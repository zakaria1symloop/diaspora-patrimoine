// CYC-035, CYC-040, CYC-070, CYC-080 — what the DOSSIER use cases (package 3.7, `dossiers-admin/`) need from the
// appointments (package 3.8). Pure functions run INSIDE the caller's transaction (FIA-001): no service, no injection.
// The exported signatures are the contract between the two packages — keep them.
import type { Actor } from '../admin/actor.js';
import { stampBy } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { domainEvent } from '../automation/event-catalogue.js';
import type { OutboxWriter } from '../platform/outbox.js';
import type { PrismaService } from '../platform/prisma.service.js';
import { currentRequestId } from '../platform/request-context.js';
import type { Tx } from '../platform/tx.js';

type Db = Tx | PrismaService;

export interface UpcomingAppointment {
  id: string;
  type: string;
  startsAt: Date;
  /** `clientNotifiedAt` set: the client was told by e-mail, and will be told of what happens to it (CYC-080). */
  clientInformed: boolean;
}

const upcoming = (now: Date) => ({ status: { in: ['REQUESTED', 'CONFIRMED'] as ('REQUESTED' | 'CONFIRMED')[] }, OR: [{ startsAt: { gt: now } }, { startsAt: null }] });

/** The appointments to come of a dossier (PIP-080 « ce qui continue de courir », PIP-081 « rendez-vous annulés »). */
export async function upcomingAppointmentsOfDossier(db: Db, dossierId: string, now: Date): Promise<UpcomingAppointment[]> {
  const rows = await db.appointment.findMany({ where: { dossierId, status: 'CONFIRMED', startsAt: { gt: now } }, orderBy: { startsAt: 'asc' }, select: { id: true, type: true, startsAt: true, clientNotifiedAt: true } });
  return rows.map((r) => ({ id: r.id, type: r.type, startsAt: r.startsAt!, clientInformed: r.clientNotifiedAt !== null }));
}

/** The next confirmed visit of a considered property, if any. */
export async function upcomingVisitOfCandidate(db: Db, candidateId: string, now: Date): Promise<{ id: string; startsAt: Date } | null> {
  const row = await db.appointment.findFirst({ where: { candidateId, status: 'CONFIRMED', startsAt: { gt: now } }, orderBy: { startsAt: 'asc' }, select: { id: true, startsAt: true } });
  return row ? { id: row.id, startsAt: row.startsAt! } : null;
}

/**
 * CYC-035 effect 4 — the appointments to come of a dossier that closes are cancelled (`cancelledBy = SYSTEM`); the
 * client is told by `C_APPOINTMENT_CANCELLED` in its « dossier clôturé » version, unless the appointment had been
 * created without informing him. Emits `appointment.cancelled` for each. Returns the number cancelled.
 */
export async function cancelAppointmentsOfClosedDossier(tx: Tx, outbox: OutboxWriter, a: { dossierId: string; now: Date }): Promise<number> {
  const rows = await tx.appointment.findMany({ where: { dossierId: a.dossierId, ...upcoming(a.now) }, select: { id: true, type: true, clientId: true, hostName: true, clientNotifiedAt: true } });
  for (const r of rows) {
    await tx.appointment.update({ where: { id: r.id }, data: { status: 'CANCELLED', cancelledBy: 'SYSTEM', version: { increment: 1 }, updatedAt: a.now } });
    await outbox.add(
      tx,
      domainEvent({
        type: 'appointment.cancelled',
        aggregate: { type: 'Appointment', id: r.id },
        clientId: r.clientId,
        dossierId: a.dossierId,
        data: { type: r.type, cancelledBy: 'SYSTEM', hadHost: Boolean(r.hostName), dossierClosed: true, notifyClient: r.clientNotifiedAt !== null },
        requestId: currentRequestId(),
      }),
      a.now,
    );
  }
  return rows.length;
}

/** CYC-040 — the appointments to come of a dossier follow its new adviser. Returns the number moved. */
export async function reassignUpcomingAppointments(tx: Tx, a: { dossierId: string; toAgentId: string; actor: Actor; now: Date }): Promise<number> {
  const moved = await tx.appointment.updateMany({
    where: { dossierId: a.dossierId, ...upcoming(a.now), NOT: { staffUserId: a.toAgentId } },
    data: { staffUserId: a.toAgentId, updatedById: stampBy(a.actor), updatedAt: a.now },
  });
  return moved.count;
}

/**
 * CYC-070 « DECLINED » — a visit to come for a property the client (or the adviser in his name) sets aside is
 * cancelled. Emits `appointment.cancelled` (`cancelledBy`: who set the property aside). Returns the number cancelled.
 * The candidate itself is NOT touched here: the caller is changing its status.
 */
export async function cancelUpcomingVisitsOfCandidate(tx: Tx, outbox: OutboxWriter, a: { candidateId: string; by: 'CLIENT' | 'STAFF'; actor: Actor; now: Date }): Promise<number> {
  const rows = await tx.appointment.findMany({ where: { candidateId: a.candidateId, ...upcoming(a.now) }, select: { id: true, type: true, status: true, clientId: true, dossierId: true, hostName: true, clientNotifiedAt: true } });
  for (const r of rows) {
    await tx.appointment.update({ where: { id: r.id }, data: { status: 'CANCELLED', cancelledBy: a.by, version: { increment: 1 }, updatedById: stampBy(a.actor), updatedAt: a.now } });
    await writeAudit(tx, a.actor, a.now, { action: 'appointment.updated', entityType: 'appointment', entityId: r.id, before: { status: r.status }, after: { status: 'CANCELLED', cancelledBy: a.by }, clientId: r.clientId });
    await outbox.add(
      tx,
      domainEvent({
        type: 'appointment.cancelled',
        aggregate: { type: 'Appointment', id: r.id },
        actor: a.by === 'STAFF' ? { type: 'USER', id: a.actor.userId } : { type: 'USER', id: null },
        clientId: r.clientId,
        dossierId: r.dossierId,
        data: { type: r.type, cancelledBy: a.by, hadHost: Boolean(r.hostName), notifyClient: a.by === 'STAFF' && r.clientNotifiedAt !== null },
        requestId: currentRequestId(),
      }),
      a.now,
    );
  }
  return rows.length;
}
