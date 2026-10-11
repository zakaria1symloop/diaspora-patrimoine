// AUT-003 (step 3), AUT-004, AUT-005, AUT-007, AUT-009 — execution of the automation rules.
//
// 1. An event arrives (the engine is the LAST group of the outbox, after the system effects and the notifications):
//    for every active rule of this trigger, the conditions are evaluated on the current state. False: nothing is
//    recorded. True: a `WorkflowExecution` PENDING is created, `scheduledFor` = date of the event + delay of the rule.
//    Unique (`ruleId`, `triggerEventId`): a rule runs once per event, however many times the event is replayed.
// 2. A rule without delay runs at once, inside the processing of the event; the others wait for `workflow.execute`.
// 3. At `scheduledFor` the objects are READ AGAIN, the conditions evaluated again, the stop conditions checked.
//    Something no longer holds: SKIPPED with its reason. Otherwise the actions run in order: DONE.
// 4. A failed action is replayed three times (1 min, 10 min, 1 h); then FAILED, error recorded, technical alert.
//    Actions already done are not done again (`actionsDone`); each also carries its own key (AUT-005).
// 5. A pending execution follows the rule AS IT IS when it acts: disabled or deleted → SKIPPED « Règle désactivée »;
//    modified → its new conditions and actions, not its new delay.
// No loop: an event carrying `causation` (produced by the action of a rule) triggers no rule.
//
// The failure of an action never fails the event: the execution row carries its own new tries. The event is retried
// only when the engine could not even record its executions.
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import type { WorkflowExecution, WorkflowRule } from '../generated/prisma/client.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { newId } from '../platform/ids.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { log } from '../platform/request-context.js';
import { evaluateConditions } from './conditions.js';
import { isRuleTrigger, toEnvelope, type EventEnvelope } from './event-catalogue.js';
import { RuleTeamActions, type ActionInput, type TaskState } from './rule-actions.js';
import { RuleContextLoader } from './rule-context.js';
import { citedConditionFields, parseRuleDefinition, type RuleAction, type RuleDefinition } from './rule-definition.js';
import { RuleMailAction, type ActionResult } from './rule-mail.js';
import { StaffDirectory } from './staff-directory.js';
import { safeError, TechAlerts } from './tech-alerts.js';
import { nextAttemptAt, scheduledFor } from './timing.js';

const t = createTranslator('fr');

/**
 * AUT-007 — the rules of COMMERCIAL follow-up: for a person erased or whose processing is limited, they create neither
 * task nor alert for the team (a request not taken, the first-contact delay, proposals without answer, an idle dossier).
 */
export const COMMERCIAL_FOLLOW_UP_RULES: ReadonlySet<string> = new Set([
  'R_LEAD_NOT_TAKEN', 'R_LEAD_SLA_WARNING', 'R_LEAD_SLA_BREACHED', 'R_CALL_MISSED', 'R_QUALIFIED_NO_PROPOSAL', 'R_PROPOSAL_REMINDER', 'R_PROPOSAL_FEEDBACK', 'R_DOSSIER_INACTIVE',
]);

/** A rule without delay left PENDING by a crash is taken over by `workflow.execute` after this time. */
const STRAGGLER_MS = 5 * 60_000;

export type ExecutionOutcome = 'DONE' | 'SKIPPED' | 'FAILED' | 'PENDING' | 'NOT_FOUND';

export function definitionOf(rule: Pick<WorkflowRule, 'trigger' | 'conditions' | 'delayValue' | 'delayUnit' | 'actions'>) {
  return parseRuleDefinition({ trigger: rule.trigger, conditions: rule.conditions ?? null, delayValue: rule.delayValue, delayUnit: rule.delayUnit, actions: rule.actions });
}

@Injectable()
export class RuleEngine implements OutboxHandler, OnModuleInit {
  readonly name = 'rules';
  readonly types = ['*'] as const;
  /** AUT-003 — after the system effects and the notifications of the event. */
  readonly order = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendarService,
    private readonly loader: RuleContextLoader,
    private readonly staff: StaffDirectory,
    private readonly mail: RuleMailAction,
    private readonly team: RuleTeamActions,
    private readonly alerts: TechAlerts,
    private readonly handlers: OutboxHandlers,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
  }

  async handle(event: OutboxRecord): Promise<void> {
    await this.onEvent(event);
  }

  /** Step 3 of AUT-003 for one event. Returns the outcome of each execution it created or resumed. */
  async onEvent(record: Pick<OutboxRecord, 'id' | 'type' | 'aggregateType' | 'aggregateId' | 'payload' | 'occurredAt'>): Promise<{ ruleId: string; executionId: string; outcome: ExecutionOutcome }[]> {
    const event = toEnvelope(record);
    if (!isRuleTrigger(event.type) || event.causation) return [];
    const rules = await this.prisma.workflowRule.findMany({ where: { trigger: event.type, isActive: true, deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    if (rules.length === 0) return [];
    const cal = await this.calendar.load(this.prisma);
    const out: { ruleId: string; executionId: string; outcome: ExecutionOutcome }[] = [];
    for (const rule of rules) {
      const parsed = definitionOf(rule);
      if (!parsed.ok) {
        await this.invalid(rule, parsed.issues.map((i) => `${i.code} ${i.path}`).join(', '));
        continue;
      }
      const def = parsed.definition;
      const ctx = await this.loader.load(this.prisma, event, citedConditionFields(def.conditions));
      if (!evaluateConditions(def.conditions, ctx.read)) continue; // False: nothing is recorded (AUT-004).
      const now = this.clock.now();
      const id = newId();
      const created = await this.prisma.workflowExecution.createMany({
        data: [{ id, ruleId: rule.id, triggerEventId: event.eventId, entityType: event.aggregate.type.slice(0, 40), entityId: event.aggregate.id, scheduledFor: scheduledFor(event.occurredAt, def.delayValue, def.delayUnit, cal), status: 'PENDING', createdAt: now, updatedAt: now }],
        skipDuplicates: true,
      });
      let executionId = id;
      if (created.count === 0) {
        // The event is replayed (FIA-041): the execution exists. Only one left untouched by a crash is resumed here.
        const existing = await this.prisma.workflowExecution.findUnique({ where: { ruleId_triggerEventId: { ruleId: rule.id, triggerEventId: event.eventId } } });
        if (!existing || existing.status !== 'PENDING' || existing.attempts > 0 || existing.nextAttemptAt || existing.actionsDone > 0) continue;
        executionId = existing.id;
      }
      if (def.delayValue > 0) {
        out.push({ ruleId: rule.id, executionId, outcome: 'PENDING' });
        continue;
      }
      out.push({ ruleId: rule.id, executionId, outcome: await this.execute(executionId, event) });
    }
    return out;
  }

  /**
   * `workflow.execute` — the deferred executions that came due (`scheduledFor`) and the new tries (`nextAttemptAt`),
   * oldest first. A rule without delay does not wait for this pass.
   * `only`: restricts the pass to these executions — for tests on a shared database; the scheduled task never sets it.
   */
  async runDue(limit = 200, only?: readonly string[]): Promise<Record<string, number>> {
    const now = this.clock.now();
    const counters = { scanned: 0, done: 0, skipped: 0, failed: 0, waiting: 0 };
    const pending = await this.prisma.workflowExecution.findMany({
      where: { status: 'PENDING', ...(only ? { id: { in: [...only] } } : {}), OR: [{ nextAttemptAt: { lte: now } }, { nextAttemptAt: null, scheduledFor: { lte: now } }] },
      orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
      take: limit * 2,
      select: { id: true, nextAttemptAt: true, scheduledFor: true, createdAt: true, updatedAt: true },
    });
    // A rule without delay is run by the event itself: this pass takes it over only when it was left behind by a crash.
    const due = pending
      .filter((e) => e.nextAttemptAt !== null || e.scheduledFor.getTime() > e.createdAt.getTime() || now.getTime() - e.updatedAt.getTime() >= STRAGGLER_MS)
      .slice(0, limit);
    for (const row of due) {
      counters.scanned++;
      const outcome = await this.execute(row.id);
      if (outcome === 'DONE') counters.done++;
      else if (outcome === 'SKIPPED') counters.skipped++;
      else if (outcome === 'FAILED') counters.failed++;
      else counters.waiting++;
    }
    return counters;
  }

  /** Runs one execution (AUT-004, points 3 to 5). Never throws for the failure of an action. */
  async execute(executionId: string, known?: EventEnvelope): Promise<ExecutionOutcome> {
    const db = this.prisma;
    const read = await db.workflowExecution.findUnique({ where: { id: executionId } });
    if (!read) return 'NOT_FOUND';
    if (read.status !== 'PENDING') return read.status as ExecutionOutcome;
    const now = this.clock.now();
    // Claim: the row is taken only by who read its latest state (two workers never run the same execution).
    const claimed = await db.workflowExecution.updateMany({ where: { id: executionId, status: 'PENDING', updatedAt: read.updatedAt }, data: { updatedAt: new Date(Math.max(now.getTime(), read.updatedAt.getTime() + 1)) } });
    if (claimed.count !== 1) return 'PENDING';
    const exec = read;

    const rule = await db.workflowRule.findUnique({ where: { id: exec.ruleId } });
    if (!rule || !rule.isActive || rule.deletedAt) return this.finish(exec, 'SKIPPED', { skipReason: t('ui.automation.skip.ruleDisabled') });
    const parsed = definitionOf(rule);
    if (!parsed.ok) {
      await this.invalid(rule, parsed.issues.map((i) => `${i.code} ${i.path}`).join(', '));
      return this.finish(exec, 'SKIPPED', { skipReason: t('ui.automation.skip.ruleInvalid') });
    }
    const def = parsed.definition;

    let event = known ?? null;
    if (!event) {
      const row = await db.outboxEvent.findUnique({ where: { id: exec.triggerEventId } });
      if (!row) return this.finish(exec, 'SKIPPED', { skipReason: t('ui.automation.skip.eventGone') });
      event = toEnvelope({ id: row.id, type: row.type, aggregateType: row.aggregateType, aggregateId: row.aggregateId, payload: row.payload as Record<string, unknown>, occurredAt: row.occurredAt });
    }

    try {
      // Point 3 — the object is read again, the conditions are evaluated again.
      const ctx = await this.loader.load(db, event, citedConditionFields(def.conditions));
      if (!evaluateConditions(def.conditions, ctx.read)) return this.finish(exec, 'SKIPPED', { skipReason: t('ui.automation.skip.conditions') });
      // AUT-007 — what stops the whole rule: a spam request; commercial follow-up of an erased or restricted person.
      if (ctx.objects.lead?.status === 'SPAM') return this.finish(exec, 'SKIPPED', { skipReason: t('ui.automation.skip.spam') });
      if (rule.code && COMMERCIAL_FOLLOW_UP_RULES.has(rule.code)) {
        if (ctx.objects.client?.gdprErasedAt) return this.finish(exec, 'SKIPPED', { skipReason: t('ui.automation.skip.erased') });
        if (ctx.objects.client?.restrictedAt) return this.finish(exec, 'SKIPPED', { skipReason: t('ui.automation.skip.restricted') });
      }
      return await this.runActions(exec, rule, def, ctx, event);
    } catch (err) {
      return this.failed(exec, rule, err, exec.actionsDone);
    }
  }

  // ---------- internals ----------

  private async runActions(exec: WorkflowExecution, rule: WorkflowRule, def: RuleDefinition, ctx: Awaited<ReturnType<RuleContextLoader['load']>>, event: EventEnvelope): Promise<ExecutionOutcome> {
    const db = this.prisma;
    const now = this.clock.now();
    const [cal, staff] = await Promise.all([this.calendar.load(db), this.staff.load(db, now)]);
    const vars = this.loader.vars(ctx, { name: rule.name, delayValue: rule.delayValue, delayUnit: rule.delayUnit });
    const actions: readonly RuleAction[] = def.actions;
    const base = {
      ctx,
      vars,
      rule: { id: rule.id, code: rule.code, name: rule.name, actions },
      execution: { id: exec.id, createdAt: exec.createdAt, deferred: exec.scheduledFor.getTime() > event.occurredAt.getTime() },
      staff,
      cal,
      now,
    };
    let task: TaskState | null = exec.actionsDone > 0 ? await this.team.recallTask(db, base, actions.slice(0, exec.actionsDone)) : null;
    const reasons: string[] = [];
    let done = 0;
    for (let index = exec.actionsDone; index < actions.length; index++) {
      const action = actions[index]!;
      let result: ActionResult;
      try {
        if (action.type === 'SEND_EMAIL') {
          result = await this.mail.run(db, { action, index, ctx, vars, rule: { id: rule.id, code: rule.code, trigger: rule.trigger }, executionId: exec.id, staff, now });
        } else if (action.type === 'CREATE_TASK') {
          const made = await this.team.createTask(db, { ...base, action, index, task } as ActionInput<typeof action>);
          task = made.task;
          result = made.result;
        } else if (action.type === 'NOTIFY_STAFF') {
          result = await this.team.notifyStaff(db, { ...base, action, index, task } as ActionInput<typeof action>);
        } else {
          // AUT-034 `SEND_SURVEY` — the surveys come with their package (5.x): until then the action is ignored.
          result = { status: 'SKIPPED', reason: t('ui.automation.skip.surveyUnavailable') };
        }
      } catch (err) {
        return this.failed(exec, rule, err, index);
      }
      if (result.status === 'DEFERRED') {
        // AUT-006, AUT-008 — the action waits; the execution resumes there, without counting a try.
        await db.workflowExecution.update({ where: { id: exec.id }, data: { actionsDone: index, nextAttemptAt: result.until, skipReason: reasons.join(' · ').slice(0, 200) || null, updatedAt: this.clock.now() } });
        return 'PENDING';
      }
      if (result.status === 'SKIPPED') reasons.push(result.reason);
      else done++;
      await db.workflowExecution.update({ where: { id: exec.id }, data: { actionsDone: index + 1, updatedAt: this.clock.now() } });
    }
    const earlier = exec.skipReason ? [exec.skipReason] : [];
    const all = [...new Set([...earlier, ...reasons])];
    // Every action ignored: the execution is SKIPPED with its reason; otherwise DONE, the reasons of the ignored ones kept.
    const everySkipped = done === 0 && exec.actionsDone === 0 && reasons.length > 0;
    return this.finish(exec, everySkipped ? 'SKIPPED' : 'DONE', { skipReason: all.join(' · ').slice(0, 200) || null });
  }

  private async finish(exec: Pick<WorkflowExecution, 'id'>, status: 'DONE' | 'SKIPPED', data: { skipReason?: string | null }): Promise<ExecutionOutcome> {
    const now = this.clock.now();
    await this.prisma.workflowExecution.update({ where: { id: exec.id }, data: { status, executedAt: now, nextAttemptAt: null, error: null, skipReason: data.skipReason ?? null, updatedAt: now } });
    return status;
  }

  /** AUT-004 point 4 — counts the try, dates the next one, or gives up after the third replay. */
  private async failed(exec: WorkflowExecution, rule: WorkflowRule, err: unknown, actionsDone: number): Promise<ExecutionOutcome> {
    const now = this.clock.now();
    const failures = exec.attempts + 1;
    const next = nextAttemptAt(failures, now);
    const error = safeError(err).slice(0, 500);
    if (next) {
      await this.prisma.workflowExecution.update({ where: { id: exec.id }, data: { attempts: failures, nextAttemptAt: next, error, actionsDone, updatedAt: now } });
      log('warn', 'rule.action_failed', { rule: rule.code ?? rule.id, executionId: exec.id, attempts: failures });
      return 'PENDING';
    }
    await this.prisma.workflowExecution.update({ where: { id: exec.id }, data: { status: 'FAILED', attempts: failures, nextAttemptAt: null, error, actionsDone, executedAt: now, updatedAt: now } });
    log('error', 'rule.execution_failed', { rule: rule.code ?? rule.id, executionId: exec.id });
    const code = rule.code ?? rule.name;
    await this.alerts.raise({ cause: `rule:${rule.id}`, label: t('ui.automation.alert.rule', { code }), details: t('ui.automation.alert.details.rule', { execution: exec.id, code, error }), reference: exec.id });
    return 'FAILED';
  }

  /** A definition that no longer passes the validation is never run (AUT-021): logged, and signalled once an hour. */
  private async invalid(rule: WorkflowRule, issues: string): Promise<void> {
    const code = rule.code ?? rule.name;
    log('error', 'rule.invalid', { rule: rule.code ?? rule.id, issues });
    await this.alerts.raise({ cause: `rule:${rule.id}`, label: t('ui.automation.alert.ruleInvalid', { code }), details: t('ui.automation.alert.details.ruleInvalid', { code, error: issues.slice(0, 300) }), reference: rule.id });
  }
}
