// AUT-081, AUT-082, AUT-084 — ONE scheduler for every scheduled task of the platform. A module declares its tasks
// (`Scheduler.register`) and its purge lines (`Scheduler.registerPurge`); the scheduler decides when each is due, makes
// sure a task runs on one instance at a time, and writes its `JobRun` (start, end, counters, error).
//
//   · a task is REPLAYABLE (keys of AUT-012) and CATCHES UP: it looks at everything due when it runs;
//   · a pass still RUNNING for less than 30 minutes prevents the next one; a skipped pass writes no `JobRun`;
//   · hours are those of the business calendar (`business.calendar.timezone`); a daily task runs once per local date,
//     at the first tick at or after its hour — which also settles the nights when the hour changes (AUT-081);
//   · it reads the time through `Clock`: in acceptance it follows the shifted clock (ENV-032).
//
// This in-process timer stands for the `automation` queue of ARC-050 while Redis is not part of the environment
// (AUT-084): it runs in the `worker` and `all` roles, and in the local `api` role. A repeatable job of the queue will
// call `tick()` instead of the timer, without touching the tasks.
import { Inject, Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { isWorkingDay } from '@dp/domain';
import { createTranslator } from '@dp/i18n';
import { ENV, type Env } from '../config/env.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { log } from '../platform/request-context.js';
import { safeError, TechAlerts } from './tech-alerts.js';
import { addDays, localDay, zonedInstant } from './timing.js';

const t = createTranslator('fr');
const MINUTE = 60_000;
/** AUT-084 — a pass still RUNNING for less than 30 minutes prevents the next one; older, it is held for abandoned. */
export const RUNNING_TIMEOUT_MS = 30 * MINUTE;

export type JobSchedule =
  /** Every `n` minutes, counted from the start of the previous pass. */
  | { everyMinutes: number }
  /** Once a day at `HH:MM` (business calendar time zone); optionally on working days only, or on one weekday (1 = Monday). */
  | { dailyAt: string; businessDaysOnly?: boolean; weekday?: number };

export interface JobContext {
  now: Date;
  /** Start of the previous pass (DONE or still RUNNING), or null — what a pass that works « since the last one » needs. */
  lastRunAt: Date | null;
  /** Id of the `JobRun` of this pass: the « request of origin » of the events it emits (NOT-035). */
  jobRunId: string;
}

export interface ScheduledJob {
  /** AUT-081 name (`sla.scan`, `alerts.daily`…). */
  name: string;
  schedule: JobSchedule;
  /** Returns its counters (`{scanned, changed, sent, skipped, failed}`…). Throwing marks the pass FAILED. */
  run(ctx: JobContext): Promise<Record<string, number>>;
}

export interface JobStatus {
  name: string;
  schedule: JobSchedule;
  lastRun: { id: string; status: string; startedAt: Date; finishedAt: Date | null; counters: unknown; error: string | null } | null;
  nextRunAt: Date | null;
  running: boolean;
}

export type PurgeLine = (now: Date) => Promise<number>;

function hm(instant: Date, timeZone: string): { hm: string; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { hm: `${get('hour')}:${get('minute')}`, weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1 };
}

@Injectable()
export class Scheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly jobs = new Map<string, ScheduledJob>();
  private readonly purges = new Map<string, PurgeLine>();
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  readonly tickMs = 20_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendarService,
    private readonly alerts: TechAlerts,
    @Inject(ENV) private readonly env: Env,
  ) {
    // AUT-091 — `purge`, 4:30: one pass, the lines of every module.
    this.register({ name: 'purge', schedule: { dailyAt: '04:30' }, run: (ctx) => this.purge(ctx.now) });
  }

  /** Declares a scheduled task (at module initialisation). */
  register(job: ScheduledJob): void {
    this.jobs.set(job.name, job);
  }

  /** Declares a line of the `purge` task (AUT-091): returns the number of rows physically deleted. */
  registerPurge(name: string, line: PurgeLine): void {
    this.purges.set(name, line);
  }

  list(): ScheduledJob[] {
    return [...this.jobs.values()];
  }

  onApplicationBootstrap(): void {
    const enabled = this.env.APP_ROLE !== 'api' || this.env.APP_ENV === 'local';
    if (!enabled || process.env.VITEST) return;
    this.timer = setInterval(() => void this.tick(), this.tickMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Runs every task that is due. Never throws (a failed pass is a FAILED `JobRun`). */
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const now = this.clock.now();
      for (const job of this.jobs.values()) {
        try {
          if (await this.isDue(job, now)) await this.run(job.name);
        } catch (err) {
          log('error', 'scheduler.job_check_failed', { job: job.name, message: safeError(err) });
        }
      }
    } finally {
      this.busy = false;
    }
  }

  /** Latest pass that counts as « ran »: DONE, or still RUNNING. */
  private async lastRun(jobName: string): Promise<Date | null> {
    const row = await this.prisma.jobRun.findFirst({ where: { jobName, status: { in: ['DONE', 'RUNNING'] } }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } });
    return row?.startedAt ?? null;
  }

  async isDue(job: ScheduledJob, now: Date): Promise<boolean> {
    const last = await this.lastRun(job.name);
    // A failed pass is tried again, but not at every tick.
    const failed = await this.prisma.jobRun.findFirst({ where: { jobName: job.name, status: 'FAILED', startedAt: { gt: new Date(now.getTime() - MINUTE) } }, select: { id: true } });
    if (failed) return false;
    if ('everyMinutes' in job.schedule) return !last || now.getTime() - last.getTime() >= job.schedule.everyMinutes * MINUTE;
    const cal = await this.calendar.load(this.prisma);
    const today = localDay(now, cal.timeZone);
    const local = hm(now, cal.timeZone);
    if (local.hm < job.schedule.dailyAt) return false;
    if (job.schedule.businessDaysOnly && !isWorkingDay(today, cal)) return false;
    if (job.schedule.weekday && job.schedule.weekday !== local.weekday) return false;
    return !(last && localDay(last, cal.timeZone) === today);
  }

  /** When the task will next be due (for the diagnostic screen, ADM-080). */
  async nextRunAt(job: ScheduledJob, now: Date): Promise<Date | null> {
    const last = await this.lastRun(job.name);
    if ('everyMinutes' in job.schedule) return last ? new Date(Math.max(now.getTime(), last.getTime() + job.schedule.everyMinutes * MINUTE)) : now;
    const cal = await this.calendar.load(this.prisma);
    const today = localDay(now, cal.timeZone);
    const ranToday = last !== null && localDay(last, cal.timeZone) === today;
    for (let i = ranToday ? 1 : 0; i < 9; i++) {
      const day = addDays(today, i);
      const at = zonedInstant(day, job.schedule.dailyAt, cal.timeZone);
      if (job.schedule.businessDaysOnly && !isWorkingDay(day, cal)) continue;
      if (job.schedule.weekday && hm(at, cal.timeZone).weekday !== job.schedule.weekday) continue;
      return at.getTime() < now.getTime() ? now : at;
    }
    return null;
  }

  /**
   * One pass = one `JobRun`. Returns the counters, or null when the pass was skipped (the previous one still runs) or
   * failed. `triggeredById`: « Lancer maintenant » from the diagnostic screen (the launch is traced on the row).
   */
  async run(jobName: string, triggeredById: string | null = null): Promise<Record<string, number> | null> {
    const job = this.jobs.get(jobName);
    if (!job) throw new Error(`Unknown job ${jobName}`);
    const now = this.clock.now();
    const lastRunAt = await this.lastRun(jobName);
    // The claim is atomic across instances: an advisory lock for the time of the check and of the insertion.
    const id = newId();
    const claimed = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `job:${jobName}`);
      const running = await tx.jobRun.findFirst({ where: { jobName, status: 'RUNNING' }, orderBy: { startedAt: 'desc' }, select: { id: true, startedAt: true } });
      if (running && now.getTime() - running.startedAt.getTime() < RUNNING_TIMEOUT_MS) return false;
      // An abandoned pass (the process died): closed as failed, so that the journal tells what happened.
      await tx.jobRun.updateMany({ where: { jobName, status: 'RUNNING' }, data: { status: 'FAILED', finishedAt: now, error: 'ABANDONED', updatedAt: now } });
      await tx.jobRun.create({ data: { id, jobName, status: 'RUNNING', startedAt: now, triggeredById, createdAt: now, updatedAt: now } });
      return true;
    });
    if (!claimed) return null;
    try {
      const counters = await job.run({ now, lastRunAt, jobRunId: id });
      const end = this.clock.now();
      await this.prisma.jobRun.update({ where: { id }, data: { status: 'DONE', finishedAt: end, counters: counters as never, updatedAt: end } });
      if (Object.values(counters).some((v) => v > 0)) log('info', 'job.done', { job: jobName, ...counters });
      return counters;
    } catch (err) {
      const end = this.clock.now();
      const error = safeError(err);
      await this.prisma.jobRun.update({ where: { id }, data: { status: 'FAILED', finishedAt: end, error: error.slice(0, 500), updatedAt: end } });
      log('error', 'job.failed', { job: jobName });
      // AUT-076 — a scheduled task failed.
      await this.alerts.raise({ cause: `job:${jobName}`, label: t('ui.automation.alert.jobFailed', { job: jobName }), details: t('ui.automation.alert.details.jobFailed', { job: jobName, error }), reference: id });
      return null;
    }
  }

  /** ADM-080 « Tâches planifiées » — last pass and next pass of each task. */
  async status(): Promise<JobStatus[]> {
    const now = this.clock.now();
    const out: JobStatus[] = [];
    for (const job of [...this.jobs.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      const lastRun = await this.prisma.jobRun.findFirst({ where: { jobName: job.name }, orderBy: { startedAt: 'desc' }, select: { id: true, status: true, startedAt: true, finishedAt: true, counters: true, error: true } });
      out.push({
        name: job.name,
        schedule: job.schedule,
        lastRun,
        nextRunAt: await this.nextRunAt(job, now),
        running: lastRun?.status === 'RUNNING' && now.getTime() - lastRun.startedAt.getTime() < RUNNING_TIMEOUT_MS,
      });
    }
    return out;
  }

  /** AUT-091 — every line runs, whatever happens to the others; a failed line fails the pass after the others ran. */
  private async purge(now: Date): Promise<Record<string, number>> {
    const counters: Record<string, number> = {};
    const failed: string[] = [];
    for (const [name, line] of this.purges) {
      try {
        counters[name] = await line(now);
      } catch (err) {
        failed.push(`${name}: ${safeError(err)}`);
      }
    }
    if (failed.length) throw new Error(`purge lines failed — ${failed.join(' | ')}`.slice(0, 480));
    return counters;
  }
}
