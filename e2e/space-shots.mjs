// Visual review of the client space (signed-in pages) at 1440 and 390 px (DSN-080): signs up a fresh client through
// the real forms (verification link read from the local .eml), optionally reuses a saved session, then screenshots.
// Usage: node space-shots.mjs <outDir> [--state <file>] <path> [<path>…]
//   --state <file>: reuse the session saved there (created on first run). No credentials are printed.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const outDir = args.shift() ?? './shots';
let state = null;
const si = args.indexOf('--state');
if (si >= 0) {
  state = args[si + 1];
  args.splice(si, 2);
}
const paths = args.length ? args : ['/espace-client'];
const base = process.env.WEB_URL ?? 'http://localhost:3000';
const MAIL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.local', 'mail');
mkdirSync(outDir, { recursive: true });

async function mailLink(email, template, pattern) {
  for (let i = 0; i < 40; i++) {
    const files = readdirSync(MAIL_DIR).filter((f) => f.includes(`_${template}_`)).sort().reverse();
    for (const f of files) {
      const raw = readFileSync(join(MAIL_DIR, f), 'utf8');
      if (!raw.includes(`<${email}>`)) continue;
      const blocks = raw.match(/Content-Transfer-Encoding: base64\r?\n(?:[^\r\n]+\r?\n)*\r?\n[A-Za-z0-9+/=\r\n]+/g) ?? [];
      const text = blocks.map((b) => Buffer.from(b.split(/\r?\n\r?\n/)[1].replace(/\s+/g, ''), 'base64').toString('utf8')).join('\n');
      const m = text.match(pattern);
      if (m) return m[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No ${template} e-mail`);
}

const browser = await chromium.launch();
let context;
if (state && existsSync(state)) {
  context = await browser.newContext({ storageState: state, baseURL: base });
} else {
  context = await browser.newContext({ baseURL: base, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const n = () => Math.floor(Math.random() * 250) + 1;
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.51.${n()}.${n()}` });
  const page = await context.newPage();
  const email = `client-${Date.now().toString(36)}@example.test`;
  await page.goto('/inscription');
  await page.getByLabel('Prénom').fill('Karima');
  await page.getByLabel('Nom', { exact: true }).fill('Benali');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
  await page.getByPlaceholder(/6 12 34 56 78/).fill('612345678');
  await page.getByLabel('Mot de passe', { exact: true }).fill(`Une maison au bord de la mer ${Date.now()}`);
  await page.getByLabel(/J’accepte les/).check();
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await page.getByRole('heading', { name: 'Vérifiez votre boîte e-mail' }).waitFor();
  const verify = await mailLink(email, 'C_EMAIL_VERIFICATION', /http:\/\/localhost:3000\/verification\/[A-Za-z0-9_-]+/);
  await page.goto(verify.replace(base, ''));
  await page.waitForURL(/\/espace-client/);
  try {
    await page.evaluate(() => localStorage.setItem('dp_tour_space', '1'));
  } catch {
    /* ignore */
  }
  if (state) await context.storageState({ path: state });
  await page.close();
  console.log('signed up a fresh client');
}

for (const width of [1440, 390]) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  for (const path of paths) {
    const res = await page.goto(path, { waitUntil: 'load', timeout: 90_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(1800);
    const name = `${path.replace(/\W+/g, '-').replace(/^-|-$/g, '')}-${width}.png`;
    await page.screenshot({ path: join(outDir, name), fullPage: true });
    console.log(`${res?.status()} ${path} → ${name} (${page.url().replace(base, '')})`);
    if (state) await context.storageState({ path: state });
  }
  await page.close();
}
if (state) await context.storageState({ path: state });
await browser.close();
