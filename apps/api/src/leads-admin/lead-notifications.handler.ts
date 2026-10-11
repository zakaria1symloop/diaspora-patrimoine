// NOT-030 § 3.2, NOT-035 — the notifications of the team for the events of package 3.2, written from the outbox after
// the commit (AUT-003 step 2), each with its key (NOT-011): replaying the event writes nothing twice.
//   · `lead.taken` by someone else than the new adviser → `NS_ASSIGNED` and the e-mail `S_ASSIGNED` (group STAFF_LEADS).
//     A request taken by the adviser himself, or assigned automatically at its creation (no actor), notifies nobody:
//     `NS_LEAD_NEW` already said it (NOT-035). The dossier that follows (`dossier.assigned` with `viaLeadId`) adds nothing.
//   · `lead.attached` → `NS_LEAD_ATTACHED` to the adviser of the dossier (never the author of the gesture, NOT-018).
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import { toEnvelope } from '../automation/event-catalogue.js';
import { StaffDirectory } from '../automation/staff-directory.js';
import { staffLink } from '../automation/staff-links.js';
import { StaffNotifier } from '../automation/staff-notifications.service.js';
import { MailerService } from '../communication/mailer.service.js';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { OutboxHandlers, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';

const t = createTranslator('fr');
const fullName = (u: { firstName: string | null; lastName: string | null } | null | undefined) => [u?.firstName, u?.lastName].filter(Boolean).join(' ');

@Injectable()
export class LeadNotificationsHandler implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly handlers: OutboxHandlers,
    private readonly notifier: StaffNotifier,
    private readonly directory: StaffDirectory,
    private readonly mailer: MailerService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register({ name: 'leads.staff-notifications', types: ['lead.taken', 'lead.attached'], handle: (e) => this.handle(e) });
  }

  async handle(record: OutboxRecord): Promise<void> {
    const event = toEnvelope(record);
    const actorId = event.actor?.type === 'USER' ? event.actor.id : null;
    const lead = await this.prisma.lead.findUnique({
      where: { id: event.aggregate.id },
      select: { id: true, reference: true, status: true, assignedAgentId: true, firstName: true, lastName: true, client: { select: { firstName: true, lastName: true } }, dossier: { select: { id: true, reference: true, assignedAgentId: true } } },
    });
    if (!lead || lead.status === 'SPAM') return;
    const staff = await this.directory.load(this.prisma, this.clock.now());

    if (record.type === 'lead.taken') {
      const agentId = typeof event.data.agentId === 'string' ? event.data.agentId : null;
      // read again (FIA-042): reassigned meanwhile, the notification would be wrong
      if (!actorId || !agentId || agentId === actorId || lead.assignedAgentId !== agentId || !staff.canAct(agentId)) return;
      const actor = staff.get(actorId) ?? (await this.prisma.user.findUnique({ where: { id: actorId }, select: { firstName: true, lastName: true } }));
      const author = fullName(actor);
      const { notified } = await this.notifier.notify(this.prisma, record.occurredAt, {
        type: 'NS_ASSIGNED',
        userIds: [agentId],
        title: t('ui.notifications.NS_ASSIGNED.lead', { auteur: author, reference: lead.reference }),
        link: staffLink('Lead', lead),
        entityType: 'Lead',
        entityId: lead.id,
        originId: event.originId,
        exceptUserId: actorId,
      });
      if (!notified.length) return;
      const recipient = await this.prisma.user.findUnique({ where: { id: agentId }, select: { email: true, firstName: true, notificationPreferences: { where: { group: 'STAFF_LEADS' }, select: { emailEnabled: true } } } });
      if (!recipient) return;
      await this.mailer.sendTemplate({
        templateCode: 'S_ASSIGNED',
        to: recipient.email,
        dedupeKey: `S_ASSIGNED:${record.id}:${recipient.email}`,
        triggeredBy: 'EVENT',
        links: { leadId: lead.id, staffUserId: agentId },
        suppress: recipient.notificationPreferences.some((p) => !p.emailEnabled) ? 'PREFERENCE_DISABLED' : null,
        vars: { staff: { firstName: recipient.firstName }, actor: { fullName: author }, action: { objectLabel: t('ui.admin-leads.mail.objectLabel', { reference: lead.reference }), adminUrl: `${this.env.ADMIN_URL ?? this.env.WEB_URL}/demandes/${lead.reference.toLowerCase()}` } },
        greetingName: recipient.firstName,
        render: { eventId: record.id, leadId: lead.id },
      });
      return;
    }

    // lead.attached
    const dossier = lead.dossier;
    if (!dossier) return;
    const recipients = staff.resolve(['DOSSIER_AGENT'], { DOSSIER_AGENT: dossier.assignedAgentId, LEAD_AGENT: null, CLIENT_AGENT: null, APPOINTMENT_AGENT: null, EVENT_HOST: null });
    const client = fullName(lead.client) || fullName(lead) || lead.reference;
    await this.notifier.notify(this.prisma, record.occurredAt, {
      type: 'NS_LEAD_ATTACHED',
      userIds: recipients.map((r) => r.userId),
      title: t('ui.notifications.NS_LEAD_ATTACHED', { client, reference: dossier.reference }),
      link: staffLink('Lead', lead),
      entityType: 'Lead',
      entityId: lead.id,
      originId: event.originId,
      exceptUserId: actorId,
    });
  }
}
