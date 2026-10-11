// AUT-012, AUT-035, AUT-051, AUT-070, TAC-030, CYC-080 — what runs by itself around the tasks and the appointments:
//   `appointment.scan` (15 min) — `appointment.upcoming` 24 hours before a confirmed appointment (R_APPOINTMENT_REMINDER),
//                                  `appointment.outcome_missing` 2 business days after its end without outcome;
//   `task.scan` (5 min)         — `task.due` at the reminder of a task (NS_TASK_DUE); the tasks `email-fix:{clientId}` close
//                                  as soon as the address is no longer marked rejected, whatever the cause (AUT-035);
//   `digest.staff` (8:30, business days) — the morning summary `S_DAILY_DIGEST` (AUT-070), limited to the perimeter of
//                                  each member, not sent when it has nothing to say;
//   the lines of AUT-035 whose events come with package 3.8.
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { addBusinessDays, localDate } from '@dp/domain';
import { createTranslator } from '@dp/i18n';
import { emitFact, SCAN_BATCH } from '../automation/automation-jobs.js';
import { Scheduler, type JobContext } from '../automation/scheduler.js';
import { TaskAutoClose } from '../automation/task-effects.js';
import { TasksService } from '../automation/tasks.service.js';
import { MailerService } from '../communication/mailer.service.js';
import { ENV, type Env } from '../config/env.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { PrismaService } from '../platform/prisma.service.js';
import { groupOf } from './tasks-admin.service.js';

const t = createTranslator('fr');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface DigestSection {
  key: string;
  lines: string[];
}

/** S_DAILY_DIGEST `{{> digest}}` — one titled list per section; empty sections are left out (NOT-060 § 6.7). */
export function digestBlock(sections: readonly DigestSection[]): { html: string; text: string } | null {
  const shown = sections.filter((s) => s.lines.length);
  if (!shown.length) return null;
  const title = (k: string) => t(`ui.admin-tasks.digest.section.${k}` as never);
  return {
    html: shown.map((s) => `<h3 style="margin:20px 0 6px;font-size:16px;color:#06177a">${esc(title(s.key))} (${s.lines.length})</h3><ul style="margin:0;padding-left:20px">${s.lines.map((l) => `<li style="margin:2px 0">${esc(l)}</li>`).join('')}</ul>`).join(''),
    text: shown.map((s) => `${title(s.key)} (${s.lines.length})\n${s.lines.map((l) => `- ${l}`).join('\n')}`).join('\n\n'),
  };
}

@Injectable()
export class AgendaJobs implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: BusinessCalendarService,
    private readonly scheduler: Scheduler,
    private readonly autoClose: TaskAutoClose,
    private readonly tasks: TasksService,
    private readonly mailer: MailerService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.scheduler.register({ name: 'appointment.scan', schedule: { everyMinutes: 15 }, run: (ctx) => this.appointmentScan(ctx) });
    this.scheduler.register({ name: 'task.scan', schedule: { everyMinutes: 5 }, run: (ctx) => this.taskScan(ctx) });
    this.scheduler.register({ name: 'digest.staff', schedule: { dailyAt: '08:30', businessDaysOnly: true }, run: (ctx) => this.digest(ctx) });
    this.closingLines();
  }

  /** `appointment.scan`. `scope`: only these appointments (tests on a shared database). */
  async appointmentScan(ctx: Pick<JobContext, 'now' | 'jobRunId'>, scope?: { ids: readonly string[] }): Promise<Record<string, number>> {
    const { now } = ctx;
    const only = scope ? { id: { in: [...scope.ids] } } : {};
    const counters = { upcoming: 0, outcomeMissing: 0 };
    const soon = await this.prisma.appointment.findMany({ where: { ...only, status: 'CONFIRMED', reminderSentAt: null, startsAt: { gt: now, lte: new Date(now.getTime() + DAY) } }, take: SCAN_BATCH, select: { id: true, clientId: true, dossierId: true, startsAt: true } });
    for (const a of soon) {
      const ok = await emitFact(this.prisma, now, { type: 'appointment.upcoming', aggregate: { type: 'Appointment', id: a.id }, clientId: a.clientId, dossierId: a.dossierId, jobRunId: ctx.jobRunId, dedupeKey: `appointment.upcoming:${a.id}:${a.startsAt!.toISOString()}` });
      if (ok) counters.upcoming++;
    }
    // CYC-080 — confirmed, its end passed for 2 business days, without outcome.
    const cal = await this.calendar.load();
    const ended = await this.prisma.appointment.findMany({ where: { ...only, status: 'CONFIRMED', endsAt: { lt: now } }, take: SCAN_BATCH, select: { id: true, clientId: true, dossierId: true, endsAt: true, startsAt: true } });
    for (const a of ended) {
      if (addBusinessDays(a.endsAt!, 2, cal).getTime() > now.getTime()) continue;
      const ok = await emitFact(this.prisma, now, { type: 'appointment.outcome_missing', aggregate: { type: 'Appointment', id: a.id }, clientId: a.clientId, dossierId: a.dossierId, jobRunId: ctx.jobRunId, dedupeKey: `appointment.outcome_missing:${a.id}:${a.startsAt!.toISOString()}` });
      if (ok) counters.outcomeMissing++;
    }
    return counters;
  }

  /** `task.scan` — TAC-030 reminders; AUT-035 `email-fix`. */
  async taskScan(ctx: Pick<JobContext, 'now' | 'jobRunId'>, scope?: { ids: readonly string[] }): Promise<Record<string, number>> {
    const { now } = ctx;
    const only = scope ? { id: { in: [...scope.ids] } } : {};
    const counters = { due: 0, emailFixed: 0 };
    const due = await this.prisma.task.findMany({ where: { ...only, deletedAt: null, status: 'OPEN', assigneeId: { not: null }, remindAt: { lte: now, gt: new Date(now.getTime() - 7 * DAY) } }, take: SCAN_BATCH, select: { id: true, clientId: true, dossierId: true, remindAt: true } });
    for (const task of due) {
      const ok = await emitFact(this.prisma, now, { type: 'task.due', aggregate: { type: 'Task', id: task.id }, clientId: task.clientId, dossierId: task.dossierId, jobRunId: ctx.jobRunId, dedupeKey: `task.due:${task.id}:${task.remindAt!.toISOString()}` });
      if (ok) counters.due++;
    }
    const fixes = await this.prisma.task.findMany({ where: { ...only, deletedAt: null, status: 'OPEN', dedupeKey: { startsWith: 'email-fix:' } }, take: SCAN_BATCH, select: { dedupeKey: true, client: { select: { emailBouncedAt: true } } } });
    const fixed = fixes.filter((f) => f.client && f.client.emailBouncedAt === null).map((f) => f.dedupeKey!);
    if (fixed.length) counters.emailFixed = await this.tasks.closeAutomatically(this.prisma, now, fixed, 'DONE', t('ui.automation.close.emailFixed'));
    return counters;
  }

  /** `digest.staff` — AUT-070. `only`: these accounts (tests); never set by the task. */
  async digest(ctx: Pick<JobContext, 'now' | 'jobRunId' | 'lastRunAt'>, only?: readonly string[]): Promise<Record<string, number>> {
    const { now } = ctx;
    const since = ctx.lastRunAt ?? new Date(now.getTime() - DAY);
    const cal = await this.calendar.load();
    const today = localDate(now, cal);
    const counters = { sent: 0, empty: 0 };
    const members = await this.prisma.membership.findMany({
      where: { revokedAt: null, suspendedAt: null, organization: { type: 'OPERATOR' }, role: { in: ['OWNER', 'ADMIN', 'AGENT'] }, user: { kind: 'STAFF', status: 'ACTIVE', ...(only ? { id: { in: [...only] } } : {}) } },
      select: { role: true, user: { select: { id: true, email: true, firstName: true, timezone: true, notificationPreferences: { where: { group: 'STAFF_DIGEST' }, select: { emailEnabled: true } } } } },
    });
    for (const m of members) {
      const u = m.user;
      const admin = m.role === 'OWNER' || m.role === 'ADMIN';
      const tz = u.timezone;
      const fmt = (d: Date, withTime: boolean) => new Intl.DateTimeFormat('fr-FR', withTime ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz } : { day: '2-digit', month: '2-digit', timeZone: tz }).format(d);
      const [open, fresh, alerts, toTake, noContact, toReview, unassigned, docs, appointments, late] = await Promise.all([
        this.prisma.task.findMany({ where: { deletedAt: null, status: 'OPEN', assigneeId: u.id, dueAt: { lt: new Date(now.getTime() + 2 * DAY) } }, select: { title: true, dueAt: true, dueHasTime: true, status: true }, orderBy: { dueAt: 'asc' }, take: 200 }),
        this.prisma.task.findMany({ where: { deletedAt: null, status: 'OPEN', assigneeId: u.id, origin: { in: ['WORKFLOW', 'SYSTEM'] }, createdAt: { gte: since } }, select: { title: true }, orderBy: { createdAt: 'asc' }, take: 50 }),
        this.prisma.notification.findMany({ where: { userId: u.id, type: 'NS_RULE_ALERT', readAt: null, createdAt: { gte: since } }, select: { title: true }, take: 50 }),
        this.prisma.lead.findMany({ where: { status: 'NEW', assignedAgentId: null, applicationStatus: null }, select: { reference: true, slaDueAt: true }, orderBy: { slaDueAt: 'asc' }, take: 50 }),
        this.prisma.lead.findMany({ where: { status: { in: ['NEW', 'IN_PROGRESS'] }, assignedAgentId: u.id, firstContactAt: null, kind: { not: 'PARTNER_REQUEST' } }, select: { reference: true, slaDueAt: true }, orderBy: { slaDueAt: 'asc' }, take: 50 }),
        admin ? this.prisma.lead.count({ where: { needsReview: true } }) : Promise.resolve(0),
        admin ? this.prisma.task.findMany({ where: { deletedAt: null, status: 'OPEN', assigneeId: null, createdAt: { gte: since } }, select: { title: true }, take: 50 }) : Promise.resolve([]),
        this.prisma.dossierDocument.groupBy({ by: ['dossierId'], where: { status: 'RECEIVED', dossier: { deletedAt: null, ...(admin ? {} : { assignedAgentId: u.id }) } }, _count: { _all: true } }),
        this.prisma.appointment.findMany({ where: { staffUserId: u.id, status: 'CONFIRMED', startsAt: { gte: new Date(`${today}T00:00:00Z`), lt: new Date(now.getTime() + DAY) } }, select: { type: true, startsAt: true, client: { select: { firstName: true, lastName: true } } }, orderBy: { startsAt: 'asc' } }),
        this.prisma.dossier.findMany({ where: { deletedAt: null, status: 'OPEN', assignedAgentId: u.id, slaDueAt: { lt: now } }, select: { reference: true }, take: 50 }),
      ]);
      const docDossiers = docs.length ? await this.prisma.dossier.findMany({ where: { id: { in: docs.map((d) => d.dossierId) } }, select: { id: true, reference: true } }) : [];
      const sections: DigestSection[] = [
        { key: 'overdue', lines: open.filter((x) => groupOf(x, now, tz) === 'OVERDUE').map((x) => `${x.title} — ${fmt(x.dueAt!, x.dueHasTime)}`) },
        { key: 'today', lines: open.filter((x) => groupOf(x, now, tz) === 'TODAY').map((x) => x.title) },
        { key: 'newTasks', lines: fresh.map((x) => x.title) },
        { key: 'alerts', lines: alerts.map((x) => x.title) },
        { key: 'leadsToTake', lines: [...toTake, ...noContact].map((l) => (l.slaDueAt ? t('ui.admin-tasks.digest.leadDue', { reference: l.reference, date: fmt(l.slaDueAt, true) }) : l.reference)) },
        { key: 'toReview', lines: toReview ? [t('ui.admin-tasks.digest.toReview', { n: toReview })] : [] },
        { key: 'unassigned', lines: unassigned.map((x) => x.title) },
        { key: 'documents', lines: docs.map((d) => t('ui.admin-tasks.digest.documents', { reference: docDossiers.find((x) => x.id === d.dossierId)?.reference ?? '', n: d._count._all })) },
        { key: 'appointments', lines: appointments.map((a) => `${fmt(a.startsAt!, true)} — ${[a.client.firstName, a.client.lastName].filter(Boolean).join(' ')}`) },
        { key: 'lateDossiers', lines: late.map((d) => d.reference) },
      ];
      const block = digestBlock(sections);
      if (!block) {
        counters.empty++;
        continue;
      }
      const outcome = await this.mailer.sendTemplate({
        templateCode: 'S_DAILY_DIGEST',
        to: u.email,
        dedupeKey: `S_DAILY_DIGEST:${u.id}:${today}`,
        triggeredBy: 'SYSTEM',
        links: { staffUserId: u.id },
        suppress: u.notificationPreferences.some((p) => !p.emailEnabled) ? 'PREFERENCE_DISABLED' : null,
        vars: { digest: { dateLabel: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(now) }, action: { adminUrl: `${this.env.ADMIN_URL ?? this.env.WEB_URL}/taches` } },
        blocks: { digest: block },
        greetingName: u.firstName,
        render: { jobRunId: ctx.jobRunId },
      });
      if (outcome === 'SENT') counters.sent++;
    }
    return counters;
  }

  /** AUT-035 — the lines of the table whose events come with package 3.8. */
  private closingLines(): void {
    this.autoClose.on('appointment.confirmed', (e) => [{ keys: [`appt-confirm:${e.aggregate.id}`], outcome: 'DONE', reason: t('ui.automation.close.appointmentConfirmed') }]);
    this.autoClose.on('appointment.cancelled', (e) => [
      { keys: [`appt-confirm:${e.aggregate.id}`, `visit-host-moved:${e.aggregate.id}`], outcome: 'CANCELLED', reason: t('ui.automation.close.appointmentCancelled') },
      { keys: [`visit-unavailable:${e.aggregate.id}`], outcome: 'DONE', reason: t('ui.automation.close.appointmentCancelled') },
    ]);
    this.autoClose.on(['appointment.done', 'appointment.no_show'], (e) => [{ keys: [`appt-outcome:${e.aggregate.id}`, `visit-unavailable:${e.aggregate.id}`], outcome: 'DONE', reason: t('ui.automation.close.appointmentReported') }]);
  }
}
