// AUT-081 — the scheduled tasks of the platform itself (package 1.4):
//   `workflow.execute` every minute   — deferred executions that came due, and the new tries (AUT-004);
//   `jobs.watchdog`    every 5 min    — a task without pass for two intervals; outbox events nobody takes; events that
//                                       failed five times (AUT-076);
//   `sla.scan`         every 5 min    — requests: one business day left before `slaDueAt` (`lead.sla_warning`), then
//                                       the deadline passed without first contact (`slaBreachedAt`, `lead.sla_breached`,
//                                       CYC-007). The stage deadline of the dossiers comes with the dossier (3.7);
//   `purge` lines (AUT-091)           — idempotency keys at `expiresAt`; processed outbox events after
//                                       `retention.outboxDays`; rule executions after 180 days; `JobRun` after 90 days.
// `outbox.dispatch` runs continuously in platform/outbox.ts and writes no `JobRun` (AUT-082).
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { businessMinutesBetween, workdayMinutes } from '@dp/domain';
import { createTranslator } from '@dp/i18n';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { newId } from '../platform/ids.js';
import { OUTBOX_ALERT_AT } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { domainEvent, type NewDomainEvent } from './event-catalogue.js';
import { RuleEngine } from './rule-engine.js';
import { Scheduler, type JobContext } from './scheduler.js';
import { TechAlerts } from './tech-alerts.js';

const t = createTranslator('fr');
const MINUTE = 60_000;
const DAY = 86_400_000;
/** AUT-082 — 500 objects at most per pass and per transaction. */
export const SCAN_BATCH = 500;

/**
 * AUT-012 — deposits a ⏱ event under the key that names the FACT: the same fact is signalled once, even if the task
 * runs twice or resumes after a failure. Returns false when the fact was already signalled.
 */
export async function emitFact(db: Tx | PrismaService, at: Date, event: NewDomainEvent & { dedupeKey: string }): Promise<boolean> {
  const e = domainEvent(event);
  const created = await db.outboxEvent.createMany({
    data: [{ id: newId(), type: e.type, aggregateType: e.aggregateType, aggregateId: e.aggregateId, payload: e.payload as never, dedupeKey: event.dedupeKey.slice(0, 200), occurredAt: at, availableAt: at, createdAt: at, updatedAt: at }],
    skipDuplicates: true,
  });
  return created.count === 1;
}

/** FIA-001 — runs `fn` in a transaction; inside one already (a caller's, a test's), in that one. */
export async function inTransaction<T>(db: Tx | PrismaService, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const open = (db as { $transaction?: unknown }).$transaction;
  return typeof open === 'function' ? (db as PrismaService).$transaction(fn) : fn(db as Tx);
}

@Injectable()
export class AutomationJobs implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly scheduler: Scheduler,
    private readonly engine: RuleEngine,
    private readonly alerts: TechAlerts,
  ) {}

  onModuleInit(): void {
    this.scheduler.register({ name: 'workflow.execute', schedule: { everyMinutes: 1 }, run: () => this.engine.runDue() });
    this.scheduler.register({ name: 'jobs.watchdog', schedule: { everyMinutes: 5 }, run: (ctx) => this.watchdog(ctx.now) });
    this.scheduler.register({ name: 'sla.scan', schedule: { everyMinutes: 5 }, run: (ctx) => this.slaScan(ctx) });
    this.scheduler.registerPurge('idempotencyKeys', async (now) => (await this.prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: now } } })).count);
    this.scheduler.registerPurge('outboxEvents', (now) => this.purgeOutbox(now));
    this.scheduler.registerPurge('workflowExecutions', async (now) => (await this.prisma.workflowExecution.deleteMany({ where: { status: { not: 'PENDING' }, createdAt: { lt: new Date(now.getTime() - 180 * DAY) } } })).count);
    this.scheduler.registerPurge('jobRuns', async (now) => (await this.prisma.jobRun.deleteMany({ where: { startedAt: { lt: new Date(now.getTime() - 90 * DAY) } } })).count);
  }

  /** Processed events older than `retention.outboxDays` — except those a pending execution still has to read again. */
  async purgeOutbox(now: Date): Promise<number> {
    const days = await this.settings.get('retention.outboxDays');
    return this.prisma.$executeRawUnsafe(
      `DELETE FROM outbox_events e
        WHERE e.processed_at < $1
          AND NOT EXISTS (SELECT 1 FROM workflow_executions x WHERE x.trigger_event_id = e.id AND x.status = 'PENDING')`,
      new Date(now.getTime() - days * DAY),
    );
  }

  /** `jobs.watchdog` (AUT-076, AUT-081). */
  async watchdog(now: Date): Promise<Record<string, number>> {
    const counters = { late: 0, stuckEvents: 0, failingEvents: 0 };
    for (const job of this.scheduler.list()) {
      if (!('everyMinutes' in job.schedule) || job.name === 'jobs.watchdog') continue;
      const last = await this.prisma.jobRun.findFirst({ where: { jobName: job.name }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } });
      // Never ran yet (a fresh installation): the first tick takes care of it.
      if (!last || now.getTime() - last.startedAt.getTime() <= 2 * job.schedule.everyMinutes * MINUTE) continue;
      counters.late++;
      await this.alerts.raise({
        cause: `job:${job.name}`,
        label: t('ui.automation.alert.jobLate', { job: job.name }),
        details: t('ui.automation.alert.details.jobLate', { job: job.name, last: last.startedAt.toISOString() }),
        reference: job.name,
      });
    }
    // `outbox.dispatch`: an event available for more than 2 minutes that nobody took, outside those waiting behind a
    // failing event of the same object (FIA-040).
    const stuck = await this.prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM outbox_events e
        WHERE e.processed_at IS NULL AND e.parked_at IS NULL AND e.claimed_at IS NULL AND e.attempts = 0 AND e.available_at < $1
          AND NOT EXISTS (SELECT 1 FROM outbox_events o
                           WHERE o.aggregate_type = e.aggregate_type AND o.aggregate_id = e.aggregate_id
                             AND o.processed_at IS NULL AND o.parked_at IS NULL AND (o.occurred_at, o.id) < (e.occurred_at, e.id))`,
      new Date(now.getTime() - 2 * MINUTE),
    );
    counters.stuckEvents = Number(stuck[0]?.n ?? 0);
    if (counters.stuckEvents > 0) {
      await this.alerts.raise({ cause: 'queue:outbox', label: t('ui.automation.alert.outboxStuck'), details: t('ui.automation.alert.details.outboxStuck', { n: counters.stuckEvents }), reference: 'outbox.dispatch' });
    }
    // An event failed five times (it is still retried until the tenth failure, then parked).
    const failing = await this.prisma.outboxEvent.findMany({ where: { processedAt: null, attempts: { gte: OUTBOX_ALERT_AT } }, orderBy: { updatedAt: 'desc' }, take: 20, select: { id: true, type: true, attempts: true, lastError: true } });
    for (const e of failing) {
      counters.failingEvents++;
      await this.alerts.raise({
        cause: `outbox:${e.id}`,
        label: t('ui.automation.alert.outbox', { type: e.type }),
        // `lastError` names the failing group, never a person (outbox.ts).
        details: t('ui.automation.alert.details.outbox', { type: e.type, n: e.attempts, error: (e.lastError ?? '').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[adresse]').slice(0, 300) }),
        reference: e.id,
      });
    }
    return counters;
  }

  /** `sla.scan` — CYC-007, AUT-040 (requests). `scope`: only these requests (tests on a shared database; never set by the task). */
  async slaScan(ctx: Pick<JobContext, 'now' | 'jobRunId'>, scope?: { leadIds: readonly string[] }): Promise<Record<string, number>> {
    const { now } = ctx;
    const counters = { scanned: 0, warned: 0, breached: 0 };
    const cal = await this.calendar.load(this.prisma);
    const open = { status: { in: ['NEW', 'IN_PROGRESS'] as ('NEW' | 'IN_PROGRESS')[] }, firstContactAt: null, ...(scope ? { id: { in: [...scope.leadIds] } } : {}) };

    // The deadline passed without first contact: `slaBreachedAt` and the event, in the same transaction.
    const late = await this.prisma.lead.findMany({ where: { ...open, slaDueAt: { lte: now }, slaBreachedAt: null }, orderBy: { slaDueAt: 'asc' }, take: SCAN_BATCH, select: { id: true, clientId: true, dossierId: true, slaDueAt: true } });
    for (const lead of late) {
      counters.scanned++;
      await inTransaction(this.prisma, async (tx) => {
        const marked = await tx.lead.updateMany({ where: { ...open, id: lead.id, slaBreachedAt: null }, data: { slaBreachedAt: now, updatedAt: now } });
        if (marked.count !== 1) return;
        const emitted = await emitFact(tx, now, {
          type: 'lead.sla_breached',
          aggregate: { type: 'Lead', id: lead.id },
          clientId: lead.clientId,
          dossierId: lead.dossierId,
          data: { slaDueAt: lead.slaDueAt!.toISOString() },
          jobRunId: ctx.jobRunId,
          dedupeKey: `lead.sla_breached:${lead.id}`,
        });
        if (emitted) counters.breached++;
      });
    }

    // One business day or less left. A week of calendar days bounds what « one business day » can span.
    const soon = await this.prisma.lead.findMany({ where: { ...open, slaDueAt: { gt: now, lte: new Date(now.getTime() + 7 * DAY) } }, orderBy: { slaDueAt: 'asc' }, take: SCAN_BATCH, select: { id: true, clientId: true, dossierId: true, slaDueAt: true } });
    const oneDay = workdayMinutes(cal);
    for (const lead of soon) {
      counters.scanned++;
      if (businessMinutesBetween(now, lead.slaDueAt!, cal) > oneDay) continue;
      const emitted = await emitFact(this.prisma, now, {
        type: 'lead.sla_warning',
        aggregate: { type: 'Lead', id: lead.id },
        clientId: lead.clientId,
        dossierId: lead.dossierId,
        data: { slaDueAt: lead.slaDueAt!.toISOString() },
        jobRunId: ctx.jobRunId,
        dedupeKey: `lead.sla_warning:${lead.id}`,
      });
      if (emitted) counters.warned++;
    }
    return counters;
  }
}
