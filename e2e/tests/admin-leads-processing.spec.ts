// Back office — package 3.2 « Demandes : traitement » and its exchanges, against the real stack:
//   CRM-025 a request entered by the team for a person met by phone (no e-mail: MOD-302), assigned to me by default;
//   CRM-030 a call noted « Joint » is the first contact (CYC-004) and closes nothing for a contact message;
//   CRM-011 / CYC-005 close with an outcome, CYC-008 reopen; CYC-006 undesirable then restored;
//   CRM-004 the bulk « Affecter » from the list; COM-020 a hand-written e-mail written from a request with an address,
//   found in `.local/mail` with the adviser's signature.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, adminPost, signInDirection } from './helpers/admin.js';

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const MAIL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.local', 'mail');
const letters = (tag: string) => tag.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]!);

async function createLead(page: Page, body: Record<string, unknown>) {
  const r = await adminPost(page, page.request, '/admin/leads', body);
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()) as { id: string; reference: string; clientId: string; status: string };
}

test.describe('back office — requests processing', () => {
  test.skip(({ isMobile }) => isMobile, 'the back office is designed for 1280 px and more (TRV-130)');
  // the local `next dev` compiles the door and the API relay on their first call: warm them up before signing in
  // (the shared API restarts when another session rebuilds it: wait until the relay answers)
  test.beforeEach(async ({ request }) => {
    await request.get(`${ADMIN}/connexion`, { timeout: 60_000 }).catch(() => undefined);
    await expect.poll(async () => (await request.get(`${ADMIN}/api/v1/public/health`).catch(() => null))?.status() ?? 0, { timeout: 120_000, intervals: [1000, 2000, 3000] }).toBe(200);
  });

  test('CRM-025, CRM-030, CYC-004, CYC-005, CYC-008 — entered by phone, called, closed, reopened', async ({ page }) => {
    test.setTimeout(180_000);
    await signInDirection(page);
    const tag = letters(unique());
    const lastName = `Telephone${tag.slice(-5)}`;

    // CRM-025 — the form of « + Créer › Demande »
    await page.goto(`${ADMIN}/demandes/nouvelle`);
    await expect(page.getByRole('heading', { name: 'Saisir une demande', level: 1 })).toBeVisible();
    await page.getByRole('tab', { name: 'Nouvelle personne' }).click();
    await page.getByLabel('Prénom').fill('Samir');
    await page.getByLabel('Nom', { exact: true }).fill(lastName);
    await page.getByLabel(/^Téléphone/).fill(`+3361${String(Date.now()).slice(-7)}`);
    await page.getByRole('button', { name: 'Message de contact' }).click();
    await page.getByLabel(/Ce que la personne demande/).fill(`Rappel pour un projet à Oran (${tag})`);
    // without the oral agreement the request is refused (MUST_ACCEPT)
    await page.getByRole('button', { name: 'Enregistrer la demande' }).click();
    await expect(page.getByText(/accepté d’être recontactée/).first()).toBeVisible();
    await page.getByLabel(/La personne a accepté d’être recontactée/).check();
    await expect(page.getByText('Sans adresse e-mail, aucune confirmation ne peut partir.')).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer la demande' }).click();
    await expect(page).toHaveURL(/\/demandes\/dem-/, { timeout: 30_000 });
    await expect(page.getByText('Sans e-mail').first()).toBeVisible();
    await expect(page.getByText(/\(vous\)/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clôturer' })).toBeVisible();

    // CRM-030 — a call « Joint » is the first contact
    await page.getByRole('group', { name: 'Ajout rapide' }).getByRole('button', { name: 'Appel', exact: true }).click();
    const call = page.getByRole('dialog', { name: 'Noter un appel' });
    await call.getByRole('button', { name: /^Joint/ }).click();
    await call.getByRole('button', { name: 'Noter l’appel' }).click();
    await expect(call.getByText('Le compte rendu est obligatoire quand la personne a été jointe.')).toBeVisible();
    await call.getByLabel(/Compte rendu/).fill('Projet confirmé, rappel la semaine prochaine.');
    await call.getByRole('button', { name: 'Noter l’appel' }).click();
    await expect(page.getByText('Échange noté : le premier contact est fait.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Contacté en/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Appel noté/).first()).toBeVisible();

    // CYC-005 — close with an outcome; CYC-008 — reopen
    await page.getByRole('button', { name: 'Clôturer' }).click();
    const close = page.getByRole('dialog', { name: /Clôturer la demande/ });
    await close.getByText('Réponse apportée', { exact: true }).click();
    await close.getByRole('button', { name: 'Clôturer la demande' }).click();
    await expect(page.getByText('Demande clôturée.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rouvrir' })).toBeVisible();
    await page.getByRole('button', { name: 'Rouvrir' }).click();
    await page.getByRole('dialog', { name: /Rouvrir la demande/ }).getByRole('button', { name: 'Rouvrir' }).click();
    await expect(page.getByText('Demande rouverte.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clôturer' })).toBeVisible();

    // the client record exists, without e-mail, and lists the request
    await page.getByRole('link', { name: new RegExp(lastName.toUpperCase()) }).first().click();
    await expect(page).toHaveURL(/\/clients\//, { timeout: 30_000 });
    await expect(page.getByText('Sans e-mail').first()).toBeVisible();
    await page.getByRole('link', { name: /^Demandes/ }).last().click();
    await expect(page.getByRole('cell', { name: /DEM-/ }).first()).toBeVisible();
  });

  test('CYC-006 undesirable then restored · CRM-004 bulk assignment · CYC-003 take from the row', async ({ page }) => {
    test.setTimeout(150_000);
    await signInDirection(page);
    const tag = letters(unique());
    const created = await Promise.all(
      [1, 2].map((i) =>
        createLead(page, { source: 'WHATSAPP', kind: 'CALLBACK_REQUEST', client: { firstName: 'Lina', lastName: `Groupe${tag}${'ab'[i - 1]}`, email: `groupe-${tag}-${i}@example.test`, phone: null, whatsappOptIn: false, countryOfResidence: 'FR' }, consentContact: true, assignedAgentId: null }),
      ),
    );
    expect(created.every((c) => c.status === 'NEW')).toBe(true);

    // take from the row (CYC-003)
    await page.goto(`${ADMIN}/demandes?view=to-take&q=Groupe${tag}`);
    const rows = page.getByRole('row').filter({ hasText: `GROUPE${tag.toUpperCase()}` });
    await expect(rows).toHaveCount(2, { timeout: 20_000 });
    await rows.first().getByRole('button', { name: 'Prendre' }).click();
    await expect(page.getByText(/prise en charge\./)).toBeVisible();

    // bulk « Affecter » (CRM-004): both to me
    await page.goto(`${ADMIN}/demandes?view=all&q=Groupe${tag}`);
    await expect(page.getByRole('row').filter({ hasText: `GROUPE${tag.toUpperCase()}` })).toHaveCount(2, { timeout: 20_000 });
    for (const row of await page.getByRole('row').filter({ hasText: `GROUPE${tag.toUpperCase()}` }).all()) await row.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Affecter' }).click();
    const dialog = page.getByRole('dialog', { name: /Affecter 2 demandes/ });
    const select = dialog.getByLabel('Conseiller');
    const value = await select.locator('option:not([disabled])').filter({ hasText: '(moi)' }).getAttribute('value');
    await select.selectOption(value!);
    await dialog.getByRole('button', { name: 'Affecter' }).click();
    await expect(page.getByText(/2 demandes traitées|1 demande traitée/)).toBeVisible({ timeout: 15_000 });

    // CYC-006 — undesirable, then restored
    const one = created[1]!;
    await page.goto(`${ADMIN}/demandes/${one.reference.toLowerCase()}`);
    await page.getByRole('button', { name: 'Autres actions' }).click();
    await page.getByRole('menuitem', { name: 'Classer indésirable' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Classer indésirable' }).click();
    await expect(page.getByText('Demande classée indésirable.')).toBeVisible();
    await page.getByRole('button', { name: 'Restaurer' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restaurer' }).click();
    await expect(page.getByText(/Demande restaurée/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prendre en charge' })).toBeVisible();
  });

  test('COM-020, COM-021 — a hand-written e-mail leaves with the adviser’s signature and is a first contact', async ({ page }) => {
    test.setTimeout(150_000);
    await signInDirection(page);
    const tag = letters(unique());
    const email = `ecrit-${tag}@example.test`;
    const lead = await createLead(page, { source: 'EMAIL', kind: 'CONTACT_MESSAGE', client: { firstName: 'Yasmine', lastName: `Courrier${tag}`, email, phone: null, whatsappOptIn: false, countryOfResidence: null }, consentContact: true, message: 'Question sur les frais' });
    const since = Date.now();
    await page.goto(`${ADMIN}/demandes/${lead.reference.toLowerCase()}`);
    await page.getByRole('group', { name: 'Ajout rapide' }).getByRole('button', { name: 'E-mail', exact: true }).click();
    const win = page.getByRole('dialog', { name: 'Écrire un e-mail' });
    await expect(win.getByText(email)).toBeVisible({ timeout: 15_000 });
    await win.getByLabel('Objet').fill(`Votre question (${tag})`);
    await win.getByLabel('Message').fill('Bonjour,\n\nLes frais sont détaillés dans votre espace.');
    await expect(win.locator('iframe')).toBeVisible({ timeout: 15_000 });
    await win.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByText('E-mail envoyé.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Contacté en/).first()).toBeVisible({ timeout: 15_000 });

    // the .eml written locally carries the subject and the signature (COM-021)
    await expect
      .poll(() => {
        const files = readdirSync(MAIL).map((f) => join(MAIL, f)).filter((f) => statSync(f).mtimeMs >= since - 2000);
        return files.some((f) => {
          const raw = readFileSync(f, 'utf8');
          if (!raw.includes(`<${email}>`)) return false;
          // the text part is base64: decode it, then read the subject line of the layout and the signature
          const part = raw.split(/Content-Transfer-Encoding: base64\r?\n\r?\n/)[1]?.split(/\r?\n--/)[0] ?? '';
          const text = Buffer.from(part.replace(/\s/g, ''), 'base64').toString('utf8');
          return text.includes('Les frais sont détaillés') && /\S+ \S\. — |\S+ \S\.\n/.test(text);
        });
      }, { timeout: 20_000 })
      .toBe(true);
  });
});
