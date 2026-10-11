// NOT-030, NOT-035, NOT-024, NOT-025 — the notifications and the e-mails of the events of package 3.7, written from the
// outbox after the commit (AUT-003 step 2). Every effect carries its key: replaying the event writes nothing twice.
//   candidate.proposed            → NC_PROPOSAL_NEW + C_PROPOSAL_NEW (one per sending); no e-mail possible and no
//                                   active space → task « Présenter les biens proposés à {client} » (NOT-025)
//   candidate.selected            → NC_SELECTION_CONFIRMED
//   candidate.selection_declined  → NC_SELECTION_DECLINED
//   candidate.unselected          → NC_SELECTION_WITHDRAWN
//   candidate.interested/declined → NS_CANDIDATE_RESPONSE (by the client)
//   client.qualified              → NC_PROJECT_QUALIFIED
//   dossier.put_on_hold           → NC_DOSSIER_ON_HOLD (+ C_DOSSIER_ON_HOLD when « Informer le client »)
//   dossier.resumed, .reopened    → NC_DOSSIER_RESUMED
//   dossier.lost                  → NC_DOSSIER_CLOSED + C_DOSSIER_CLOSED when « Informer le client » (no address: task)
//   dossier.assigned              → NS_ASSIGNED + S_ASSIGNED (new adviser), NS_UNASSIGNED (former), C_ADVISOR_CHANGED
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator, formatMoney, hasMessage, type MessageKey } from '@dp/i18n';
import { addBusinessDays } from '@dp/domain';
import { propertiesBlock } from '../alerts/alerts-mail.handler.js';
import { SYSTEM_ACTOR } from '../admin/actor.js';
import { toEnvelope, type EventEnvelope } from '../automation/event-catalogue.js';
import { staffLink } from '../automation/staff-links.js';
import { StaffNotifier } from '../automation/staff-notifications.service.js';
import { TasksService } from '../automation/tasks.service.js';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import { notifyClient } from '../client-tools/client-notify.js';
import { advisorDisplayName } from '../client-space/timeline.js';
import { MailerService, type SuppressionReason } from '../communication/mailer.service.js';
import { ENV, type Env } from '../config/env.js';
import { ensureInvitedAccount } from '../identity/lead-account.js';
import { TokensService } from '../identity/tokens.service.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';

const t = createTranslator('fr');

const CLIENT_SELECT = {
  id: true,
  userId: true,
  email: true,
  firstName: true,
  lastName: true,
  doNotContact: true,
  emailBouncedAt: true,
  restrictedAt: true,
  restrictionReason: true,
  gdprErasedAt: true,
  deletedAt: true,
  timezone: true,
  preferredLanguage: true,
  phone: true,
  user: { select: { id: true, status: true, emailVerifiedAt: true } },
} as const;
type ClientRow = { id: string; userId: string | null; email: string | null; firstName: string | null; lastName: string | null; doNotContact: boolean; emailBouncedAt: Date | null; restrictedAt: Date | null; restrictionReason: string | null; gdprErasedAt: Date | null; deletedAt: Date | null; timezone: string | null; preferredLanguage: 'fr' | 'ar' | 'en'; phone: string | null; user: { id: string; status: string; emailVerifiedAt: Date | null } | null };

/**
 * AUT-007, applied to the e-mails of an event: what stops an e-mail to this client. `ERASED` writes nothing at all. A
 * service e-mail (no preference group) of a dossier in progress still reaches a client who asked not to be contacted.
 */
export function eventMailStop(c: Pick<ClientRow, 'email' | 'doNotContact' | 'emailBouncedAt' | 'restrictedAt' | 'gdprErasedAt' | 'deletedAt'>, opts: { service: boolean; dossierLive: boolean }): keyof typeof SuppressionReason | 'ERASED' | null {
  if (c.gdprErasedAt || c.deletedAt) return 'ERASED';
  if (c.restrictedAt) return 'RESTRICTED';
  if (!c.email) return 'NO_ADDRESS';
  if (c.emailBouncedAt) return 'ADDRESS_BOUNCED';
  if (c.doNotContact && !(opts.service && opts.dossierLive)) return 'DO_NOT_CONTACT';
  return null;
}

const fullName = (c: { firstName: string | null; lastName: string | null }) => [c.firstName, c.lastName].filter(Boolean).join(' ');
const id = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

@Injectable()
export class DossierNotificationHandlers implements OutboxHandler, OnModuleInit {
  readonly name = 'dossiers.notifications';
  readonly types = [
    'candidate.proposed',
    'candidate.selected',
    'candidate.selection_declined',
    'candidate.unselected',
    'candidate.interested',
    'candidate.declined',
    'client.qualified',
    'dossier.put_on_hold',
    'dossier.resumed',
    'dossier.reopened',
    'dossier.lost',
    'dossier.assigned',
  ] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly mailer: MailerService,
    private readonly notifier: StaffNotifier,
    private readonly tasks: TasksService,
    private readonly tokens: TokensService,
    private readonly index: CatalogueIndex,
    private readonly catalogue: CatalogueService,
    private readonly handlers: OutboxHandlers,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
  }

  async handle(record: OutboxRecord): Promise<void> {
    const e = toEnvelope(record);
    switch (e.type) {
      case 'candidate.proposed':
        return this.proposed(e, record);
      case 'candidate.selected':
      case 'candidate.selection_declined':
      case 'candidate.unselected':
        return this.selection(e);
      case 'candidate.interested':
      case 'candidate.declined':
        return this.response(e);
      case 'client.qualified':
        return this.qualified(e);
      case 'dossier.put_on_hold':
      case 'dossier.resumed':
      case 'dossier.reopened':
      case 'dossier.lost':
        return this.state(e);
      case 'dossier.assigned':
        return this.assigned(e);
      default:
        return;
    }
  }

  // ─── Shared ───────────────────────────────────────────────────────────────

  private async dossier(dossierId: string) {
    return this.prisma.dossier.findUnique({ where: { id: dossierId }, select: { id: true, reference: true, status: true, stage: true, clientId: true, assignedAgentId: true, holdClientNote: true, holdUntil: true, client: { select: CLIENT_SELECT } } });
  }

  private async advisor(userId: string | null) {
    const company = await this.settings.get('contact.companyName');
    const u = userId ? await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, signature: true } }) : null;
    return {
      firstName: u?.firstName ?? t('ui.email.advisorFallback.firstName'),
      displayName: (u && advisorDisplayName(u.firstName, u.lastName)) ?? t('ui.email.advisorFallback.displayName', { company }),
      signature: u?.signature ?? null,
      label: u ? advisorDisplayName(u.firstName, u.lastName) : null,
      company,
    };
  }

  private dossierPath(reference: string): string {
    return `/espace-client/dossiers/${reference.toLowerCase()}`;
  }

  /** NOT-025 — a task replaces an e-mail that cannot leave (system effect: from the outbox, never in the gesture). */
  private async replacementTask(d: { id: string; clientId: string; assignedAgentId: string | null; client: ClientRow }, code: string, title: string, at: Date): Promise<void> {
    const cal = await this.calendar.load();
    await this.tasks.create(this.prisma, SYSTEM_ACTOR, at, {
      title: title.slice(0, 160),
      description: d.client.phone ? t('ui.automation.systemTask.phone', { phone: d.client.phone }) : null,
      type: 'CALL',
      priority: 'HIGH',
      assigneeId: d.assignedAgentId,
      dueAt: addBusinessDays(at, 1, cal),
      dueHasTime: true,
      timeZone: cal.timeZone,
      origin: 'SYSTEM',
      dedupeKey: `client-notify:${code}:${d.id}`,
      links: { dossierId: d.id, clientId: d.clientId },
    });
  }

  // ─── candidate.proposed ───────────────────────────────────────────────────

  private async proposed(e: EventEnvelope, record: OutboxRecord): Promise<void> {
    const d = await this.dossier(e.aggregate.id);
    if (!d) return;
    const ids = Array.isArray(e.data.candidateIds) ? (e.data.candidateIds as string[]) : [];
    const candidates = await this.prisma.dossierCandidate.findMany({ where: { id: { in: ids }, dossierId: d.id }, select: { id: true, propertyId: true, message: true, proposedById: true } });
    if (!candidates.length) return;
    const advisor = await this.advisor(candidates[0]!.proposedById ?? d.assignedAgentId);
    const n = candidates.length;
    const conseiller = advisor.label ?? advisor.displayName;
    await notifyClient(this.prisma, record.occurredAt, {
      clientId: d.clientId,
      type: 'NC_PROPOSAL_NEW',
      title: n === 1 ? t('ui.notifications.NC_PROPOSAL_NEW.one', { conseiller }) : t('ui.notifications.NC_PROPOSAL_NEW.many', { conseiller, n }),
      link: '/espace-client/biens-proposes',
      entityType: 'Dossier',
      entityId: d.id,
      dedupeKey: `NC_PROPOSAL_NEW:${record.id}`,
    });

    const c = d.client;
    const activeSpace = c.user?.status === 'ACTIVE';
    const group = await this.prisma.notificationPreference.findFirst({ where: { clientId: c.id, group: 'PROJECT_NEWS' }, select: { emailEnabled: true } });
    const stop = eventMailStop(c, { service: false, dossierLive: d.status === 'OPEN' || d.status === 'ON_HOLD' }) ?? (group && !group.emailEnabled ? 'PREFERENCE_DISABLED' : null);
    if (stop === 'ERASED') return;
    // NOT-025 — the client learns of the proposals by this e-mail only, without an address or an active space: a task.
    if (stop && (!c.email || !activeSpace)) {
      await this.replacementTask(d, 'C_PROPOSAL_NEW', t('ui.automation.systemTask.presentProposals', { client: fullName(c) }), record.occurredAt);
    }
    const target = '/espace-client/biens-proposes';
    const rows = (await this.index.rows()).filter((r) => candidates.some((x) => x.propertyId === r.id));
    const cards = await this.catalogue.toCards(rows);
    const amount = (m: { amount: string; currency: string } | null) => (m ? formatMoney(Math.round(Number(m.amount)), m.currency, 'fr-FR', 0) : null);
    const block = propertiesBlock(
      cards.map((p) => ({
        title: p.title,
        url: `${this.env.WEB_URL}/biens/${p.slug}`,
        place: p.city ? `${p.city.name}, ${p.region.name}` : p.region.name,
        price: amount(p.priceFromRef),
        monthly: amount(p.monthlyFromRef),
        image: p.cover ? `${p.cover.base.startsWith('/') ? this.env.WEB_URL.replace(/\/$/, '') : ''}${p.cover.base}/card.${p.cover.formats.includes('jpg') ? 'jpg' : (p.cover.formats[0] ?? 'jpg')}` : null,
      })),
      await this.settings.get('legal.monthlyFootnote'),
    );
    await this.mailer.sendTemplate({
      templateCode: 'C_PROPOSAL_NEW',
      to: c.email,
      dedupeKey: `C_PROPOSAL_NEW:${record.id}:${c.email ?? '-'}`,
      triggeredBy: 'EVENT',
      links: { clientId: c.id, dossierId: d.id },
      suppress: stop === 'PREFERENCE_DISABLED' ? null : stop, // the mailer itself writes the group cut (NOT-020)
      vars: {
        advisor: { firstName: advisor.firstName, displayName: advisor.displayName },
        company: { name: advisor.company },
        properties: { countLabel: n === 1 ? t('ui.email.proposals.one') : t('ui.email.proposals.many', { n }) },
        action: { advisorMessage: candidates[0]!.message ?? '' },
      },
      // NOT-024 — the button carries the activation link for a client without an active space, then the page.
      secrets: async () => ({ action: { url: await this.spaceLink(c, target) } }),
      blocks: { properties: block },
      greetingName: c.firstName,
      signature: advisor.signature,
      render: { eventId: record.id, dossierId: d.id, candidateIds: ids },
    });
  }

  /** NOT-024 — the address of a page of the space: the page itself for an active account, else its activation link. */
  private async spaceLink(c: ClientRow, path: string): Promise<string> {
    const page = new URL(path, this.env.WEB_URL).toString();
    if (!c.email) return page;
    if (c.user?.status === 'ACTIVE' && c.user.emailVerifiedAt) return page;
    let userId = c.user && c.user.status !== 'DELETED' ? c.user.id : null;
    if (!userId) userId = await this.prisma.$transaction((tx) => ensureInvitedAccount(tx, { ...c, preferredLanguage: c.preferredLanguage }, this.clock.now()));
    if (!userId) return page;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (user?.status === 'INVITED') {
      const { token } = await this.tokens.issue({ purpose: 'ACCOUNT_ACTIVATION', userId, email: c.email, payload: { fromSignup: false, next: path } });
      return new URL(`/activation/${token}`, this.env.WEB_URL).toString();
    }
    if (user?.status === 'ACTIVE') {
      const { token } = await this.tokens.issue({ purpose: 'EMAIL_VERIFICATION', userId, email: c.email, payload: { next: path } });
      return new URL(`/verification/${token}`, this.env.WEB_URL).toString();
    }
    return page;
  }

  // ─── The choice of a property ─────────────────────────────────────────────

  private async selection(e: EventEnvelope): Promise<void> {
    const c = await this.prisma.dossierCandidate.findUnique({ where: { id: e.aggregate.id }, select: { id: true, selectionDeclineNote: true, property: { select: { title: true } }, dossier: { select: { id: true, reference: true, clientId: true, assignedAgentId: true } } } });
    if (!c) return;
    const advisor = await this.advisor(c.dossier.assignedAgentId);
    const conseiller = advisor.label ?? advisor.displayName;
    const titre = c.property.title;
    const base = { clientId: c.dossier.clientId, entityType: 'Dossier', entityId: c.dossier.id, dedupeKey: `${e.type}:${e.eventId}` };
    if (e.type === 'candidate.selected') await notifyClient(this.prisma, e.occurredAt, { ...base, type: 'NC_SELECTION_CONFIRMED', title: t('ui.notifications.NC_SELECTION_CONFIRMED', { titre }), link: this.dossierPath(c.dossier.reference) });
    else if (e.type === 'candidate.selection_declined') await notifyClient(this.prisma, e.occurredAt, { ...base, type: 'NC_SELECTION_DECLINED', title: t('ui.notifications.NC_SELECTION_DECLINED', { conseiller, titre, raison: c.selectionDeclineNote ?? '' }), link: '/espace-client/interets' });
    else await notifyClient(this.prisma, e.occurredAt, { ...base, type: 'NC_SELECTION_WITHDRAWN', title: t('ui.notifications.NC_SELECTION_WITHDRAWN', { conseiller, titre }), link: '/espace-client/interets' });
  }

  /** NS_CANDIDATE_RESPONSE — « {client} est intéressé par {bien}. » · « … a écarté {bien} : {raison}. » (by the client only). */
  private async response(e: EventEnvelope): Promise<void> {
    if (e.data.by !== 'CLIENT') return;
    const c = await this.prisma.dossierCandidate.findUnique({ where: { id: e.aggregate.id }, select: { property: { select: { title: true } }, dossier: { select: { id: true, reference: true, assignedAgentId: true, client: { select: { firstName: true, lastName: true } } } } } });
    if (!c?.dossier.assignedAgentId) return;
    const reason = typeof e.data.declineReason === 'string' && hasMessage(`ui.enum.DeclineReason.${e.data.declineReason}`) ? t(`ui.enum.DeclineReason.${e.data.declineReason}` as MessageKey) : '';
    const client = fullName(c.dossier.client);
    await this.notifier.notify(this.prisma, e.occurredAt, {
      type: 'NS_CANDIDATE_RESPONSE',
      userIds: [c.dossier.assignedAgentId],
      title: e.type === 'candidate.interested' ? t('ui.notifications.NS_CANDIDATE_RESPONSE.interested', { client, bien: c.property.title }) : t('ui.notifications.NS_CANDIDATE_RESPONSE.declined', { client, bien: c.property.title, raison: reason }),
      link: `${staffLink('Dossier', c.dossier) ?? ''}?onglet=biens`,
      entityType: 'Dossier',
      entityId: c.dossier.id,
      originId: e.originId,
    });
  }

  private async qualified(e: EventEnvelope): Promise<void> {
    const dossierId = e.dossierId;
    const d = dossierId ? await this.dossier(dossierId) : null;
    const advisor = await this.advisor(d?.assignedAgentId ?? null);
    await notifyClient(this.prisma, e.occurredAt, { clientId: e.aggregate.id, type: 'NC_PROJECT_QUALIFIED', title: t('ui.notifications.NC_PROJECT_QUALIFIED', { conseiller: advisor.label ?? advisor.displayName }), link: '/espace-client', dedupeKey: `NC_PROJECT_QUALIFIED:${e.eventId}` });
  }

  // ─── Pause, resumption, closing ───────────────────────────────────────────

  private async state(e: EventEnvelope): Promise<void> {
    const d = await this.dossier(e.aggregate.id);
    if (!d) return;
    const base = { clientId: d.clientId, entityType: 'Dossier', entityId: d.id, link: this.dossierPath(d.reference), dedupeKey: `${e.type}:${e.eventId}` };
    if (e.type === 'dossier.resumed' || e.type === 'dossier.reopened') {
      await notifyClient(this.prisma, e.occurredAt, { ...base, type: 'NC_DOSSIER_RESUMED', title: t('ui.notifications.NC_DOSSIER_RESUMED') });
      return;
    }
    const hold = e.type === 'dossier.put_on_hold';
    if (hold) await notifyClient(this.prisma, e.occurredAt, { ...base, type: 'NC_DOSSIER_ON_HOLD', title: t('ui.notifications.NC_DOSSIER_ON_HOLD') });
    if (e.data.notifyClient !== true) return;
    if (!hold) await notifyClient(this.prisma, e.occurredAt, { ...base, type: 'NC_DOSSIER_CLOSED', title: t('ui.notifications.NC_DOSSIER_CLOSED', { reference: d.reference }) });
    const code = hold ? 'C_DOSSIER_ON_HOLD' : 'C_DOSSIER_CLOSED';
    const stop = eventMailStop(d.client, { service: true, dossierLive: true });
    if (stop === 'ERASED') return;
    if (stop === 'NO_ADDRESS' && !hold) await this.replacementTask(d, code, t('ui.automation.systemTask.notifyClient', { client: fullName(d.client), objet: t('ui.notifications.NC_DOSSIER_CLOSED', { reference: d.reference }) }), e.occurredAt);
    const advisor = await this.advisor(d.assignedAgentId);
    const holdUntil = typeof e.data.holdUntil === 'string' && e.data.holdUntil ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${e.data.holdUntil}T12:00:00Z`)) : '';
    await this.mailer.sendTemplate({
      templateCode: code,
      to: d.client.email,
      dedupeKey: `${code}:${e.eventId}:${d.client.email ?? '-'}`,
      triggeredBy: 'EVENT',
      links: { clientId: d.clientId, dossierId: d.id },
      suppress: stop,
      vars: {
        dossier: { reference: d.reference },
        advisor: { firstName: advisor.firstName, displayName: advisor.displayName },
        company: { name: advisor.company },
        action: { waitingClient: e.data.holdReason === 'WAITING_CLIENT' ? 'oui' : '', holdClientNote: d.holdClientNote ?? '', holdUntilLabel: holdUntil },
      },
      greetingName: d.client.firstName,
      signature: advisor.signature,
      render: { eventId: e.eventId, dossierId: d.id },
    });
  }

  // ─── Change of adviser ────────────────────────────────────────────────────

  private async assigned(e: EventEnvelope): Promise<void> {
    const d = await this.dossier(e.aggregate.id);
    const agentId = id(e.data.agentId);
    if (!d || !agentId) return;
    const previousId = id(e.data.previousAgentId);
    const authorId = e.actor?.type === 'USER' ? e.actor.id : null;
    const [agent, author] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: agentId }, select: { id: true, email: true, firstName: true, lastName: true, status: true, notificationPreferences: { where: { group: 'STAFF_LEADS' }, select: { emailEnabled: true } } } }),
      authorId ? this.prisma.user.findUnique({ where: { id: authorId }, select: { firstName: true, lastName: true } }) : null,
    ]);
    const auteur = author ? fullName(author) : t('ui.notifications.NS_TEAM_CHANGE.platform');
    const link = staffLink('Dossier', d);
    // NS_ASSIGNED — « par un autre que le destinataire » (NOT-018: never notified of one's own gesture).
    if (agent && agent.status === 'ACTIVE' && authorId !== agentId) {
      const { notified } = await this.notifier.notify(this.prisma, e.occurredAt, { type: 'NS_ASSIGNED', userIds: [agentId], title: t('ui.notifications.NS_ASSIGNED.dossier', { auteur, reference: d.reference }), link, entityType: 'Dossier', entityId: d.id, originId: e.originId, exceptUserId: authorId });
      if (notified.includes(agentId)) {
        await this.mailer.sendTemplate({
          templateCode: 'S_ASSIGNED',
          to: agent.email,
          dedupeKey: `S_ASSIGNED:${e.eventId}:${agent.email}`,
          triggeredBy: 'EVENT',
          links: { staffUserId: agent.id, dossierId: d.id },
          suppress: agent.notificationPreferences.some((p) => !p.emailEnabled) ? 'PREFERENCE_DISABLED' : null,
          vars: { actor: { fullName: auteur }, action: { objectLabel: t('ui.email.assigned.dossier', { reference: d.reference }), adminUrl: `${this.env.ADMIN_URL ?? this.env.WEB_URL}${link ?? ''}` } },
          greetingName: agent.firstName,
          render: { eventId: e.eventId, dossierId: d.id },
        });
      }
    }
    if (previousId && previousId !== authorId) {
      await this.notifier.notify(this.prisma, e.occurredAt, { type: 'NS_UNASSIGNED', userIds: [previousId], title: t('ui.notifications.NS_UNASSIGNED', { reference: d.reference, conseiller: agent ? fullName(agent) : '' }), link, entityType: 'Dossier', entityId: d.id, originId: e.originId, exceptUserId: authorId });
    }
    // C_ADVISOR_CHANGED — a change (not the first adviser), unless « Ne pas informer le client » (CYC-040).
    if (previousId && e.data.notifyClient === true) {
      const stop = eventMailStop(d.client, { service: true, dossierLive: d.status === 'OPEN' || d.status === 'ON_HOLD' });
      if (stop === 'ERASED') return;
      const advisor = await this.advisor(agentId);
      await this.mailer.sendTemplate({
        templateCode: 'C_ADVISOR_CHANGED',
        to: d.client.email,
        dedupeKey: `C_ADVISOR_CHANGED:${e.eventId}:${d.client.email ?? '-'}`,
        triggeredBy: 'EVENT',
        links: { clientId: d.clientId, dossierId: d.id },
        suppress: stop,
        vars: { advisor: { firstName: advisor.firstName, displayName: advisor.displayName }, company: { name: advisor.company } },
        greetingName: d.client.firstName,
        signature: advisor.signature,
        render: { eventId: e.eventId, dossierId: d.id },
      });
    }
  }
}
