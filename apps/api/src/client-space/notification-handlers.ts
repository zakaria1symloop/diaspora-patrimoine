// NOT-030 § 3.1 — the client notifications of the events that exist at livraison 2, written from the outbox after the
// commit (AUT-003). Each carries its key (NOT-035: one operation, one notification; replaying the event creates
// nothing twice). A client without an account has no notification (the e-mail is his channel).
//   lead.created                 → NC_LEAD_RECEIVED (link Mes intérêts; object: the dossier, else the request)
//   lead.taken, dossier.assigned → NC_ADVISOR_ASSIGNED, once per advisor (link Tableau de bord, no object)
//   dossier.assigned (change)    → NC_ADVISOR_CHANGED
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { callbackLabel, createTranslator, type CallbackSlot } from '@dp/i18n';
import { notifyClient } from '../client-tools/client-notify.js';
import { loadAdvisors } from '../leads/assignment.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { advisorDisplayName } from './timeline.js';

const t = createTranslator('fr');

@Injectable()
export class ClientNotificationHandlers implements OutboxHandler, OnModuleInit {
  readonly name = 'client-space.notifications';
  readonly types = ['lead.created', 'lead.taken', 'dossier.assigned'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly handlers: OutboxHandlers,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
  }

  async handle(event: OutboxRecord): Promise<void> {
    if (event.type === 'lead.created') return this.leadReceived(event);
    return this.advisorAssigned(event);
  }

  private async leadReceived(event: OutboxRecord): Promise<void> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: event.aggregateId },
      select: { id: true, kind: true, status: true, clientId: true, dossierId: true, contextDossierId: true, preferredCallbackDate: true, preferredSlot: true, callerTimezone: true, client: { select: { timezone: true } } },
    });
    if (!lead?.clientId || lead.status === 'SPAM' || lead.kind === 'PARTNER_REQUEST') return;
    const cal = await this.calendar.load();
    const quand = callbackLabel({
      preferredCallbackDate: lead.preferredCallbackDate?.toISOString().slice(0, 10) ?? null,
      preferredSlot: (lead.preferredSlot as CallbackSlot | null) ?? null,
      firstContactBusinessDays: await this.settings.get('sla.firstContactBusinessDays'),
      timeZone: lead.callerTimezone ?? lead.client?.timezone ?? cal.timeZone,
    });
    const dossierId = lead.dossierId ?? lead.contextDossierId;
    await notifyClient(this.prisma, event.occurredAt, {
      clientId: lead.clientId,
      type: 'NC_LEAD_RECEIVED',
      title: lead.kind === 'CONTACT_MESSAGE' ? t('ui.notifications.NC_LEAD_RECEIVED.contact', { quand }) : t('ui.notifications.NC_LEAD_RECEIVED.request', { quand }),
      link: '/espace-client/interets',
      entityType: dossierId ? 'Dossier' : 'Lead',
      entityId: dossierId ?? lead.id,
      dedupeKey: `NC_LEAD_RECEIVED:${lead.id}`,
    });
  }

  private async advisorAssigned(event: OutboxRecord): Promise<void> {
    const p = event.payload as { agentId?: string; previousAgentId?: string | null };
    if (!p.agentId) return;
    const clientId =
      event.type === 'lead.taken'
        ? (await this.prisma.lead.findUnique({ where: { id: event.aggregateId }, select: { clientId: true, kind: true } }))?.clientId
        : (await this.prisma.dossier.findUnique({ where: { id: event.aggregateId }, select: { clientId: true } }))?.clientId;
    if (!clientId) return;
    // NOT-018 — an advisor who can no longer act is not named to the client.
    if (!(await loadAdvisors(this.prisma)).some((a) => a.userId === p.agentId)) return;
    const user = await this.prisma.user.findUnique({ where: { id: p.agentId }, select: { firstName: true, lastName: true } });
    const conseiller = advisorDisplayName(user?.firstName ?? null, user?.lastName ?? null);
    if (!conseiller) return;
    const changed = event.type === 'dossier.assigned' && Boolean(p.previousAgentId);
    await notifyClient(this.prisma, event.occurredAt, {
      clientId,
      type: changed ? 'NC_ADVISOR_CHANGED' : 'NC_ADVISOR_ASSIGNED',
      title: changed ? t('ui.notifications.NC_ADVISOR_CHANGED', { conseiller }) : t('ui.notifications.NC_ADVISOR_ASSIGNED', { conseiller }),
      link: '/espace-client',
      // NOT-035 — « une seule fois par conseiller » (the request and its dossier entrusted together notify once).
      dedupeKey: changed ? `NC_ADVISOR_CHANGED:${event.id}` : `NC_ADVISOR_ASSIGNED:${clientId}:${p.agentId}`,
    });
  }
}
