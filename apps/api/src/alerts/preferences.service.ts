// NOT-020 … NOT-022, PRO-030, PRO-031 — e-mail preferences without signing in (EP-27, `/preferences/{jeton}`) and the
// one-click unsubscription (`POST /public/unsubscribe/{jeton}`, RFC 8058). Preferences belong to the client RECORD
// (`NotificationPreference.clientId`), not to an account; the token dies with a change of address or the erasure of the
// record (410, « Recevoir un nouveau lien »). Turning « Actualités » on or off writes a `Consent` (MARKETING_EMAIL).
// These routes keep working in maintenance and with any feature off (NAV-061, PAR-011): one can always say no.
import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  CLIENT_PREFERENCE_GROUPS,
  ErrorCode,
  linkRequestSchema,
  patchPreferencesSchema,
  type ClientPreferenceGroup,
  type PreferencesView,
  type UnsubscribeResult,
} from '@dp/contracts';
import { createTranslator } from '@dp/i18n';
import { ENV, type Env } from '../config/env.js';
import { emailPrint, verifyAlertToken, verifyPreferencesToken } from '../communication/link-tokens.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { OutboxWriter } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp, RateLimiter } from '../platform/rate-limit.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { AlertsService, maskEmail } from './alerts.service.js';

/** PRO-031 — without an account: news, alerts, Café; with a dossier, reminders and project news too. */
const tr = createTranslator('fr');
const WITHOUT_ACCOUNT: ClientPreferenceGroup[] = ['NEWS', 'ALERTS', 'CAFE'];
const WITH_DOSSIER: ClientPreferenceGroup[] = ['REMINDERS', 'PROJECT_NEWS'];

interface Owner {
  clientId: string;
  email: string;
  communicationId: string | null;
  group: ClientPreferenceGroup;
}

@Injectable()
export class PreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly outbox: OutboxWriter,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
    private readonly alerts: AlertsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** The record a token designates — the one kept after a merge (CRM-080) — or 410. */
  private async owner(token: string): Promise<Owner> {
    const check = verifyPreferencesToken(this.env.LINK_SIGNING_KEY, token);
    if (!check.ok) throw new AppError(ErrorCode.GONE, { reason: 'LINK_EXPIRED' });
    let client = await this.prisma.client.findUnique({ where: { id: check.clientId }, select: { id: true, email: true, gdprErasedAt: true, deletedAt: true, mergedIntoId: true } });
    for (let hops = 0; client?.mergedIntoId && hops < 5; hops++) {
      client = await this.prisma.client.findUnique({ where: { id: client.mergedIntoId }, select: { id: true, email: true, gdprErasedAt: true, deletedAt: true, mergedIntoId: true } });
    }
    if (!client || !client.email || client.gdprErasedAt || client.deletedAt) throw new AppError(ErrorCode.GONE, { reason: 'LINK_EXPIRED' });
    // The address of the record changed since the e-mail: the token is revoked (PRO-031). A merge keeps it valid.
    if (client.id === check.clientId && emailPrint(client.email) !== check.emailPrint) throw new AppError(ErrorCode.GONE, { reason: 'LINK_EXPIRED' });
    return { clientId: client.id, email: client.email, communicationId: check.communicationId, group: check.group };
  }

  private async values(clientId: string): Promise<Map<ClientPreferenceGroup, boolean>> {
    const [client, rows] = await Promise.all([
      this.prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { marketingOptIn: true } }),
      this.prisma.notificationPreference.findMany({ where: { clientId }, orderBy: { updatedAt: 'asc' }, select: { group: true, emailEnabled: true } }),
    ]);
    const out = new Map<ClientPreferenceGroup, boolean>(CLIENT_PREFERENCE_GROUPS.map((g) => [g, g === 'NEWS' ? client.marketingOptIn : true]));
    for (const r of rows) if ((CLIENT_PREFERENCE_GROUPS as readonly string[]).includes(r.group)) out.set(r.group as ClientPreferenceGroup, r.emailEnabled);
    return out;
  }

  private async viewOf(o: Owner): Promise<PreferencesView> {
    const [client, dossier, values] = await Promise.all([
      this.prisma.client.findUniqueOrThrow({ where: { id: o.clientId }, select: { user: { select: { status: true } } } }),
      this.prisma.dossier.findFirst({ where: { clientId: o.clientId, deletedAt: null }, select: { id: true } }),
      this.values(o.clientId),
    ]);
    const hasAccount = Boolean(client.user && client.user.status !== 'DELETED');
    const shown = hasAccount ? [...CLIENT_PREFERENCE_GROUPS] : CLIENT_PREFERENCE_GROUPS.filter((g) => WITHOUT_ACCOUNT.includes(g) || (dossier && WITH_DOSSIER.includes(g)));
    return { emailMasked: maskEmail(o.email), groups: shown.map((group) => ({ group, emailEnabled: values.get(group)! })), hasAccount };
  }

  async view(token: string): Promise<PreferencesView> {
    return this.viewOf(await this.owner(token));
  }

  async patch(req: Request, token: string, body: unknown): Promise<PreferencesView> {
    const input = parseOrThrow(patchPreferencesSchema, body);
    const o = await this.owner(token);
    const changes: [ClientPreferenceGroup, boolean][] = 'essentialOnly' in input ? CLIENT_PREFERENCE_GROUPS.map((g) => [g, false]) : [[input.group, input.emailEnabled]];
    await this.prisma.$transaction(async (tx) => {
      for (const [group, enabled] of changes) await this.set(tx, req, o, group, enabled, 'preferences:page');
    });
    return this.viewOf(o);
  }

  /** NOT-022 — one click cuts the group of the e-mail; an alert's own link stops that alert. 200 even when already done. */
  async unsubscribe(req: Request, token: string): Promise<UnsubscribeResult> {
    if (token.startsWith('a')) {
      const check = verifyAlertToken(this.env.LINK_SIGNING_KEY, token, this.clock.now());
      if (!check.ok || (check.purpose !== 'stop' && check.purpose !== 'manage')) throw new AppError(ErrorCode.GONE, { reason: 'LINK_EXPIRED' });
      await this.alerts.stop(token);
      return { kind: 'ALERT', group: null };
    }
    const o = await this.owner(token);
    await this.prisma.$transaction((tx) => this.set(tx, req, o, o.group, false, 'preferences:unsubscribe'));
    return { kind: 'GROUP', group: o.group };
  }

  /** Writes one switch; for NEWS, the consent line (with the e-mail of origin when known) and the record's cache. */
  private async set(tx: Tx, req: Request, o: Owner, group: ClientPreferenceGroup, enabled: boolean, source: string): Promise<void> {
    const now = this.clock.now();
    const current = await tx.notificationPreference.findFirst({ where: { clientId: o.clientId, group }, orderBy: { updatedAt: 'desc' }, select: { id: true, emailEnabled: true } });
    if (current) {
      if (current.emailEnabled !== enabled) await tx.notificationPreference.update({ where: { id: current.id }, data: { emailEnabled: enabled, updatedAt: now } });
    } else {
      await tx.notificationPreference.create({ data: { id: newId(), clientId: o.clientId, group, emailEnabled: enabled, pushEnabled: false, createdAt: now, updatedAt: now } });
    }
    if (group !== 'NEWS') return;
    const client = await tx.client.findUniqueOrThrow({ where: { id: o.clientId }, select: { marketingOptIn: true } });
    if (client.marketingOptIn === enabled) return;
    const communication = o.communicationId ? await tx.communication.findUnique({ where: { id: o.communicationId }, select: { id: true } }) : null;
    await tx.consent.create({
      data: {
        id: newId(),
        type: 'MARKETING_EMAIL',
        granted: enabled,
        clientId: o.clientId,
        source,
        // MOD-106 — the proof keeps the very words of the switch the person used (PRO-030).
        wording: `${tr('ui.preferences.groups.NEWS.label')} — ${tr('ui.preferences.groups.NEWS.text')} (${enabled ? tr('ui.preferences.page.on') : tr('ui.preferences.page.off')})`,
        sourceCommunicationId: source === 'preferences:unsubscribe' ? (communication?.id ?? null) : null,
        givenAt: now,
        ipHash: this.ip.fingerprint(req),
        userAgent: (req.headers['user-agent'] ?? '').slice(0, 400) || null,
        createdAt: now,
      },
    });
    await tx.client.update({ where: { id: o.clientId }, data: { marketingOptIn: enabled, updatedAt: now } });
    await this.outbox.add(tx, { type: 'consent.changed', aggregateType: 'Client', aggregateId: o.clientId, payload: { type: 'MARKETING_EMAIL', granted: enabled, by: 'CLIENT', dossierId: null } }, now);
  }

  /** PRO-031 « Recevoir un nouveau lien » — same answer whatever the address (TRV-112). */
  async requestLink(req: Request, body: unknown): Promise<Record<string, never>> {
    const { email: raw } = parseOrThrow(linkRequestSchema, body);
    const wait = this.limiter.hit(`pref-link:${this.ip.hash(req)}`, { limit: 10, windowSeconds: 3600 });
    if (wait) throw AppError.rateLimited(wait);
    const email = raw.trim().toLowerCase();
    const client = await this.prisma.client.findFirst({ where: { email, deletedAt: null, gdprErasedAt: null, mergedIntoId: null }, select: { id: true } });
    if (client) {
      const now = this.clock.now();
      await this.prisma.$transaction((tx) =>
        this.outbox.add(tx, { type: 'preferences.link_requested', aggregateType: 'Client', aggregateId: client.id, payload: {} }, now),
      );
    }
    return {};
  }
}
