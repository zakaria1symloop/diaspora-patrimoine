// EA-30 — the tasks of the team (TAC-001 … TAC-007, TAC-030, TAC-031, CYC-220). The list groups the open tasks by
// due date in the READER's time zone (En retard · Aujourd'hui · Demain · Cette semaine · Plus tard · Sans échéance),
// by priority then due date inside a group. Rights of TAC-004 (the assignee and the author; the others with
// `task.manage.all`; anyone takes an unassigned task) are applied by `TasksService` and announced here per task, so
// that a screen shows what the reader may do (BO-047). Perimeter (note 5 of the matrix): an adviser reads his tasks,
// the unassigned ones and those of the dossiers he sees.
import { Inject, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  TASK_VIEWS,
  grantOf,
  taskAssignSchema,
  taskBulkSchema,
  taskCancelSchema,
  taskCompleteSchema,
  taskCreateSchema,
  taskListQuerySchema,
  taskPostponeSchema,
  taskUpdateSchema,
  type TaskAbility,
  type TaskAttachment,
  type TaskBulkResult,
  type TaskDetail,
  type TaskGroup,
  type TaskItem,
  type TaskList,
  type TaskView,
} from '@dp/contracts';
import { stampBy } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { addDays, localDay, zonedInstant } from '../automation/timing.js';
import { REOPEN_DAYS, remindAtFor, TasksService, type ReminderKind } from '../automation/tasks.service.js';
import { dossierScope, maskName, clientName, staffName, StaffViews, type StaffView } from '../back-office/staff-view.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { EVENT_DISPATCHER, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { parseOrThrow } from '../platform/validation.js';
import { touchDossier } from '../dossiers-admin/candidate-effects.js';
import { groupOf } from './task-group.js';
import { endOfBusinessDay } from '@dp/domain';

const DAY = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
const GROUP_RANK: Record<TaskGroup, number> = { OVERDUE: 0, TODAY: 1, TOMORROW: 2, WEEK: 3, LATER: 4, NONE: 5, CLOSED: 6 };
/** Beyond, an open-task view is cut (its counters stay exact). */
const OPEN_CAP = 2000;

const INCLUDE = {
  assignee: { select: { id: true, firstName: true, lastName: true, status: true } },
  createdBy: { select: { firstName: true, lastName: true, status: true } },
  completedBy: { select: { firstName: true, lastName: true, status: true } },
  rule: { select: { name: true } },
  dossier: { select: { id: true, reference: true } },
  client: { select: { id: true, firstName: true, lastName: true } },
  lead: { select: { id: true, reference: true } },
  appointment: { select: { id: true, type: true, startsAt: true } },
  property: { select: { id: true, title: true } },
  promoter: { select: { id: true, brandName: true, legalName: true } },
  event: { select: { id: true, title: true } },
  submission: { select: { id: true, reference: true } },
  bank: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;
type Row = Prisma.TaskGetPayload<{ include: typeof INCLUDE }>;

export { groupOf } from './task-group.js';

/** TAC-005 « Reporter » — the new day of the due date. « La semaine prochaine »: the next Monday. */
export function postponeDay(to: string, today: string): string {
  if (to === 'TOMORROW') return addDays(today, 1);
  if (to === 'IN_3_DAYS') return addDays(today, 3);
  if (to === 'NEXT_WEEK') {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
    return addDays(today, 8 - weekday);
  }
  return to;
}

@Injectable()
export class TasksAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendarService,
    private readonly views: StaffViews,
    private readonly tasks: TasksService,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  /** Note 5 — an adviser (grant `scoped`): his tasks, the unassigned ones, and those of the dossiers he sees. */
  scope(staff: StaffView): Prisma.TaskWhereInput {
    if (grantOf(staff.role, 'task.read') !== 'scoped') return {};
    return { OR: [{ assigneeId: staff.userId }, { createdById: staff.userId }, { assigneeId: null }, { dossier: { AND: [{ deletedAt: null }, dossierScope(staff)] } }] };
  }

  private viewWhere(view: TaskView, staff: StaffView, now: Date): Prisma.TaskWhereInput {
    switch (view) {
      case 'mine':
        return { assigneeId: staff.userId, status: 'OPEN' };
      case 'to-take':
        return { assigneeId: null, status: 'OPEN' };
      case 'late':
        // refined in memory for the tasks due « in the day » (late only the day after)
        return { status: 'OPEN', dueAt: { lt: now } };
      case 'done':
        return { status: { in: ['DONE', 'CANCELLED'] }, updatedAt: { gte: new Date(now.getTime() - 30 * DAY) } };
      default:
        return { status: 'OPEN' };
    }
  }

  private mayChange(staff: StaffView, t: { assigneeId: string | null; createdById: string | null }): boolean {
    return t.assigneeId === staff.userId || t.createdById === staff.userId || staff.has('task.manage.all');
  }

  private abilities(staff: StaffView, t: Row, now: Date): TaskItem['can'] {
    const manage = staff.has('task.manage');
    const may = manage && this.mayChange(staff, t);
    const open = t.status === 'OPEN';
    const gate = (ok: boolean, reason: string): TaskAbility => (!may ? false : ok ? true : { reason });
    const closedAt = t.completedAt ?? t.updatedAt;
    return {
      complete: gate(open, 'TASK_CLOSED'),
      edit: gate(open, 'TASK_CLOSED'),
      reassign: gate(open, 'TASK_CLOSED'),
      cancel: gate(open, 'TASK_CLOSED'),
      reopen: !may || open ? false : now.getTime() - closedAt.getTime() <= REOPEN_DAYS * DAY ? true : { reason: 'TASK_TOO_OLD' },
      take: manage && open && t.assigneeId === null,
    };
  }

  private attachments(t: Row, staff: StaffView): TaskAttachment[] {
    const out: TaskAttachment[] = [];
    if (t.dossier) out.push({ kind: 'DOSSIER', label: t.dossier.reference, path: `/dossiers/${t.dossier.reference.toLowerCase()}` });
    if (t.client) out.push({ kind: 'CLIENT', label: (staff.masked ? maskName(t.client.firstName, t.client.lastName) : clientName(t.client)) ?? '—', path: `/clients/${t.client.id}` });
    if (t.lead) out.push({ kind: 'LEAD', label: t.lead.reference, path: `/demandes/${t.lead.reference.toLowerCase()}` });
    if (t.appointment) out.push({ kind: 'APPOINTMENT', label: t.appointment.type, path: `/agenda?rdv=${t.appointment.id}` });
    if (t.property) out.push({ kind: 'PROPERTY', label: t.property.title, path: `/catalogue/biens/${t.property.id}` });
    if (t.promoter) out.push({ kind: 'PROMOTER', label: t.promoter.brandName ?? t.promoter.legalName, path: `/promoteurs/${t.promoter.id}` });
    if (t.event) out.push({ kind: 'EVENT', label: t.event.title, path: `/cafes/${t.event.id}` });
    if (t.submission) out.push({ kind: 'SUBMISSION', label: t.submission.reference, path: null });
    if (t.bank) out.push({ kind: 'BANK', label: t.bank.name, path: `/banques/${t.bank.id}` });
    return out;
  }

  private item(t: Row, staff: StaffView, now: Date, timeZone: string): TaskItem {
    // ROL-015 — the title and description of a MANUAL task are free text: masked for SUPPORT.
    const hide = staff.masked && t.origin === 'MANUAL';
    return {
      id: t.id,
      version: t.version,
      title: hide ? '•••' : t.title,
      type: t.type,
      priority: t.priority,
      status: t.status,
      dueAt: t.dueAt?.toISOString() ?? null,
      dueHasTime: t.dueHasTime,
      group: groupOf(t, now, timeZone),
      overdue: groupOf(t, now, timeZone) === 'OVERDUE',
      attachments: this.attachments(t, staff),
      assignee: t.assignee ? { id: t.assignee.id, name: staffName(t.assignee) } : null,
      mine: t.assigneeId === staff.userId,
      origin: t.origin,
      ruleName: t.rule?.name ?? null,
      suggestedTemplateCode: t.suggestedTemplateCode,
      completedAt: t.completedAt?.toISOString() ?? null,
      closedAutomatically: t.status !== 'OPEN' && t.origin !== 'MANUAL' && t.completedById === null && t.updatedById === null,
      completionNote: hide ? null : t.completionNote,
      cancelReason: hide ? null : t.cancelReason,
      createdAt: t.createdAt.toISOString(),
      can: this.abilities(staff, t, now),
    };
  }

  private async zoneOf(auth: AuthContext): Promise<string> {
    const u = await this.prisma.user.findUnique({ where: { id: auth.userId }, select: { timezone: true } });
    return u?.timezone ?? (await this.calendar.load()).timeZone;
  }

  // ─── List (TAC-001, TAC-002) ──────────────────────────────────────────────

  /** `GET /admin/tasks` (`task.read`). */
  async list(auth: AuthContext, rawQuery: unknown): Promise<TaskList> {
    const staff = await this.views.of(auth);
    const parsed = taskListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST);
    const q = parsed.data;
    const now = this.clock.now();
    const timeZone = await this.zoneOf(auth);
    const view = q.view ?? 'mine';
    const term = q.q && q.q.length >= 2 && !staff.masked ? q.q : null;
    const agents = q.assigneeId.filter((v) => v !== 'none');
    const criteria = (skip?: 'type' | 'priority' | 'origin'): Prisma.TaskWhereInput => ({
      AND: [
        { deletedAt: null },
        this.scope(staff),
        this.viewWhere(view, staff, now),
        term ? { OR: [{ title: { contains: term, mode: 'insensitive' } }, { dossier: { reference: { contains: term, mode: 'insensitive' } } }, { lead: { reference: { contains: term, mode: 'insensitive' } } }] } : {},
        skip !== 'type' && q.type.length ? { type: { in: q.type } } : {},
        skip !== 'priority' && q.priority.length ? { priority: { in: q.priority } } : {},
        skip !== 'origin' && q.origin.length === 1 ? (q.origin[0] === 'MANUAL' ? { origin: 'MANUAL' } : { origin: { in: ['WORKFLOW', 'SYSTEM'] } }) : {},
        q.assigneeId.length ? { OR: [...(agents.length ? [{ assigneeId: { in: agents } }] : []), ...(q.assigneeId.includes('none') ? [{ assigneeId: null }] : [])] } : {},
        q.dossierId ? { dossierId: q.dossierId } : {},
        q.clientId ? { clientId: q.clientId } : {},
        q.leadId ? { leadId: q.leadId } : {},
      ],
    });
    const rows = await this.prisma.task.findMany({ where: criteria(), include: INCLUDE, orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }], take: OPEN_CAP });
    let items = rows.map((r) => this.item(r, staff, now, timeZone));
    if (view === 'late') items = items.filter((i) => i.overdue);
    if (q.due.length) items = items.filter((i) => (q.due as string[]).includes(i.group));
    // TAC-001 — by group, then priority, then due date (closed: most recent first).
    const desc = q.sort.startsWith('-');
    const key = q.sort.replace(/^-/, '');
    items.sort((a, b) => {
      if (view === 'done') return (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt);
      let c = 0;
      if (key === 'due') c = GROUP_RANK[a.group] - GROUP_RANK[b.group] || PRIORITY_RANK[a.priority]! - PRIORITY_RANK[b.priority]! || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9');
      else if (key === 'priority') c = PRIORITY_RANK[a.priority]! - PRIORITY_RANK[b.priority]! || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9');
      else c = a.createdAt.localeCompare(b.createdAt);
      return (desc ? -c : c) || a.id.localeCompare(b.id);
    });
    const total = items.length;
    const page = items.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);

    const [viewCounts, byType, byPriority, byOrigin, lateRows, agentRows] = await Promise.all([
      Promise.all(TASK_VIEWS.map((v) => (v === 'late' ? Promise.resolve(0) : this.prisma.task.count({ where: { AND: [{ deletedAt: null }, this.scope(staff), this.viewWhere(v, staff, now)] } })))),
      this.prisma.task.groupBy({ by: ['type'], where: criteria('type'), _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['priority'], where: criteria('priority'), _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['origin'], where: criteria('origin'), _count: { _all: true } }),
      this.prisma.task.findMany({ where: { AND: [{ deletedAt: null }, this.scope(staff), { status: 'OPEN', dueAt: { lt: now } }] }, select: { status: true, dueAt: true, dueHasTime: true }, take: OPEN_CAP }),
      this.prisma.membership.findMany({ where: { revokedAt: null, suspendedAt: null, organization: { type: 'OPERATOR' }, role: { in: ['OWNER', 'ADMIN', 'AGENT'] }, user: { kind: 'STAFF', status: 'ACTIVE' } }, select: { user: { select: { id: true, firstName: true, lastName: true } } } }),
    ]);
    const views = Object.fromEntries(TASK_VIEWS.map((v, i) => [v, viewCounts[i]!])) as Record<TaskView, number>;
    views.late = lateRows.filter((r) => groupOf(r, now, timeZone) === 'OVERDUE').length;
    const counts = (list: { _count: { _all: number } }[], keyOf: (r: never) => string) => Object.fromEntries(list.map((r) => [keyOf(r as never), r._count._all]));
    const origin = counts(byOrigin, (r: { origin: string }) => r.origin);
    return {
      data: page,
      meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
      views,
      facets: { type: counts(byType, (r: { type: string }) => r.type), priority: counts(byPriority, (r: { priority: string }) => r.priority), origin: { MANUAL: origin.MANUAL ?? 0, AUTOMATIC: (origin.WORKFLOW ?? 0) + (origin.SYSTEM ?? 0) } },
      agents: agentRows.map((m) => ({ id: m.user.id, name: staffName(m.user) ?? '' })).filter((a) => a.name).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    };
  }

  /** TAC-007 — the counter of the menu: the reader's own overdue tasks. */
  async countOverdue(auth: AuthContext): Promise<number> {
    const now = this.clock.now();
    const timeZone = await this.zoneOf(auth);
    const rows = await this.prisma.task.findMany({ where: { deletedAt: null, status: 'OPEN', assigneeId: auth.userId, dueAt: { lt: now } }, select: { status: true, dueAt: true, dueHasTime: true }, take: OPEN_CAP });
    return rows.filter((r) => groupOf(r, now, timeZone) === 'OVERDUE').length;
  }

  // ─── One task ─────────────────────────────────────────────────────────────

  private async visible(staff: StaffView, id: string): Promise<Row> {
    if (!UUID.test(id)) throw AppError.notFound();
    const t = await this.prisma.task.findFirst({ where: { AND: [{ id, deletedAt: null }, this.scope(staff)] }, include: INCLUDE });
    if (!t) throw AppError.notFound();
    return t;
  }

  /** `GET /admin/tasks/{id}` (`task.read`). */
  async detail(auth: AuthContext, id: string): Promise<TaskDetail> {
    const staff = await this.views.of(auth);
    const t = await this.visible(staff, id);
    const now = this.clock.now();
    const hide = staff.masked && t.origin === 'MANUAL';
    return {
      ...this.item(t, staff, now, await this.zoneOf(auth)),
      description: hide ? null : t.description,
      reminderKind: t.reminderKind,
      remindAt: t.remindAt?.toISOString() ?? null,
      createdBy: staffName(t.createdBy),
      completedBy: staffName(t.completedBy),
      links: { dossierId: t.dossierId, clientId: t.clientId, leadId: t.leadId, appointmentId: t.appointmentId },
    };
  }

  // ─── Writes (TAC-003 … TAC-005) ───────────────────────────────────────────

  /** The due instant of TAC-003: with an hour, that hour in the zone; without, the end of that business day. */
  private async due(date: string | null, time: string | null, timeZone: string): Promise<{ dueAt: Date | null; dueHasTime: boolean }> {
    if (!date) return { dueAt: null, dueHasTime: false };
    if (time) return { dueAt: zonedInstant(date, time, timeZone), dueHasTime: true };
    return { dueAt: endOfBusinessDay(date, await this.calendar.load()), dueHasTime: false };
  }

  /** The objects a task is attached to must be visible to its author (ROL-018). */
  private async assertLinks(staff: StaffView, links: { dossierId: string | null; clientId: string | null; leadId: string | null }): Promise<{ dossierId: string | null; clientId: string | null; leadId: string | null }> {
    let clientId = links.clientId;
    if (links.dossierId) {
      const d = await this.prisma.dossier.findFirst({ where: { AND: [{ id: links.dossierId, deletedAt: null }, dossierScope(staff)] }, select: { clientId: true } });
      if (!d) throw AppError.validation([{ field: 'links.dossierId', code: 'INVALID_CHOICE' }]);
      clientId ??= d.clientId;
    }
    if (links.leadId && !(await this.prisma.lead.findFirst({ where: { id: links.leadId }, select: { id: true } }))) throw AppError.validation([{ field: 'links.leadId', code: 'INVALID_CHOICE' }]);
    if (clientId && !(await this.prisma.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { id: true } }))) throw AppError.validation([{ field: 'links.clientId', code: 'INVALID_CHOICE' }]);
    return { dossierId: links.dossierId, clientId, leadId: links.leadId };
  }

  private async assertAssignee(id: string): Promise<void> {
    const ok = await this.prisma.membership.findFirst({ where: { userId: id, revokedAt: null, suspendedAt: null, organization: { type: 'OPERATOR' }, role: { in: ['OWNER', 'ADMIN', 'AGENT'] }, user: { status: 'ACTIVE' } }, select: { userId: true } });
    if (!ok) throw AppError.validation([{ field: 'assignee', code: 'INVALID_CHOICE' }]);
  }

  /** `POST /admin/tasks` (`task.manage`). Entrusting it to a colleague notifies him (`NS_TASK_ASSIGNED`, TAC-004). */
  async create(auth: AuthContext, body: unknown): Promise<TaskDetail> {
    const input = parseOrThrow(taskCreateSchema, body);
    const staff = await this.views.of(auth);
    const links = await this.assertLinks(staff, input.links);
    const assigneeId = input.assignee === 'me' ? auth.userId : input.assignee === 'team' ? null : input.assignee;
    if (assigneeId && assigneeId !== auth.userId) await this.assertAssignee(assigneeId);
    const timeZone = await this.zoneOf(auth);
    const due = await this.due(input.dueDate, input.dueTime, timeZone);
    const now = this.clock.now();
    const id = await this.prisma.$transaction(async (tx) => {
      const r = await this.tasks.create(tx, auth.actor, now, {
        title: input.title,
        description: input.description,
        type: input.type,
        priority: input.priority,
        links,
        assigneeId,
        dueAt: due.dueAt,
        dueHasTime: due.dueHasTime,
        reminderKind: input.reminderKind,
        remindAt: input.remindAt ? new Date(input.remindAt) : null,
        timeZone,
        origin: 'MANUAL',
      });
      return r.id;
    });
    this.dispatcher.wake();
    return this.detail(auth, id);
  }

  private async act(auth: AuthContext, id: string, fn: (staff: StaffView, t: Row, now: Date) => Promise<void>): Promise<TaskDetail> {
    const staff = await this.views.of(auth);
    const t = await this.visible(staff, id);
    await fn(staff, t, this.clock.now());
    this.dispatcher.wake();
    return this.detail(auth, id);
  }

  /** `PATCH /admin/tasks/{id}` (`task.manage`) — the fields of TAC-003; `remindAt` follows `reminderKind`. */
  async update(auth: AuthContext, id: string, body: unknown): Promise<TaskDetail> {
    const input = parseOrThrow(taskUpdateSchema, body);
    return this.act(auth, id, async (staff, t, now) => {
      if (!this.mayChange(staff, t)) throw new AppError(ErrorCode.FORBIDDEN);
      if (t.status !== 'OPEN') throw AppError.conflictState('TASK_CLOSED');
      if (t.version !== input.version) throw new AppError(ErrorCode.CONFLICT_VERSION);
      const timeZone = await this.zoneOf(auth);
      const data: Prisma.TaskUncheckedUpdateInput = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.type !== undefined) data.type = input.type;
      if (input.priority !== undefined) data.priority = input.priority;
      if (input.description !== undefined) data.description = input.description;
      let dueAt = t.dueAt;
      let dueHasTime = t.dueHasTime;
      if (input.dueDate !== undefined || input.dueTime !== undefined) {
        const date = input.dueDate !== undefined ? input.dueDate : t.dueAt ? localDay(t.dueAt, timeZone) : null;
        const time = input.dueTime !== undefined ? input.dueTime : t.dueHasTime && t.dueAt ? new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t.dueAt) : null;
        ({ dueAt, dueHasTime } = await this.due(date, time, timeZone));
        Object.assign(data, { dueAt, dueHasTime });
      }
      const kind = (input.reminderKind ?? t.reminderKind) as ReminderKind;
      const custom = input.remindAt !== undefined ? (input.remindAt ? new Date(input.remindAt) : null) : t.remindAt;
      data.reminderKind = kind;
      data.remindAt = remindAtFor(kind, dueAt, dueHasTime, timeZone, custom);
      await this.prisma.$transaction(async (tx) => {
        await tx.task.update({ where: { id: t.id }, data: { ...data, version: { increment: 1 }, updatedById: stampBy(auth.actor), updatedAt: now } });
        await writeAudit(tx, auth.actor, now, { action: 'task.updated', entityType: 'task', entityId: t.id, after: Object.fromEntries(Object.keys(data).map((k) => [k, k === 'title' || k === 'description' ? '[modifié]' : (data as Record<string, unknown>)[k]])), clientId: t.clientId });
      });
    });
  }

  /** `POST /admin/tasks/{id}/postpone` (`task.manage`) — TAC-005; a reminder on a chosen date (`CUSTOM`) does not move. */
  async postpone(auth: AuthContext, id: string, body: unknown): Promise<TaskDetail> {
    const { to } = parseOrThrow(taskPostponeSchema, body);
    return this.act(auth, id, async (staff, t, now) => {
      if (!this.mayChange(staff, t)) throw new AppError(ErrorCode.FORBIDDEN);
      if (t.status !== 'OPEN') throw AppError.conflictState('TASK_CLOSED');
      const timeZone = await this.zoneOf(auth);
      const day = postponeDay(to, localDay(now, timeZone));
      const time = t.dueHasTime && t.dueAt ? new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t.dueAt) : null;
      const { dueAt, dueHasTime } = await this.due(day, time, timeZone);
      const kind = t.reminderKind as ReminderKind;
      await this.prisma.$transaction(async (tx) => {
        await tx.task.update({ where: { id: t.id }, data: { dueAt, dueHasTime, remindAt: remindAtFor(kind, dueAt, dueHasTime, timeZone, t.remindAt), version: { increment: 1 }, updatedById: stampBy(auth.actor), updatedAt: now } });
        await writeAudit(tx, auth.actor, now, { action: 'task.updated', entityType: 'task', entityId: t.id, before: { dueAt: t.dueAt }, after: { dueAt }, clientId: t.clientId });
      });
    });
  }

  /** `POST /admin/tasks/{id}/complete` (`task.manage`) — the note shows in the timeline of the attached object (TAC-005). */
  async complete(auth: AuthContext, id: string, body: unknown): Promise<TaskDetail> {
    const { note } = parseOrThrow(taskCompleteSchema, body);
    return this.act(auth, id, async (_staff, t, now) => {
      await this.prisma.$transaction(async (tx) => {
        await this.tasks.complete(tx, auth.actor, now, t.id, note);
        if (t.dossierId) await touchDossier(tx, t.dossierId, now); // MOD-311 « une tâche terminée »
      });
    });
  }

  /** `POST /admin/tasks/{id}/cancel` (`task.manage`). */
  async cancel(auth: AuthContext, id: string, body: unknown): Promise<TaskDetail> {
    const { reason } = parseOrThrow(taskCancelSchema, body);
    return this.act(auth, id, (_staff, t, now) => this.prisma.$transaction((tx) => this.tasks.cancel(tx, auth.actor, now, t.id, reason)));
  }

  /** `POST /admin/tasks/{id}/reopen` (`task.manage`) — within 30 days (CYC-220). */
  async reopen(auth: AuthContext, id: string): Promise<TaskDetail> {
    return this.act(auth, id, (_staff, t, now) => this.prisma.$transaction((tx) => this.tasks.reopen(tx, auth.actor, now, t.id)));
  }

  /** `POST /admin/tasks/{id}/take` (`task.manage`) — anyone takes an unassigned task (TAC-004). */
  async take(auth: AuthContext, id: string): Promise<TaskDetail> {
    return this.act(auth, id, async (_staff, t, now) => {
      if (t.assigneeId !== null) throw AppError.conflictState('TASK_ALREADY_TAKEN');
      await this.prisma.$transaction((tx) => this.tasks.assign(tx, auth.actor, now, t.id, auth.userId));
    });
  }

  /** `POST /admin/tasks/{id}/assign` (`task.manage`) — to a colleague, or to the team (`null`). */
  async assign(auth: AuthContext, id: string, body: unknown): Promise<TaskDetail> {
    const { assigneeId } = parseOrThrow(taskAssignSchema, body);
    if (assigneeId) await this.assertAssignee(assigneeId);
    return this.act(auth, id, (_staff, t, now) => this.prisma.$transaction((tx) => this.tasks.assign(tx, auth.actor, now, t.id, assigneeId)));
  }

  /** `POST /admin/tasks/bulk` (`task.manage`) — BO-035: line by line, under the rights of TAC-004. */
  async bulk(auth: AuthContext, body: unknown): Promise<TaskBulkResult> {
    const input = parseOrThrow(taskBulkSchema, body);
    if (input.action === 'assign' && input.assigneeId) await this.assertAssignee(input.assigneeId);
    const out: TaskBulkResult = { done: 0, refused: [] };
    for (const id of input.ids) {
      try {
        if (input.action === 'complete') await this.complete(auth, id, {});
        else if (input.action === 'cancel') await this.cancel(auth, id, {});
        else await this.assign(auth, id, { assigneeId: input.assigneeId ?? null });
        out.done++;
      } catch (err) {
        out.refused.push({ id, reason: err instanceof AppError ? (err.options.reason ?? err.code) : 'INTERNAL_ERROR' });
      }
    }
    return out;
  }
}
