// CYC-004, CYC-005 — the FIRST CONTACT of a request and of its dossier, kept in ONE place.
//
// `firstContactAt` is the OLDEST of the facts of the closed list of CYC-004 that come after the request:
//   · a call noted with the outcome REACHED (CRM-030) · a WhatsApp exchange or a meeting noted (CRM-031)
//   · a MANUAL e-mail really sent to the client (never one that bounced, failed, was cancelled or suppressed)
//   · a message written by the staff in the messaging · an appointment marked DONE · a projection sent (BNK-081)
//   · a request entered by the team with « Échange déjà eu avec le client » (CRM-025): the creation itself.
// A fact noted from the client record, without a named request (`Communication.leadId` empty), counts for every
// request of the client that was open at that moment. Automatic e-mails never count.
//
// It is never set by hand: every use case that writes, corrects or removes one of these facts calls
// `syncFirstContact` in ITS transaction. The function reads the facts again and writes what they say — so a corrected
// call outcome, a deleted exchange or a bounced e-mail RECOMPUTES the value, which may become empty again (CYC-004).
// Effects of a first contact that appears (CYC-005): `lead.first_contact`; a request that opened or joined a dossier
// closes by itself (`DOSSIER_OPENED` / `ATTACHED_TO_DOSSIER`, `lead.closed`) — and stays closed if the fact is later
// invalidated. The dossier follows: its own `firstContactAt` is the oldest of its requests' and of the facts noted on
// the client since it exists.
import type { Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { domainEvent } from '../automation/event-catalogue.js';
import type { OutboxWriter } from '../platform/outbox.js';
import { currentRequestId } from '../platform/request-context.js';
import type { Tx } from '../platform/tx.js';

export type ContactFactChannel = 'CALL' | 'WHATSAPP' | 'MEETING' | 'EMAIL' | 'MESSAGE' | 'APPOINTMENT' | 'PROJECTION' | 'STAFF_ENTRY';

export interface ContactFact {
  at: Date;
  channel: ContactFactChannel;
  /** The request the fact names, when it names one. */
  leadId: string | null;
}

/** E-mail states that never count as a contact (CYC-004: « un e-mail rejeté ne compte pas »; not sent yet: not a fact). */
const DEAD_EMAIL_STATES = ['QUEUED', 'BOUNCED', 'FAILED', 'CANCELLED', 'SUPPRESSED'] as const;

/** `Lead.payload.staffEntry.alreadyContacted` — written by the creation of CRM-025. */
export function enteredAsAlreadyContacted(payload: unknown): boolean {
  const entry = (payload as { staffEntry?: { alreadyContacted?: unknown } } | null)?.staffEntry;
  return entry?.alreadyContacted === true;
}

/** Every fact of CYC-004 known for a client (all his requests), oldest first. */
export async function clientContactFacts(tx: Tx, clientId: string): Promise<ContactFact[]> {
  const [communications, messages, appointments, projections] = await Promise.all([
    tx.communication.findMany({
      where: {
        clientId,
        OR: [
          { channel: 'CALL', callOutcome: 'REACHED' },
          { channel: { in: ['WHATSAPP', 'MEETING'] } },
          { channel: 'EMAIL', direction: 'OUTBOUND', triggeredBy: 'MANUAL', sentAt: { not: null }, deliveryState: { notIn: [...DEAD_EMAIL_STATES] } },
        ],
      },
      select: { channel: true, occurredAt: true, sentAt: true, leadId: true },
    }),
    tx.message.findMany({ where: { senderType: 'STAFF', deletedAt: null, conversation: { clientId } }, select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 50 }),
    tx.appointment.findMany({ where: { clientId, status: 'DONE' }, select: { startsAt: true, endsAt: true, updatedAt: true } }),
    tx.simulation.findMany({ where: { clientId, type: 'PROJECTION', sentAt: { not: null } }, select: { sentAt: true } }),
  ]);
  const facts: ContactFact[] = [];
  for (const c of communications) {
    if (c.channel === 'EMAIL') facts.push({ at: c.sentAt!, channel: 'EMAIL', leadId: c.leadId });
    else facts.push({ at: c.occurredAt, channel: c.channel as ContactFactChannel, leadId: c.leadId });
  }
  for (const m of messages) facts.push({ at: m.createdAt, channel: 'MESSAGE', leadId: null });
  for (const a of appointments) facts.push({ at: a.endsAt ?? a.startsAt ?? a.updatedAt, channel: 'APPOINTMENT', leadId: null });
  for (const p of projections) facts.push({ at: p.sentAt!, channel: 'PROJECTION', leadId: null });
  return facts.sort((x, y) => x.at.getTime() - y.at.getTime());
}

/** Facts that name a request without a client record (a partner application never has one; kept for completeness). */
async function orphanLeadFacts(tx: Tx, leadId: string): Promise<ContactFact[]> {
  const rows = await tx.communication.findMany({
    where: { leadId, clientId: null, OR: [{ channel: 'CALL', callOutcome: 'REACHED' }, { channel: { in: ['WHATSAPP', 'MEETING'] } }] },
    select: { channel: true, occurredAt: true },
  });
  return rows.map((r) => ({ at: r.occurredAt, channel: r.channel as ContactFactChannel, leadId })).sort((x, y) => x.at.getTime() - y.at.getTime());
}

interface LeadLike {
  id: string;
  createdAt: Date;
  closedAt: Date | null;
  payload: unknown;
}

/**
 * CYC-004 — the oldest fact that counts for THIS request: one that names it, or one noted on the client while the
 * request was open; always after the request itself. Pure.
 */
export function firstFactFor(lead: LeadLike, facts: readonly ContactFact[]): ContactFact | null {
  if (enteredAsAlreadyContacted(lead.payload)) return { at: lead.createdAt, channel: 'STAFF_ENTRY', leadId: lead.id };
  for (const f of facts) {
    if (f.at.getTime() < lead.createdAt.getTime()) continue;
    if (f.leadId === lead.id) return f;
    if (f.leadId === null && (!lead.closedAt || f.at.getTime() <= lead.closedAt.getTime())) return f;
  }
  return null;
}

export interface SyncFirstContactInput {
  /** The requests the gesture names. */
  leadIds?: readonly string[];
  /** The client the gesture was noted on: every request of his is read again. */
  clientId?: string | null;
  actor: Actor;
  now: Date;
}

export interface SyncFirstContactResult {
  /** Requests whose `firstContactAt` changed. */
  leads: { id: string; firstContactAt: Date | null; closed: boolean }[];
  /** Dossiers whose `firstContactAt` changed. */
  dossierIds: string[];
}

const same = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

/**
 * Reads the facts again and writes `firstContactAt` on the requests and their dossiers. Idempotent: calling it twice
 * changes nothing the second time. To call INSIDE the transaction of the gesture, after the fact is written.
 */
export async function syncFirstContact(tx: Tx, outbox: OutboxWriter, input: SyncFirstContactInput): Promise<SyncFirstContactResult> {
  const { now, actor } = input;
  const result: SyncFirstContactResult = { leads: [], dossierIds: [] };
  const ids = [...new Set(input.leadIds ?? [])];
  if (!ids.length && !input.clientId) return result;

  const leads = await tx.lead.findMany({
    where: {
      status: { not: 'SPAM' },
      kind: { not: 'PARTNER_REQUEST' }, // CAL-061: a partner application has no first contact
      OR: [...(ids.length ? [{ id: { in: ids } }] : []), ...(input.clientId ? [{ clientId: input.clientId }] : [])],
    },
    select: { id: true, reference: true, clientId: true, dossierId: true, status: true, createdAt: true, closedAt: true, firstContactAt: true, payload: true, dossier: { select: { originLeadId: true } } },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  if (!leads.length && !input.clientId) return result;

  const factsByClient = new Map<string, ContactFact[]>();
  const factsOf = async (clientId: string) => {
    let facts = factsByClient.get(clientId);
    if (!facts) {
      facts = await clientContactFacts(tx, clientId);
      factsByClient.set(clientId, facts);
    }
    return facts;
  };

  const dossierIds = new Set<string>();
  for (const lead of leads) {
    if (lead.dossierId) dossierIds.add(lead.dossierId);
    const facts = lead.clientId ? await factsOf(lead.clientId) : await orphanLeadFacts(tx, lead.id);
    const fact = firstFactFor(lead, facts);
    const next = fact?.at ?? null;
    if (same(next, lead.firstContactAt)) continue;

    const appears = lead.firstContactAt === null && next !== null;
    // CYC-005 — a request that opened or joined a dossier closes by itself at the first contact.
    const closes = appears && lead.dossierId !== null && (lead.status === 'NEW' || lead.status === 'IN_PROGRESS');
    const outcome = closes ? (lead.dossier?.originLeadId === lead.id ? 'DOSSIER_OPENED' : 'ATTACHED_TO_DOSSIER') : null;
    await tx.lead.update({
      where: { id: lead.id },
      data: { firstContactAt: next, ...(closes ? { status: 'CLOSED', outcome: outcome!, closedAt: now, closedById: null } : {}), updatedAt: now },
    });
    if (appears) {
      await outbox.add(
        tx,
        domainEvent({ type: 'lead.first_contact', aggregate: { type: 'Lead', id: lead.id }, actor: { type: actor.type === 'USER' ? 'USER' : 'SYSTEM', id: actor.userId }, clientId: lead.clientId, dossierId: lead.dossierId, data: { channel: fact!.channel }, requestId: currentRequestId() }),
        now,
      );
    }
    if (closes) {
      // closed by the system: `closedById` stays empty — that is what tells it from a closure made by hand (CYC-008)
      await writeAudit(tx, actor, now, { action: 'lead.closed', entityType: 'Lead', entityId: lead.id, entityLabel: lead.reference, clientId: lead.clientId, before: { status: lead.status }, after: { status: 'CLOSED', outcome }, reason: 'first_contact' });
      await outbox.add(
        tx,
        domainEvent({ type: 'lead.closed', aggregate: { type: 'Lead', id: lead.id }, actor: { type: 'SYSTEM', id: null }, clientId: lead.clientId, dossierId: lead.dossierId, data: { outcome }, requestId: currentRequestId() }),
        now,
      );
    }
    result.leads.push({ id: lead.id, firstContactAt: next, closed: closes });
  }

  // The dossiers: those of the requests read, and every live dossier of the client the gesture was noted on.
  if (input.clientId) {
    const own = await tx.dossier.findMany({ where: { clientId: input.clientId, deletedAt: null }, select: { id: true } });
    for (const d of own) dossierIds.add(d.id);
  }
  if (dossierIds.size) {
    const dossiers = await tx.dossier.findMany({
      where: { id: { in: [...dossierIds] }, deletedAt: null },
      select: { id: true, clientId: true, createdAt: true, firstContactAt: true, leadsAsDossier: { select: { firstContactAt: true } } },
    });
    for (const d of dossiers) {
      const candidates: number[] = d.leadsAsDossier.map((l) => l.firstContactAt?.getTime()).filter((v): v is number => typeof v === 'number');
      // a fact noted on the client, without a named request, since the dossier exists (a dossier opened by hand, CYC-004)
      const direct = (await factsOf(d.clientId)).find((f) => f.leadId === null && f.at.getTime() >= d.createdAt.getTime());
      if (direct) candidates.push(direct.at.getTime());
      const next = candidates.length ? new Date(Math.min(...candidates)) : null;
      if (same(next, d.firstContactAt)) continue;
      await tx.dossier.update({ where: { id: d.id }, data: { firstContactAt: next, version: { increment: 1 }, updatedAt: now } });
      result.dossierIds.push(d.id);
    }
  }
  return result;
}
