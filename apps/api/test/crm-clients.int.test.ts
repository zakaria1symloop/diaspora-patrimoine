// Package 3.3 against the database — CRM-080 rule 3 « tout ce qui est rattaché, présent ou à venir »: the merge moves
// every column that references `clients.id`, read from the schema itself; a table where that column takes part in a
// unique key (two rows of the same client would collide) must be handled before the generic move (SPECIAL_TABLES).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientForeignKeys, REFUSAL_GUARDED_TABLES, SPECIAL_TABLES } from '../src/clients-merge-admin/clients-merge.service.js';
import type { Env } from '../src/config/env.js';
import { PrismaService } from '../src/platform/prisma.service.js';

const API = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(API, '.env'), quiet: true });
const url = process.env.DATABASE_URL;

async function reachable(): Promise<boolean> {
  if (!url) return false;
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await c.connect();
    await c.query('select 1 from clients limit 1');
    return true;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => undefined);
  }
}

const dbUp = await reachable();

describe.skipIf(!dbUp)('CRM-080 — the merge covers every reference to a client', () => {
  let prisma: PrismaService;
  beforeAll(() => {
    prisma = new PrismaService({ DATABASE_URL: url! } as unknown as Env);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rule 3 — the references are read from the schema: requests, dossiers, simulations, consents… are all there', async () => {
    const fks = await clientForeignKeys(prisma);
    const tables = new Set(fks.map((f) => f.table));
    for (const t of ['leads', 'dossiers', 'simulations', 'consents', 'communications', 'favorites', 'search_alerts', 'tasks']) expect(tables.has(t), t).toBe(true);
  });

  it('a table whose client column takes part in a unique key is handled before the generic move', async () => {
    const fks = await clientForeignKeys(prisma);
    const uniques = await prisma.$queryRaw<{ table: string; column: string }[]>`
      SELECT t.relname AS "table", a.attname AS "column"
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
      WHERE i.indisunique AND NOT i.indisprimary`;
    const unique = new Set(uniques.map((u) => `${u.table}.${u.column}`));
    const colliding = fks.filter((f) => unique.has(`${f.table}.${f.column}`)).map((f) => f.table);
    // the two open dossiers on one property are refused before anything moves (SAME_PROPERTY)
    for (const table of colliding) expect(SPECIAL_TABLES.has(table) || table in REFUSAL_GUARDED_TABLES, `${table} has a unique key on its client column`).toBe(true);
  });
});
