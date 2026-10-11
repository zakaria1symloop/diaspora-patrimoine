// Local PostgreSQL 16 for development, without Docker (embedded binaries in node_modules).
// Usage: node scripts/db.mjs init | start
// Data lives in <repo>/.local/pg (git-ignored). Credentials come from .env (DATABASE_URL).
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, '../.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://dp:dp-local@localhost:5433/diaspora');
const dataDir = resolve(here, '../../../.local/pg');
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port || 5432),
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

const cmd = process.argv[2];
if (cmd === 'init') {
  if (existsSync(resolve(dataDir, 'PG_VERSION'))) {
    console.log('Database cluster already initialised.');
  } else {
    await pg.initialise();
  }
  await pg.start();
  const db = url.pathname.slice(1);
  try {
    await pg.createDatabase(db);
    console.log(`Database ${db} created.`);
  } catch {
    console.log(`Database ${db} already exists.`);
  }
  await pg.stop();
} else if (cmd === 'start') {
  await pg.start();
  console.log(`PostgreSQL 16 listening on port ${url.port}. Ctrl+C to stop.`);
  const stop = async () => { await pg.stop(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30);
} else {
  console.error('Usage: node scripts/db.mjs init | start');
  process.exit(1);
}
