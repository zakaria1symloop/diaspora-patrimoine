// ROL-012, NOT-030 `NS_TEAM_CHANGE`, 01-domaine/09 § 6.7 `S_TEAM_CHANGE` — every change of the team is told to the
// Direction: an invitation, a role, a suspension, a reactivation, a deletion, a recovery (ADM-040), a change of address,
// a second factor reset by a third party. Sent from the outbox, after the commit (AUT-003 step 2): the in-app
// notification and the e-mail each carry their key, so replaying the event tells nothing twice (FIA-041, NOT-011).
// Recipients (NOT-018): the active OWNER accounts — plus the ADMIN accounts for a recovery — never the author of the
// action, never the account the change is about.
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import { MailerService } from '../communication/mailer.service.js';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { toEnvelope } from '../automation/event-catalogue.js';
import { StaffNotifier } from '../automation/staff-notifications.service.js';
import { staffName } from './staff-view.js';

const t = createTranslator('fr');

export const TEAM_EVENT_KIND = {
  'user.invited': 'invited',
  'user.role_changed': 'roleChanged',
  'user.suspended': 'suspended',
  'user.reactivated': 'reactivated',
  'user.deleted': 'deleted',
  'user.recovered': 'recovered',
  'user.email_changed': 'emailChanged',
  'user.two_factor_changed': 'twoFactorReset',
} as const;
export type TeamEventType = keyof typeof TEAM_EVENT_KIND;
export type TeamChangeKind = (typeof TEAM_EVENT_KIND)[TeamEventType];

/** The key of the e-mail of one event for one address (shared with the operations command, which may send it first). */
export function teamChangeMailKey(eventId: string, to: string): string {
  return `S_TEAM_CHANGE:${eventId}:${to}`;
}

/** NOT-030 — the title of the notification, and `action.summary` of the e-mail, for one kind of change. */
export function teamChangeTexts(kind: TeamChangeKind, actorName: string | null, targetName: string): { title: string; summary: string } {
  const author = actorName ?? t('ui.notifications.NS_TEAM_CHANGE.platform');
  const title =
    kind === 'emailChanged'
      ? t('ui.notifications.NS_TEAM_CHANGE.emailChanged', { nom: targetName })
      : t(`ui.notifications.NS_TEAM_CHANGE.${kind}`, { auteur: author, nom: targetName });
  return { title, summary: t(`ui.email.teamChange.${kind}`, { nom: targetName }) };
}

@Injectable()
export class TeamEventsHandler implements OutboxHandler, OnModuleInit {
  readonly name = 'team.notify';
  readonly types = Object.keys(TEAM_EVENT_KIND);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
    private readonly handlers: OutboxHandlers,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
  }

  async handle(event: OutboxRecord): Promise<void> {
    const kind = TEAM_EVENT_KIND[event.type as TeamEventType];
    if (!kind) return;
    const payload = event.payload as { actorId?: string | null; targetName?: string | null; byThirdParty?: boolean; kind?: string };
    const target = await this.prisma.user.findUnique({ where: { id: event.aggregateId }, select: { id: true, kind: true, firstName: true, lastName: true } });
    // ROL-012 — staff accounts only (a client's address or second factor follows other rules).
    if (!target || target.kind !== 'STAFF') return;
    if (event.type === 'user.two_factor_changed' && !payload.byThirdParty) return;
    const targetName = staffName(target) ?? payload.targetName ?? t('ui.common.deletedUser');
    const actor = payload.actorId ? await this.prisma.user.findUnique({ where: { id: payload.actorId }, select: { firstName: true, lastName: true, status: true } }) : null;
    const actorName = staffName(actor);
    const texts = teamChangeTexts(kind, actorName, targetName);

    const recipients = await this.prisma.membership.findMany({
      where: {
        revokedAt: null,
        suspendedAt: null,
        organization: { type: 'OPERATOR' },
        role: { in: kind === 'recovered' ? ['OWNER', 'ADMIN'] : ['OWNER'] },
        user: { kind: 'STAFF', status: 'ACTIVE', id: { notIn: [event.aggregateId, ...(payload.actorId ? [payload.actorId] : [])] } },
      },
      select: { user: { select: { id: true, email: true, firstName: true, timezone: true } } },
    });
    if (!recipients.length) return;

    const companyName = await this.settings.get('contact.companyName');
    const company = { name: companyName, phone: (await this.settings.get('contact.phone')) || null, email: (await this.settings.get('contact.email')) || null, siteUrl: this.env.WEB_URL };
    const now = this.clock.now();
    // NOT-035 — the writer of the automation module: one key per type, object and origin (this event).
    await new StaffNotifier().notify(this.prisma, now, {
      type: 'NS_TEAM_CHANGE',
      userIds: recipients.map((r) => r.user.id),
      title: texts.title,
      link: '/equipe',
      entityType: 'User',
      entityId: event.aggregateId,
      originId: toEnvelope(event).originId,
    });
    for (const { user } of recipients) {
      const dateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: user.timezone })
        .format(event.occurredAt)
        .replace(/(\d{1,2}):(\d{2})/, '$1 h $2');
      await this.mailer.sendTemplate({
        templateCode: 'S_TEAM_CHANGE',
        to: user.email,
        dedupeKey: teamChangeMailKey(event.id, user.email),
        triggeredBy: 'SYSTEM',
        links: { staffUserId: user.id },
        vars: {
          staff: { firstName: user.firstName },
          actor: { fullName: actorName },
          action: { summary: texts.summary, isSystem: !actorName, dateLabel, adminUrl: `${this.env.ADMIN_URL ?? this.env.WEB_URL}/equipe` },
          company,
        },
        greetingName: user.firstName,
        render: { eventId: event.id },
      });
    }
  }
}
