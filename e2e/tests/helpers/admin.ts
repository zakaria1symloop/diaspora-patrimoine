// Shared steps of the back-office journeys (apps/admin, http://localhost:3001). The local stack has ONE Direction test
// account (`direction.test@example.test`, created by `pnpm ops owner:invite`): its password and its second-factor key
// are kept in the git-ignored `.local/e2e-admin.json`. When that file is missing or stale, the account is recovered by
// the operations command (ADM-040) and set up again through the real invitation page (BO-003) — no account is ever
// written into the database by a test.
import { execSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { freshIp, mailLink } from './account.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const STATE = join(ROOT, '.local', 'e2e-admin.json');
export const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://localhost:3001';
export const DIRECTION_EMAIL = 'direction.test@example.test';

export interface AdminState {
  email: string;
  password: string;
  secret: string;
  /** Last time step used for a code: a TOTP code is accepted once (SEC-011). */
  lastStep?: number;
}

type Accounts = Record<string, AdminState>;
function readAll(): Accounts {
  if (!existsSync(STATE)) return {};
  const raw = JSON.parse(readFileSync(STATE, 'utf8')) as Accounts | AdminState;
  // first format of this file: the Direction account alone
  return 'email' in raw && typeof raw.email === 'string' ? { [raw.email as string]: raw as AdminState } : (raw as Accounts);
}
export function readState(email: string = DIRECTION_EMAIL): AdminState | null {
  return readAll()[email] ?? null;
}
function writeState(state: AdminState): void {
  writeFileSync(STATE, JSON.stringify({ ...readAll(), [state.email]: state }, null, 2));
}

// ─── RFC 6238 (SHA-1, 6 digits, 30 s) ───────────────────────────────────────

function base32(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/[\s=]/g, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', base32(secret)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0xf;
  const value = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(value % 1_000_000).padStart(6, '0');
}

/** A code never used before by these tests: waits for the next 30-second step when the current one was spent. */
export async function freshCode(secret: string): Promise<string> {
  const state = Object.values(readAll()).find((a) => a.secret === secret) ?? null;
  let step = Math.floor(Date.now() / 30_000);
  if (state && state.secret === secret && state.lastStep !== undefined && step <= state.lastStep) {
    await new Promise((r) => setTimeout(r, (state.lastStep! + 1) * 30_000 - Date.now() + 300));
    step = Math.floor(Date.now() / 30_000);
  }
  if (state && state.secret === secret) writeState({ ...state, lastStep: step });
  return codeAt(secret, step);
}

// ─── The Direction account ──────────────────────────────────────────────────

/** BO-003: the three steps of the invitation page, for the account `email`. Leaves the page signed in. */
export async function completeInvitation(page: Page, email: string): Promise<AdminState> {
  const link = await mailLink(email, 'S_INVITATION', new RegExp(`${ADMIN.replace(/[.]/g, '\\.')}/invitation/[A-Za-z0-9_-]+`));
  const password = `Recette locale ${Date.now().toString(36)} maison`;
  await freshIp(page);
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Première connexion' })).toBeVisible({ timeout: 30_000 });

  // 1 — password
  await page.getByLabel('Nouveau mot de passe').fill(password);
  await page.getByRole('button', { name: 'Continuer' }).click();

  // 2 — second factor: the key shown for an application that cannot scan
  await expect(page.getByRole('heading', { name: 'Configurez la double authentification' })).toBeVisible();
  const secret = ((await page.locator('code').first().textContent()) ?? '').replace(/\s+/g, '');
  expect(secret.length).toBeGreaterThanOrEqual(16);
  const state: AdminState = { email, password, secret };
  writeState(state);
  await page.getByLabel('Code à 6 chiffres').fill(await freshCode(secret));
  await page.getByRole('button', { name: 'Vérifier le code' }).click();
  await expect(page.getByText('Voici vos dix codes de secours')).toBeVisible();
  await page.getByLabel('J’ai conservé mes codes.').check();
  await page.getByRole('button', { name: 'Activer la double authentification' }).click();

  // 3 — charter (asked only while it was never accepted: a recovered account already did)
  const charter = page.getByLabel('J’ai lu la charte et je l’accepte.');
  await expect(charter.or(page.getByRole('navigation', { name: 'Menu principal' }))).toBeVisible({ timeout: 30_000 });
  if (await charter.isVisible()) {
    await charter.check();
    await page.getByRole('button', { name: 'Continuer' }).click();
  }
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  return state;
}

/** ADM-040 then BO-003: recover the Direction account, then the invitation page. */
export async function setUpDirection(page: Page): Promise<AdminState> {
  const out = execSync(`pnpm ops owner:recover --email ${DIRECTION_EMAIL} --request E2E-LOCAL`, { cwd: ROOT, encoding: 'utf8' });
  if (!/rétabli/.test(out)) throw new Error('owner:recover did not answer as expected');
  return completeInvitation(page, DIRECTION_EMAIL);
}

/** EA-00 for an account these tests already know: true when the frame is reached. */
export async function signIn(page: Page, state: AdminState): Promise<boolean> {
  await freshIp(page); // the per-address limits of SEC-070 must not block a rerun
  await page.goto(`${ADMIN}/connexion`);
  await page.getByLabel('E-mail').fill(state.email);
  await page.getByLabel('Mot de passe').fill(state.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  const code = page.getByLabel('Code à 6 chiffres');
  const refused = page.getByText(/E-mail ou mot de passe incorrect|Ce compte est suspendu|Trop de tentatives|Trop de demandes/);
  await expect(code.or(refused).first()).toBeVisible({ timeout: 30_000 });
  if (!(await code.isVisible())) return false;
  await code.fill(await freshCode(state.secret));
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  return true;
}

/** EA-00: e-mail, password, code. Sets the account up first when these tests do not know it yet. */
export async function signInDirection(page: Page): Promise<AdminState> {
  const state = readState();
  if (state && (await signIn(page, state))) return state;
  return setUpDirection(page);
}

/** The anti-forgery token of the signed-in page, for a direct API call made by a test. */
export async function csrf(page: Page): Promise<string> {
  const cookies = await page.context().cookies(ADMIN);
  return cookies.find((c) => c.name === 'dp_admin_csrf')?.value ?? '';
}

/** A write to the API as the signed-in staff member (same origin as the pages: the `Origin` gives the audience). */
export async function adminPost(page: Page, request: APIRequestContext, path: string, data: unknown = {}, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST') {
  return page.request.fetch(`${ADMIN}/api/v1${path}`, { method, data, headers: { 'X-CSRF-Token': await csrf(page), Origin: ADMIN, 'content-type': 'application/json' } });
}
