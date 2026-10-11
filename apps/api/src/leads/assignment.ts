// CRM-020, CRM-021, CYC-003, CYC-020 — automatic assignment of a new request (« affectation d'office »):
// joined dossier's advisor (not the referent) · else the client's referent · else the only active OWNER/ADMIN/AGENT
// account · else ROUND_ROBIN when that mode is set. An automatic assignment never goes to someone absent beyond the
// first-contact deadline. Effects (CYC-003): IN_PROGRESS, `takenAt`; a dossier at INTEREST receives the same advisor
// and moves to QUALIFICATION (CYC-020), with its history line, its stage deadline and the client's referent.
import { businessMinutesBetween, endOfBusinessDay, stageDueAt, type BusinessCalendar, type DossierStage } from '@dp/domain';
import type { OutboxWriter } from '../platform/outbox.js';
import { newId } from '../platform/ids.js';
import type { Tx } from '../platform/tx.js';
import { writeAdvisorLine } from '../client-space/timeline.js';

export interface Advisor {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT';
  receivesLeads: boolean;
  /** `Membership.absentUntil` (a date). */
  absentUntil: Date | null;
  sortName: string;
}

/** Active accounts of the operator that can handle requests (never VIEWER nor SUPPORT, CRM-020). */
export async function loadAdvisors(tx: Tx): Promise<Advisor[]> {
  const rows = await tx.membership.findMany({
    where: {
      revokedAt: null,
      suspendedAt: null,
      role: { in: ['OWNER', 'ADMIN', 'AGENT'] },
      organization: { type: 'OPERATOR' },
      user: { kind: 'STAFF', status: 'ACTIVE' },
    },
    select: { userId: true, role: true, receivesLeads: true, absentUntil: true, user: { select: { firstName: true, lastName: true } } },
  });
  return rows.map((r) => ({
    userId: r.userId,
    role: r.role as Advisor['role'],
    receivesLeads: r.receivesLeads,
    absentUntil: r.absentUntil,
    sortName: `${r.user.lastName ?? ''} ${r.user.firstName ?? ''}`.trim().toLowerCase(),
  }));
}

/** CRM-021 — back the day after `absentUntil`, at `business.calendar.start`, in the calendar time zone. */
export function returnAt(absentUntil: Date, cal: BusinessCalendar): Date {
  const next = new Date(absentUntil.getTime() + 86_400_000).toISOString().slice(0, 10);
  return endOfBusinessDay(next, { ...cal, end: cal.start });
}

/** « Absent au-delà » of a deadline = back after it. Without deadline: present now. */
export function canHandleBy(advisor: Advisor, deadline: Date | null, now: Date, cal: BusinessCalendar): boolean {
  if (!advisor.absentUntil) return true;
  const back = returnAt(advisor.absentUntil, cal);
  return back.getTime() <= (deadline ?? now).getTime();
}

export interface AssigneeInput {
  joinedDossierAgentId: string | null;
  referentId: string | null;
  advisors: readonly Advisor[];
  mode: 'MANUAL' | 'ROUND_ROBIN';
  /** Latest `takenAt` per advisor (ROUND_ROBIN). */
  lastTakenAt: ReadonlyMap<string, Date>;
  deadline: Date | null;
  now: Date;
  cal: BusinessCalendar;
}

/** CRM-020 — the advisor who receives the request, or null (it stays unassigned). */
export function pickAssignee(i: AssigneeInput): string | null {
  const byId = new Map(i.advisors.map((a) => [a.userId, a]));
  const ok = (id: string | null) => {
    const a = id ? byId.get(id) : undefined;
    return a && canHandleBy(a, i.deadline, i.now, i.cal) ? a.userId : null;
  };
  if (i.joinedDossierAgentId) {
    const agent = ok(i.joinedDossierAgentId);
    if (agent) return agent;
  } else {
    const referent = ok(i.referentId);
    if (referent) return referent;
  }
  if (i.advisors.length === 1) return i.advisors[0]!.userId; // Whatever its « Reçoit des demandes » setting.
  if (i.mode !== 'ROUND_ROBIN') return null;
  const available = i.advisors.filter((a) => a.receivesLeads && canHandleBy(a, null, i.now, i.cal));
  available.sort((a, b) => {
    const ta = i.lastTakenAt.get(a.userId)?.getTime() ?? -Infinity;
    const tb = i.lastTakenAt.get(b.userId)?.getTime() ?? -Infinity;
    return ta !== tb ? ta - tb : a.sortName.localeCompare(b.sortName, 'fr');
  });
  return available[0]?.userId ?? null;
}

export async function lastTakenAt(tx: Tx, userIds: string[]): Promise<Map<string, Date>> {
  if (userIds.length === 0) return new Map();
  const rows = await tx.lead.groupBy({ by: ['assignedAgentId'], where: { assignedAgentId: { in: userIds }, takenAt: { not: null } }, _max: { takenAt: true } });
  return new Map(rows.filter((r) => r.assignedAgentId && r._max.takenAt).map((r) => [r.assignedAgentId!, r._max.takenAt!]));
}

/**
 * CYC-003 effects of an automatic assignment, inside the creation transaction. `dossier`: the dossier the request opened
 * or joined, if any.
 */
export async function applyAssignment(
  tx: Tx,
  outbox: OutboxWriter,
  args: {
    leadId: string;
    agentId: string;
    clientId: string | null;
    dossier: { id: string; stage: string; assignedAgentId: string | null; stageEnteredAt: Date; version: number } | null;
    now: Date;
    cal: BusinessCalendar;
    stageSlaDays: Readonly<Record<DossierStage, number>>;
  },
): Promise<void> {
  const { now, agentId } = args;
  await tx.lead.update({ where: { id: args.leadId }, data: { status: 'IN_PROGRESS', assignedAgentId: agentId, takenAt: now, updatedAt: now } });
  await outbox.add(tx, { type: 'lead.taken', aggregateType: 'Lead', aggregateId: args.leadId, payload: { agentId, previousAgentId: null } }, now);

  const d = args.dossier;
  if (d && d.stage === 'INTEREST' && !d.assignedAgentId) {
    // CYC-020 — INTEREST → QUALIFICATION.
    const seconds = Math.max(0, Math.round((now.getTime() - d.stageEnteredAt.getTime()) / 1000));
    const businessMinutes = Math.max(0, Math.round(businessMinutesBetween(d.stageEnteredAt, now, args.cal)));
    await tx.dossier.update({
      where: { id: d.id },
      data: {
        assignedAgentId: agentId,
        stage: 'QUALIFICATION',
        stageEnteredAt: now,
        slaDueAt: stageDueAt(now, 'QUALIFICATION', args.cal, args.stageSlaDays),
        lastActivityAt: now,
        version: { increment: 1 },
        updatedAt: now,
      },
    });
    await tx.dossierStageHistory.create({
      data: {
        id: newId(),
        dossierId: d.id,
        fromStage: 'INTEREST',
        toStage: 'QUALIFICATION',
        fromStatus: 'OPEN',
        toStatus: 'OPEN',
        isBackward: false,
        actorType: 'SYSTEM',
        changedAt: now,
        secondsInPreviousStage: BigInt(seconds),
        businessMinutesInPreviousStage: BigInt(businessMinutes),
        createdAt: now,
      },
    });
    // « Demandes du dossier → IN_PROGRESS », with the dossier's advisor.
    await tx.lead.updateMany({ where: { dossierId: d.id, status: 'NEW' }, data: { status: 'IN_PROGRESS', assignedAgentId: agentId, takenAt: now, updatedAt: now } });
    await outbox.add(tx, { type: 'dossier.assigned', aggregateType: 'Dossier', aggregateId: d.id, payload: { agentId, previousAgentId: null, notifyClient: false } }, now);
    await writeAdvisorLine(tx, { dossierId: d.id, agentId, at: now }); // ECL-031 « {conseiller} suit votre projet. »
    await outbox.add(tx, { type: 'dossier.stage_changed', aggregateType: 'Dossier', aggregateId: d.id, payload: { fromStage: 'INTEREST', toStage: 'QUALIFICATION', isBackward: false } }, now);
    if (args.clientId) {
      // CYC-020 — the client becomes followed by this advisor, if no one follows him yet.
      await tx.client.updateMany({
        where: { id: args.clientId, assignedAgentId: null },
        data: { assignedAgentId: agentId, version: { increment: 1 }, updatedAt: now },
      });
    }
  }
}
