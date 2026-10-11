// NOT-030, CYC-080, AUT-071 — the notifications and the e-mails of the events of package 3.8, from the outbox after the
// commit (AUT-003 step 2), each with its key:
//   appointment.confirmed, .rescheduled → NC_APPOINTMENT_CONFIRMED; C_APPOINTMENT_CONFIRMED (+ `.ics`) only when the
//                                          client was informed (`clientNotifiedAt`, TAC-040)
//   appointment.cancelled (staff/system)→ NC_APPOINTMENT_CANCELLED; C_APPOINTMENT_CANCELLED when `notifyClient`
//   appointment.cancelled (client)      → NS_APPOINTMENT_CANCELLED + S_APPOINTMENT_CANCELLED to the adviser
//   client.email_bounced                → NS_EMAIL_BOUNCED to the client's adviser
//   task.due                            → NS_TASK_DUE (in the application only, TAC-030)
// And the fields of `C_APPOINTMENT_REMINDER` (rule R_APPOINTMENT_REMINDER): the hour where the appointment is held.
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator, hasMessage, type MessageKey } from '@dp/i18n';
import { toEnvelope, type EventEnvelope } from '../automation/event-catalogue.js';
import { RuleMailComposers } from '../automation/rule-mail.js';
import { staffLink, taskLink } from '../automation/staff-links.js';
import { StaffNotifier } from '../automation/staff-notifications.service.js';
import { notifyClient } from '../client-tools/client-notify.js';
import { advisorDisplayName } from '../client-space/timeline.js';
import { MailerService } from '../communication/mailer.service.js';
import { ENV, type Env } from '../config/env.js';
import { eventMailStop } from '../dossiers-admin/dossier-notifications.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { appointmentIcs } from './appointments.service.js';

const t = createTranslator('fr');

/** French names of the zones the platform meets (« heure d'Alger »); else the city of the zone identifier. */
const CITY: Record<string, string> = {
  'Africa/Algiers': 'Alger',
  'Europe/Paris': 'Paris',
  'America/Montreal': 'Montréal',
  'America/Toronto': 'Toronto',
  'Europe/London': 'Londres',
  'Europe/Brussels': 'Bruxelles',
  'Europe/Zurich': 'Zurich',
  'Europe/Madrid': 'Madrid',
  'Europe/Berlin': 'Berlin',
  'Africa/Casablanca': 'Casablanca',
  'Africa/Tunis': 'Tunis',
  'Asia/Dubai': 'Dubaï',
  'America/New_York': 'New York',
};

/** TRV-031 — « heure d'Alger », « heure de Paris ». */
export function zoneLabel(timeZone: string): string {
  const city = CITY[timeZone] ?? timeZone.split('/').pop()!.replace(/_/g, ' ');
  return /^[AEIOUYÉÈÂÎaeiouyéèâî]/.test(city) ? `heure d’${city}` : `heure de ${city}`;
}

/** The labels of an appointment, in the zone it is held in (the place's for a visit on site, else the client's). */
export function appointmentLabels(a: { type: string; startsAt: Date | null; placeTimezone: string | null; timezone: string; locationText: string | null; hostName: string | null; hostPhone: string | null; meetingUrl: string | null }) {
  const zone = a.placeTimezone ?? a.timezone;
  const date = a.startsAt ? new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: zone }).format(a.startsAt) : '';
  const time = a.startsAt ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(a.startsAt).replace(':', ' h ') : '';
  const typeKey = `ui.enum.AppointmentType.${a.type}`;
  return {
    typeLabel: hasMessage(typeKey) ? t(typeKey as MessageKey).toLocaleLowerCase('fr') : a.type,
    dateLabel: date,
    timeLabel: time,
    timezoneLabel: zoneLabel(zone),
    location: a.locationText ?? '',
    hostLabel: a.hostName ? (a.hostPhone ? `${a.hostName} (${a.hostPhone})` : a.hostName) : '',
    meetingUrl: a.meetingUrl ?? '',
  };
}

const fullName = (c: { firstName: string | null; lastName: string | null }) => [c.firstName, c.lastName].filter(Boolean).join(' ');

@Injectable()
export class AgendaNotificationHandlers implements OutboxHandler, OnModuleInit {
  readonly name = 'agenda.notifications';
  readonly types = ['appointment.confirmed', 'appointment.rescheduled', 'appointment.cancelled', 'client.email_bounced', 'task.due'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
    private readonly notifier: StaffNotifier,
    private readonly handlers: OutboxHandlers,
    private readonly ruleMails: RuleMailComposers,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
    // R_APPOINTMENT_REMINDER — the hour of the place (visit) or of the client, and who hosts on site.
    this.ruleMails.compose('C_APPOINTMENT_REMINDER', async ({ ctx }) => {
      const id = ctx.id('appointment');
      const a = id ? await this.prisma.appointment.findUnique({ where: { id }, select: { type: true, startsAt: true, placeTimezone: true, timezone: true, locationText: true, hostName: true, hostPhone: true, meetingUrl: true, status: true, staffUser: { select: { firstName: true, lastName: true } } } }) : null;
      if (!a || a.status !== 'CONFIRMED') return { skip: true };
      const advisor = advisorDisplayName(a.staffUser?.firstName ?? null, a.staffUser?.lastName ?? null);
      return { vars: { appointment: appointmentLabels(a), ...(advisor ? { advisor: { firstName: a.staffUser!.firstName!, displayName: advisor } } : {}) } };
    });
  }

  async handle(record: OutboxRecord): Promise<void> {
    const e = toEnvelope(record);
    if (e.type === 'client.email_bounced') return this.bounced(e);
    if (e.type === 'task.due') return this.due(e);
    return this.appointment(e, record);
  }

  private async appointment(e: EventEnvelope, record: OutboxRecord): Promise<void> {
    const a = await this.prisma.appointment.findUnique({
      where: { id: e.aggregate.id },
      include: { client: { select: { id: true, firstName: true, lastName: true, email: true, doNotContact: true, emailBouncedAt: true, restrictedAt: true, gdprErasedAt: true, deletedAt: true } }, dossier: { select: { id: true, reference: true, status: true } }, property: { select: { title: true } }, staffUser: { select: { id: true, email: true, firstName: true, lastName: true, status: true, notificationPreferences: { where: { group: 'STAFF_DOSSIERS' }, select: { emailEnabled: true } } } } },
    });
    if (!a) return;
    const labels = appointmentLabels(a);
    const company = await this.settings.get('contact.companyName');
    const advisorName = advisorDisplayName(a.staffUser?.firstName ?? null, a.staffUser?.lastName ?? null);
    const advisor = { firstName: a.staffUser?.firstName ?? t('ui.email.advisorFallback.firstName'), displayName: advisorName ?? t('ui.email.advisorFallback.displayName', { company }) };
    const base = { clientId: a.clientId, link: '/espace-client/rendez-vous', entityType: a.dossierId ? 'Dossier' : null, entityId: a.dossierId, dedupeKey: `${e.type}:${e.eventId}` };

    if (e.type === 'appointment.cancelled' && e.data.cancelledBy === 'CLIENT') {
      // NS_APPOINTMENT_CANCELLED + S_APPOINTMENT_CANCELLED — the adviser of the appointment.
      if (!a.staffUser || a.staffUser.status !== 'ACTIVE') return;
      const link = a.dossier ? staffLink('Dossier', a.dossier) : `/agenda?rdv=${a.id}`;
      const { notified } = await this.notifier.notify(this.prisma, e.occurredAt, { type: 'NS_APPOINTMENT_CANCELLED', userIds: [a.staffUser.id], title: t('ui.notifications.NS_APPOINTMENT_CANCELLED', { client: fullName(a.client), date: labels.dateLabel }), link, entityType: a.dossier ? 'Dossier' : null, entityId: a.dossier?.id ?? null, originId: e.originId });
      if (notified.length) {
        await this.mailer.sendTemplate({
          templateCode: 'S_APPOINTMENT_CANCELLED',
          to: a.staffUser.email,
          dedupeKey: `S_APPOINTMENT_CANCELLED:${e.eventId}:${a.staffUser.email}`,
          triggeredBy: 'EVENT',
          links: { staffUserId: a.staffUser.id, dossierId: a.dossierId, clientId: a.clientId },
          suppress: a.staffUser.notificationPreferences.some((p) => !p.emailEnabled) ? 'PREFERENCE_DISABLED' : null,
          vars: { client: { fullName: fullName(a.client) }, appointment: labels, action: { adminUrl: `${this.env.ADMIN_URL ?? this.env.WEB_URL}${link ?? ''}` } },
          greetingName: a.staffUser.firstName,
          render: { eventId: e.eventId, appointmentId: a.id },
        });
      }
      return;
    }

    const cancelled = e.type === 'appointment.cancelled';
    // The appointment is the client's: it is in his space, with its notification, e-mail or not (TAC-040, INT-041).
    await notifyClient(this.prisma, e.occurredAt, cancelled ? { ...base, type: 'NC_APPOINTMENT_CANCELLED', title: t('ui.notifications.NC_APPOINTMENT_CANCELLED', { date: labels.dateLabel }) } : { ...base, type: 'NC_APPOINTMENT_CONFIRMED', title: t('ui.notifications.NC_APPOINTMENT_CONFIRMED', { date: labels.dateLabel, heure: labels.timeLabel }) });
    const wantsMail = cancelled ? e.data.notifyClient === true : a.clientNotifiedAt !== null;
    if (!wantsMail) return;
    const stop = eventMailStop(a.client, { service: true, dossierLive: true });
    if (stop === 'ERASED') return;
    const code = cancelled ? 'C_APPOINTMENT_CANCELLED' : 'C_APPOINTMENT_CONFIRMED';
    const siteName = company;
    await this.mailer.sendTemplate({
      templateCode: code,
      to: a.client.email,
      dedupeKey: `${code}:${record.id}:${a.client.email ?? '-'}`,
      triggeredBy: 'EVENT',
      links: { clientId: a.clientId, dossierId: a.dossierId, staffUserId: a.staffUserId },
      suppress: stop,
      vars: {
        advisor,
        company: { name: company },
        appointment: { ...labels, isRescheduled: e.type === 'appointment.rescheduled' ? 'oui' : '', dossierClosed: e.data.dossierClosed === true ? 'oui' : '', staffNote: typeof e.data.staffNote === 'string' ? e.data.staffNote : '' },
      },
      attachments: cancelled || !a.startsAt ? undefined : [{ filename: 'rendez-vous.ics', contentType: 'text/calendar; charset=utf-8; method=PUBLISH', content: Buffer.from(appointmentIcs({ ...a, staffUser: a.staffUser }, siteName, e.occurredAt)) }],
      greetingName: a.client.firstName,
      render: { eventId: e.eventId, appointmentId: a.id },
    });
  }

  /** NS_EMAIL_BOUNCED — « L'adresse e-mail de {client} rejette nos messages. » (the task comes from R_EMAIL_BOUNCED). */
  private async bounced(e: EventEnvelope): Promise<void> {
    const c = await this.prisma.client.findUnique({ where: { id: e.aggregate.id }, select: { id: true, firstName: true, lastName: true, assignedAgentId: true } });
    if (!c?.assignedAgentId) return;
    await this.notifier.notify(this.prisma, e.occurredAt, { type: 'NS_EMAIL_BOUNCED', userIds: [c.assignedAgentId], title: t('ui.notifications.NS_EMAIL_BOUNCED', { client: fullName(c) }), link: staffLink('Client', c), entityType: 'Client', entityId: c.id, originId: e.originId });
  }

  /** TAC-030 — NS_TASK_DUE, in the application only; an unassigned task reminds nobody. */
  private async due(e: EventEnvelope): Promise<void> {
    const task = await this.prisma.task.findUnique({ where: { id: e.aggregate.id }, select: { id: true, title: true, status: true, assigneeId: true, deletedAt: true } });
    if (!task || task.deletedAt || task.status !== 'OPEN' || !task.assigneeId) return;
    await this.notifier.notify(this.prisma, e.occurredAt, { type: 'NS_TASK_DUE', userIds: [task.assigneeId], title: t('ui.notifications.NS_TASK_DUE', { titre: task.title }), link: taskLink(task.id), entityType: 'Task', entityId: task.id, originId: e.originId });
  }
}
