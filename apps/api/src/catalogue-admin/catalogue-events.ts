// AUT-010, FIA-040 — the domain events of the catalogue, written in the transaction of the action (no commit, no
// event). The write services build them here rather than through `OutboxWriter` so that their constructors stay as
// the demo command builds them (`install/admin-services.ts`).
import { domainEvent } from '../automation/event-catalogue.js';
import { newId } from '../platform/ids.js';
import type { Tx } from '../platform/tx.js';
import type { Actor } from '../admin/actor.js';

export async function emitCatalogueEvent(
  tx: Tx,
  now: Date,
  actor: Actor,
  type: string,
  aggregate: { type: string; id: string },
  data: Record<string, unknown> = {},
  dedupeKey?: string,
): Promise<void> {
  const ev = domainEvent({ type, aggregate, actor: { type: actor.type === 'USER' ? 'USER' : 'SYSTEM', id: actor.userId }, data, dedupeKey });
  await tx.outboxEvent.create({
    data: {
      id: newId(),
      type: ev.type,
      aggregateType: ev.aggregateType,
      aggregateId: ev.aggregateId,
      payload: ev.payload as never,
      dedupeKey: ev.dedupeKey ?? null,
      occurredAt: now,
      availableAt: now,
      createdAt: now,
      updatedAt: now,
    },
  });
}
