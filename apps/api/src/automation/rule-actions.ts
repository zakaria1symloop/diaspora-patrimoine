// AUT-032 (`CREATE_TASK`), AUT-033 (`NOTIFY_STAFF`), NOT-035 — the two actions of a rule that make the team act.
//
// One operation, one notification: a rule that notifies someone AND creates him a task writes one notification, the
// rule's, which opens the task; `NS_TASK_AUTO` exists only for a HIGH or URGENT task whose recipient is told by nothing
// else — or for a task nobody could receive, whatever its priority (the ADMINS are told).
import { Injectable } from '@nestjs/common';
import { addBusinessDays, type BusinessCalendar } from '@dp/domain';
import { createTranslator } from '@dp/i18n';
import type { SettingKey } from '@dp/contracts';
import { settingsRegistry } from '@dp/contracts';
import { SYSTEM_ACTOR } from '../admin/actor.js';
import { renderTemplate, type TemplateVars } from '../communication/template-renderer.js';
import type { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { RuleContext } from './rule-context.js';
import { AGENT_REFS, type AgentRef, type CreateTaskAction, type NotifyStaffAction, type RuleAction, type StaffRecipientRef } from './rule-definition.js';
import type { ActionResult } from './rule-mail.js';
import type { StaffSnapshot } from './staff-directory.js';
import { staffLink, taskLink } from './staff-links.js';
import { StaffNotifier } from './staff-notifications.service.js';
import { clip, dueInTheDay, TasksService } from './tasks.service.js';

const t = createTranslator('fr');

/** What the task action of an execution left for the following ones (AUT-033: the alert takes its title and its link). */
export interface TaskState {
  id: string;
  created: boolean;
  title: string;
}

export interface ActionInput<A extends RuleAction> {
  action: A;
  ctx: RuleContext;
  vars: TemplateVars;
  rule: { id: string; code: string | null; name: string; actions: readonly RuleAction[] };
  execution: { id: string; createdAt: Date; /** A rule with a delay says something else, later: its notification leaves normally (NOT-035). */ deferred: boolean };
  staff: StaffSnapshot;
  cal: BusinessCalendar;
  now: Date;
  /** Position of the action in the rule. */
  index: number;
  /** The task created (or found) by a previous action of this execution. */
  task: TaskState | null;
}

/** AUT-036 — replaces the dynamic fields of a title or a text; plain text, one line. */
export function renderText(source: string, vars: TemplateVars): string {
  return renderTemplate({ subject: source, body: '' }, vars, { siteUrl: 'https://invalid.local' }).subject;
}

const asList = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);
const isAgentRef = (v: string): v is AgentRef => (AGENT_REFS as readonly string[]).includes(v);

@Injectable()
export class RuleTeamActions {
  constructor(
    private readonly tasks: TasksService,
    private readonly notifier: StaffNotifier,
    private readonly settings: SettingsService,
  ) {}

  /** The origin of a notification for the priority of NOT-035. */
  private origin(input: ActionInput<RuleAction>): string {
    return input.execution.deferred ? input.execution.id : input.ctx.event.originId;
  }

  /** Accounts a `NOTIFY_STAFF` action reaches. The author of the action that triggered the rule is not told (NOT-018). */
  private alertRecipients(action: NotifyStaffAction, input: ActionInput<RuleAction>): string[] {
    const author = input.execution.deferred ? null : input.ctx.event.actor?.id;
    return input.staff
      .resolve(asList(action.recipients) as StaffRecipientRef[], input.ctx.agentIds(), action.fallback ? (asList(action.fallback) as StaffRecipientRef[]) : undefined)
      .map((m) => m.userId)
      .filter((id) => id !== author);
  }

  // ---------- CREATE_TASK ----------

  async createTask(db: PrismaService, input: ActionInput<CreateTaskAction>): Promise<{ result: ActionResult; task: TaskState }> {
    const { action, ctx, vars, staff, cal, now } = input;
    const title = clip(renderText(action.title, vars), 160);
    const description = action.description ? renderText(action.description, vars) : null;
    const due = await this.dueAt(action, ctx, cal, now);

    // AUT-032 — who receives it. An explicit TEAM is « à prendre »; an expected advisor who is not there, or cannot
    // act, or is away beyond the due date, leaves the task unassigned AND tells the administrators.
    const agents = ctx.agentIds();
    let expected: string | null = null;
    let team = false;
    if (action.assignee === 'TEAM') team = true;
    else if (action.assignee && isAgentRef(action.assignee)) expected = agents[action.assignee];
    else if (action.assignee) expected = action.assignee;
    else expected = agents.DOSSIER_AGENT ?? agents.LEAD_AGENT ?? agents.CLIENT_AGENT;
    const explicit = action.assignee !== undefined && action.assignee !== 'TEAM';
    const able = expected !== null && staff.canAct(expected) && !staff.isAbsent(expected, due.at);
    const assigneeId = able ? expected : null;
    // Nobody could receive it: the advisor named by the rule does not exist, or the one found cannot act.
    const orphan = !team && !able && (explicit || expected !== null);

    const dedupeKey = action.dedupeKey ? renderText(action.dedupeKey, vars).slice(0, 120) : null;
    const outcome = await this.tasks.create(db, SYSTEM_ACTOR, now, {
      title,
      description,
      type: action.taskType ?? 'FOLLOW_UP',
      priority: action.priority ?? 'NORMAL',
      links: ctx.taskLinks(),
      suggestedTemplateCode: action.suggestedTemplate ?? null,
      assigneeId,
      dueAt: due.at,
      dueHasTime: due.hasTime,
      timeZone: staff.get(assigneeId)?.timezone ?? cal.timeZone,
      origin: 'WORKFLOW',
      ruleId: input.rule.id,
      dedupeKey,
    });
    const task: TaskState = { id: outcome.id, created: outcome.created, title };
    if (!outcome.created) return { result: { status: 'DONE', note: 'TASK_ALREADY_OPEN' }, task };

    // NS_TASK_AUTO — unless the person is already told of the same fact by the rule itself (its NOTIFY_STAFF actions)
    // or by a type of the catalogue (asked by the notifier, for a rule without delay).
    const priority = action.priority ?? 'NORMAL';
    const urgent = priority === 'HIGH' || priority === 'URGENT';
    const recipients = assigneeId ? (urgent ? [assigneeId] : []) : orphan || urgent ? staff.withRoles(['OWNER', 'ADMIN']).map((m) => m.userId) : [];
    if (recipients.length) {
      const told = new Set(input.rule.actions.filter((a): a is NotifyStaffAction => a.type === 'NOTIFY_STAFF').flatMap((a) => this.alertRecipients(a, input)));
      await this.notifier.notify(db, now, {
        type: 'NS_TASK_AUTO',
        userIds: recipients.filter((id) => !told.has(id)),
        title: t('ui.notifications.NS_TASK_AUTO', { titre: title }),
        body: orphan ? t('ui.automation.task.unassignedNote') : null,
        link: taskLink(task.id),
        entityType: 'Task',
        entityId: task.id,
        factId: ctx.subject().entityId,
        originId: this.origin(input),
      });
    }
    return { result: { status: 'DONE' }, task };
  }

  /** AUT-032 — one of the three due keys; none: one business day. `0`: due at once. */
  private async dueAt(action: CreateTaskAction, ctx: RuleContext, cal: BusinessCalendar, now: Date): Promise<{ at: Date; hasTime: boolean }> {
    if (action.dueAtField) {
      const [object, field] = action.dueAtField.split('.');
      const value = ctx.objects[object as keyof typeof ctx.objects]?.[field ?? ''];
      if (value instanceof Date) return { at: value, hasTime: true };
    }
    if (action.dueInDays !== undefined) {
      return action.dueInDays === 0 ? { at: now, hasTime: true } : { at: dueInTheDay(new Date(now.getTime() + action.dueInDays * 86_400_000), cal), hasTime: false };
    }
    let days = 1;
    if (typeof action.dueInBusinessDays === 'number') days = action.dueInBusinessDays;
    else if (action.dueInBusinessDays) {
      // Only a declared, numeric setting may be read (the name comes from the rule, which is data).
      const key = action.dueInBusinessDays.setting;
      const value = key in settingsRegistry ? await this.settings.get(key as SettingKey) : null;
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 365) days = value;
    }
    return days === 0 ? { at: now, hasTime: true } : { at: dueInTheDay(addBusinessDays(now, days, cal), cal), hasTime: false };
  }

  /**
   * After a new try, the memory of the execution is gone: finds again the task its CREATE_TASK action made (or met),
   * by the rule and the key.
   */
  async recallTask(db: PrismaService, input: Omit<ActionInput<RuleAction>, 'action' | 'task' | 'index'>, doneActions: readonly RuleAction[]): Promise<TaskState | null> {
    const action = [...doneActions].reverse().find((a): a is CreateTaskAction => a.type === 'CREATE_TASK');
    if (!action) return null;
    const dedupeKey = action.dedupeKey ? renderText(action.dedupeKey, input.vars).slice(0, 120) : null;
    const task = await db.task.findFirst({
      where: dedupeKey ? { dedupeKey, deletedAt: null } : { ruleId: input.rule.id, deletedAt: null, createdAt: { gte: input.execution.createdAt } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, ruleId: true, createdAt: true },
    });
    if (!task) return null;
    return { id: task.id, title: task.title, created: task.ruleId === input.rule.id && task.createdAt.getTime() >= input.execution.createdAt.getTime() };
  }

  // ---------- NOTIFY_STAFF ----------

  async notifyStaff(db: PrismaService, input: ActionInput<NotifyStaffAction>): Promise<ActionResult> {
    const { action, ctx, vars, now, task } = input;
    const makesTask = input.rule.actions.some((a) => a.type === 'CREATE_TASK');
    // AUT-033 — when the task is not created because an open one carries its key, the alert is not repeated either.
    if (makesTask && task && !task.created) return { status: 'DONE', note: 'ALERT_NOT_REPEATED' };
    const title = action.title ? renderText(action.title, vars) : (task?.title ?? input.rule.name);
    const userIds = this.alertRecipients(action, input);
    if (userIds.length === 0) return { status: 'SKIPPED', reason: t('ui.automation.skip.noRecipient') };
    const subject = ctx.subject();
    const opensTask = task?.created === true;
    await this.notifier.notify(db, now, {
      type: 'NS_RULE_ALERT',
      userIds,
      title: clip(title, 160),
      body: action.body ? clip(renderText(action.body, vars), 400) : null,
      // The link leads to the object of the event — to the task when the rule has just created one (NOT-035).
      link: opensTask ? taskLink(task.id) : staffLink(subject.entityType, subject.object ? (ctx.objects[subject.object] ?? {}) : {}),
      entityType: opensTask ? 'Task' : subject.entityType,
      entityId: opensTask ? task.id : subject.entityId,
      keyPart: `${input.rule.id}.${input.index}.${subject.entityId}`,
      factId: subject.entityId,
      originId: this.origin(input),
    });
    return { status: 'DONE' };
  }
}
