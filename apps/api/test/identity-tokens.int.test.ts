// SEC-040, MOD-105 — single-use tokens against the database: only the fingerprint stored, lifetime per purpose, single
// use (two concurrent uses: one wins), a new token kills the previous ones of the same purpose, except activation links;
// AUTH-086 codes keyed by row. Every row is written inside a transaction rolled back at the end.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../src/config/env.js';
import { sha256Hex } from '../src/identity/crypto.js';
import { TokensService } from '../src/identity/tokens.service.js';
import { FixedClock } from '../src/platform/clock.js';
import { newId } from '../src/platform/ids.js';
import { PrismaService } from '../src/platform/prisma.service.js';
import type { Tx } from '../src/platform/tx.js';

const API = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(API, '.env'), quiet: true });
const url = process.env.DATABASE_URL;

async function reachable(): Promise<boolean> {
  if (!url) return false;
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await c.connect();
    await c.query('select 1 from auth_tokens limit 1');
    return true;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => undefined);
  }
}

const dbUp = await reachable();
class Rollback extends Error {}

describe.skipIf(!dbUp)('single-use tokens against the database', () => {
  let prisma: PrismaService;
  const t0 = new Date('2026-10-09T09:00:00Z');
  const clock = new FixedClock(t0);
  const env = { DATABASE_URL: url!, LINK_SIGNING_KEY: 'l'.repeat(40) } as Env;

  beforeAll(() => {
    prisma = new PrismaService(env);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Runs `fn` in a transaction that is always rolled back. */
  async function inRollback(fn: (tx: Tx, tokens: TokensService) => Promise<void>): Promise<void> {
    await prisma
      .$transaction(async (tx) => {
        const tokens = new TokensService(tx as unknown as PrismaService, clock, env);
        await fn(tx, tokens);
        throw new Rollback();
      })
      .catch((e: unknown) => {
        if (!(e instanceof Rollback)) throw e;
      });
  }

  async function user(tx: Tx): Promise<string> {
    const id = newId();
    await tx.user.create({ data: { id, kind: 'CLIENT', email: `tok-${id}@example.test`, status: 'ACTIVE', createdAt: t0, updatedAt: t0 } });
    return id;
  }

  it('stores the fingerprint only, expires after its lifetime, and serves once', async () => {
    clock.set(t0);
    await inRollback(async (tx, tokens) => {
      const uid = await user(tx);
      const { token } = await tokens.issue({ purpose: 'PASSWORD_RESET', userId: uid, email: 'x@example.test' }, tx);
      expect(await tx.authToken.count({ where: { tokenHash: token } })).toBe(0);
      expect(await tx.authToken.count({ where: { tokenHash: sha256Hex(token) } })).toBe(1);
      const row = (await tokens.find(token, 'PASSWORD_RESET', tx))!;
      expect(tokens.isAlive(row)).toBe(true);
      expect(await tokens.find(token, 'MAGIC_LOGIN', tx)).toBeNull(); // another purpose: unknown
      expect(await tokens.consume(row, tx)).toBe(true);
      expect(await tokens.consume(row, tx)).toBe(false); // single use
      expect(tokens.isAlive((await tokens.find(token, 'PASSWORD_RESET', tx))!)).toBe(false);

      const late = await tokens.issue({ purpose: 'PASSWORD_RESET', userId: uid, email: 'x@example.test' }, tx);
      clock.set(new Date(t0.getTime() + 3600_000 + 1)); // PASSWORD_RESET lives 1 hour
      const lateRow = (await tokens.find(late.token, 'PASSWORD_RESET', tx))!;
      expect(tokens.isAlive(lateRow)).toBe(false);
      expect(await tokens.consume(lateRow, tx)).toBe(false);
      clock.set(t0);
    });
  });

  it('MOD-105 — a new token kills the previous ones; activation links all stay valid until the first use', async () => {
    clock.set(t0);
    await inRollback(async (tx, tokens) => {
      const uid = await user(tx);
      const a = await tokens.issue({ purpose: 'MAGIC_LOGIN', userId: uid, email: 'x@example.test' }, tx);
      const b = await tokens.issue({ purpose: 'MAGIC_LOGIN', userId: uid, email: 'x@example.test' }, tx);
      expect(tokens.isAlive((await tokens.find(a.token, 'MAGIC_LOGIN', tx))!)).toBe(false);
      expect(tokens.isAlive((await tokens.find(b.token, 'MAGIC_LOGIN', tx))!)).toBe(true);

      const x = await tokens.issue({ purpose: 'ACCOUNT_ACTIVATION', userId: uid, email: 'x@example.test' }, tx);
      const y = await tokens.issue({ purpose: 'ACCOUNT_ACTIVATION', userId: uid, email: 'x@example.test' }, tx);
      expect(tokens.isAlive((await tokens.find(x.token, 'ACCOUNT_ACTIVATION', tx))!)).toBe(true);
      expect(tokens.isAlive((await tokens.find(y.token, 'ACCOUNT_ACTIVATION', tx))!)).toBe(true);
      await tokens.consume((await tokens.find(y.token, 'ACCOUNT_ACTIVATION', tx))!, tx);
      await tokens.killAll(uid, ['ACCOUNT_ACTIVATION'], tx);
      expect(tokens.isAlive((await tokens.find(x.token, 'ACCOUNT_ACTIVATION', tx))!)).toBe(false);
    });
  });

  it('AUTH-086 — a code is checked against its own row, and dies at the fifth wrong attempt', async () => {
    clock.set(t0);
    await inRollback(async (tx, tokens) => {
      const uid = await user(tx);
      const { code, id } = await tokens.issueCode({ purpose: 'ACTION_CODE', userId: uid, email: 'x@example.test', payload: { action: 'TWO_FACTOR' } }, tx);
      expect(code).toMatch(/^\d{6}$/);
      const row = (await tx.authToken.findUnique({ where: { id } }))!;
      expect(tokens.codeMatches(row, code)).toBe(true);
      expect(tokens.codeMatches(row, code === '000000' ? '111111' : '000000')).toBe(false);
      for (let i = 0; i < 5; i++) await tokens.addAttempt(id, tx);
      const dead = (await tx.authToken.findUnique({ where: { id } }))!;
      expect(tokens.isAlive({ ...dead, payload: {} })).toBe(false);
    });
  });
});
