// Data access (ARC-011 « Dépôt ») — Prisma 7 with the pg driver adapter.
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { ENV, type Env } from '../config/env.js';

/**
 * One-dimensional PostgreSQL array literal → strings (`{a,"b c",NULL}`). The pg driver only knows the built-in array
 * types: arrays of extension or enum types (`citext[]` — `Client.alternateEmails`, `Communication.ccAddresses` — and
 * enum arrays) reach the adapter as raw literals, which Prisma's data mapper cannot read.
 */
export function parsePgArray(literal: string): (string | null)[] {
  const inner = literal.slice(1, -1);
  const out: (string | null)[] = [];
  if (inner === '') return out;
  let i = 0;
  while (i <= inner.length) {
    if (inner[i] === '"') {
      let value = '';
      i++;
      while (i < inner.length && inner[i] !== '"') {
        if (inner[i] === '\\') i++;
        value += inner[i++];
      }
      out.push(value);
      i += 2; // closing quote and comma
    } else {
      const end = inner.indexOf(',', i);
      const raw = inner.slice(i, end === -1 ? inner.length : end);
      out.push(raw === 'NULL' ? null : raw);
      i = end === -1 ? inner.length + 1 : end + 1;
    }
  }
  return out;
}

/**
 * The adapter with the parser of user-defined array types (enum labels and e-mail addresses never start with `{`).
 * ARC-070 — the session time zone is pinned to UTC: the adapter writes instants as UTC wall-clock text, which
 * PostgreSQL would otherwise read in the server's zone (a one-hour shift on a server set to UTC+1).
 */
export function createPgAdapter(connectionString: string): PrismaPg {
  return new PrismaPg(
    { connectionString, options: '-c TimeZone=UTC' },
    {
      userDefinedTypeParser: async (_oid, value) =>
        typeof value === 'string' && value.startsWith('{') && value.endsWith('}') ? parsePgArray(value) : value,
    },
  );
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({ adapter: createPgAdapter(env.DATABASE_URL) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
