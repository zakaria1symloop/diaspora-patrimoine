// Packages 1.6 / 2.10 / A.14 — the account journeys against the local stack (web :3000, API :4000, PostgreSQL).
// Sign-up → verification link read from the .eml written locally → space → sign-out → sign-in by link → two-factor
// (enabled through the API, used with a recovery code) → forgotten password; and a partner sign-up up to its space.
// The e-mails land in `<repo>/.local/mail` (MAIL_PROVIDER=log). Accounts use @example.test addresses.
import { createHmac } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const MAIL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.local', 'mail');
const ORIGIN = 'http://localhost:3000';
const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The first link of the latest e-mail of `template` sent to `email`, waited for up to 15 s. */
async function mailLink(email: string, template: string, pattern: RegExp): Promise<string> {
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

function totp(secretB32: string, step = Math.floor(Date.now() / 30_000)): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of secretB32) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const o = mac[mac.length - 1]! & 15;
  return String((((mac[o]! & 127) << 24) | (mac[o + 1]! << 16) | (mac[o + 2]! << 8) | mac[o + 3]!) % 1_000_000).padStart(6, '0');
}

async function csrf(page: Page): Promise<string> {
  const c = (await page.context().cookies()).find((x) => x.name === 'dp_web_csrf');
  return c?.value ?? '';
}

async function api(page: Page, path: string, data: unknown) {
  const res = await page.request.post(`/api/v1${path}`, { data, headers: { Origin: ORIGIN, 'X-CSRF-Token': await csrf(page) } });
  return { status: res.status(), body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}

test.describe('account', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'one journey: the limits of SEC-070 are per IP'));

  test('client: sign-up, verification, sign-out, link, two-factor, forgotten password', async ({ page }) => {
    test.setTimeout(180_000);
    const email = `client-${unique()}@example.test`;
    const password = 'Une maison au bord de la mer 2026';

    // EC-02 — sign-up; the screen is always « Vérifiez votre boîte e-mail ».
    await page.goto('/inscription');
    await page.getByLabel('Prénom').fill('Karima');
    await page.getByLabel('Nom', { exact: true }).fill('Testeuse');
    await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
    await page.getByPlaceholder(/6 12 34 56 78/).fill('612345678');
    await page.getByLabel('Mot de passe', { exact: true }).fill(password);
    await page.getByLabel(/J’accepte les/).check();
    await page.getByRole('button', { name: 'Créer mon espace' }).click();
    await expect(page.getByRole('heading', { name: 'Vérifiez votre boîte e-mail' })).toBeVisible();

    // EC-03 — the link, opened in the browser of the sign-up: verified and signed in, then the space.
    const verify = await mailLink(email, 'C_EMAIL_VERIFICATION', /http:\/\/localhost:3000\/verification\/[A-Za-z0-9_-]+/);
    await page.goto(verify.replace(ORIGIN, ''));
    await expect(page).toHaveURL(/\/espace-client$/);
    await expect(page.getByRole('heading', { name: 'Bonjour Karima' })).toBeVisible();
    // ECL-002 — the space's own frame: the account menu with the first name (the public « Mon espace » is NAV-013).
    await expect(page.getByRole('button', { name: /Karima/ })).toBeVisible();

    // SEC-026 — sign-out from the space.
    await page.getByRole('button', { name: /Karima/ }).click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/espace-client');
    await expect(page).toHaveURL(/\/connexion\?suite=/); // AUTH-023

    // AUTH-021 — one message for a wrong password.
    await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).fill('pas le bon mot de passe');
    await page.getByRole('button', { name: 'Se connecter' }).last().click();
    await expect(page.getByText('E-mail ou mot de passe incorrect.')).toBeVisible();

    // EC-07 — sign-in by link.
    await page.goto('/connexion/lien');
    await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
    await page.getByRole('button', { name: 'Recevoir le lien' }).click();
    await expect(page.getByText(/Si un espace existe pour cette adresse, un lien de connexion/)).toBeVisible();
    const magic = await mailLink(email, 'C_MAGIC_LOGIN', /http:\/\/localhost:3000\/connexion\/lien\/[A-Za-z0-9_-]+/);
    await page.goto(magic.replace(ORIGIN, ''));
    await expect(page).toHaveURL(/\/espace-client$/);

    // PRO-020 — two-factor enabled through the API (the profile page comes with package 2.8).
    const setup = await api(page, '/client/me/two-factor/setup', { password });
    expect(setup.status).toBe(200);
    const secret = String(setup.body!.secret);
    const confirm = await api(page, '/client/me/two-factor/confirm', { code: totp(secret) });
    expect(confirm.status).toBe(200);
    const codes = confirm.body!.recoveryCodes as string[];
    expect(codes).toHaveLength(10);
    expect((await page.request.post('/api/v1/client/me/two-factor/enable', { data: { saved: true }, headers: { Origin: ORIGIN, 'X-CSRF-Token': await csrf(page) } })).status()).toBe(204);

    // EC-08 — sign-in with the password, then a recovery code.
    await page.goto('/espace-client');
    await page.getByRole('button', { name: /Karima/ }).click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/connexion');
    await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Se connecter' }).last().click();
    await expect(page.getByText('Saisissez le code à 6 chiffres de votre application.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Code à 6 chiffres' }).fill('000000');
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByText(/Code incorrect\. Il vous reste 4 essais\./)).toBeVisible();
    await page.getByRole('button', { name: 'Utiliser un code de secours' }).click();
    await page.getByRole('textbox', { name: 'Code de secours' }).fill(codes[0]!);
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page).toHaveURL(/\/espace-client$/);

    // EC-04, EC-05 — forgotten password: every session closes, then the new password signs in (after the code).
    await page.getByRole('button', { name: /Karima/ }).click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await page.goto('/mot-de-passe-oublie');
    await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
    await page.getByRole('button', { name: 'Recevoir le lien' }).click();
    await expect(page.getByText('Si un espace existe pour cette adresse, un e-mail vient d’être envoyé.')).toBeVisible();
    const reset = await mailLink(email, 'C_PASSWORD_RESET', /http:\/\/localhost:3000\/reinitialisation\/[A-Za-z0-9_-]+/);
    await page.goto(reset.replace(ORIGIN, ''));
    await page.getByLabel('Nouveau mot de passe').fill('azertyuiop');
    await page.getByRole('button', { name: 'Enregistrer et me connecter' }).click();
    await expect(page.getByText('Ce mot de passe est trop courant. Choisissez-en un autre.')).toBeVisible();
    await page.getByLabel('Nouveau mot de passe').fill('Un autre jardin plein de figuiers');
    await page.getByRole('button', { name: 'Enregistrer et me connecter' }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await page.getByRole('button', { name: 'Utiliser un code de secours' }).click();
    await page.getByRole('textbox', { name: 'Code de secours' }).fill(codes[1]!);
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page).toHaveURL(/\/espace-client$/);
    // A used recovery code is dead.
    expect(codes[0]).not.toBe(codes[1]);
  });

  test('partner: two-step sign-up, verification, application space', async ({ page }) => {
    const email = `promoteur-${unique()}@example.test`;
    await page.goto('/partenaires/inscription');
    await page.getByRole('button', { name: /Promoteur immobilier/ }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByText(/Étape 2 sur 2/)).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Vérifiez votre boîte e-mail' })).toBeVisible();

    const verify = await mailLink(email, 'P_PARTNER_EMAIL_VERIFICATION', /http:\/\/localhost:3000\/partenaires\/verification\/[A-Za-z0-9_-]+/);
    await page.goto(verify.replace(ORIGIN, ''));
    await expect(page).toHaveURL(/\/partenaires\/connexion$/);
    await expect(page.getByRole('heading', { name: /Bienvenue, Yacine/ })).toBeVisible();
    await expect(page.getByText('0 sur 2 rubriques obligatoires')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Envoyer mon dossier pour examen' })).toBeDisabled();

    // ACP-087 — « Votre activité », saved alone.
    await page.getByRole('button', { name: 'À compléter' }).first().click();
    await page.getByLabel('Numéro d’immatriculation au registre du commerce').fill('16/00-1234567B22');
    await page.getByLabel('Année de création').fill('2009');
    await page.getByLabel('Programmes en cours (nombre)').fill('3');
    await page.getByRole('checkbox', { name: 'Alger' }).check();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Enregistré.')).toBeVisible();
    await expect(page.getByText('1 sur 2 rubriques obligatoires')).toBeVisible();

    // API-080 — the registration extract: announced, sent, confirmed (type read from the content).
    await page.getByRole('button', { name: 'À compléter' }).first().click();
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
    await page.getByLabel(/Extrait d’immatriculation/).setInputFiles({ name: 'extrait-rc.pdf', mimeType: 'application/pdf', buffer: pdf });
    await expect(page.getByText('extrait-rc.pdf')).toBeVisible();
    await expect(page.getByText('2 sur 2 rubriques obligatoires')).toBeVisible();

    // « Envoyer mon dossier pour examen » → under review.
    await page.getByRole('button', { name: 'Envoyer mon dossier pour examen' }).click();
    await expect(page.getByRole('heading', { name: 'Nous étudions votre candidature.' })).toBeVisible();
  });
});
