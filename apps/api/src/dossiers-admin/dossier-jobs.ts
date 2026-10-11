// AUT-012, AUT-035, CYC-033, CYC-039, CAL-062 — what runs by itself around the dossiers of package 3.7:
//   `dossier.scan` (every 15 minutes) deposits the ⏱ facts the rules of AUT-043 listen to, each under the key that
//     names it (a fact is signalled once even if the task runs twice):
//       · `dossier.sla_breached` — an OPEN dossier whose stage deadline has passed (key: dossier + stage entry);
//       · `dossier.inactive`     — an OPEN dossier without activity for `dossier.inactivityDays` (key: dossier + last activity);
//       · `dossier.hold_ended`   — a dossier ON HOLD whose planned resumption is today, from 9:00 (key: dossier + date);
//   the lines of AUT-035 that close the tasks of the dossier and of the matching when what they asked for happened.
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { localDate } from '@dp/domain';
import { createTranslator } from '@dp/i18n';
import { emitFact, SCAN_BATCH } from '../automation/automation-jobs.js';
import { Scheduler, type JobContext } from '../automation/scheduler.js';
import { TaskAutoClose, type TaskClosing } from '../automation/task-effects.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';

const t = createTranslator('fr');
const DAY = 86_400_000;
const LIVE_CANDIDATE_EVENTS = ['candidate.proposed', 'candidate.viewed', 'candidate.interested', 'candidate.declined', 'candidate.selection_requested', 'candidate.selected', 'candidate.unselected'];

/** The hour the planned resumption becomes a task (CYC-033: « à 9 h »). */
export const HOLD_ENDED_HOUR = '09:00';

@Injectable()
export class DossierJobs implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly scheduler: Scheduler,
    private readonly autoClose: TaskAutoClose,
  ) {}

  onModuleInit(): void {
    this.scheduler.register({ name: 'dossier.scan', schedule: { everyMinutes: 15 }, run: (ctx) => this.scan(ctx) });
    this.closingLines();
  }

  /** `dossier.scan`. `scope`: only these dossiers (tests on a shared database; never set by the task). */
  async scan(ctx: Pick<JobContext, 'now' | 'jobRunId'>, scope?: { dossierIds: readonly string[] }): Promise<Record<string, number>> {
    const { now } = ctx;
    const counters = { breached: 0, inactive: 0, holdEnded: 0 };
    const only = scope ? { id: { in: [...scope.dossierIds] } } : {};
    const [cal, inactivityDays] = await Promise.all([this.calendar.load(), this.settings.get('dossier.inactivityDays')]);

    const late = await this.prisma.dossier.findMany({ where: { ...only, deletedAt: null, status: 'OPEN', slaDueAt: { lte: now } }, orderBy: { slaDueAt: 'asc' }, take: SCAN_BATCH, select: { id: true, clientId: true, stage: true, stageEnteredAt: true } });
    for (const d of late) {
      const ok = await emitFact(this.prisma, now, { type: 'dossier.sla_breached', aggregate: { type: 'Dossier', id: d.id }, clientId: d.clientId, dossierId: d.id, data: { stage: d.stage }, jobRunId: ctx.jobRunId, dedupeKey: `dossier.sla_breached:${d.id}:${d.stageEnteredAt.toISOString()}` });
      if (ok) counters.breached++;
    }

    const idle = await this.prisma.dossier.findMany({ where: { ...only, deletedAt: null, status: 'OPEN', lastActivityAt: { lte: new Date(now.getTime() - inactivityDays * DAY) } }, orderBy: { lastActivityAt: 'asc' }, take: SCAN_BATCH, select: { id: true, clientId: true, lastActivityAt: true } });
    for (const d of idle) {
      const days = Math.floor((now.getTime() - d.lastActivityAt.getTime()) / DAY);
      const ok = await emitFact(this.prisma, now, { type: 'dossier.inactive', aggregate: { type: 'Dossier', id: d.id }, clientId: d.clientId, dossierId: d.id, data: { days }, jobRunId: ctx.jobRunId, dedupeKey: `dossier.inactive:${d.id}:${d.lastActivityAt.toISOString()}` });
      if (ok) counters.inactive++;
    }

    // CYC-033 — at the planned resumption the dossier is NOT resumed: a task « Reprendre le dossier » at 9:00.
    const today = localDate(now, cal);
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: cal.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    if (hour >= HOLD_ENDED_HOUR) {
      const due = await this.prisma.dossier.findMany({ where: { ...only, deletedAt: null, status: 'ON_HOLD', holdUntil: { lte: new Date(`${today}T00:00:00Z`) } }, take: SCAN_BATCH, select: { id: true, clientId: true, holdUntil: true } });
      for (const d of due) {
        const ok = await emitFact(this.prisma, now, { type: 'dossier.hold_ended', aggregate: { type: 'Dossier', id: d.id }, clientId: d.clientId, dossierId: d.id, jobRunId: ctx.jobRunId, dedupeKey: `dossier.hold_ended:${d.id}:${d.holdUntil!.toISOString().slice(0, 10)}` });
        if (ok) counters.holdEnded++;
      }
    }
    return counters;
  }

  /** AUT-035 — the lines of the table whose events come with package 3.7. */
  private closingLines(): void {
    const dossierOf = async (e: { aggregate: { type: string; id: string }; dossierId: string | null; data: Record<string, unknown> }): Promise<string | null> => {
      if (e.dossierId) return e.dossierId;
      if (e.aggregate.type === 'Dossier') return e.aggregate.id;
      if (e.aggregate.type === 'DossierCandidate') return (await this.prisma.dossierCandidate.findUnique({ where: { id: e.aggregate.id }, select: { dossierId: true } }))?.dossierId ?? null;
      return null;
    };
    const candidateOf = (e: { aggregate: { type: string; id: string }; data: Record<string, unknown> }) => (e.aggregate.type === 'DossierCandidate' ? e.aggregate.id : typeof e.data.candidateId === 'string' ? e.data.candidateId : null);

    // `propose:{dossierId}` — a property is proposed (DONE).
    this.autoClose.on('candidate.proposed', async (e) => {
      const d = await dossierOf(e);
      return d ? [{ keys: [`propose:${d}`], outcome: 'DONE', reason: t('ui.automation.close.proposed') }] : [];
    });
    // `proposal-feedback:{dossierId}` — no proposal waits for an answer any more (DONE).
    this.autoClose.on(['candidate.viewed', 'candidate.interested', 'candidate.declined', 'candidate.selected'], async (e, db) => {
      const out: TaskClosing[] = [];
      const d = await dossierOf(e);
      if (d && (await db.dossierCandidate.count({ where: { dossierId: d, status: { in: ['PROPOSED', 'VIEWED'] }, sentAt: { not: null } } })) === 0) out.push({ keys: [`proposal-feedback:${d}`], outcome: 'DONE', reason: t('ui.automation.close.proposalAnswered') });
      const cid = candidateOf(e);
      // `selection:{candidateId}` — the property is retained (DONE) · the candidate changes otherwise (CANCELLED).
      if (cid && e.type === 'candidate.selected') out.push({ keys: [`selection:${cid}`], outcome: 'DONE', reason: t('ui.automation.close.selectionDone') });
      if (cid && e.type === 'candidate.declined') out.push({ keys: [`selection:${cid}`], outcome: 'CANCELLED', reason: t('ui.automation.close.selectionOther') });
      // `unavailable:{dossierId}` — an available property is retained (DONE).
      if (d && e.type === 'candidate.selected') out.push({ keys: [`unavailable:${d}`], outcome: 'DONE', reason: t('ui.automation.close.unavailableReplaced') });
      return out;
    });
    this.autoClose.on('candidate.selection_declined', (e) => [{ keys: [`selection:${e.aggregate.id}`], outcome: 'CANCELLED', reason: t('ui.automation.close.selectionOther') }]);
    // `inactive:{dossierId}` — any activity on the dossier (DONE).
    this.autoClose.on([...LIVE_CANDIDATE_EVENTS, 'dossier.stage_changed', 'dossier.resumed', 'dossier.assigned', 'lead.attached', 'document.received', 'appointment.done', 'appointment.confirmed'], async (e) => {
      const d = await dossierOf(e);
      return d ? [{ keys: [`inactive:${d}`], outcome: 'DONE', reason: t('ui.automation.close.dossierActivity') }] : [];
    });
    // `propose:{dossierId}` — the dossier went beyond MATCHING (CANCELLED).
    this.autoClose.on('dossier.stage_changed', (e) => {
      const to = typeof e.data.toStage === 'string' ? e.data.toStage : '';
      return ['DOCUMENTS', 'BANK_REVIEW', 'APPROVED', 'ACQUISITION'].includes(to) ? [{ keys: [`propose:${e.aggregate.id}`], outcome: 'CANCELLED', reason: t('ui.automation.close.stageBeyond') }] : [];
    });
    // `doc-call:{dossierId}` — the dossier is put on hold (CANCELLED).
    this.autoClose.on('dossier.put_on_hold', (e) => [{ keys: [`doc-call:${e.aggregate.id}`], outcome: 'CANCELLED', reason: t('ui.automation.close.holdStarted') }]);
    // Closing: the open tasks are cancelled by the gesture itself (CYC-035); the keys below may be born afterwards.
    this.autoClose.on('dossier.lost', (e) => [
      { keys: ['propose', 'proposal-feedback', 'resurfaced', 'hold-ended', 'inactive', 'unavailable', 'doc-review', 'doc-call', 'consent', 'acquisition-lot'].map((k) => `${k}:${e.aggregate.id}`), outcome: 'CANCELLED', reason: t('ui.automation.close.dossierClosed') },
    ]);
  }
}
