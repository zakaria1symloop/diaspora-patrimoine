// API-040, TRV-091 — the creating forms of the back office send an `Idempotency-Key` (optional on `/admin`): the same key
// with the same body replays the first answer instead of creating twice. The catalogue write services open their own
// transaction (they are also called by the demo command), so the answer is stored right after their commit rather than
// inside it; if the process stops between the two, the key row is replaced after 30 s (API-040) — the worst case is the
// duplicate the key was meant to prevent, on a crash only (deviation noted in the report of packages 3.4–3.6).
import type { Request } from 'express';
import { IdempotencyService, parseIdempotencyKey, requestHash } from '../platform/idempotency.js';
import type { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';

export async function idempotentCreate<T>(idempotency: IdempotencyService, prisma: PrismaService, req: Request, route: string, userId: string | null, run: () => Promise<T>): Promise<T> {
  const key = parseIdempotencyKey(req.headers['idempotency-key']);
  if (!key) return run();
  const hash = requestHash(req.body);
  const claim = await idempotency.claim(key, idempotency.scopeOf(req, { route, userId }), hash, userId);
  if (claim.kind === 'replay') return claim.body as T;
  try {
    const result = await run();
    await idempotency.complete(prisma as unknown as Tx, claim.id, hash, 201, JSON.parse(JSON.stringify(result)));
    return result;
  } catch (err) {
    await idempotency.release(claim.id);
    throw err;
  }
}
