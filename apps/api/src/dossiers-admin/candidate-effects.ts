// CYC-070, CYC-034, MOD-311 — what the APPOINTMENTS and the TASKS (package 3.8, `tasks-admin/`) need from the dossier
// (package 3.7). Pure functions run INSIDE the caller's transaction (FIA-001). The exported signatures are the
// contract between the two packages — keep them.
import type { Actor } from '../admin/actor.js';
import { stampBy } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { domainEvent } from '../automation/event-catalogue.js';
import type { OutboxWriter } from '../platform/outbox.js';
import { currentRequestId } from '../platform/request-context.js';
import type { Tx } from '../platform/tx.js';

/**
 * What an appointment does to the considered property it is about (CYC-070, CYC-080):
 *   REQUESTED — the client asked for a visit                         INTERESTED, VISITED → VISIT_REQUESTED
 *   PLANNED   — a visit is confirmed or created by the team          VISIT_REQUESTED, PROPOSED, VIEWED, INTERESTED, VISITED → VISIT_PLANNED
 *   DONE      — the visit took place (also noted afterwards)         VISIT_PLANNED, PROPOSED, VIEWED, INTERESTED, VISIT_REQUESTED → VISITED
 *   RELEASED  — cancelled, refused, missed, or corrected to those    VISIT_REQUESTED, VISIT_PLANNED, VISITED → INTERESTED
 * From any other status nothing moves: a property retained or set aside meanwhile keeps its status.
 */
export type VisitEffect = 'REQUESTED' | 'PLANNED' | 'DONE' | 'RELEASED';

const FROM: Record<VisitEffect, readonly string[]> = {
  REQUESTED: ['INTERESTED', 'VISITED'],
  PLANNED: ['VISIT_REQUESTED', 'PROPOSED', 'VIEWED', 'INTERESTED', 'VISITED'],
  DONE: ['VISIT_PLANNED', 'PROPOSED', 'VIEWED', 'INTERESTED', 'VISIT_REQUESTED'],
  RELEASED: ['VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED'],
};
const TO: Record<VisitEffect, 'VISIT_REQUESTED' | 'VISIT_PLANNED' | 'VISITED' | 'INTERESTED'> = { REQUESTED: 'VISIT_REQUESTED', PLANNED: 'VISIT_PLANNED', DONE: 'VISITED', RELEASED: 'INTERESTED' };

/** CYC-070 — pure: the status an effect leads to from `status`, or null when nothing moves. */
export function visitEffectTarget(status: string, effect: VisitEffect): 'VISIT_REQUESTED' | 'VISIT_PLANNED' | 'VISITED' | 'INTERESTED' | null {
  return FROM[effect].includes(status) ? TO[effect] : null;
}

/** Applies the effect; returns true when the status changed. Audited (`candidate.status_changed`). */
export async function applyVisitEffect(tx: Tx, a: { candidateId: string; effect: VisitEffect; actor: Actor; now: Date }): Promise<boolean> {
  const c = await tx.dossierCandidate.findUnique({ where: { id: a.candidateId }, select: { id: true, status: true, viewedAt: true, dossierId: true, property: { select: { title: true } }, dossier: { select: { clientId: true, reference: true } } } });
  if (!c) return false;
  const to = visitEffectTarget(c.status, a.effect);
  if (!to) return false;
  // A visit corrected to « not held » gives VISITED back to INTERESTED only when no other visit of the property was held.
  if (a.effect === 'RELEASED' && c.status === 'VISITED') {
    const held = await tx.appointment.count({ where: { candidateId: c.id, status: 'DONE' } });
    if (held > 0) return false;
  }
  const moved = await tx.dossierCandidate.updateMany({
    where: { id: c.id, status: c.status },
    data: { status: to, statusChangedAt: a.now, viewedAt: c.viewedAt ?? a.now, version: { increment: 1 }, updatedById: stampBy(a.actor), updatedAt: a.now },
  });
  if (moved.count !== 1) return false;
  await writeAudit(tx, a.actor, a.now, { action: 'candidate.status_changed', entityType: 'DossierCandidate', entityId: c.id, entityLabel: c.property.title, before: { status: c.status }, after: { status: to, event: to.toLowerCase() }, clientId: c.dossier.clientId, dossierId: c.dossierId, reason: 'appointment' });
  await touchDossier(tx, c.dossierId, a.now);
  return true;
}

/** MOD-311 — `lastActivityAt` of a dossier (an appointment, a finished task, a note…). */
export async function touchDossier(tx: Tx, dossierId: string, now: Date): Promise<void> {
  await tx.dossier.updateMany({ where: { id: dossierId, deletedAt: null }, data: { lastActivityAt: now } });
}

/** What happened on a dossier on hold (CYC-034); the words of « {ce qui s'est passé} » are `ui.automation.holdActivity.{what}`. */
export type HoldActivity = 'DOCUMENT' | 'MESSAGE' | 'PROPOSAL_ANSWER' | 'APPOINTMENT' | 'BANK_DECISION' | 'BANK_INFO';

/**
 * CYC-034 — an action of the client on a dossier ON HOLD: emits `dossier.activity_on_hold` (rule `R_HOLD_ACTIVITY`:
 * one open task whatever the number of facts). Nothing when the dossier is not on hold.
 */
export async function signalHoldActivity(tx: Tx, outbox: OutboxWriter, a: { dossierId: string; what: HoldActivity; now: Date }): Promise<boolean> {
  const d = await tx.dossier.findUnique({ where: { id: a.dossierId }, select: { status: true, clientId: true } });
  if (!d || d.status !== 'ON_HOLD') return false;
  await outbox.add(tx, domainEvent({ type: 'dossier.activity_on_hold', aggregate: { type: 'Dossier', id: a.dossierId }, clientId: d.clientId, dossierId: a.dossierId, data: { what: a.what }, requestId: currentRequestId() }), a.now);
  return true;
}
