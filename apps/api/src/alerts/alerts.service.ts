// CAT-070 … CAT-072 (alert created from the catalogue, without an account: inactive until the link of C_ALERT_CONFIRM),
// SFA-035 (EP-26: confirm, extend, manage, stop through a link), AUT-061 (lifetime). State of a `SearchAlert`:
//   PENDING   confirmedAt null, not deactivated               — waits for its confirmation link (7 days)
//   ACTIVE    isActive, confirmed                             — sends (AUT-060)
//   PAUSED    confirmed, not active, deactivatedReason null   — « Mettre en pause »: sends nothing, its life goes on
//   EXPIRED   deactivatedReason EXPIRED (or BOUNCE, ADMIN)    — « Prolonger » reactivates it
//   stopped   deactivatedReason USER                          — « Supprimer l'alerte »: the link is dead (410); within
//             10 minutes « Annuler » restores it (TRV-081); the daily job removes it after 30 days.
// Signed-in clients (« active tout de suite », CAT-071) come with the client space: this file serves the public side.
import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  ALERT_CONFIRM_DAYS,
  ALERTS_MAX_ACTIVE,
  ErrorCode,
  alertCriteriaOf,
  createAlertSchema,
  criteriaToSearch,
  linkRequestSchema,
  parseCatalogueCriteria,
  patchAlertSchema,
  type AlertActionResult,
  type AlertState,
  type AlertView,
  type CatalogueCriteria,
  type CreateAlertResult,
} from '@dp/contracts';
import type { SearchAlert } from '../generated/prisma/client.js';
import { ENV, type Env } from '../config/env.js';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { alertManageToken, tokenSha256, verifyAlertToken, type AlertLinkPurpose } from '../communication/link-tokens.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { newId } from '../platform/ids.js';
import { OutboxWriter } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp, RateLimiter } from '../platform/rate-limit.js';
import { SettingsService } from '../platform/settings.service.js';
import { isUniqueViolation, type Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { alertLabel, type LabelNames } from './alert-label.js';

/** SEC-070 — alerts: 10 per IP and per hour. */
const ALERT_RATE = { limit: 10, windowSeconds: 3600 };
/** TRV-081 — « Annuler » after a stop. */
export const RESTORE_WINDOW_MS = 10 * 60_000;
/** Unconfirmed alerts kept per address: beyond, no new confirmation e-mail is sent (a form cannot flood a box). */
const PENDING_MAX = 10;

/**
 * Not stopped by its owner. Written with an explicit `null` branch: `NOT: { deactivatedReason: 'USER' }` would also
 * drop every row whose reason is NULL (SQL three-valued logic), i.e. all live alerts.
 */
export const NOT_STOPPED = { OR: [{ deactivatedReason: null }, { deactivatedReason: { not: 'USER' as const } }] };

export function alertState(a: Pick<SearchAlert, 'isActive' | 'confirmedAt' | 'deactivatedReason'>): AlertState | 'STOPPED' {
  if (a.deactivatedReason === 'USER') return 'STOPPED';
  if (a.deactivatedReason) return 'EXPIRED';
  if (!a.confirmedAt) return 'PENDING';
  return a.isActive ? 'ACTIVE' : 'PAUSED';
}

/** « a•••@exemple.fr » — the page never shows the address in full (TRV-053 spirit: no address readable by a passer-by). */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}•••@${domain}`;
}

const canonical = (c: CatalogueCriteria) => criteriaToSearch(c);

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly outbox: OutboxWriter,
    private readonly idempotency: IdempotencyService,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
    private readonly index: CatalogueIndex,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async featureOn(): Promise<void> {
    if (!(await this.settings.get('features.searchAlerts'))) throw new AppError(ErrorCode.NOT_FOUND, { reason: 'FEATURE_DISABLED' });
  }

  /** Names of the criteria for the label (CAT-022). */
  async names(c: CatalogueCriteria): Promise<LabelNames> {
    const [regions, cities, promoters] = await Promise.all([
      c.region?.length ? this.prisma.region.findMany({ where: { slug: { in: c.region } }, select: { slug: true, nameFr: true } }) : [],
      c.city?.length ? this.prisma.city.findMany({ where: { slug: { in: c.city } }, select: { slug: true, nameFr: true } }) : [],
      c.promoter?.length ? this.prisma.promoter.findMany({ where: { slug: { in: c.promoter } }, select: { slug: true, brandName: true, legalName: true } }) : [],
    ]);
    return {
      regions: new Map(regions.map((r) => [r.slug, r.nameFr])),
      cities: new Map(cities.map((r) => [r.slug, r.nameFr])),
      promoters: new Map(promoters.map((p) => [p.slug, p.brandName ?? p.legalName])),
    };
  }

  async labelOf(c: CatalogueCriteria): Promise<string> {
    const [names, prefix, today] = await Promise.all([this.names(c), this.settings.get('display.roomsPrefix'), this.index.today()]);
    return alertLabel(c, names, prefix, Number(today.slice(0, 4)));
  }

  // ---------- CAT-070 … CAT-072 — creation ----------

  /**
   * CAT-071 — `client`: the signed-in client (session), whose alert is active at once, on the account's address and
   * linked to his record; no confirmation e-mail. Without a session: inactive until the link of `C_ALERT_CONFIRM`.
   */
  async create(req: Request, body: unknown, client: { clientId: string; email: string } | null = null): Promise<{ status: number; body: CreateAlertResult }> {
    await this.featureOn();
    const input = parseOrThrow(createAlertSchema, client ? { ...(body as object), email: client.email } : body);
    const email = input.email.trim().toLowerCase();
    const year = Number((await this.index.today()).slice(0, 4));
    const criteria = alertCriteriaOf(parseCatalogueCriteria(input.criteria, year));
    const key = canonical(criteria);
    const result = await this.idempotency.run<{ label: string; lifetimeDays: number }, CreateAlertResult>(
      req,
      { route: 'public.alerts' },
      {
        prepare: async () => {
          const wait = this.limiter.hit(`alert:${this.ip.hash(req)}`, ALERT_RATE);
          if (wait) throw AppError.rateLimited(wait);
          return { label: await this.labelOf(criteria), lifetimeDays: await this.settings.get('alerts.lifetimeDays') };
        },
        execute: async (tx, prepared) => {
          const now = this.clock.now();
          const mine = await tx.searchAlert.findMany({
            where: { email, frequency: { not: 'NONE' }, AND: [NOT_STOPPED] },
            orderBy: { createdAt: 'desc' },
          });
          const same = mine.filter((a) => canonical(a.criteria as CatalogueCriteria) === key);
          // CAT-072 — same criteria and same address as an ACTIVE alert: no duplicate.
          if (same.some((a) => alertState(a) === 'ACTIVE' || alertState(a) === 'PAUSED')) return { outcome: 'ALREADY_EXISTS' };
          // CAT-072 — an unconfirmed one: the confirmation leaves again, without saying it existed (TRV-112).
          const pending = same.find((a) => alertState(a) === 'PENDING');
          if (pending && client) {
            // signed in: the address is proven, the pending alert becomes active (CAT-071)
            await tx.searchAlert.update({ where: { id: pending.id }, data: { frequency: input.frequency, clientId: client.clientId, isActive: true, confirmedAt: now, updatedAt: now } });
            await this.outbox.add(tx, { type: 'alert.confirmed', aggregateType: 'SearchAlert', aggregateId: pending.id, payload: {} }, now);
            return { outcome: 'ACTIVE' };
          }
          if (pending) {
            await tx.searchAlert.update({ where: { id: pending.id }, data: { frequency: input.frequency, updatedAt: now } });
            await this.outbox.add(tx, { type: 'alert.confirmation_requested', aggregateType: 'SearchAlert', aggregateId: pending.id, payload: {} }, now);
            return { outcome: 'CONFIRMATION_SENT' };
          }
          // An expired one with the same criteria is reactivated by a new confirmation rather than doubled.
          const expired = same.find((a) => alertState(a) === 'EXPIRED');
          // CAT-072 — ten alerts that send, for this address (saved searches do not count, Q-051).
          if (mine.filter((a) => alertState(a) === 'ACTIVE').length >= ALERTS_MAX_ACTIVE) throw AppError.conflictState('ALERT_LIMIT', { n: ALERTS_MAX_ACTIVE });
          if (mine.filter((a) => alertState(a) === 'PENDING').length >= PENDING_MAX) return { outcome: 'CONFIRMATION_SENT' };
          const expiresAt = new Date(now.getTime() + prepared.lifetimeDays * 86_400_000);
          let id: string;
          if (expired) {
            id = expired.id;
            await tx.searchAlert.update({
              where: { id },
              data: {
                frequency: input.frequency,
                isActive: Boolean(client),
                confirmedAt: client ? now : null,
                ...(client ? { clientId: client.clientId } : {}),
                deactivatedAt: null,
                deactivatedReason: null,
                expiryNoticeSentAt: null,
                expiresAt,
                updatedAt: now,
              },
            });
          } else {
            id = newId();
            await tx.searchAlert.create({
              data: {
                id,
                clientId: client?.clientId ?? null,
                email,
                label: prepared.label,
                criteria: criteria as never,
                frequency: input.frequency,
                isActive: Boolean(client),
                confirmedAt: client ? now : null,
                unsubscribeTokenHash: tokenSha256(alertManageToken(this.env.LINK_SIGNING_KEY, id)),
                expiresAt,
                createdAt: now,
                updatedAt: now,
              },
            });
          }
          if (client) {
            await this.outbox.add(tx, { type: 'alert.confirmed', aggregateType: 'SearchAlert', aggregateId: id, payload: { signedIn: true } }, now);
            return { outcome: 'ACTIVE' };
          }
          await this.outbox.add(tx, { type: 'alert.created', aggregateType: 'SearchAlert', aggregateId: id, payload: { frequency: input.frequency } }, now);
          return { outcome: 'CONFIRMATION_SENT' };
        },
        status: 201,
      },
    );
    return { status: result.status, body: result.body };
  }

  // ---------- EP-26 — the page with a token ----------

  /** Resolves a link: unknown, forged, expired or stopped → 410 « Ce lien a expiré ou a déjà été utilisé. » */
  private async resolve(token: string, allowed: AlertLinkPurpose[], db: Tx | PrismaService = this.prisma): Promise<{ alert: SearchAlert; purpose: AlertLinkPurpose }> {
    const check = verifyAlertToken(this.env.LINK_SIGNING_KEY, token, this.clock.now());
    if (!check.ok || !allowed.includes(check.purpose)) throw new AppError(ErrorCode.GONE, { reason: 'LINK_EXPIRED' });
    const alert = await db.searchAlert.findUnique({ where: { id: check.alertId } });
    if (!alert) throw new AppError(ErrorCode.GONE, { reason: 'LINK_EXPIRED' });
    // The management token is checked against the stored hash as well (a re-keyed alert loses its old links).
    if (check.purpose === 'manage' && alert.unsubscribeTokenHash !== tokenSha256(token)) throw new AppError(ErrorCode.GONE, { reason: 'LINK_EXPIRED' });
    return { alert, purpose: check.purpose };
  }

  async toView(alert: SearchAlert): Promise<AlertView> {
    const state = alertState(alert);
    const criteria = (alert.criteria ?? {}) as CatalogueCriteria;
    const hasAccount = alert.clientId ? Boolean(await this.prisma.client.findFirst({ where: { id: alert.clientId, userId: { not: null } }, select: { id: true } })) : false;
    return {
      token: alertManageToken(this.env.LINK_SIGNING_KEY, alert.id),
      label: alert.label ?? (await this.labelOf(criteria)),
      criteria,
      resultsPath: `/programmes${criteriaToSearch(criteria)}`,
      frequency: alert.frequency === 'NONE' ? 'DAILY' : alert.frequency,
      state: state === 'STOPPED' ? 'EXPIRED' : state,
      emailMasked: maskEmail(alert.email),
      expiresAt: alert.expiresAt.toISOString(),
      pausedAt: state === 'PAUSED' && alert.deactivatedAt ? alert.deactivatedAt.toISOString() : null,
      lastSentAt: alert.lastSentAt?.toISOString() ?? null,
      hasAccount,
    };
  }

  async view(token: string): Promise<AlertView> {
    const { alert } = await this.resolve(token, ['manage', 'confirm', 'extend']);
    if (alertState(alert) === 'STOPPED') throw new AppError(ErrorCode.GONE, { reason: 'LINK_EXPIRED' });
    return this.toView(alert);
  }

  /** SFA-035 « Confirmation » — activates the alert. Called by the page in the browser (a mail scanner does not run it). */
  async confirm(token: string): Promise<AlertActionResult> {
    await this.featureOn();
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const { alert } = await this.resolve(token, ['confirm', 'manage'], tx);
      const state = alertState(alert);
      if (state === 'STOPPED') throw new AppError(ErrorCode.GONE, { reason: 'LINK_EXPIRED' });
      if (state !== 'PENDING') return { view: await this.toView(alert), done: 'ALREADY_CONFIRMED' as const };
      const updated = await tx.searchAlert.update({ where: { id: alert.id }, data: { isActive: true, confirmedAt: now, updatedAt: now } });
      await this.outbox.add(tx, { type: 'alert.confirmed', aggregateType: 'SearchAlert', aggregateId: alert.id, payload: {} }, now);
      return { view: await this.toView(updated), done: 'CONFIRMED' as const };
    });
  }

  /** SFA-035 « Prolongation », AUT-061 — the alert lives `alerts.lifetimeDays` more days from now; an expired one wakes up. */
  async extend(token: string): Promise<AlertActionResult> {
    await this.featureOn();
    const now = this.clock.now();
    const days = await this.settings.get('alerts.lifetimeDays');
    return this.prisma.$transaction(async (tx) => {
      const { alert } = await this.resolve(token, ['extend', 'manage'], tx);
      const state = alertState(alert);
      if (state === 'STOPPED' || state === 'PENDING') throw new AppError(ErrorCode.GONE, { reason: 'LINK_EXPIRED' });
      const expiresAt = new Date(now.getTime() + days * 86_400_000);
      const wake = state === 'EXPIRED' ? { isActive: true, deactivatedAt: null, deactivatedReason: null } : {};
      const updated = await tx.searchAlert.update({ where: { id: alert.id }, data: { expiresAt, expiryNoticeSentAt: null, ...wake, updatedAt: now } });
      return { view: await this.toView(updated), done: 'EXTENDED' as const };
    });
  }

  /** SFA-035 « Gestion » — frequency, pause, « Annuler » after a stop. Saved at once (« Préférence enregistrée. »). */
  async patch(token: string, body: unknown): Promise<AlertActionResult> {
    const input = parseOrThrow(patchAlertSchema, body);
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const { alert } = await this.resolve(token, ['manage'], tx);
      const state = alertState(alert);
      if ('restore' in input) {
        if (state !== 'STOPPED' || !alert.deactivatedAt || now.getTime() - alert.deactivatedAt.getTime() > RESTORE_WINDOW_MS) {
          throw new AppError(ErrorCode.GONE, { reason: 'LINK_EXPIRED' });
        }
        const updated = await tx.searchAlert.update({
          where: { id: alert.id },
          data: { isActive: Boolean(alert.confirmedAt) && alert.expiresAt > now, deactivatedAt: null, deactivatedReason: alert.expiresAt > now ? null : 'EXPIRED', updatedAt: now },
        });
        return { view: await this.toView(updated), done: 'RESTORED' as const };
      }
      if (state === 'STOPPED') throw new AppError(ErrorCode.GONE, { reason: 'LINK_EXPIRED' });
      if ('frequency' in input) {
        const updated = await tx.searchAlert.update({ where: { id: alert.id }, data: { frequency: input.frequency, updatedAt: now } });
        return { view: await this.toView(updated), done: 'SAVED' as const };
      }
      // Pause or resume — only a confirmed alert that has not expired.
      if (state !== 'ACTIVE' && state !== 'PAUSED') throw AppError.conflictState('ALERT_NOT_ACTIVE');
      const updated = await tx.searchAlert.update({
        where: { id: alert.id },
        data: input.paused ? { isActive: false, deactivatedAt: now, deactivatedReason: null, updatedAt: now } : { isActive: true, deactivatedAt: null, updatedAt: now },
      });
      return { view: await this.toView(updated), done: 'SAVED' as const };
    });
  }

  /**
   * « Supprimer l'alerte » (SFA-035) and the one-click stop of NOT-022: works even with the feature off or in
   * maintenance (PAR-011, NAV-061). Answers the same when already stopped.
   */
  async stop(token: string): Promise<{ done: 'STOPPED' }> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const { alert } = await this.resolve(token, ['manage', 'stop'], tx);
      if (alertState(alert) === 'STOPPED') return;
      await tx.searchAlert.update({ where: { id: alert.id }, data: { isActive: false, deactivatedAt: now, deactivatedReason: 'USER', updatedAt: now } });
    });
    return { done: 'STOPPED' };
  }

  /** SFA-035 « Recevoir un nouveau lien » — same answer for every address (TRV-112); the e-mail leaves from the outbox. */
  async requestLinks(req: Request, body: unknown): Promise<Record<string, never>> {
    const { email: raw } = parseOrThrow(linkRequestSchema, body);
    const wait = this.limiter.hit(`alert-link:${this.ip.hash(req)}`, ALERT_RATE);
    if (wait) throw AppError.rateLimited(wait);
    const email = raw.trim().toLowerCase();
    const now = this.clock.now();
    const alerts = await this.prisma.searchAlert.findMany({
      where: { email, frequency: { not: 'NONE' }, AND: [NOT_STOPPED] },
      orderBy: { createdAt: 'desc' },
      select: { id: true, isActive: true, confirmedAt: true, deactivatedReason: true },
    });
    if (alerts.length) {
      await this.prisma.$transaction(async (tx) => {
        const pending = alerts.find((a) => alertState(a) === 'PENDING');
        if (pending) await this.outbox.add(tx, { type: 'alert.confirmation_requested', aggregateType: 'SearchAlert', aggregateId: pending.id, payload: {} }, now);
        const others = alerts.filter((a) => alertState(a) !== 'PENDING');
        if (others.length) {
          await this.outbox.add(
            tx,
            // One e-mail for the address, listing its alerts (C_ALERT_MANAGE); keyed by the day: one request per day is enough.
            { type: 'alert.links_requested', aggregateType: 'SearchAlert', aggregateId: others[0]!.id, payload: { alertIds: others.map((a) => a.id) }, dedupeKey: `alert.links_requested:${others[0]!.id}:${now.toISOString().slice(0, 10)}` },
            now,
          );
        }
      }).catch((err: unknown) => {
        // The day's key already exists: the e-mail already left today; the answer stays the same.
        if (!isUniqueViolation(err)) throw err;
      });
    }
    return {};
  }
}

export const confirmLinkDays = ALERT_CONFIRM_DAYS;
