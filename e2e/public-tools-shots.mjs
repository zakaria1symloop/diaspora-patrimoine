// Review helper — the account and tool pages of the public site in their REAL states (real sign-up, real alert, real
// favourites and comparison, real partner application), at 1440 and 390 px.
// Usage: node public-tools-shots.mjs <outDir> [--only=compare,favorites,alert,auth,partner]
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--')) ?? './shots/public-pass/after';
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const want = (k) => !only || only.includes(k);
const base = 'http://localhost:3000';
const MAIL = join(dirname(fileURLToPath(import.meta.url)), '..', '.local', 'mail');
const REFS = ['DP-DZ-0142', 'DP-DZ-0203', 'DP-DZ-0177'];
mkdirSync(outDir, { recursive: true });
const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function apiUp() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://localhost:4000/api/v1/public/health')).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
}
async function mailLink(email, template, pattern) {
  for (let i = 0; i < 40; i++) {
    for (const f of readdirSync(MAIL).filter((n) => n.includes(`_${template}_`)).sort().reverse()) {
      const raw = readFileSync(join(MAIL, f), 'utf8');
      if (!raw.includes(`<${email}>`)) continue;
      const blocks = raw.match(/Content-Transfer-Encoding: base64\r?\n(?:[^\r\n]+\r?\n)*\r?\n[A-Za-z0-9+/=\r\n]+/g) ?? [];
      const text = blocks.map((b) => Buffer.from(b.split(/\r?\n\r?\n/)[1].replace(/\s+/g, ''), 'base64').toString('utf8')).join('\n');
      const m = text.match(pattern);
      if (m) return m[0].replace(base, '');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no ${template} for ${email}`);
}

const browser = await chromium.launch();
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.addCookies([{ name: 'dp_consent', value: 'none', url: base }]);
  const page = await ctx.newPage();
  const n = () => Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.51.${n()}.${n()}` });
  const go = async (path) => {
    for (let a = 0; a < 4; a++) {
      await apiUp();
      const res = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => null);
      if (res && res.status() < 500) return;
      await page.waitForTimeout(4000);
    }
  };
  const shot = async (name, wait = 2600) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: join(outDir, `${name}-${width}.jpg`), fullPage: true, type: 'jpeg', quality: 62 });
    console.log(`→ ${name}-${width}.jpg`);
  };
  const step = async (name, fn) => {
    try { await fn(); } catch (e) { console.log(`!! ${name} (${width}): ${String(e.message).split('\n')[0]}`); await shot(`FAILED-${name}`, 300).catch(() => {}); }
  };

  if (want('compare')) await step('compare', async () => {
    await go(`/comparer?biens=${REFS.join(',')}`);
    await shot('comparer-trois');
    const sw = page.getByRole('switch').first();
    if (await sw.count()) { await sw.click(); await shot('comparer-differences', 600); }
    await go(`/comparer?biens=${REFS.slice(0, 2).join(',')},DP-DZ-9999`);
    await shot('comparer-deux-et-inconnu');
    await go('/programmes');
    await page.evaluate((refs) => localStorage.setItem('dp_compare', JSON.stringify(refs)), REFS.slice(0, 2));
    await go('/programmes');
    await page.screenshot({ path: join(outDir, `comparer-bac-${width}.jpg`), type: 'jpeg', quality: 62 });
    await go('/comparer');
    await shot('comparer-depuis-navigateur');
    await page.evaluate(() => localStorage.removeItem('dp_compare'));
    await go('/comparer');
    await shot('comparer-vide');
  });

  if (want('favorites')) await step('favorites', async () => {
    await go('/favoris');
    await shot('favoris-vide');
    const day = 86_400_000;
    await page.evaluate(({ refs, day }) => localStorage.setItem('dp_favorites', JSON.stringify([
      { ref: refs[0], at: Date.now() - 2 * 3600_000 }, { ref: refs[1], at: Date.now() - 3 * day }, { ref: refs[2], at: Date.now() - 9 * day }, { ref: 'DP-DZ-0145', at: Date.now() - 20 * day },
    ])), { refs: REFS, day });
    await go('/favoris');
    await shot('favoris-liste');
    await page.evaluate(() => localStorage.removeItem('dp_favorites'));
  });

  if (want('alert')) await step('alert', async () => {
    const email = `alerte-${uniq()}@example.test`;
    await go('/programmes?region=alger&alerte=1');
    const dialog = page.getByRole('dialog', { name: 'Créer une alerte' });
    await dialog.waitFor({ timeout: 20000 });
    await page.screenshot({ path: join(outDir, `alerte-fenetre-${width}.jpg`), type: 'jpeg', quality: 62 });
    await dialog.getByRole('textbox', { name: 'Votre adresse e-mail' }).fill(email);
    await dialog.getByRole('button', { name: 'Créer l’alerte' }).click();
    await dialog.getByText(/Vérifiez votre boîte/).waitFor({ timeout: 20000 });
    await page.screenshot({ path: join(outDir, `alerte-fenetre-envoyee-${width}.jpg`), type: 'jpeg', quality: 62 });
    const link = await mailLink(email, 'C_ALERT_CONFIRM', /http:\/\/localhost:3000\/alertes\/[A-Za-z0-9_.-]+/);
    await go(link);
    await shot('alerte-activee');
    await go(link);
    await shot('alerte-gestion');
    const prefs = await mailLink(email, 'C_ALERT_CONFIRM', /http:\/\/localhost:3000\/preferences\/[A-Za-z0-9_.-]+/).catch(() => null);
    if (prefs) { await go(prefs); await shot('preferences'); }
    await go(`${link}/arreter`);
    await shot('alerte-arreter');
    await go('/alertes/jeton-inconnu');
    await shot('alerte-lien-expire');
    await go('/preferences/jeton-inconnu');
    await shot('preferences-lien-expire');
    await go('/programmes?region=alger&enregistrer=1');
    await page.screenshot({ path: join(outDir, `recherche-enregistrer-${width}.jpg`), type: 'jpeg', quality: 62 });
  });

  if (want('auth')) await step('auth', async () => {
    const email = `client-${uniq()}@example.test`;
    for (const p of ['/inscription', '/connexion', '/connexion/lien', '/mot-de-passe-oublie', '/verification', '/verification/jeton-inconnu', '/reinitialisation/jeton-inconnu', '/activation/jeton-inconnu', '/connexion/lien/jeton-inconnu', '/nouvelle-adresse/jeton-inconnu', '/connexion?suite=%2Ffavoris']) {
      await go(p);
      await shot(`compte${p.replace(/\W+/g, '-')}`, 2600);
    }
    await go('/inscription');
    await page.getByRole('button', { name: 'Créer mon espace' }).click();
    await shot('compte-inscription-erreurs', 600);
    await page.getByLabel('Prénom').fill('Karima');
    await page.getByLabel('Nom', { exact: true }).fill('Testeuse');
    await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
    await page.getByPlaceholder(/6 12 34 56 78/).fill('612345678');
    await page.getByLabel('Mot de passe', { exact: true }).fill('Une maison au bord de la mer 2026');
    await page.getByLabel(/J’accepte les/).check();
    await shot('compte-inscription-remplie', 300);
    await page.getByRole('button', { name: 'Créer mon espace' }).click();
    await page.getByRole('heading', { name: 'Vérifiez votre boîte e-mail' }).waitFor({ timeout: 30000 });
    await shot('compte-inscription-verifiez');
    await go('/mot-de-passe-oublie');
    await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
    await page.getByRole('button', { name: 'Recevoir le lien' }).click();
    await page.getByText(/Si un espace existe/).waitFor({ timeout: 20000 });
    await shot('compte-mot-de-passe-envoye', 600);
    const reset = await mailLink(email, 'C_PASSWORD_RESET', /http:\/\/localhost:3000\/reinitialisation\/[A-Za-z0-9_-]+/).catch(() => null);
    if (reset) { await go(reset); await shot('compte-nouveau-mot-de-passe'); }
    await go('/connexion');
    await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais mot de passe');
    await page.getByRole('button', { name: 'Se connecter' }).last().click();
    await shot('compte-connexion-erreur', 2500);
  });

  if (want('partner')) await step('partner', async () => {
    const email = `promoteur-${uniq()}@example.test`;
    await go('/partenaires/inscription');
    await shot('partenaire-inscription-1');
    await page.getByRole('button', { name: /Promoteur immobilier/ }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByText(/Étape 2 sur 2/).waitFor();
    await shot('partenaire-inscription-2', 600);
    await page.getByRole('button', { name: 'Créer mon espace partenaire' }).click();
    await shot('partenaire-inscription-erreurs', 600);
    await page.getByLabel('Raison sociale').fill('Résidences Test');
    await page.getByLabel('Pays', { exact: true }).selectOption('DZ');
    await page.getByLabel('Ville').fill('Alger');
    await page.getByLabel('Prénom').fill('Yacine');
    await page.getByLabel('Nom', { exact: true }).fill('Promoteur');
    await page.getByLabel('Fonction').fill('Directeur commercial');
    await page.getByRole('textbox', { name: 'E-mail professionnel' }).fill(email);
    await page.locator('#phone').fill('550123456');
    await page.getByLabel('Mot de passe', { exact: true }).fill('Des immeubles face à la mer 2026');
    await page.getByLabel(/charte des partenaires/).check();
    await page.getByLabel(/me contacte au sujet de ma demande/).check();
    await page.getByRole('button', { name: 'Créer mon espace partenaire' }).click();
    await page.getByRole('heading', { name: 'Vérifiez votre boîte e-mail' }).waitFor({ timeout: 30000 });
    await shot('partenaire-verifiez');
    const verify = await mailLink(email, 'P_PARTNER_EMAIL_VERIFICATION', /http:\/\/localhost:3000\/partenaires\/verification\/[A-Za-z0-9_-]+/);
    await go(verify);
    await page.getByRole('heading', { name: /Bienvenue, Yacine/ }).waitFor({ timeout: 30000 });
    await shot('partenaire-dossier');
    await page.getByRole('button', { name: 'À compléter' }).first().click();
    await shot('partenaire-dossier-activite', 600);
    await page.getByLabel('Numéro d’immatriculation au registre du commerce').fill('16/00-1234567B22');
    await page.getByLabel('Année de création').fill('2009');
    await page.getByLabel('Programmes en cours (nombre)').fill('3');
    await page.getByRole('checkbox', { name: 'Alger' }).check();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByText('1 sur 2 rubriques obligatoires').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'À compléter' }).first().click();
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
    await page.getByLabel(/Extrait d’immatriculation/).setInputFiles({ name: 'extrait-rc.pdf', mimeType: 'application/pdf', buffer: pdf });
    await page.getByText('2 sur 2 rubriques obligatoires').waitFor({ timeout: 20000 });
    await shot('partenaire-dossier-pret', 600);
    await page.getByRole('button', { name: 'Envoyer mon dossier pour examen' }).click();
    await page.getByRole('heading', { name: 'Nous étudions votre candidature.' }).waitFor({ timeout: 20000 });
    await shot('partenaire-en-cours');
    for (const p of ['/partenaires/mot-de-passe-oublie', '/partenaires/verification/jeton-inconnu', '/partenaires/reinitialisation/jeton-inconnu']) {
      await ctx.clearCookies();
      await ctx.addCookies([{ name: 'dp_consent', value: 'none', url: base }]);
      await go(p);
      await shot(`partenaire${p.replace('/partenaires', '').replace(/\W+/g, '-')}`);
    }
    await go('/partenaires/connexion');
    await shot('partenaire-connexion');
  });
  await ctx.close();
}
await browser.close();
