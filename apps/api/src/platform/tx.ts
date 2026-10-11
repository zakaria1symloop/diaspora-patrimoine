// FIA-001 — one action = one transaction. The transaction client handed to use cases.
import type { Prisma } from '../generated/prisma/client.js';

export type Tx = Prisma.TransactionClient;

/** Deterministic JSON (sorted keys) — for hashes of request bodies (API-040). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** True for a PostgreSQL unique violation surfaced by Prisma (P2002) or the driver (23505). */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; meta?: { driverAdapterError?: { cause?: { originalCode?: string } } } };
  return e?.code === 'P2002' || e?.code === '23505' || e?.cause?.code === '23505' || e?.meta?.driverAdapterError?.cause?.originalCode === '23505';
}
