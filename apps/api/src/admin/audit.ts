// SEC-080, SEC-081, CTL-161 — audit rows, written in the transaction of the action (FIA-001).
// Generic codes `{objet}.created|updated|deleted` (objet = Prisma model in snake_case) plus the named catalogue codes.
import { newId } from '../platform/ids.js';
import { currentRequestId } from '../platform/request-context.js';
import type { Tx } from '../platform/tx.js';
import type { Actor } from './actor.js';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string | null;
  /** SEC-081 — a reference or the name of a non-person object, never a person's name. */
  entityLabel?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** SEC-111 — kept without FK so the row survives erasure; the screen finds the name through it (SEC-081). */
  clientId?: string | null;
  /** Overrides the actor's reason (e.g. a cancellation motive). */
  reason?: string | null;
  /** The dossier the row belongs to, when it is not the dossier itself (a considered property, a reservation…): its timeline reads it (BO-050). */
  dossierId?: string | null;
}

/** Decimal / Date / bigint → JSON-safe values (the log stores plain JSON). */
export function auditValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object' && value !== null && 'toFixed' in value && typeof (value as { toFixed: unknown }).toFixed === 'function') {
    return (value as { toString(): string }).toString();
  }
  if (Array.isArray(value)) return value.map(auditValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, auditValue(v)]));
  }
  return value;
}

/** Before/after of the fields that changed only. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const x = JSON.stringify(auditValue(before[key]));
    const y = JSON.stringify(auditValue(after[key]));
    if (x !== y) {
      b[key] = auditValue(before[key]);
      a[key] = auditValue(after[key]);
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}

export async function writeAudit(tx: Tx, actor: Actor, at: Date, entry: AuditEntry): Promise<void> {
  const requestId = currentRequestId();
  await tx.auditLog.create({
    data: {
      id: newId(),
      actorType: actor.type,
      actorId: actor.userId,
      actorRole: actor.role,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityLabel: entry.entityLabel?.slice(0, 200) ?? null,
      clientId: entry.clientId ?? null,
      dossierId: entry.dossierId ?? null,
      before: (entry.before ? auditValue(entry.before) : undefined) as never,
      after: (entry.after ? auditValue(entry.after) : undefined) as never,
      reason: (entry.reason ?? actor.reason)?.slice(0, 500) ?? null,
      requestId: requestId === 'req_none' ? null : requestId,
      createdAt: at,
    },
  });
}
