// FIA-030, TRV-051 — readable references from the `Sequence` table: the counter row is locked and incremented in the
// creating transaction (one atomic upsert); a number is never reused, a failed transaction may leave a gap.
import type { Tx } from '../platform/tx.js';

export async function nextSequenceValue(tx: Tx, name: string, scope: string, now: Date): Promise<number> {
  const rows = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO sequences (name, scope, last_value, created_at, updated_at)
    VALUES (${name}, ${scope}, 1, ${now}, ${now})
    ON CONFLICT (name, scope) DO UPDATE SET last_value = sequences.last_value + 1, updated_at = ${now}
    RETURNING last_value`;
  return Number(rows[0]!.last_value);
}

/**
 * Moves a counter forward so that the next value is at least `nextAtLeast` (never backwards: a gap, never a reuse).
 * Used by the demonstration data only, to give the reference properties the numbers of `Design/donnees-de-reference.md`.
 */
export async function advanceSequence(tx: Tx, name: string, scope: string, nextAtLeast: number, now: Date): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO sequences (name, scope, last_value, created_at, updated_at)
    VALUES (${name}, ${scope}, ${nextAtLeast - 1}, ${now}, ${now})
    ON CONFLICT (name, scope) DO UPDATE SET last_value = GREATEST(sequences.last_value, ${nextAtLeast - 1}), updated_at = ${now}`;
}

/** TRV-051 — `DP-{pays}-{numéro sur 4 chiffres ou plus}`. */
export function propertyReference(countryCode: string, n: number): string {
  return `DP-${countryCode}-${String(n).padStart(4, '0')}`;
}
