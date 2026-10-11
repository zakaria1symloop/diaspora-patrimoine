// MED-021, Q-096 — the antivirus stub: always on in local, allowed on a test server that declares VIRUS_SCAN_STUB=true,
// never in production (the environment refuses to start, and the scanner stays « unavailable »).
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import { scannerFor } from '../src/files/virus-scanner.js';

const base = {
  APP_ENV: 'staging',
  DATABASE_URL: 'postgresql://dp:x@localhost:5432/dp',
  WEB_URL: 'https://site.example',
  API_URL: 'http://127.0.0.1:4000',
  REVALIDATE_SECRET: 'r'.repeat(32),
  JWT_SIGNING_KEY: 'j'.repeat(32),
  IP_HASH_KEY: 'i'.repeat(32),
  LINK_SIGNING_KEY: 'l'.repeat(32),
  ENCRYPTION_KEY: 'e'.repeat(44),
  ENCRYPTION_KEY_ID: 'k1',
  SITE_GATE_PASSWORD: 'gate-password-123',
  MAIL_SANDBOX_RECIPIENT: 'sandbox@example.test',
};

describe('MED-021 / Q-096 — antivirus stub', () => {
  it('local always uses the stub', async () => {
    expect(await scannerFor('local', false).scan(Buffer.from('x'))).toBe('CLEAN');
  });
  it('staging without the switch keeps files pending (ERROR)', async () => {
    expect(await scannerFor('staging', false).scan(Buffer.from('x'))).toBe('ERROR');
  });
  it('staging with VIRUS_SCAN_STUB=true considers files clean', async () => {
    expect(await scannerFor('staging', true).scan(Buffer.from('x'))).toBe('CLEAN');
  });
  it('production never uses the stub, even with the switch', async () => {
    expect(await scannerFor('production', true).scan(Buffer.from('x'))).toBe('ERROR');
  });
  it('the environment accepts the switch in staging', () => {
    expect(loadEnv({ ...base, VIRUS_SCAN_STUB: 'true' }).VIRUS_SCAN_STUB).toBe(true);
  });
});
