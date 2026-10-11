import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { FixedClock } from '../src/platform/clock.js';
import { AppError } from '../src/platform/errors.js';
import { IdempotencyService, IN_PROGRESS_MS, parseIdempotencyKey, requestHash } from '../src/platform/idempotency.js';
import type { PrismaService } from '../src/platform/prisma.service.js';
import type { ClientIp } from '../src/platform/rate-limit.js';

interface Row {
  id: string;
  key: string;
  scope: string;
  requestHash: string;
  responseStatus: number | null;
  responseBody: unknown;
  userId: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** In-memory stand-in for the `IdempotencyKey` table, with the unique (key, scope) and a transaction that rolls back. */
function fakePrisma() {
  let rows: Row[] = [];
  const table = {
    createMany: async ({ data }: { data: Row[] }) => {
      let count = 0;
      for (const r of data) {
        if (rows.some((x) => x.key === r.key && x.scope === r.scope)) continue;
        rows.push({ ...r, responseStatus: r.responseStatus ?? null, responseBody: r.responseBody ?? null });
        count++;
      }
      return { count };
    },
    findUnique: async ({ where }: { where: { key_scope: { key: string; scope: string } } }) =>
      rows.find((r) => r.key === where.key_scope.key && r.scope === where.key_scope.scope) ?? null,
    deleteMany: async ({ where }: { where: { id: string; responseStatus?: null } }) => {
      const before = rows.length;
      rows = rows.filter((r) => !(r.id === where.id && (where.responseStatus === undefined || r.responseStatus === null)));
      return { count: before - rows.length };
    },
    updateMany: async ({ where, data }: { where: { id: string; responseStatus: null }; data: Partial<Row> }) => {
      const r = rows.find((x) => x.id === where.id && x.responseStatus === null);
      if (!r) return { count: 0 };
      Object.assign(r, data);
      return { count: 1 };
    },
  };
  const prisma = {
    idempotencyKey: table,
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => {
      const snapshot = rows.map((r) => ({ ...r }));
      try {
        return await fn({ idempotencyKey: table });
      } catch (e) {
        rows = snapshot; // rollback
        throw e;
      }
    },
  };
  return { prisma: prisma as unknown as PrismaService, rows: () => rows };
}

const ip = { fingerprint: () => 'f'.repeat(64) } as unknown as ClientIp;
const KEY = '01a12009-15dc-767d-8d0c-76360df7765c';
const req = (body: unknown, key: string | undefined = KEY) => ({ headers: key ? { 'idempotency-key': key } : {}, body }) as unknown as Request;
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'OK';
  } catch (e) {
    return e instanceof AppError ? e.code : 'THROWN';
  }
};

function setup() {
  const db = fakePrisma();
  const clock = new FixedClock(new Date('2026-10-14T10:00:00Z'));
  const svc = new IdempotencyService(db.prisma, clock, ip);
  return { ...db, clock, svc };
}

describe('idempotency', () => {
  it('API-040 the key is a lower-case UUID v4 or v7; anything else is 400', () => {
    expect(parseIdempotencyKey(KEY)).toBe(KEY);
    expect(parseIdempotencyKey('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479');
    expect(() => parseIdempotencyKey(KEY.toUpperCase())).toThrow(AppError);
    expect(() => parseIdempotencyKey('123')).toThrow(AppError);
    expect(parseIdempotencyKey(undefined)).toBeNull();
  });

  it('API-040 a route that requires the key answers 400 without it', async () => {
    const { svc } = setup();
    expect(await code(svc.run(req({ a: 1 }, ''), { route: 'r' }, { execute: async () => ({}) }))).toBe('BAD_REQUEST');
  });

  it('API-040 unknown key: processed once, the response is stored with the body hash, in the same transaction', async () => {
    const { svc, rows } = setup();
    let runs = 0;
    const result = await svc.run(req({ a: 1 }), { route: 'r' }, { execute: async () => ({ n: ++runs }) });
    expect(result).toEqual({ status: 201, body: { n: 1 }, replayed: false });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ responseStatus: 201, responseBody: { n: 1 }, requestHash: requestHash({ a: 1 }) });
  });

  it('API-040 same key, same body after a success: the same response, nothing done again', async () => {
    const { svc } = setup();
    let runs = 0;
    const action = { execute: async () => ({ n: ++runs }) };
    await svc.run(req({ a: 1, b: [1, 2] }), { route: 'r' }, action);
    const again = await svc.run(req({ b: [1, 2], a: 1 }), { route: 'r' }, action); // key order does not matter
    expect(again).toEqual({ status: 201, body: { n: 1 }, replayed: true });
    expect(runs).toBe(1);
  });

  it('API-040 same key, different body after a success: 422 IDEMPOTENCY_KEY_REUSED', async () => {
    const { svc } = setup();
    await svc.run(req({ a: 1 }), { route: 'r' }, { execute: async () => ({}) });
    expect(await code(svc.run(req({ a: 2 }), { route: 'r' }, { execute: async () => ({}) }))).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('API-040 a key belongs to its caller: another caller with the same key is a new request', async () => {
    const { svc } = setup();
    await svc.run(req({ a: 1 }), { route: 'r' }, { execute: async () => ({ who: 'ip' }) });
    const other = await svc.run(req({ a: 1 }), { route: 'r', userId: 'u1' }, { execute: async () => ({ who: 'user' }) });
    expect(other).toMatchObject({ body: { who: 'user' }, replayed: false });
  });

  it('API-040 first request still in progress (row without response under 30 s): 409 REQUEST_IN_PROGRESS', async () => {
    const { svc } = setup();
    let release!: () => void;
    const slow = svc.run(req({ a: 1 }), { route: 'r' }, { execute: () => new Promise((r) => (release = () => r({ ok: 1 }))) });
    await new Promise((r) => setTimeout(r, 0));
    expect(await code(svc.run(req({ a: 1 }), { route: 'r' }, { execute: async () => ({}) }))).toBe('REQUEST_IN_PROGRESS');
    release();
    await slow;
  });

  it('API-040 a row without response older than 30 s is abandoned: replaced, and the late original rolls back', async () => {
    const { svc, clock, rows, prisma } = setup();
    const claim = await svc.claim(KEY, 'r|ip:x', requestHash({ a: 1 }), null);
    expect(claim.kind).toBe('claimed');
    clock.set(new Date(clock.now().getTime() + IN_PROGRESS_MS + 1));
    const second = await svc.claim(KEY, 'r|ip:x', requestHash({ a: 1 }), null);
    expect(second.kind).toBe('claimed');
    expect(rows()).toHaveLength(1);
    // The original instance wakes up: its completion finds its row gone → REQUEST_IN_PROGRESS, its transaction rolls back.
    expect(await code(svc.complete({ idempotencyKey: prisma.idempotencyKey } as never, (claim as { id: string }).id, 'h', 201, {}))).toBe('REQUEST_IN_PROGRESS');
  });

  it('API-040 an error (4xx, 5xx, exception) deletes the row: the key stays free and a corrected request is processed', async () => {
    const { svc, rows } = setup();
    const failing = { execute: async () => Promise.reject(AppError.validation([{ field: 'x', code: 'REQUIRED' }])) };
    expect(await code(svc.run(req({ a: 1 }), { route: 'r' }, failing))).toBe('VALIDATION_ERROR');
    expect(rows()).toHaveLength(0);
    const ok = await svc.run(req({ a: 2 }), { route: 'r' }, { execute: async () => ({ fixed: true }) });
    expect(ok).toMatchObject({ body: { fixed: true }, replayed: false });
  });

  it('API-040 the preparation (before the transaction) failing also frees the key, and is not run on a replay', async () => {
    const { svc, rows } = setup();
    let prepared = 0;
    expect(await code(svc.run(req({ a: 1 }), { route: 'r' }, { prepare: async () => Promise.reject(new AppError('RATE_LIMITED')), execute: async () => ({}) }))).toBe('RATE_LIMITED');
    expect(rows()).toHaveLength(0);
    const action = { prepare: async () => ++prepared, execute: async (_tx: unknown, p: number) => ({ p }) };
    await svc.run(req({ a: 1 }), { route: 'r' }, action);
    const replay = await svc.run(req({ a: 1 }), { route: 'r' }, action);
    expect(replay).toMatchObject({ body: { p: 1 }, replayed: true });
    expect(prepared).toBe(1);
  });

  it('API-040 responses are kept 24 hours: after that the key is unknown again', async () => {
    const { svc, clock } = setup();
    let runs = 0;
    const action = { execute: async () => ({ n: ++runs }) };
    await svc.run(req({ a: 1 }), { route: 'r' }, action);
    clock.set(new Date(clock.now().getTime() + 24 * 3_600_000));
    expect(await svc.run(req({ a: 1 }), { route: 'r' }, action)).toMatchObject({ body: { n: 2 }, replayed: false });
  });
});
