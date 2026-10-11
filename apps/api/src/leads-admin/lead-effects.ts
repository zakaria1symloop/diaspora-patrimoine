// Package 3.2 — the effects of the gestures of CRM-011 on the request, its dossier and its client, written once and
// called inside the transaction of each use case (FIA-001):
//   · CYC-003 / CYC-008 « Prendre en charge », « Affecter à… », « Réaffecter » — `assignLeadByHand`;
//   · CYC-008 « Rendre » — `releaseLeadByHand`;
//   · CYC-002, CRM-011 « Ouvrir un dossier », « Ouvrir un second dossier », « Rattacher au dossier » — `openDossierForLead`,
//     `attachLeadToDossier`.
import { businessMinutesBetween, stageDueAt, type BusinessCalendar, type DossierStage } from '@dp/domain';
import { domainEvent } from '../automation/event-catalogue.js';
import { writeAdvisorLine, writeLeadLine } from '../client-space/timeline.js';
import { nextReference } from '../platform/business-calendar.js';
import { newId } from '../platform/ids.js';
import type { OutboxWriter } from '../platform/outbox.js';
import type { Tx } from '../platform/tx.js';

export type StageSlaDays = Readonly<Record<DossierStage, number>>;

interface LeadRef {
  id: string;
  clientId: string | null;
  dossierId: string | null;
  assignedAgentId: string | null;
}

const userEvent = (type: string, lead: LeadRef, actorId: string, requestId: string | null, data: Record<string, unknown>) =>
  domainEvent({ type, aggregate: { type: 'Lead', id: lead.id }, actor: { type: 'USER', id: actorId }, clientId: lead.clientId, dossierId: lead.dossierId, data, requestId });

async function stageChange(
  tx: Tx,
  outbox: OutboxWriter,
  d: { id: string; stage: string; status: string; stageEnteredAt: Date },
  to: DossierStage,
  a: { actorId: string | null; reason?: string; now: Date; cal: BusinessCalendar; stageSlaDays: StageSlaDays },
  data: Record<string, unknown>,
): Promise<void> {
  const seconds = Math.max(0, Math.round((a.now.getTime() - d.stageEnteredAt.getTime()) / 1000));
  const businessMinutes = Math.max(0, Math.round(businessMinutesBetween(d.stageEnteredAt, a.now, a.cal)));
  const backward = to === 'INTEREST';
  await tx.dossier.update({ where: { id: d.id }, data: { ...data, stage: to, stageEnteredAt: a.now, slaDueAt: stageDueAt(a.now, to, a.cal, a.stageSlaDays), lastActivityAt: a.now, version: { increment: 1 }, updatedAt: a.now } });
  await tx.dossierStageHistory.create({
    data: {
      id: newId(),
      dossierId: d.id,
      fromStage: d.stage as DossierStage,
      toStage: to,
      fromStatus: d.status as 'OPEN',
      toStatus: d.status as 'OPEN',
      isBackward: backward,
      reason: a.reason ?? null,
      actorType: a.actorId && !backward ? 'USER' : 'SYSTEM',
      changedById: backward ? null : a.actorId,
      changedAt: a.now,
      secondsInPreviousStage: BigInt(seconds),
      businessMinutesInPreviousStage: BigInt(businessMinutes),
      createdAt: a.now,
    },
  });
  await outbox.add(tx, { type: 'dossier.stage_changed', aggregateType: 'Dossier', aggregateId: d.id, payload: { fromStage: d.stage, toStage: to, isBackward: backward } }, a.now);
}

export interface ManualAssignInput {
  lead: LeadRef;
  agentId: string;
  actorId: string;
  requestId: string | null;
  now: Date;
  cal: BusinessCalendar;
  stageSlaDays: StageSlaDays;
}

/**
 * CYC-003 / CYC-008 — the request becomes IN_PROGRESS with its adviser (`lead.taken`, with the actor: NS_ASSIGNED goes
 * to the new adviser when someone else entrusted it). Its dossier follows while it is at INTEREST (→ QUALIFICATION,
 * CYC-020) or at QUALIFICATION under the previous adviser; the client gets this adviser as referent when nobody — or
 * the previous adviser — followed him.
 */
export async function assignLeadByHand(tx: Tx, outbox: OutboxWriter, a: ManualAssignInput): Promise<void> {
  const { now, agentId } = a;
  const previous = a.lead.assignedAgentId;
  await tx.lead.update({ where: { id: a.lead.id }, data: { status: 'IN_PROGRESS', assignedAgentId: agentId, takenAt: now, updatedById: a.actorId, updatedAt: now } });
  await outbox.add(tx, userEvent('lead.taken', a.lead, a.actorId, a.requestId, { agentId, previousAgentId: previous }), now);
  if (a.lead.dossierId) {
    const d = await tx.dossier.findUnique({ where: { id: a.lead.dossierId }, select: { id: true, stage: true, status: true, assignedAgentId: true, stageEnteredAt: true, deletedAt: true } });
    if (d && !d.deletedAt && (d.status === 'OPEN' || d.status === 'ON_HOLD')) {
      const follows = !d.assignedAgentId || d.assignedAgentId === previous;
      if (d.stage === 'INTEREST' && follows) {
        await stageChange(tx, outbox, d, 'QUALIFICATION', a, { assignedAgentId: agentId });
        await tx.lead.updateMany({ where: { dossierId: d.id, status: 'NEW', id: { not: a.lead.id } }, data: { status: 'IN_PROGRESS', assignedAgentId: agentId, takenAt: now, updatedAt: now } });
      } else if (d.stage === 'QUALIFICATION' && follows && d.assignedAgentId !== agentId) {
        await tx.dossier.update({ where: { id: d.id }, data: { assignedAgentId: agentId, lastActivityAt: now, version: { increment: 1 }, updatedAt: now } });
      } else {
        return void (await referent(tx, a.lead.clientId, agentId, previous, now));
      }
      // NOT-035 — the request and its dossier entrusted together make ONE NS_ASSIGNED (the request's): `viaLeadId`.
      await outbox.add(tx, { type: 'dossier.assigned', aggregateType: 'Dossier', aggregateId: d.id, payload: { agentId, previousAgentId: d.assignedAgentId, notifyClient: false, viaLeadId: a.lead.id } }, now);
      await writeAdvisorLine(tx, { dossierId: d.id, agentId, at: now });
    }
  }
  await referent(tx, a.lead.clientId, agentId, previous, now);
}

async function referent(tx: Tx, clientId: string | null, agentId: string, previous: string | null, now: Date): Promise<void> {
  if (!clientId) return;
  await tx.client.updateMany({
    where: { id: clientId, OR: [{ assignedAgentId: null }, ...(previous ? [{ assignedAgentId: previous }] : [])] },
    data: { assignedAgentId: agentId, version: { increment: 1 }, updatedAt: now },
  });
}

/**
 * CYC-008 « Rendre » — back to « à prendre en charge » (the first-contact deadline does not change). The dossier at
 * QUALIFICATION under this adviser without first contact goes back to INTEREST and loses its adviser (history line,
 * reason « Demande rendue »); the client's referent is emptied when this adviser follows nothing else for him.
 */
export async function releaseLeadByHand(
  tx: Tx,
  outbox: OutboxWriter,
  a: { lead: LeadRef & { assignedAgentId: string }; actorId: string; requestId: string | null; now: Date; cal: BusinessCalendar; stageSlaDays: StageSlaDays; reason: string },
): Promise<void> {
  const { now } = a;
  const agent = a.lead.assignedAgentId;
  await tx.lead.update({ where: { id: a.lead.id }, data: { status: 'NEW', assignedAgentId: null, takenAt: null, updatedById: a.actorId, updatedAt: now } });
  await outbox.add(tx, userEvent('lead.released', a.lead, a.actorId, a.requestId, { previousAgentId: agent }), now);
  if (a.lead.dossierId) {
    const d = await tx.dossier.findUnique({ where: { id: a.lead.dossierId }, select: { id: true, stage: true, status: true, assignedAgentId: true, stageEnteredAt: true, firstContactAt: true, deletedAt: true } });
    if (d && !d.deletedAt && d.stage === 'QUALIFICATION' && d.assignedAgentId === agent && !d.firstContactAt) {
      await stageChange(tx, outbox, d, 'INTEREST', { ...a, actorId: null }, { assignedAgentId: null });
    }
  }
  if (a.lead.clientId) {
    const [otherLeads, dossiers] = await Promise.all([
      tx.lead.count({ where: { clientId: a.lead.clientId, assignedAgentId: agent, id: { not: a.lead.id }, status: { in: ['NEW', 'IN_PROGRESS'] } } }),
      tx.dossier.count({ where: { clientId: a.lead.clientId, assignedAgentId: agent, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] } } }),
    ]);
    if (otherLeads + dossiers === 0) await tx.client.updateMany({ where: { id: a.lead.clientId, assignedAgentId: agent }, data: { assignedAgentId: null, version: { increment: 1 }, updatedAt: now } });
  }
}

interface ObjectRefs {
  propertyId: string | null;
  propertyTitle: string | null;
  lotId: string | null;
  candidateStatus: 'INTERESTED' | 'UNAVAILABLE';
}

/** CYC-002 / CYC-070 — the property of a PROPERTY_INTEREST becomes a candidate of the dossier; the selected one is never touched. */
async function candidateFor(tx: Tx, outbox: OutboxWriter, dossierId: string, leadId: string, kind: string, o: ObjectRefs, now: Date): Promise<void> {
  if (kind !== 'PROPERTY_INTEREST' || !o.propertyId) return;
  const existing = await tx.dossierCandidate.findUnique({ where: { dossierId_propertyId: { dossierId, propertyId: o.propertyId } } });
  if (!existing) {
    await tx.dossierCandidate.create({ data: { id: newId(), dossierId, propertyId: o.propertyId, lotId: o.lotId, origin: 'CLIENT_INTEREST', leadId, status: o.candidateStatus, statusChangedAt: now, createdAt: now, updatedAt: now } });
  } else if (['PROPOSED', 'VIEWED', 'DECLINED'].includes(existing.status) && o.candidateStatus === 'INTERESTED') {
    await tx.dossierCandidate.update({ where: { id: existing.id }, data: { status: 'INTERESTED', statusChangedAt: now, version: { increment: 1 }, updatedAt: now } });
    await outbox.add(tx, { type: 'candidate.interested', aggregateType: 'Dossier', aggregateId: dossierId, payload: { candidateId: existing.id, by: 'CLIENT' } }, now);
  }
}

/**
 * CRM-011 « Ouvrir un dossier » / « Ouvrir un second dossier » — a dossier at INTEREST with `originLeadId`, the request
 * attached; a request that already has an adviser gives it to the dossier, which moves at once to QUALIFICATION
 * (CYC-020). The caller then runs `syncFirstContact`: a first contact already noted closes the request
 * (`DOSSIER_OPENED`) and gives its date to the dossier (CRM-011).
 */
export async function openDossierForLead(
  tx: Tx,
  outbox: OutboxWriter,
  a: {
    lead: LeadRef & { reference: string; kind: string };
    client: { id: string; preferredCountries: string[]; financingPreference: string | null; downPayment: unknown; downPaymentCurrency: string | null };
    object: ObjectRefs & { countryCode: string | null };
    actorId: string;
    requestId: string | null;
    now: Date;
    cal: BusinessCalendar;
    stageSlaDays: StageSlaDays;
  },
): Promise<{ id: string; reference: string }> {
  const { now } = a;
  const id = newId();
  const reference = await nextReference(tx, 'DOSSIER', now, a.cal.timeZone);
  const financing = a.client.financingPreference;
  await tx.dossier.create({
    data: {
      id,
      reference,
      clientId: a.client.id,
      originLeadId: a.lead.id,
      stage: 'INTEREST',
      status: 'OPEN',
      propertyCountryCode: a.object.countryCode ?? a.client.preferredCountries[0] ?? null,
      financingRequested: financing !== 'CASH',
      financingType: (financing as never) ?? null,
      downPayment: (a.client.downPayment as never) ?? null,
      downPaymentCurrency: a.client.downPayment !== null ? a.client.downPaymentCurrency : null,
      stageEnteredAt: now,
      slaDueAt: stageDueAt(now, 'INTEREST', a.cal, a.stageSlaDays),
      lastActivityAt: now,
      createdById: a.actorId,
      updatedById: a.actorId,
      createdAt: now,
      updatedAt: now,
    },
  });
  await tx.dossierParty.create({ data: { id: newId(), dossierId: id, role: 'PRIMARY', clientId: a.client.id, sortOrder: 0, createdAt: now, updatedAt: now } });
  await tx.dossierStageHistory.create({ data: { id: newId(), dossierId: id, fromStage: null, toStage: 'INTEREST', fromStatus: null, toStatus: 'OPEN', isBackward: false, actorType: 'USER', changedById: a.actorId, changedAt: now, createdAt: now } });
  await tx.lead.update({ where: { id: a.lead.id }, data: { dossierId: id, updatedAt: now } });
  await outbox.add(tx, domainEvent({ type: 'dossier.opened', aggregate: { type: 'Dossier', id }, actor: { type: 'USER', id: a.actorId }, clientId: a.client.id, dossierId: id, data: { originLeadId: a.lead.id }, requestId: a.requestId }), now);
  await writeLeadLine(tx, { dossierId: id, again: false, kind: a.lead.kind, propertyTitle: a.object.propertyTitle, leadReference: a.lead.reference, at: now });
  await candidateFor(tx, outbox, id, a.lead.id, a.lead.kind, a.object, now);
  if (a.lead.assignedAgentId) {
    const d = { id, stage: 'INTEREST', status: 'OPEN', stageEnteredAt: now };
    await stageChange(tx, outbox, d, 'QUALIFICATION', a, { assignedAgentId: a.lead.assignedAgentId });
    await outbox.add(tx, { type: 'dossier.assigned', aggregateType: 'Dossier', aggregateId: id, payload: { agentId: a.lead.assignedAgentId, previousAgentId: null, notifyClient: false, viaLeadId: a.lead.id } }, now);
    await writeAdvisorLine(tx, { dossierId: id, agentId: a.lead.assignedAgentId, at: now });
  }
  return { id, reference };
}

/** CRM-011 « Rattacher au dossier » — `Lead.dossierId`, `lead.attached`; the property becomes a candidate (CYC-002). */
export async function attachLeadToDossier(
  tx: Tx,
  outbox: OutboxWriter,
  a: { lead: LeadRef & { reference: string; kind: string }; dossier: { id: string }; object: ObjectRefs; actorId: string; requestId: string | null; now: Date },
): Promise<void> {
  await tx.lead.update({ where: { id: a.lead.id }, data: { dossierId: a.dossier.id, updatedAt: a.now } });
  await outbox.add(tx, domainEvent({ type: 'lead.attached', aggregate: { type: 'Lead', id: a.lead.id }, actor: { type: 'USER', id: a.actorId }, clientId: a.lead.clientId, dossierId: a.dossier.id, data: { dossierId: a.dossier.id }, requestId: a.requestId }), a.now);
  await tx.dossier.update({ where: { id: a.dossier.id }, data: { lastActivityAt: a.now, version: { increment: 1 }, updatedAt: a.now } });
  await writeLeadLine(tx, { dossierId: a.dossier.id, again: true, kind: a.lead.kind, propertyTitle: a.object.propertyTitle, leadReference: a.lead.reference, at: a.now });
  await candidateFor(tx, outbox, a.dossier.id, a.lead.id, a.lead.kind, a.object, a.now);
}
