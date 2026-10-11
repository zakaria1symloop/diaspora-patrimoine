// CYC-220, TAC-003…TAC-006, AUT-032, AUT-035 — the tasks of the team: the use cases behind the screens of package 3.8
// (EA-30) and behind the automations. Every write is audited (`task.created`, `task.updated`) in the caller's
// transaction (FIA-001); a person who entrusts a task to someone else emits `task.assigned` (NS_TASK_ASSIGNED and its
// e-mail leave from the outbox); a task born from a rule or from a system effect never does (AUT-032).
//
// `Task.dedupeKey` is unique among OPEN tasks (partial unique index): an automation never creates the same task twice,
// and the same key closes it when what it asked for has happened (AUT-035).
import { Injectable } from '@nestjs/common';
import { endOfBusinessDay, localDate, type BusinessCalendar } from '@dp/domain';
import { ErrorCode, roleHasPermission, type StaffRole as ContractRole } from '@dp/contracts';
import { SYSTEM_ACTOR, stampBy, type Actor } from '../admin/actor.js';
import { diff, writeAudit } from '../admin/audit.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { OutboxWriter } from '../platform/outbox.js';
import type { PrismaService } from '../platform/prisma.service.js';
import { isUniqueViolation, type Tx } from '../platform/tx.js';
import { domainEvent } from './event-catalogue.js';
import { addDays, zonedInstant } from './timing.js';

type Db = Tx | PrismaService;

export type TaskType = 'CALL' | 'FOLLOW_UP' | 'DOC_REVIEW' | 'BANK_FOLLOW_UP' | 'VISIT' | 'MEETING' | 'CONTENT' | 'OTHER';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ReminderKind = 'NONE' | 'AT_DUE' | 'BEFORE_15M' | 'BEFORE_1H' | 'BEFORE_1D' | 'CUSTOM';

/** The objects a task may be attached to (MOD § 1.6). */
export interface TaskLinks {
  dossierId?: string | null;
  clientId?: string | null;
  leadId?: string | null;
  submissionId?: string | null;
  eventId?: string | null;
  propertyId?: string | null;
  promoterId?: string | null;
  bankId?: string | null;
  bankProductId?: string | null;
  appointmentId?: string | null;
  reservationId?: string | null;
  feedbackId?: string | null;
}
export const TASK_LINK_KEYS = [
  'dossierId', 'clientId', 'leadId', 'submissionId', 'eventId', 'propertyId', 'promoterId', 'bankId', 'bankProductId', 'appointmentId', 'reservationId', 'feedbackId',
] as const satisfies readonly (keyof TaskLinks)[];

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  type?: TaskType;
  priority?: TaskPriority;
  links?: TaskLinks;
  suggestedTemplateCode?: string | null;
  /** Null: « à prendre » by the team. */
  assigneeId: string | null;
  dueAt?: Date | null;
  /** False: due « in the day » (TAC-003). */
  dueHasTime?: boolean;
  reminderKind?: ReminderKind;
  /** The chosen date of a `CUSTOM` reminder. */
  remindAt?: Date | null;
  /** Time zone of the reminder of a due date without hour (the assignee's; else the business calendar's). */
  timeZone: string;
  origin: 'MANUAL' | 'WORKFLOW' | 'SYSTEM';
  ruleId?: string | null;
  /** AUT-032 — required for an automatic task: no second OPEN task with the same key. */
  dedupeKey?: string | null;
}

/** TAC-003 — what « Modifier » and « Reporter » may change; an absent key keeps its value. */
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  type?: TaskType;
  priority?: TaskPriority;
  dueAt?: Date | null;
  dueHasTime?: boolean;
  reminderKind?: ReminderKind;
  /** The chosen date of a `CUSTOM` reminder. */
  remindAt?: Date | null;
  /** Null: « à prendre » by the team. */
  assigneeId?: string | null;
  links?: TaskLinks;
  /** Time zone of the reminder of a due date without hour. */
  timeZone: string;
}

export interface TaskOutcome {
  id: string;
  /** False: an OPEN task already carried the key; nothing was created. */
  created: boolean;
}

const MINUTE = 60_000;

/** AUT-032 — 2 000 characters at most; beyond, cut and ended by « … ». */
export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** MOD § 1.6 `remindAt` — computed from `reminderKind`; a due date without hour reminds at 9:00 (TAC-030). */
export function remindAtFor(kind: ReminderKind, dueAt: Date | null, dueHasTime: boolean, timeZone: string, custom: Date | null = null): Date | null {
  if (kind === 'NONE') return null;
  if (kind === 'CUSTOM') return custom;
  if (!dueAt) return null;
  if (!dueHasTime) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dueAt);
    return zonedInstant(kind === 'BEFORE_1D' ? addDays(day, -1) : day, '09:00', timeZone);
  }
  const before = kind === 'BEFORE_15M' ? 15 * MINUTE : kind === 'BEFORE_1H' ? 60 * MINUTE : kind === 'BEFORE_1D' ? 24 * 60 * MINUTE : 0;
  return new Date(dueAt.getTime() - before);
}

/** TAC-003 — a due date without hour is the end of the working day of that date. */
export function dueInTheDay(instant: Date, cal: BusinessCalendar): Date {
  return endOfBusinessDay(localDate(instant, cal), cal);
}

/** CYC-220 — a closed task reopens within 30 days. */
export const REOPEN_DAYS = 30;

const AUDIT_FIELDS = ['title', 'type', 'priority', 'status', 'assigneeId', 'dueAt', 'dedupeKey', 'origin'] as const;
const snapshot = (row: Record<string, unknown>) => Object.fromEntries(AUDIT_FIELDS.map((k) => [k, row[k] ?? null]));

@Injectable()
export class TasksService {
  constructor(private readonly outbox: OutboxWriter) {}

  /**
   * Creates a task. With a `dedupeKey`, an OPEN task carrying it wins: nothing is created (AUT-032).
   * `actor` is the person (MANUAL) or `SYSTEM_ACTOR` (WORKFLOW, SYSTEM).
   */
  async create(db: Db, actor: Actor, at: Date, input: CreateTaskInput): Promise<TaskOutcome> {
    const title = input.title.trim();
    if (!title) throw AppError.validation([{ field: 'title', code: 'REQUIRED' }]);
    if (title.length > 160) throw AppError.validation([{ field: 'title', code: 'TOO_LONG' }]);
    const dedupeKey = input.dedupeKey ? input.dedupeKey.slice(0, 120) : null;
    if (dedupeKey) {
      const open = await db.task.findFirst({ where: { dedupeKey, status: 'OPEN', deletedAt: null }, select: { id: true } });
      if (open) return { id: open.id, created: false };
    }
    const dueAt = input.dueAt ?? null;
    const dueHasTime = input.dueHasTime ?? true;
    const reminderKind = input.reminderKind ?? 'AT_DUE';
    const links = input.links ?? {};
    const data: Prisma.TaskUncheckedCreateInput = {
      id: newId(),
      title,
      description: input.description ? clip(input.description, 2000) : null,
      type: input.type ?? 'FOLLOW_UP',
      priority: input.priority ?? 'NORMAL',
      status: 'OPEN',
      ...Object.fromEntries(TASK_LINK_KEYS.map((k) => [k, links[k] ?? null])),
      suggestedTemplateCode: input.suggestedTemplateCode ?? null,
      assigneeId: input.assigneeId,
      createdById: stampBy(actor),
      origin: input.origin,
      ruleId: input.ruleId ?? null,
      dedupeKey,
      dueAt,
      dueHasTime,
      reminderKind,
      remindAt: remindAtFor(reminderKind, dueAt, dueHasTime, input.timeZone, input.remindAt ?? null),
      createdAt: at,
      updatedAt: at,
    };
    try {
      await db.task.create({ data });
    } catch (err) {
      // Two workers at the same instant: the partial unique index decided (FIA-041).
      if (!dedupeKey || !isUniqueViolation(err)) throw err;
      const open = await db.task.findFirst({ where: { dedupeKey, status: 'OPEN', deletedAt: null }, select: { id: true } });
      if (open) return { id: open.id, created: false };
      throw err;
    }
    await writeAudit(db as Tx, actor, at, { action: 'task.created', entityType: 'task', entityId: data.id, after: snapshot(data), clientId: links.clientId ?? null });
    // AUT-010 `task.assigned` — a PERSON entrusts the task to someone else.
    if (input.origin === 'MANUAL' && actor.type === 'USER' && input.assigneeId && input.assigneeId !== actor.userId) await this.emitAssigned(db, actor, at, data.id);
    return { id: data.id, created: true };
  }

  /** TAC-005 « Réaffecter » (to a colleague, or to the team with `null`); also « prendre » an unassigned task. */
  async assign(db: Db, actor: Actor, at: Date, taskId: string, assigneeId: string | null): Promise<void> {
    const task = await this.open(db, taskId);
    // TAC-004 — anyone may take an unassigned task; otherwise the assignee, the author, or `task.manage.all`.
    const taking = task.assigneeId === null && assigneeId !== null && assigneeId === actor.userId;
    if (!taking) this.assertMayChange(actor, task);
    if (task.assigneeId === assigneeId) return;
    await db.task.update({ where: { id: taskId }, data: { assigneeId, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: at } });
    await writeAudit(db as Tx, actor, at, { action: 'task.updated', entityType: 'task', entityId: taskId, before: { assigneeId: task.assigneeId }, after: { assigneeId }, clientId: task.clientId });
    if (actor.type === 'USER' && assigneeId && assigneeId !== actor.userId) await this.emitAssigned(db, actor, at, taskId);
  }

  /**
   * TAC-003 « Modifier », TAC-005 « Reporter » — changes the fields of an OPEN task (rights of TAC-004). `remindAt`
   * follows `reminderKind` (a `CUSTOM` date does not move unless a new one is given). `expectedVersion`: MOD-007.
   */
  async update(db: Db, actor: Actor, at: Date, taskId: string, patch: UpdateTaskInput, expectedVersion?: number): Promise<void> {
    const task = await this.open(db, taskId);
    this.assertMayChange(actor, task);
    if (expectedVersion !== undefined && task.version !== expectedVersion) {
      throw new AppError(ErrorCode.CONFLICT_VERSION, { params: { currentVersion: task.version, updatedByFirstName: null, updatedAt: task.updatedAt.toISOString() } });
    }
    const title = patch.title !== undefined ? patch.title.trim() : task.title;
    if (!title) throw AppError.validation([{ field: 'title', code: 'REQUIRED' }]);
    if (title.length > 160) throw AppError.validation([{ field: 'title', code: 'TOO_LONG' }]);
    const dueAt = patch.dueAt !== undefined ? patch.dueAt : task.dueAt;
    const dueHasTime = patch.dueHasTime !== undefined ? patch.dueHasTime : task.dueHasTime;
    const reminderKind = (patch.reminderKind ?? task.reminderKind) as ReminderKind;
    const custom = patch.remindAt !== undefined ? patch.remindAt : reminderKind === 'CUSTOM' ? task.remindAt : null;
    const links = patch.links ?? {};
    const next = {
      title,
      description: patch.description !== undefined ? (patch.description ? clip(patch.description, 2000) : null) : task.description,
      type: patch.type ?? task.type,
      priority: patch.priority ?? task.priority,
      dueAt,
      dueHasTime,
      reminderKind,
      remindAt: remindAtFor(reminderKind, dueAt, dueHasTime, patch.timeZone, custom),
      ...Object.fromEntries(TASK_LINK_KEYS.filter((k) => links[k] !== undefined).map((k) => [k, links[k] ?? null])),
    };
    const before = snapshot(task as unknown as Record<string, unknown>);
    await db.task.update({ where: { id: taskId }, data: { ...next, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: at } });
    const changed = diff(before, snapshot({ ...task, ...next } as unknown as Record<string, unknown>));
    await writeAudit(db as Tx, actor, at, { action: 'task.updated', entityType: 'task', entityId: taskId, before: changed?.before ?? {}, after: changed?.after ?? { updated: true }, clientId: task.clientId });
    if (patch.assigneeId !== undefined && patch.assigneeId !== task.assigneeId) await this.assign(db, actor, at, taskId, patch.assigneeId);
  }

  /** CYC-220 OPEN → DONE, with an optional note of what was done (TAC-005). */
  async complete(db: Db, actor: Actor, at: Date, taskId: string, note?: string | null): Promise<void> {
    const task = await this.open(db, taskId);
    this.assertMayChange(actor, task);
    await this.close(db, actor, at, task, 'DONE', note ?? null);
  }

  /** CYC-220 OPEN → CANCELLED (optional reason). */
  async cancel(db: Db, actor: Actor, at: Date, taskId: string, reason?: string | null): Promise<void> {
    const task = await this.open(db, taskId);
    this.assertMayChange(actor, task);
    await this.close(db, actor, at, task, 'CANCELLED', reason ?? null);
  }

  /** CYC-220 DONE or CANCELLED → OPEN, within 30 days. Refused when another OPEN task took its key meanwhile. */
  async reopen(db: Db, actor: Actor, at: Date, taskId: string): Promise<void> {
    const task = await db.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw AppError.notFound();
    this.assertMayChange(actor, task);
    const closedAt = task.completedAt ?? task.updatedAt;
    if (task.status === 'OPEN' || at.getTime() - closedAt.getTime() > REOPEN_DAYS * 86_400_000) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (task.dedupeKey) {
      const other = await db.task.findFirst({ where: { dedupeKey: task.dedupeKey, status: 'OPEN', deletedAt: null }, select: { id: true } });
      if (other) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    }
    await db.task.update({
      where: { id: taskId },
      data: { status: 'OPEN', completedAt: null, completedById: null, completionNote: null, cancelReason: null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: at },
    });
    await writeAudit(db as Tx, actor, at, { action: 'task.updated', entityType: 'task', entityId: taskId, before: { status: task.status }, after: { status: 'OPEN' }, clientId: task.clientId });
  }

  /**
   * AUT-035 — the OPEN tasks carrying one of these keys close by themselves: `DONE` (« Terminée automatiquement »,
   * `completedById` null) when what they asked for has happened, `CANCELLED` with its reason when they have no object
   * any more. Returns the number of tasks closed.
   */
  async closeAutomatically(db: Db, at: Date, keys: readonly string[], outcome: 'DONE' | 'CANCELLED', reason: string): Promise<number> {
    if (keys.length === 0) return 0;
    const tasks = await db.task.findMany({ where: { dedupeKey: { in: [...keys] }, status: 'OPEN', deletedAt: null } });
    for (const task of tasks) await this.close(db, SYSTEM_ACTOR, at, task, outcome, reason);
    return tasks.length;
  }

  // ---------- internals ----------

  private async open(db: Db, taskId: string) {
    const task = await db.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw AppError.notFound();
    if (task.status !== 'OPEN') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    return task;
  }

  /** TAC-004 — the assignee and the author; the others with `task.manage.all`. The system always may. */
  private assertMayChange(actor: Actor, task: { assigneeId: string | null; createdById: string | null }): void {
    if (actor.type === 'SYSTEM') return;
    if (actor.userId && (task.assigneeId === actor.userId || task.createdById === actor.userId)) return;
    if (actor.role && roleHasPermission(actor.role as ContractRole, 'task.manage.all')) return;
    throw AppError.notFound(); // SEC-031: an object out of reach does not exist.
  }

  private async close(
    db: Db,
    actor: Actor,
    at: Date,
    task: { id: string; status: string; clientId: string | null },
    outcome: 'DONE' | 'CANCELLED',
    text: string | null,
  ): Promise<void> {
    const moved = await db.task.updateMany({
      where: { id: task.id, status: 'OPEN' },
      data:
        outcome === 'DONE'
          ? { status: 'DONE', completedAt: at, completedById: stampBy(actor), completionNote: text ? text.slice(0, 1000) : null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: at }
          : { status: 'CANCELLED', cancelReason: text ? text.slice(0, 300) : null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: at },
    });
    if (moved.count !== 1) return; // Closed by someone else meanwhile: nothing more to do.
    await writeAudit(db as Tx, actor, at, {
      action: 'task.updated',
      entityType: 'task',
      entityId: task.id,
      before: { status: 'OPEN' },
      after: { status: outcome },
      clientId: task.clientId,
      reason: text,
    });
  }

  private async emitAssigned(db: Db, actor: Actor, at: Date, taskId: string): Promise<void> {
    await this.outbox.add(db as Tx, domainEvent({ type: 'task.assigned', aggregate: { type: 'Task', id: taskId }, actor: { type: 'USER', id: actor.userId } }), at);
  }
}
