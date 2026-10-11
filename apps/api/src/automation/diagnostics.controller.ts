// ADM-080 « Tâches planifiées » (package 1.4, minimal diagnostic) — API-100 `/admin/diagnostics`, permission
// `support.diagnostics`. No personal data: task names, dates, counters, technical errors.
//   GET  /admin/diagnostics/jobs            last pass and next pass of each task of AUT-081
//   GET  /admin/diagnostics/jobs/:name/runs the journal of a task (`JobRun`, most recent first)
//   POST /admin/diagnostics/run-job         « Lancer maintenant » — traced (`JobRun.triggeredById`, audit `job_run.created`)
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import type { Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { CurrentActor, RequirePermission } from '../identity/access.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { parseOrThrow } from '../platform/validation.js';
import { Scheduler } from './scheduler.js';

const runJobSchema = z.object({ job: z.string().min(1).max(60) });
const runsQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

@Controller('admin/diagnostics')
export class DiagnosticsController {
  constructor(
    private readonly scheduler: Scheduler,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  @Get('jobs')
  @RequirePermission('support.diagnostics')
  async jobs() {
    const status = await this.scheduler.status();
    return {
      jobs: status.map((j) => ({
        name: j.name,
        schedule: j.schedule,
        running: j.running,
        nextRunAt: j.nextRunAt?.toISOString() ?? null,
        lastRun: j.lastRun
          ? {
              id: j.lastRun.id,
              status: j.lastRun.status,
              startedAt: j.lastRun.startedAt.toISOString(),
              finishedAt: j.lastRun.finishedAt?.toISOString() ?? null,
              durationMs: j.lastRun.finishedAt ? j.lastRun.finishedAt.getTime() - j.lastRun.startedAt.getTime() : null,
              counters: j.lastRun.counters ?? null,
              error: j.lastRun.error,
            }
          : null,
      })),
    };
  }

  @Get('jobs/:name/runs')
  @RequirePermission('support.diagnostics')
  async runs(@Param('name') name: string, @Query() query: unknown) {
    if (!this.scheduler.list().some((j) => j.name === name)) throw AppError.notFound();
    const { limit } = parseOrThrow(runsQuery, query);
    const rows = await this.prisma.jobRun.findMany({ where: { jobName: name }, orderBy: { startedAt: 'desc' }, take: limit, select: { id: true, status: true, startedAt: true, finishedAt: true, counters: true, error: true, triggeredById: true } });
    return {
      runs: rows.map((r) => ({
        id: r.id,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        durationMs: r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null,
        counters: r.counters ?? null,
        error: r.error,
        manual: r.triggeredById !== null,
      })),
    };
  }

  @Post('run-job')
  @HttpCode(200)
  @RequirePermission('support.diagnostics')
  async runJob(@CurrentActor() actor: Actor, @Body() body: unknown) {
    const { job } = parseOrThrow(runJobSchema, body);
    if (!this.scheduler.list().some((j) => j.name === job)) throw AppError.notFound();
    const now = this.clock.now();
    await this.prisma.$transaction((tx) => writeAudit(tx, actor, now, { action: 'job_run.created', entityType: 'job_run', entityId: null, entityLabel: job }));
    const counters = await this.scheduler.run(job, actor.userId);
    // Null: the previous pass still runs (AUT-082), or this one failed — the journal tells which.
    return { job, ran: counters !== null, counters };
  }
}
