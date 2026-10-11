// CYC-020 … CYC-040, CAL-062, CAL-063, MOD-311 — the transactional primitives every dossier use case shares: the row
// lock, the journal of stages (`DossierStageHistory`: one line per change of stage OR of state, with the time spent in
// the stage left, pauses excluded), the stage deadline, the events of the outbox and the audit rows with the names of
// the spec (06-technique/03: `dossier.stage_changed`, `dossier.held`, `dossier.resumed`, `dossier.closed`,
// `dossier.reopened`, `dossier.assigned`…). Everything runs in the caller's transaction (FIA-001).
import { addBusinessMinutes, businessMinutesBetween, stageDueAt, type BusinessCalendar, type DossierStage } from '@dp/domain';
import { ErrorCode } from '@dp/contracts';
import type { Actor } from '../admin/actor.js';
import { stampBy } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { domainEvent } from '../automation/event-catalogue.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import type { OutboxWriter } from '../platform/outbox.js';
import { currentRequestId } from '../platform/request-context.js';
import type { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { STAGES } from './dossier-rules.js';

export type StageSla = Readonly<Record<DossierStage, number>>;
export type DossierRow = Prisma.DossierGetPayload<object>;

/** CAL-062 — the business days of each stage, from the settings. */
export async function loadStageSla(settings: SettingsService): Promise<StageSla> {
  const out = {} as Record<DossierStage, number>;
  for (const s of STAGES) out[s] = await settings.get(`sla.stage.${s}`);
  return out;
}

/** The actor of an event (AUT-011). */
export const eventActor = (actor: Actor): { type: 'USER' | 'SYSTEM'; id: string | null } => (actor.type === 'USER' ? { type: 'USER', id: actor.userId } : { type: 'SYSTEM', id: null });

/**
 * Locks the dossier row for the transaction and reads it. A stale `version` (MOD-007) answers 409 CONFLICT_VERSION;
 * a dossier deleted or unknown, 404. The perimeter of the caller is checked by the use case BEFORE (in its query).
 */
export async function lockDossier(tx: Tx, id: string, version?: number): Promise<DossierRow> {
  await tx.$queryRawUnsafe(`SELECT id FROM dossiers WHERE id = $1::uuid FOR UPDATE`, id);
  const d = await tx.dossier.findFirst({ where: { id, deletedAt: null } });
  if (!d) throw AppError.notFound();
  if (version !== undefined && d.version !== version) throw new AppError(ErrorCode.CONFLICT_VERSION);
  return d;
}

/** CAL-063 — time spent in the current stage up to `now`, pauses excluded: calendar seconds and business minutes. */
export async function timeInStage(tx: Tx, d: Pick<DossierRow, 'id' | 'stageEnteredAt' | 'status' | 'heldAt'>, now: Date, cal: BusinessCalendar): Promise<{ seconds: number; businessMinutes: number }> {
  const rows = await tx.dossierStageHistory.findMany({ where: { dossierId: d.id, changedAt: { gte: d.stageEnteredAt } }, orderBy: [{ changedAt: 'asc' }, { createdAt: 'asc' }], select: { fromStatus: true, toStatus: true, changedAt: true } });
  let seconds = (now.getTime() - d.stageEnteredAt.getTime()) / 1000;
  let minutes = businessMinutesBetween(d.stageEnteredAt, now, cal);
  let pausedAt: Date | null = null;
  const subtract = (from: Date, to: Date) => {
    seconds -= (to.getTime() - from.getTime()) / 1000;
    minutes -= businessMinutesBetween(from, to, cal);
  };
  for (const r of rows) {
    if (r.toStatus === 'ON_HOLD' && r.fromStatus !== 'ON_HOLD') pausedAt = r.changedAt;
    else if (pausedAt && r.fromStatus === 'ON_HOLD' && r.toStatus !== 'ON_HOLD') {
      subtract(pausedAt, r.changedAt);
      pausedAt = null;
    }
  }
  if (pausedAt) subtract(pausedAt, now); // still on hold: the pause in progress does not count
  return { seconds: Math.max(0, Math.round(seconds)), businessMinutes: Math.max(0, Math.round(minutes)) };
}

export interface StageChange {
  toStage: DossierStage;
  toStatus: 'OPEN' | 'ON_HOLD' | 'WON' | 'LOST';
  isBackward?: boolean;
  /** A hold or lost reason code followed by its note, or free text (MOD § 2.3). */
  reason?: string | null;
}

/** One line of the journal of stages (immutable). `stageLeft`: the stage changes, so the time spent in it is written. */
export async function writeHistory(
  tx: Tx,
  d: Pick<DossierRow, 'id' | 'stage' | 'status' | 'stageEnteredAt' | 'heldAt'>,
  change: StageChange,
  ctx: { actor: Actor; now: Date; cal: BusinessCalendar },
): Promise<void> {
  const stageLeft = change.toStage !== d.stage;
  const spent = stageLeft ? await timeInStage(tx, d, ctx.now, ctx.cal) : null;
  await tx.dossierStageHistory.create({
    data: {
      id: newId(),
      dossierId: d.id,
      fromStage: d.stage,
      toStage: change.toStage,
      fromStatus: d.status,
      toStatus: change.toStatus,
      isBackward: change.isBackward ?? false,
      reason: change.reason ? change.reason.slice(0, 500) : null,
      actorType: ctx.actor.type === 'USER' ? 'USER' : 'SYSTEM',
      changedById: stampBy(ctx.actor),
      changedAt: ctx.now,
      secondsInPreviousStage: spent ? BigInt(spent.seconds) : null,
      businessMinutesInPreviousStage: spent ? BigInt(spent.businessMinutes) : null,
      createdAt: ctx.now,
    },
  });
}

/**
 * A change of STAGE of an OPEN dossier (advance, step back, reopening at a stage): the journal line, the new stage with
 * its whole deadline (CAL-062), `lastActivityAt`, the audit row and `dossier.stage_changed`. Extra columns of the use
 * case go in `data`. Returns the updated row.
 */
export async function moveStage(
  tx: Tx,
  outbox: OutboxWriter,
  d: DossierRow,
  change: { toStage: DossierStage; isBackward?: boolean; reason?: string | null; data?: Prisma.DossierUncheckedUpdateInput; audit?: boolean },
  ctx: { actor: Actor; now: Date; cal: BusinessCalendar; sla: StageSla },
): Promise<DossierRow> {
  const { now, actor } = ctx;
  await writeHistory(tx, d, { toStage: change.toStage, toStatus: 'OPEN', isBackward: change.isBackward, reason: change.reason }, ctx);
  const next = await tx.dossier.update({
    where: { id: d.id },
    data: {
      ...(change.data ?? {}),
      stage: change.toStage,
      status: 'OPEN',
      stageEnteredAt: now,
      slaDueAt: stageDueAt(now, change.toStage, ctx.cal, ctx.sla),
      slaPausedRemainingMinutes: null,
      lastActivityAt: now,
      version: { increment: 1 },
      updatedById: stampBy(actor),
      updatedAt: now,
    },
  });
  if (change.audit !== false) {
    await writeAudit(tx, actor, now, {
      action: 'dossier.stage_changed',
      entityType: 'Dossier',
      entityId: d.id,
      entityLabel: d.reference,
      before: { stage: d.stage, status: d.status },
      after: { stage: change.toStage, status: 'OPEN', isBackward: change.isBackward ?? false },
      clientId: d.clientId,
      reason: change.reason ?? null,
    });
  }
  await outbox.add(
    tx,
    domainEvent({
      type: 'dossier.stage_changed',
      aggregate: { type: 'Dossier', id: d.id },
      actor: eventActor(actor),
      clientId: d.clientId,
      dossierId: d.id,
      data: { fromStage: d.stage, toStage: change.toStage, isBackward: change.isBackward ?? false },
      requestId: currentRequestId(),
    }),
    now,
  );
  return next;
}

/** CYC-031 — the business minutes left before the stage deadline (negative when the stage is already late). */
export function remainingBusinessMinutes(slaDueAt: Date | null, now: Date, cal: BusinessCalendar): number | null {
  return slaDueAt ? Math.round(businessMinutesBetween(now, slaDueAt, cal)) : null;
}

/** CYC-032 — the deadline after a resumption: `ajouterMinutesOuvrées(maintenant, slaPausedRemainingMinutes)`. */
export function dueAfterResume(remaining: number | null, now: Date, cal: BusinessCalendar): Date | null {
  return remaining === null ? null : addBusinessMinutes(now, remaining, cal);
}

/** An event of the dossier in the form of AUT-011. */
export async function emitDossier(tx: Tx, outbox: OutboxWriter, d: Pick<DossierRow, 'id' | 'clientId'>, type: string, actor: Actor, now: Date, data: Record<string, unknown> = {}): Promise<void> {
  await outbox.add(tx, domainEvent({ type, aggregate: { type: 'Dossier', id: d.id }, actor: eventActor(actor), clientId: d.clientId, dossierId: d.id, data, requestId: currentRequestId() }), now);
}

/** An event of a considered property (`candidate.*`), with the dossier and the client it belongs to. */
export async function emitCandidate(
  tx: Tx,
  outbox: OutboxWriter,
  c: { id: string; dossierId: string },
  clientId: string,
  type: string,
  actor: { type: 'USER' | 'SYSTEM'; id: string | null },
  now: Date,
  data: Record<string, unknown> = {},
): Promise<void> {
  await outbox.add(tx, domainEvent({ type, aggregate: { type: 'DossierCandidate', id: c.id }, actor, clientId, dossierId: c.dossierId, data, requestId: currentRequestId() }), now);
}

/** ECL-031 — a line of the client timeline, written in the transaction of the gesture (values frozen that day). */
export async function clientLine(tx: Tx, dossierId: string, kind: string, params: Record<string, string | number | null>, at: Date): Promise<void> {
  await tx.clientTimelineEntry.create({ data: { id: newId(), dossierId, kind: kind as never, occurredAt: at, params: params as never, createdAt: at } });
}

/** TRV-145 — « Amel K. », the adviser as the client reads him. */
export async function advisorLabel(tx: Tx, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const u = await tx.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
  if (!u?.firstName) return null;
  return u.lastName ? `${u.firstName} ${u.lastName.trim().charAt(0).toUpperCase()}.` : u.firstName;
}
