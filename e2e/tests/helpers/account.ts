// Shared steps for journeys that need a signed-in client: sign-up through the real form, verification link read from
// the .eml written locally (MAIL_PROVIDER=log, `<repo>/.local/mail`). Accounts use @example.test addresses.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

const MAIL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.local', 'mail');
export const ORIGIN = 'http://localhost:3000';
export const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A random documentation address per test, so that the per-IP limits of SEC-070 never block a rerun. */
export async function freshIp(page: Page): Promise<void> {
  const n = () => Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.51.${n()}.${n()}` });
}

/** The first match of `pattern` in the latest e-mail of `template` sent to `email`, waited for up to 15 s. */
export async function mailLink(email: string, template: string, pattern: RegExp): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const files = readdirSync(MAIL_DIR)
      .filter((f) => f.includes(`_${template}_`))
      .sort()
      .reverse();
    for (const f of files) {
      const raw = readFileSync(join(MAIL_DIR, f), 'utf8');
      if (!raw.includes(`<${email}>`)) continue;
      const blocks = raw.match(/Content-Transfer-Encoding: base64\r?\n(?:[^\r\n]+\r?\n)*\r?\n[A-Za-z0-9+/=\r\n]+/g) ?? [];
      const text = blocks.map((b) => Buffer.from(b.split(/\r?\n\r?\n/)[1]!.replace(/\s+/g, ''), 'base64').toString('utf8')).join('\n');
      const m = text.match(pattern);
      if (m) return m[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No ${template} e-mail for ${email}`);
}

/** EC-02 then EC-03: a new client, verified and signed in, on /espace-client. */
export async function signUpClient(page: Page, firstName = 'Karima'): Promise<{ email: string; password: string }> {
  // The shared local API restarts when someone rebuilds it: a sign-up caught in a restart is started again with a
  // new address (the half-done one is harmless: an unverified account).
  for (let attempt = 1; ; attempt++) {
    try {
      return await signUpOnce(page, firstName);
    } catch (err) {
      if (attempt >= 6) throw err;
      await apiUp();
    }
  }
}

/** Waits (two minutes at most) until the local API answers its health check. */
export async function apiUp(): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    const ok = await fetch('http://localhost:4000/api/v1/public/health').then((r) => r.ok, () => false);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

async function signUpOnce(page: Page, firstName: string): Promise<{ email: string; password: string }> {
  const email = `client-${unique()}@example.test`;
  const password = 'Une maison au bord de la mer 2026';
  await page.goto('/inscription');
  // the dev server hydrates late when it is compiling: a click before that would do nothing
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.getByLabel('Prénom').fill(firstName);
  await page.getByLabel('Nom', { exact: true }).fill('Testeuse');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
  await page.getByPlaceholder(/6 12 34 56 78/).fill('612345678');
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByLabel(/J’accepte les/).check();
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  // the local stack may be busy (dev compilation, password hashing): give the confirmation time to appear
  await expect(page.getByRole('heading', { name: 'Vérifiez votre boîte e-mail' })).toBeVisible({ timeout: 30_000 });
  const verify = await mailLink(email, 'C_EMAIL_VERIFICATION', /http:\/\/localhost:3000\/verification\/[A-Za-z0-9_-]+/);
  await page.goto(verify.replace(ORIGIN, ''));
  // the dev server compiles the verification and space pages on their first visit
  await expect(page).toHaveURL(/\/espace-client$/, { timeout: 30_000 });
  // let the page finish its own session calls (renewal) before the test navigates: a navigation that cuts a renewal
  // in flight can leave the browser with a refresh token already rotated (seen on a phone through the network address)
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  return { email, password };
}
