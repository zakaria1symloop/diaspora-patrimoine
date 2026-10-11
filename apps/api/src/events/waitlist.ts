// CYC-185 — automatic promotion from the waiting list, inside the transaction that freed the seats, under the Café's row
// lock (MOD-410: `seatsTaken` never exceeds `capacity`). Reusable by the back office (staff cancellation, capacity raised).
import type { OutboxWriter } from '../platform/outbox.js';
import type { Tx } from '../platform/tx.js';
import { autoPromotionAllowed, pickPromotions } from './registration-rules.js';

/** MOD-410 — the row lock every registration change of a Café takes first. Returns false when the Café does not exist. */
export async function lockEvent(tx: Tx, where: { id: string } | { slug: string }): Promise<string | null> {
  const rows =
    'id' in where
      ? await tx.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM events WHERE id = $1::uuid AND deleted_at IS NULL FOR UPDATE`, where.id)
      : await tx.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM events WHERE slug = $1 AND deleted_at IS NULL FOR UPDATE`, where.slug);
  return rows[0]?.id ?? null;
}

/** Serves the waiting list of a locked Café; returns the promoted registration ids (each emits `registration.promoted`). */
export async function promoteWaitlist(tx: Tx, outbox: OutboxWriter, eventId: string, now: Date): Promise<string[]> {
  const e = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { status: true, startsAt: true, capacity: true, seatsTaken: true } });
  if (!autoPromotionAllowed(e, now)) return [];
  const free = e.capacity - e.seatsTaken;
  if (free <= 0) return [];
  const waiting = await tx.eventRegistration.findMany({
    where: { eventId, status: 'WAITLISTED' },
    orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
    select: { id: true, seats: true },
  });
  const ids = pickPromotions(waiting, free);
  let seats = 0;
  for (const id of ids) {
    const w = waiting.find((x) => x.id === id)!;
    seats += w.seats;
    await tx.eventRegistration.update({ where: { id }, data: { status: 'REGISTERED', promotedAt: now, version: { increment: 1 }, updatedAt: now } });
    await outbox.add(tx, { type: 'registration.promoted', aggregateType: 'EventRegistration', aggregateId: id, payload: { eventId, seats: w.seats } }, now);
  }
  if (seats) await tx.event.update({ where: { id: eventId }, data: { seatsTaken: { increment: seats }, waitlistSeats: { decrement: seats } } });
  return ids;
}
