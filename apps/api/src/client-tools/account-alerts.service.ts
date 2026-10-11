// EC-42 (SFA-030, SFA-031) and CAT-093 — the alerts and saved searches of an account. The page lists the alerts of the
// client, including those created without an account at the same address (the address of a signed-in account is proven:
// acting on one attaches it to the record). A saved search is a `SearchAlert` of frequency NONE: it sends nothing,
// never expires, has its own limit of twenty (Q-051) and does not count among the ten active alerts (CAT-072).
// Presentation keys (`sort`, `page`, `availability`, `vue`, `groupe`, `bbox`) are never stored (Q-055).
import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  ALERTS_MAX_ACTIVE,
  ErrorCode,
  SAVED_SEARCHES_MAX,
  alertCriteriaOf,
  createAccountAlertSchema,
  criteriaToSearch,
  parseCatalogueCriteria,
  patchAccountAlertSchema,
  type AccountAlert,
  type AccountAlertsResponse,
  type CatalogueCriteria,
  type CreateAccountAlertResult,
} from '@dp/contracts';
import type { SearchAlert } from '../generated/prisma/client.js';
import { alertState, AlertsService, NOT_STOPPED } from '../alerts/alerts.service.js';
import { ENV, type Env } from '../config/env.js';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { alertManageToken, tokenSha256 } from '../communication/link-tokens.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { OutboxWriter } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';

const DAY = 86_400_000;
const canonical = (c: CatalogueCriteria) => criteriaToSearch(alertCriteriaOf(c));

@Injectable()
export class AccountAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly alerts: AlertsService,
    private readonly index: CatalogueIndex,
    private readonly outbox: OutboxWriter,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async featureOn(): Promise<void> {
    if (!(await this.settings.get('features.searchAlerts'))) throw new AppError(ErrorCode.NOT_FOUND, { reason: 'FEATURE_DISABLED' });
  }

  private clientIdOf(ctx: AuthContext): string {
    if (!ctx.clientId) throw AppError.notFound();
    return ctx.clientId;
  }

  /** SFA-030 — the client's alerts and those of his address; never the ones he stopped through a link (being purged). */
  private mine(ctx: AuthContext) {
    return { OR: [{ clientId: this.clientIdOf(ctx) }, { email: ctx.email.toLowerCase() }], AND: [NOT_STOPPED] };
  }

  private async criteriaOf(raw: Record<string, string>): Promise<CatalogueCriteria> {
    const year = Number((await this.index.today()).slice(0, 4));
    return alertCriteriaOf(parseCatalogueCriteria(raw, year));
  }

  toAccountAlert(a: SearchAlert): AccountAlert {
    const criteria = (a.criteria ?? {}) as CatalogueCriteria;
    const search = a.frequency === 'NONE';
    const state = alertState(a);
    return {
      id: a.id,
      kind: search ? 'SEARCH' : 'ALERT',
      label: a.label ?? '',
      criteria,
      resultsPath: `/programmes${criteriaToSearch(criteria)}`,
      frequency: search ? null : (a.frequency as AccountAlert['frequency']),
      state: search ? 'ACTIVE' : state === 'STOPPED' ? 'EXPIRED' : state,
      expiresAt: search ? null : a.expiresAt.toISOString(),
      pausedAt: !search && state === 'PAUSED' && a.deactivatedAt ? a.deactivatedAt.toISOString() : null,
      lastSentAt: a.lastSentAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    };
  }

  async list(ctx: AuthContext): Promise<AccountAlertsResponse> {
    await this.featureOn();
    const rows = await this.prisma.searchAlert.findMany({ where: this.mine(ctx), orderBy: { createdAt: 'desc' } });
    return {
      alerts: rows.filter((a) => a.frequency !== 'NONE').map((a) => this.toAccountAlert(a)),
      searches: rows.filter((a) => a.frequency === 'NONE').map((a) => this.toAccountAlert(a)),
      limits: { alerts: ALERTS_MAX_ACTIVE, searches: SAVED_SEARCHES_MAX, lifetimeDays: await this.settings.get('alerts.lifetimeDays') },
    };
  }

  /** CAT-072 — ten alerts that send per address (ACTIVE ones), checked inside the writing transaction. */
  private async assertAlertRoom(tx: Tx, email: string, exceptId: string | null): Promise<void> {
    const rows = await tx.searchAlert.findMany({ where: { email, frequency: { not: 'NONE' }, AND: [NOT_STOPPED] } });
    if (rows.filter((a) => a.id !== exceptId && alertState(a) === 'ACTIVE').length >= ALERTS_MAX_ACTIVE) throw AppError.conflictState('ALERT_LIMIT', { n: ALERTS_MAX_ACTIVE });
  }

  /**
   * CAT-093 « Enregistrer cette recherche » (frequency NONE), or CAT-070 for a signed-in client (active at once,
   * CAT-071 — the creation of `AlertsService`, with its idempotency key and duplicates rules).
   */
  async create(req: Request, ctx: AuthContext, body: unknown): Promise<{ status: number; body: CreateAccountAlertResult }> {
    await this.featureOn();
    const clientId = this.clientIdOf(ctx);
    const input = parseOrThrow(createAccountAlertSchema, body ?? {});
    const criteria = await this.criteriaOf(input.criteria);
    const key = canonical(criteria);
    const email = ctx.email.toLowerCase();
    if (input.frequency !== 'NONE') {
      const r = await this.alerts.create(req, { frequency: input.frequency, criteria: input.criteria }, { clientId, email });
      const rows = await this.prisma.searchAlert.findMany({ where: { email, frequency: { not: 'NONE' }, AND: [NOT_STOPPED] }, orderBy: { updatedAt: 'desc' } });
      const alert = rows.find((a) => canonical(a.criteria as CatalogueCriteria) === key);
      if (!alert) throw AppError.notFound();
      return { status: r.status, body: { outcome: r.body.outcome === 'ALREADY_EXISTS' ? 'ALREADY_EXISTS' : 'ACTIVE', alert: this.toAccountAlert(alert) } };
    }
    const label = await this.alerts.labelOf(criteria);
    const now = this.clock.now();
    const days = await this.settings.get('alerts.lifetimeDays');
    return this.prisma.$transaction(async (tx) => {
      const searches = await tx.searchAlert.findMany({ where: { OR: [{ clientId }, { email }], frequency: 'NONE', AND: [NOT_STOPPED] } });
      const same = searches.find((a) => canonical(a.criteria as CatalogueCriteria) === key);
      if (same) return { status: 200, body: { outcome: 'ALREADY_EXISTS' as const, alert: this.toAccountAlert(same) } };
      if (searches.length >= SAVED_SEARCHES_MAX) throw AppError.conflictState('SEARCH_LIMIT', { n: SAVED_SEARCHES_MAX });
      const id = newId();
      const created = await tx.searchAlert.create({
        data: {
          id,
          clientId,
          email,
          label,
          criteria: criteria as never,
          frequency: 'NONE',
          isActive: true,
          confirmedAt: now,
          unsubscribeTokenHash: tokenSha256(alertManageToken(this.env.LINK_SIGNING_KEY, id)),
          // Required column; a saved search does not expire (the jobs ignore frequency NONE).
          expiresAt: new Date(now.getTime() + days * DAY),
          createdAt: now,
          updatedAt: now,
        },
      });
      return { status: 201, body: { outcome: 'SAVED' as const, alert: this.toAccountAlert(created) } };
    });
  }

  /** SFA-031 / CAT-093 actions. Acting on an alert of the same address attaches it to the record. */
  async patch(ctx: AuthContext, id: string, body: unknown): Promise<AccountAlert> {
    await this.featureOn();
    const clientId = this.clientIdOf(ctx);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw AppError.notFound();
    const input = parseOrThrow(patchAccountAlertSchema, body ?? {});
    const now = this.clock.now();
    const days = await this.settings.get('alerts.lifetimeDays');
    const life = new Date(now.getTime() + days * DAY);
    const label = 'criteria' in input ? await this.alerts.labelOf(await this.criteriaOf(input.criteria)) : null;
    const criteria = 'criteria' in input ? await this.criteriaOf(input.criteria) : null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const a = await tx.searchAlert.findFirst({ where: { id, ...this.mine(ctx) } });
      if (!a) throw AppError.notFound();
      const state = alertState(a);
      const base = { clientId, updatedAt: now };
      if ('label' in input) return tx.searchAlert.update({ where: { id }, data: { ...base, label: input.label } });
      if (criteria) return tx.searchAlert.update({ where: { id }, data: { ...base, criteria: criteria as never, label } });
      if ('frequency' in input) {
        if (a.frequency === 'NONE') {
          // CAT-093 « Recevoir les nouveautés » — the search becomes an alert (CAT-070), refused at ten active alerts.
          await this.assertAlertRoom(tx, a.email, a.id);
          const row = await tx.searchAlert.update({
            where: { id },
            data: { ...base, frequency: input.frequency, isActive: true, confirmedAt: a.confirmedAt ?? now, expiresAt: life, deactivatedAt: null, deactivatedReason: null, expiryNoticeSentAt: null, lastSentAt: now },
          });
          await this.outbox.add(tx, { type: 'alert.confirmed', aggregateType: 'SearchAlert', aggregateId: id, payload: { signedIn: true, fromSearch: true } }, now);
          return row;
        }
        return tx.searchAlert.update({ where: { id }, data: { ...base, frequency: input.frequency } });
      }
      if (a.frequency === 'NONE') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      if ('paused' in input) {
        if (state !== 'ACTIVE' && state !== 'PAUSED') throw AppError.conflictState('ALERT_NOT_ACTIVE');
        if (!input.paused && state === 'PAUSED') await this.assertAlertRoom(tx, a.email, a.id);
        return tx.searchAlert.update({
          where: { id },
          data: input.paused ? { ...base, isActive: false, deactivatedAt: now, deactivatedReason: null } : { ...base, isActive: true, deactivatedAt: null },
        });
      }
      if ('extend' in input) {
        // AUT-061 « Prolonger » — `alerts.lifetimeDays` more days from now; reactivates an expired alert.
        if (state === 'EXPIRED') await this.assertAlertRoom(tx, a.email, a.id);
        const wake = state === 'EXPIRED' ? { isActive: true, deactivatedAt: null, deactivatedReason: null, confirmedAt: a.confirmedAt ?? now } : {};
        return tx.searchAlert.update({ where: { id }, data: { ...base, expiresAt: life, expiryNoticeSentAt: null, ...wake } });
      }
      // confirm — an alert made without an account, waiting for its link: the signed-in account proves the address.
      if (state !== 'PENDING') return a;
      await this.assertAlertRoom(tx, a.email, a.id);
      const row = await tx.searchAlert.update({ where: { id }, data: { ...base, isActive: true, confirmedAt: now } });
      await this.outbox.add(tx, { type: 'alert.confirmed', aggregateType: 'SearchAlert', aggregateId: id, payload: { signedIn: true } }, now);
      return row;
    });
    return this.toAccountAlert(updated);
  }

  /** SFA-031 « Supprimer » — after confirmation on the screen; definitive (its deliveries go with it). */
  async remove(ctx: AuthContext, id: string): Promise<void> {
    await this.featureOn();
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw AppError.notFound();
    const done = await this.prisma.searchAlert.deleteMany({ where: { id, ...this.mine(ctx) } });
    if (!done.count) throw AppError.notFound();
  }
}
