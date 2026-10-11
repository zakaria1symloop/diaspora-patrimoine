// AUT-035, CYC-220, TAC-004 — system effects of the tasks (AUT-003 step 1, before the rules):
//   · an automatic task closes by itself when what it asked for has happened (DONE, « Terminée automatiquement ») or
//     has no object any more (CANCELLED, with its reason). The table of AUT-035 is declared key by key: each module adds
//     its lines with `TaskAutoClose.on(eventType, …)` when it delivers the events that close its tasks;
//   · `task.assigned` (a PERSON entrusts a task to someone else) → `NS_TASK_ASSIGNED` and the e-mail `S_TASK_ASSIGNED`
//     (group `STAFF_TASKS`). A task born from a rule never emits it (AUT-032).
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import { MailerService } from '../communication/mailer.service.js';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { OutboxHandlers, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { toEnvelope, type EventEnvelope } from './event-catalogue.js';
import { taskLink } from './staff-links.js';
import { StaffNotifier } from './staff-notifications.service.js';
import { TasksService } from './tasks.service.js';

const t = createTranslator('fr');

export interface TaskClosing {
  /** `Task.dedupeKey` values (`lead-contact:{leadId}`). */
  keys: string[];
  outcome: 'DONE' | 'CANCELLED';
  /** Shown with « Terminée automatiquement : {raison} » (TAC-006), or as the reason of the cancellation. */
  reason: string;
}
export type TaskClosingRule = (event: EventEnvelope, db: PrismaService) => Promise<TaskClosing[]> | TaskClosing[];

const id = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

@Injectable()
export class TaskAutoClose implements OnModuleInit {
  private readonly rules = new Map<string, TaskClosingRule[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly tasks: TasksService,
    private readonly handlers: OutboxHandlers,
  ) {}

  /** Declares which tasks an event closes (a line of the table of AUT-035). To call from a constructor or `onModuleInit`. */
  on(eventTypes: string | readonly string[], rule: TaskClosingRule): void {
    for (const type of typeof eventTypes === 'string' ? [eventTypes] : eventTypes) this.rules.set(type, [...(this.rules.get(type) ?? []), rule]);
  }

  onModuleInit(): void {
    this.builtIn();
    // One group for every type: `*`, filtered here, so that lines declared later by other modules are served too.
    this.handlers.register({ name: 'tasks.auto-close', types: ['*'], handle: async (e) => void (await this.handle(e)) });
  }

  async handle(record: Pick<OutboxRecord, 'id' | 'type' | 'aggregateType' | 'aggregateId' | 'payload' | 'occurredAt'>): Promise<number> {
    const rules = this.rules.get(record.type);
    if (!rules?.length) return 0;
    const event = toEnvelope(record);
    let closed = 0;
    for (const rule of rules) {
      for (const closing of await rule(event, this.prisma)) closed += await this.tasks.closeAutomatically(this.prisma, this.clock.now(), closing.keys, closing.outcome, closing.reason);
    }
    return closed;
  }

  /** The lines of AUT-035 whose events exist in the delivered modules (requests, partner applications, pieces, Café). */
  private builtIn(): void {
    this.on('lead.first_contact', (e) => [{ keys: [`lead-contact:${e.aggregate.id}`], outcome: 'DONE', reason: t('ui.automation.close.firstContact') }]);
    this.on(['lead.closed', 'lead.marked_spam'], (e) => [{ keys: [`lead-contact:${e.aggregate.id}`, `restricted-lead:${e.aggregate.id}`], outcome: 'CANCELLED', reason: t('ui.automation.close.leadClosed') }]);
    this.on(['lead.application_approved', 'lead.application_declined'], (e) => [{ keys: [`partner-app:${e.aggregate.id}`], outcome: 'DONE', reason: t('ui.automation.close.applicationDecided') }]);
    // `consent:{dossierId}` — the transmission agreement is given (GED-070).
    this.on('consent.changed', async (e, db) => {
      if (e.data.type !== 'DATA_SHARING_PARTNERS' || e.data.granted !== true) return [];
      const clientId = e.clientId ?? (e.aggregate.type === 'Client' ? e.aggregate.id : null);
      const dossiers = clientId ? await db.dossier.findMany({ where: { clientId, deletedAt: null }, select: { id: true } }) : [];
      const ids = new Set([...dossiers.map((d) => d.id), ...(e.dossierId ? [e.dossierId] : [])]);
      return [{ keys: [...ids].map((d) => `consent:${d}`), outcome: 'DONE', reason: t('ui.automation.close.consentGiven') }];
    });
    // `doc-review:{dossierId}` — no piece of the dossier left RECEIVED; `doc-redo:{documentId}` — the piece is back.
    this.on(['document.received', 'document.validated', 'document.rejected', 'document.waived'], async (e, db) => {
      const out: TaskClosing[] = [];
      const documentId = e.aggregate.type === 'DossierDocument' ? e.aggregate.id : id(e.data.documentId);
      const dossierId = e.dossierId ?? (e.aggregate.type === 'Dossier' ? e.aggregate.id : null);
      if (documentId && (e.type === 'document.received' || e.type === 'document.validated')) out.push({ keys: [`doc-redo:${documentId}`], outcome: 'DONE', reason: t('ui.automation.close.docBack') });
      if (documentId && e.type === 'document.waived') out.push({ keys: [`doc-redo:${documentId}`], outcome: 'CANCELLED', reason: t('ui.automation.close.docWaived') });
      if (dossierId && e.type !== 'document.received') {
        const waiting = await db.dossierDocument.count({ where: { dossierId, status: 'RECEIVED' } });
        if (waiting === 0) out.push({ keys: [`doc-review:${dossierId}`], outcome: 'DONE', reason: t('ui.automation.close.docsReviewed') });
      }
      return out;
    });
    this.on('registration.attended', async (e, db) => {
      const reg = await db.eventRegistration.findUnique({ where: { id: e.aggregate.id }, select: { eventId: true } });
      return reg ? [{ keys: [`checkin:${reg.eventId}`], outcome: 'DONE', reason: t('ui.automation.close.checkedIn') }] : [];
    });
    this.on('dossier.resumed', (e) => [{ keys: [`resurfaced:${e.aggregate.id}`, `hold-ended:${e.aggregate.id}`], outcome: 'DONE', reason: t('ui.automation.close.dossierResumed') }]);
    this.on('client.archived', (e) => [{ keys: [`email-fix:${e.aggregate.id}`], outcome: 'CANCELLED', reason: t('ui.automation.close.clientArchived') }]);
  }
}

@Injectable()
export class TaskAssignedHandler implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly notifier: StaffNotifier,
    private readonly handlers: OutboxHandlers,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register({ name: 'tasks.assigned', types: ['task.assigned'], handle: (e) => this.handle(e) });
  }

  async handle(record: OutboxRecord): Promise<void> {
    const event = toEnvelope(record);
    const task = await this.prisma.task.findUnique({ where: { id: event.aggregate.id }, select: { id: true, title: true, status: true, dueAt: true, dueHasTime: true, assigneeId: true, deletedAt: true } });
    const authorId = event.actor?.id ?? null;
    // Read again (FIA-042): reassigned or closed meanwhile, there is nobody left to tell.
    if (!task || task.deletedAt || task.status !== 'OPEN' || !task.assigneeId || task.assigneeId === authorId) return;
    const [assignee, author] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: task.assigneeId }, select: { id: true, email: true, firstName: true, timezone: true, status: true, notificationPreferences: { where: { group: 'STAFF_TASKS' }, select: { emailEnabled: true } } } }),
      authorId ? this.prisma.user.findUnique({ where: { id: authorId }, select: { firstName: true, lastName: true } }) : null,
    ]);
    if (!assignee || assignee.status !== 'ACTIVE') return;
    const fullName = [author?.firstName, author?.lastName].filter(Boolean).join(' ');
    await this.notifier.notify(this.prisma, record.occurredAt, {
      type: 'NS_TASK_ASSIGNED',
      userIds: [assignee.id],
      title: t('ui.notifications.NS_TASK_ASSIGNED', { auteur: fullName, titre: task.title }),
      link: taskLink(task.id),
      entityType: 'Task',
      entityId: task.id,
      originId: event.originId,
    });
    const dueLabel = task.dueAt
      ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', ...(task.dueHasTime ? { timeStyle: 'short' as const } : {}), timeZone: assignee.timezone }).format(task.dueAt).replace(/(\d{1,2}):(\d{2})/, '$1 h $2')
      : null;
    await this.mailer.sendTemplate({
      templateCode: 'S_TASK_ASSIGNED',
      to: assignee.email,
      dedupeKey: `S_TASK_ASSIGNED:${record.id}:${assignee.email}`,
      triggeredBy: 'EVENT',
      links: { staffUserId: assignee.id },
      suppress: assignee.notificationPreferences.some((p) => !p.emailEnabled) ? 'PREFERENCE_DISABLED' : null, // NOT-020
      vars: { staff: { firstName: assignee.firstName }, actor: { fullName }, task: { title: task.title, dueLabel, url: `${this.env.ADMIN_URL ?? this.env.WEB_URL}${taskLink(task.id)}` } },
      greetingName: assignee.firstName,
      render: { eventId: record.id, taskId: task.id },
    });
  }
}
