// Visual review of the WHOLE client space (DSN-080, D-095), filled and empty, at 1440, 1920 and 390 px.
// Extends space-shots.mjs: it creates (once per state file) a client with real data in every page, through the real
// flows and the real API — sign-up by the form, favourites, an interest and a callback request, a message to the
// advisor, an alert, a paused alert and a saved search, an eligibility and a credit simulation, the demonstration
// dossier with its pieces (`demo -- --dossier-pour=`) and one deposit — and a second client left empty.
//
// Usage: node space-full-shots.mjs <outDir> [--only <text>] [--widths 1440,390] [--fresh] [--no-empty] [--no-filled]
//   Sessions are kept in <repo>/.local/space-shots/{filled,empty}.json (ignored by git) and reused; --fresh recreates
//   them. No credential is printed. Screens: <outDir>/{filled|empty}/<page>-<width>.png, full page.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MAIL_DIR = join(ROOT, '.local', 'mail');
const STATE_DIR = join(ROOT, '.local', 'space-shots');
const API_DIR = join(ROOT, 'apps', 'api');
const base = process.env.WEB_URL ?? 'http://localhost:3000';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const option = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const only = option('--only');
const widths = (option('--widths') ?? '1440,1920,390').split(',').map(Number);
const fresh = flag('--fresh');
const noEmpty = flag('--no-empty');
const noFilled = flag('--no-filled');
const outDir = args.shift() ?? './shots/client-space-pass/latest';
mkdirSync(STATE_DIR, { recursive: true });

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

/** Calls the API as the signed-in browser (same cookies, anti-forgery header on writes — SEC-027). */
async function api(page, method, path, body, extra = {}) {
  const send = async () => {
    const cookies = await page.context().cookies();
    const csrf = decodeURIComponent(cookies.find((c) => c.name.endsWith('dp_web_csrf'))?.value ?? '');
    return page.request.fetch(`/api/v1${path}`, { method, data: body, headers: { 'X-CSRF-Token': csrf, ...extra } });
  };
  let res = await send();
  // The local API restarts when its code is rebuilt: wait for it rather than fail.
  for (let i = 0; i < 8 && res.status() >= 500; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    res = await send();
  }
  if (res.status() === 401) {
    // The access token lives 15 minutes: let the site renew the session in the browser (AUTH-023); if the session
    // itself is gone (rotated elsewhere, revoked), sign in again with the account kept in .local (never printed).
    await page.goto('/espace-client', { waitUntil: 'load' });
    await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    res = await send();
    if (res.status() === 401 && currentCredentials) {
      await page.goto('/connexion');
      await page.getByRole('textbox', { name: 'E-mail' }).fill(currentCredentials.email);
      await page.getByLabel('Mot de passe', { exact: true }).fill(currentCredentials.password);
      await page.getByRole('button', { name: 'Se connecter' }).last().click();
      await page.waitForURL(/\/espace-client/, { timeout: 60_000 });
      await page.evaluate(() => localStorage.setItem('dp_tour_space', '1')).catch(() => undefined); // the first-visit tour is not what is shot
      res = await send();
    }
    if (currentState) await page.context().storageState({ path: currentState });
  }
  return res;
}
let currentState = null;
let currentCredentials = null;
const idem = () => ({ 'Idempotency-Key': randomUUID() });
const must = async (res, what) => {
  if (!res.ok()) throw new Error(`${what}: ${res.status()} ${(await res.text()).slice(0, 300)}`);
  return res.status() === 204 ? null : res.json();
};

function tinyPdf(text = 'Document') {
  const objs = [
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R/Resources<<>>>>endobj',
    `4 0 obj<</Length ${text.length + 20}>>stream\nBT /F1 12 Tf (${text}) Tj ET\nendstream endobj`,
  ];
  return Buffer.from(`%PDF-1.4\n${objs.join('\n')}\ntrailer<</Root 1 0 R>>\n%%EOF\n`, 'latin1');
}

async function newContext(browser, statePath) {
  const context = await browser.newContext({ baseURL: base, locale: 'fr-FR', timezoneId: 'Europe/Paris', ...(statePath ? { storageState: statePath } : {}) });
  const n = () => Math.floor(Math.random() * 250) + 1;
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.51.${n()}.${n()}` });
  return context;
}

/** EC-02, EC-03 — a new client through the real form; returns its address (never printed). */
async function signUp(context, firstName, lastName) {
  const page = await context.newPage();
  const email = `client-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}@example.test`;
  await page.goto('/inscription');
  await page.getByLabel('Prénom').fill(firstName);
  await page.getByLabel('Nom', { exact: true }).fill(lastName);
  await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
  await page.getByPlaceholder(/6 12 34 56 78/).fill('612345678');
  const password = `Une maison au bord de la mer ${Date.now()}`;
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByLabel(/J’accepte les/).check();
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await page.getByRole('heading', { name: 'Vérifiez votre boîte e-mail' }).waitFor();
  const verify = await mailLink(email, 'C_EMAIL_VERIFICATION', /http:\/\/localhost:3000\/verification\/[A-Za-z0-9_-]+/);
  await page.goto(verify.replace(base, ''));
  await page.waitForURL(/\/espace-client/, { timeout: 60_000 });
  await page.evaluate(() => localStorage.setItem('dp_tour_space', '1')).catch(() => undefined);
  return { page, email, password };
}

/** Real data in every page of the space, through the real routes. */
async function fill(page, email) {
  const catalogue = await must(await page.request.get('/api/v1/public/properties?page=1'), 'catalogue');
  const cards = catalogue.data;
  if (cards.length < 4) throw new Error('The demonstration catalogue is missing: pnpm --filter @dp/api demo');
  const others = cards.filter((c) => c.reference !== 'DP-DZ-0142');

  // PRO-002 — a profile partly filled (two sections), so that the completion bar has something to say.
  const profile = await must(await api(page, 'GET', '/client/me/profile'), 'profile');
  const p2 = await must(
    await api(page, 'PATCH', '/client/me', { section: 'situation', version: profile.version, values: { residencyStatus: 'NON_RESIDENT', employmentType: 'PERMANENT', profession: 'Infirmière', employerName: null, employedSince: null } }),
    'profile situation',
  ).catch(() => null);
  void p2;

  // EC-41 — four favourites.
  for (const c of cards.slice(0, 4)) await must(await api(page, 'PUT', `/client/favorites/${c.reference}`), 'favourite');

  // DEM-011 — an interest for a property, sent signed in: it opens a dossier with its first property (CYC-002).
  const token = (await must(await page.request.post('/api/v1/public/form-token', { data: { form: 'PROPERTY_INTEREST' } }), 'form token')).token;
  const callbackToken = (await must(await page.request.post('/api/v1/public/form-token', { data: { form: 'CALLBACK_REQUEST' } }), 'form token')).token;
  await page.waitForTimeout(4000); // DEM-030: a form sent in under 3 s is suspect
  const target = others[0];
  const person = { firstName: 'Karima', lastName: 'Benali', email, phone: '+33612345678', whatsappOptIn: false };
  await must(
    await page.request.post('/api/v1/public/leads', {
      headers: { ...idem(), 'X-Form-Token': token },
      data: {
        form: 'PROPERTY_INTEREST',
        fields: { ...person, countryOfResidence: 'FR', message: 'Ce bien m’intéresse, pouvez-vous me rappeler en fin de journée ?', consentContact: true },
        context: { propertyReference: target.reference, propertyTitle: target.title, priceShown: target.priceFromRef?.amount, currencyShown: target.priceFromRef?.currency },
        tracking: { locale: 'fr', submittedFromPath: `/biens/${target.slug}` },
      },
    }),
    'interest',
  );
  // DEM-014 — « Être rappelé ».
  await page.request
    .post('/api/v1/public/leads', {
      headers: { ...idem(), 'X-Form-Token': callbackToken },
      data: { form: 'CALLBACK_REQUEST', fields: { ...person, subject: 'FINANCING', preferredSlot: 'EVENING', consentContact: true }, context: {}, tracking: { locale: 'fr', submittedFromPath: '/financements' } },
    })
    .then(async (r) => {
      if (!r.ok()) console.log(`callback request: ${r.status()} ${(await r.text()).slice(0, 200)}`);
    });

  // EC-40 — an eligibility simulation and a credit simulation, saved.
  const elig = await must(
    await api(
      page,
      'POST',
      '/public/simulations/eligibility',
      { propertyCountry: 'DZ', residencyStatus: 'NON_RESIDENT', countryOfResidence: 'FR', birthYear: 1984, monthlyIncome: '3400', incomeCurrency: 'EUR', monthlyDebts: '150', downPayment: '30000', financingPreference: 'NO_PREFERENCE' },
      idem(),
    ),
    'eligibility',
  );
  await must(await api(page, 'POST', `/public/simulations/${elig.id}/save`, {}), 'save simulation');
  await must(await api(page, 'PATCH', `/client/simulations/${elig.id}`, { label: 'Mon projet à Alger' }), 'rename simulation');
  await must(
    await api(page, 'POST', '/public/simulations', { isSaved: true, activeIndex: 0, scenarios: [{ mode: 'FROM_AMOUNT', amount: '120000', currency: 'EUR', durationMonths: 240, annualRateBps: 650, pricingMethod: 'AMORTIZED_RATE' }] }, idem()),
    'credit simulation',
  );
  await must(
    await api(page, 'POST', '/public/simulations', { isSaved: true, activeIndex: 0, scenarios: [{ mode: 'FROM_AMOUNT', amount: '95000', currency: 'EUR', durationMonths: 180, annualRateBps: 650, pricingMethod: 'AMORTIZED_RATE' }] }, idem()),
    'credit simulation 2',
  );

  // EC-42 / CAT-093 — an active alert, a paused one, a saved search.
  await must(await api(page, 'POST', '/client/alerts', { frequency: 'DAILY', criteria: { region: 'alger', type: 'APARTMENT' } }, idem()), 'alert');
  const weekly = await must(await api(page, 'POST', '/client/alerts', { frequency: 'WEEKLY', criteria: { region: 'oran' } }, idem()), 'alert 2');
  await must(await api(page, 'PATCH', `/client/alerts/${weekly.alert.id}`, { paused: true }), 'pause');
  await must(await api(page, 'POST', '/client/alerts', { frequency: 'NONE', criteria: { type: 'VILLA' } }), 'saved search');

  // Plan 2.9 — the demonstration dossier with its pieces, then one deposit made by the client.
  execFileSync(process.execPath, ['--env-file=.env', 'dist/install/demo.js', `--dossier-pour=${email}`], { cwd: API_DIR, stdio: 'pipe', timeout: 180_000 });
  const space = await must(await api(page, 'GET', '/client/space'), 'space');
  const withList = space.dossiers.find((d) => d.hasDocumentList);
  if (withList) {
    const list = await must(await api(page, 'GET', `/client/dossiers/${withList.reference}/documents`), 'documents');
    const flat = JSON.stringify(list);
    const pending = [...flat.matchAll(/"id":"([0-9a-f-]{36})"[^{}]*?"status":"PENDING"/g)].map((m) => m[1]);
    const documentId = pending[0];
    if (documentId) {
      const body = tinyPdf('Avis d imposition');
      const sha = createHash('sha256').update(body).digest('hex');
      const announce = await api(page, 'POST', `/client/dossiers/${withList.reference}/documents/${documentId}/uploads`, { files: [{ fileName: 'avis.pdf', contentType: 'application/pdf', size: body.length, sha256: sha }] });
      if (announce.ok()) {
        const u = (await announce.json()).uploads[0];
        const cookies = await page.context().cookies();
        const csrf = decodeURIComponent(cookies.find((c) => c.name.endsWith('dp_web_csrf'))?.value ?? '');
        await page.request.fetch(u.uploadUrl, { method: 'PUT', data: body, headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF-Token': csrf } });
        await api(page, 'POST', `/client/dossiers/${withList.reference}/documents/${documentId}/uploads/${u.id}/complete`, {});
        const v = await api(page, 'POST', `/client/dossiers/${withList.reference}/documents/${documentId}/versions`, { mode: 'REPLACE_ALL', uploadIds: [u.id] }, idem());
        if (!v.ok()) console.log(`deposit: ${v.status()} ${(await v.text()).slice(0, 200)}`);
      }
    }
  }

  // MSG-021 — a message to the advisor about the dossier.
  await must(
    await api(page, 'POST', '/client/leads', { message: 'Bonjour, puis-je déposer mon avis d’imposition de l’an dernier ?', prefilledFrom: 'DOCUMENTS', dossierReference: withList?.reference ?? null, submittedFromPath: '/espace-client/messages' }, idem()),
    'message',
  );
  await page.waitForTimeout(2500); // the notifications are written from the outbox, after the commit
}

async function pagesOf(page) {
  const space = await must(await api(page, 'GET', '/client/space'), 'space');
  const list = ['/espace-client'];
  if (space.dossiers.length) list.push('/espace-client/dossiers');
  for (const d of space.dossiers) {
    const ref = d.reference.toLowerCase();
    list.push(`/espace-client/dossiers/${ref}`);
    if (d.hasDocumentList) list.push(`/espace-client/dossiers/${ref}/pieces`);
  }
  list.push(
    '/espace-client/interets',
    '/espace-client/biens-proposes',
    '/espace-client/messages',
    '/espace-client/simulations',
    '/espace-client/favoris',
    '/espace-client/alertes',
    '/espace-client/profil',
    '/espace-client/profil/securite',
    '/espace-client/profil/confidentialite',
  );
  return list;
}

async function shoot(context, kind) {
  const dir = join(outDir, kind);
  mkdirSync(dir, { recursive: true });
  const probe = await context.newPage();
  const allPaths = await pagesOf(probe);
  const paths = allPaths.filter((p) => !only || p.includes(only));
  await probe.close();
  for (const width of widths) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: width === 390 ? 844 : width === 1920 ? 1080 : 900 });
    for (const path of paths) {
      await page.addInitScript(() => localStorage.setItem('dp_tour_space', '1'));
    const res = await page.goto(path, { waitUntil: 'load', timeout: 90_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      // dossier references change with each account: name the files by the role of the page
      const generic = path.replace(/dos-\d{4}-\d+/g, (m) => `dossier${allPaths.filter((p) => /dossiers\/dos-[\d-]+$/.test(p)).findIndex((p) => p.endsWith(m)) + 1}`);
      const name = `${generic.replace(/^\/espace-client\/?/, '').replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'tableau-de-bord'}-${width}.png`;
      await page.screenshot({ path: join(dir, name), fullPage: true });
      await context.storageState({ path: join(STATE_DIR, `${kind}.json`) }); // the session rotates: never lose its cookies
      console.log(`${kind} ${res?.status()} ${generic} → ${name}`);
    }
    await page.close();
  }
}

const browser = await chromium.launch();
for (const kind of ['filled', 'empty']) {
  if ((kind === 'filled' && noFilled) || (kind === 'empty' && noEmpty)) continue;
  const statePath = join(STATE_DIR, `${kind}.json`);
  currentState = existsSync(statePath) ? statePath : null;
  const credPath = join(STATE_DIR, `${kind}.cred.json`);
  currentCredentials = existsSync(credPath) ? JSON.parse(readFileSync(credPath, 'utf8')) : null;
  if (fresh && existsSync(statePath)) rmSync(statePath);
  let context;
  if (existsSync(statePath)) {
    context = await newContext(browser, statePath);
    if (kind === 'filled') {
      // The demonstration command is idempotent: it completes an older demonstration dossier (proposals, follow-up).
      const probe = await context.newPage();
      const space = await must(await api(probe, 'GET', '/client/space'), 'space');
      execFileSync(process.execPath, ['--env-file=.env', 'dist/install/demo.js', `--dossier-pour=${space.email}`], { cwd: API_DIR, stdio: 'pipe', timeout: 180_000 });
      await probe.close();
    }
  } else {
    context = await newContext(browser, null);
    const { page, email, password } = await signUp(context, kind === 'filled' ? 'Karima' : 'Nadia', kind === 'filled' ? 'Benali' : 'Haddad');
    // Kept in .local (ignored by git) so that a later run can sign in again; never printed.
    currentCredentials = { email, password };
    writeFileSync(credPath, JSON.stringify(currentCredentials));
    await context.storageState({ path: statePath });
    currentState = statePath;
    if (kind === 'filled') await fill(page, email);
    await page.close();
    await context.storageState({ path: statePath });
    console.log(`created the ${kind} client`);
  }
  await shoot(context, kind);
  await context.storageState({ path: statePath }); // the session rotates: keep the latest cookies
  await context.close();
}
await browser.close();
