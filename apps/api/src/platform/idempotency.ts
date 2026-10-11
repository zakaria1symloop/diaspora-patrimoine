// API-040, TRV-091, FIA-050 — idempotency of the creating routes of public and client forms. Reusable by any module
// (leads, Café registrations, client messages, uploads…):
//
//   const result = await idempotency.run(req, { route: 'public.leads' }, {
//     prepare: async () => …,                       // optional, outside any transaction (FIA-001: external calls)
//     execute: async (tx, prepared) => responseBody, // the action, inside ITS transaction
//   });
//   res.status(result.status); return result.body;
//
// Mechanism (API-040): the key row is inserted and committed ALONE before the work (that is what makes
// REQUEST_IN_PROGRESS visible); its completion (status, body, request hash) is written INSIDE the action's transaction,
// so a committed action always has its stored response; any error deletes the row (the key stays free). A row without
// response older than 30 s (API-060 maximum duration) can only come from an action that never committed: it is
// replaced, and the request is processed. Rows live 24 h. Times follow Clock (ARC-060).
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@dp/contracts';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { Clock } from './clock.js';
import { AppError } from './errors.js';
import { newId } from './ids.js';
import { PrismaService } from './prisma.service.js';
import { ClientIp } from './rate-limit.js';
import { canonicalJson, type Tx } from './tx.js';

export const IDEMPOTENCY_TTL_MS = 24 * 3600_000;
/** API-040 / API-060 — a row without response younger than this is a request in progress. */
export const IN_PROGRESS_MS = 30_000;
const KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface IdempotencyScope {
  /** Stable name of the route (`public.leads`): the same key on two routes never collides. */
  route: string;
  /** Account of the session, when there is one; otherwise the caller is the IP fingerprint (IP_HASH_KEY). */
  userId?: string | null;
  /** The key is required (public and client forms) or optional (back office, API-040). Default: required. */
  required?: boolean;
}

export interface IdempotentAction<P, T> {
  /** Work done before the transaction and outside it (rate limits, DNS lookup…). Not run on a replay. */
  prepare?: () => Promise<P>;
  /** The action, inside its own transaction (FIA-001). Returns the response body (2xx). */
  execute: (tx: Tx, prepared: P) => Promise<T>;
  /** Success status (default 201). */
  status?: number;
  /** Transaction timeout (default 30 s, API-060). */
  timeoutMs?: number;
}

export interface IdempotentResult<T> {
  status: number;
  body: T;
  /** True when the stored response of an earlier success is returned without doing anything. */
  replayed: boolean;
}

/** Outcome of the claim, exposed for the tests of the state machine. */
export type Claim = { kind: 'claimed'; id: string } | { kind: 'replay'; status: number; body: unknown };

export function requestHash(body: unknown): string {
  return createHash('sha256').update(canonicalJson(body ?? null)).digest('hex');
}

/** API-040 — a UUID (version 4 or 7) written in lower case; anything else is 400 BAD_REQUEST. */
export function parseIdempotencyKey(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === '') return null;
  if (!KEY_RE.test(raw)) throw new AppError(ErrorCode.BAD_REQUEST);
  return raw;
}

@Injectable()
export class IdempotencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly ip: ClientIp,
  ) {}

  /** `scope` column: the route and the caller (API-040: a key belongs to its caller). */
  scopeOf(req: Request, scope: IdempotencyScope): string {
    const caller = scope.userId ? `user:${scope.userId}` : `ip:${this.ip.fingerprint(req)}`;
    return `${scope.route}|${caller}`;
  }

  async run<P, T>(req: Request, scope: IdempotencyScope, action: IdempotentAction<P, T>): Promise<IdempotentResult<T>> {
    const status = action.status ?? 201;
    const key = parseIdempotencyKey(req.headers['idempotency-key']);
    if (!key) {
      if (scope.required !== false) throw new AppError(ErrorCode.BAD_REQUEST);
      const prepared = (await action.prepare?.()) as P;
      const body = await this.prisma.$transaction((tx) => action.execute(tx, prepared), { timeout: action.timeoutMs ?? 30_000 });
      return { status, body, replayed: false };
    }

    const hash = requestHash(req.body);
    const claim = await this.claim(key, this.scopeOf(req, scope), hash, scope.userId ?? null);
    if (claim.kind === 'replay') return { status: claim.status, body: claim.body as T, replayed: true };

    try {
      const prepared = (await action.prepare?.()) as P;
      const body = await this.prisma.$transaction(
        async (tx) => {
          const result = await action.execute(tx, prepared);
          await this.complete(tx, claim.id, hash, status, result);
          return result;
        },
        { timeout: action.timeoutMs ?? 30_000 },
      );
      return { status, body, replayed: false };
    } catch (err) {
      await this.release(claim.id);
      throw err;
    }
  }

  /**
   * Inserts the key row alone (committed at once), or decides from the existing row: replay, key reused with another
   * body (422), request in progress (409), or an abandoned/expired row that is replaced.
   */
  async claim(key: string, scope: string, hash: string, userId: string | null): Promise<Claim> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const now = this.clock.now();
      const id = newId();
      const inserted = await this.prisma.idempotencyKey.createMany({
        data: [{ id, key, scope, requestHash: hash, userId, expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS), createdAt: now, updatedAt: now }],
        skipDuplicates: true,
      });
      if (inserted.count === 1) return { kind: 'claimed', id };

      const existing = await this.prisma.idempotencyKey.findUnique({ where: { key_scope: { key, scope } } });
      if (!existing) continue; // deleted meanwhile: try again
      if (existing.expiresAt.getTime() <= now.getTime()) {
        // Older than 24 h: an unknown key again.
        await this.prisma.idempotencyKey.deleteMany({ where: { id: existing.id } });
        continue;
      }
      if (existing.responseStatus !== null) {
        if (existing.requestHash === hash) return { kind: 'replay', status: existing.responseStatus, body: existing.responseBody };
        throw new AppError(ErrorCode.IDEMPOTENCY_KEY_REUSED);
      }
      if (now.getTime() - existing.createdAt.getTime() < IN_PROGRESS_MS) throw new AppError(ErrorCode.REQUEST_IN_PROGRESS);
      // Abandoned (instance gone): replaced by a NEW row, so that the late original — if it ever finishes — finds its
      // row gone and rolls back instead of completing someone else's claim.
      await this.prisma.idempotencyKey.deleteMany({ where: { id: existing.id, responseStatus: null } });
    }
    throw new AppError(ErrorCode.REQUEST_IN_PROGRESS);
  }

  /** Writes the response inside the action's transaction; a lost claim aborts the transaction. */
  async complete(tx: Tx, id: string, hash: string, status: number, body: unknown): Promise<void> {
    const done = await tx.idempotencyKey.updateMany({
      where: { id, responseStatus: null },
      data: { responseStatus: status, responseBody: (body ?? null) as never, requestHash: hash, updatedAt: this.clock.now() },
    });
    if (done.count !== 1) throw new AppError(ErrorCode.REQUEST_IN_PROGRESS);
  }

  /** 4xx, 5xx or exception: the key stays free (API-040). */
  async release(id: string): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({ where: { id, responseStatus: null } }).catch(() => undefined);
  }
}
