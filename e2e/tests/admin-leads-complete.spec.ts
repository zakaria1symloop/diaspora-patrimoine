// Back office — package 3.2 completed, against the real stack (P02, P07):
//   COM-020 a hand-written e-mail with an attachment (MED-010: format refused, a PDF kept), found in `.local/mail`,
//     and its file opened from the timeline by a signed link (MED-030);
//   CRM-030, COM-030 from a DOSSIER: « Appel », « Échange », « E-mail », « E-mail reçu » on its « Échanges » tab, an
//     e-mail received noted there with its file;
//   CYC-005 closing as « Injoignable » the request that opened the dossier offers to close the dossier too (CYC-035);
//   CRM-020, CRM-025 a request entered « à prendre » for a client who has a referent goes to him, as from the site;
//   CRM-011 « Créer la fiche partenaire » from a « Devenir partenaire » request (EP-23 → CTL-170), then closed;
//   CRM-001 the « Bien » filter of the list.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, adminPost, signInDirection } from './helpers/admin.js';
import { freshIp } from './helpers/account.js';
import { tinyPdf } from './helpers/space-api.js';

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const letters = (tag: string) => tag.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]!);
const MAIL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.local', 'mail');

async function createLead(page: Page, body: Record<string, unknown>) {
  const r = await adminPost(page, page.request, '/admin/leads', body);
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()) as { id: string; reference: string; clientId: string; status: string; dossierReference: string | null };
}

async function adminGet<T>(page: Page, path: string): Promise<T> {
  const r = await page.request.get(`${ADMIN}/api/v1${path}`);
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()) as T;
}

async function myId(page: Page): Promise<string> {
  return (await adminGet<{ user: { id: string } }>(page, '/admin/me/shell')).user.id;
}

test.describe('back office — requests, package 3.2 completed', () => {
  test.skip(({ isMobile }) => isMobile, 'the back office is designed for 1280 px and more (TRV-130)');
  test.beforeEach(async ({ request }) => {
    await request.get(`${ADMIN}/connexion`, { timeout: 60_000 }).catch(() => undefined);
    await expect.poll(async () => (await request.get(`${ADMIN}/api/v1/public/health`).catch(() => null))?.status() ?? 0, { timeout: 120_000, intervals: [1000, 2000, 3000] }).toBe(200);
  });

  test('COM-020, MED-010, MED-030 — a hand-written e-mail leaves with its attachment, opened again from the timeline (P07)', async ({ page }) => {
    test.setTimeout(180_000);
    await signInDirection(page);
    const tag = letters(unique());
    const email = `piece-${tag}@example.test`;
    const lead = await createLead(page, { source: 'EMAIL', kind: 'CONTACT_MESSAGE', client: { firstName: 'Nora', lastName: `Jointe${tag}`, email, phone: null, whatsappOptIn: false, countryOfResidence: null }, consentContact: true, message: 'Pouvez-vous m’envoyer la plaquette ?' });
    const since = Date.now();
    await page.goto(`${ADMIN}/demandes/${lead.reference.toLowerCase()}`);
    await page.getByRole('group', { name: 'Ajout rapide' }).getByRole('button', { name: 'E-mail', exact: true }).click();
    const win = page.getByRole('dialog', { name: 'Écrire un e-mail' });
    await expect(win.getByText(email)).toBeVisible({ timeout: 15_000 });
    await win.getByLabel('Objet').fill(`La plaquette (${tag})`);
    await win.getByLabel('Message').fill('Bonjour,\n\nVoici la plaquette du programme.');

    // MED-010 — a format refused on its line; a PDF checked and ready
    const files = win.locator('input[type="file"]');
    await files.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('texte') });
    await expect(win.getByText('Format non accepté : PDF, JPG, PNG, Word ou Excel.')).toBeVisible();
    await win.getByRole('button', { name: 'Retirer notes.txt' }).click();
    await files.setInputFiles({ name: `plaquette-${tag}.pdf`, mimeType: 'application/pdf', buffer: tinyPdf('Plaquette') });
    await expect(win.locator('[data-file="ready"]')).toHaveCount(1, { timeout: 20_000 });
    await win.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByText('E-mail envoyé.')).toBeVisible({ timeout: 20_000 });

    // the .eml carries the file (the attachment's name in its headers)
    await expect
      .poll(() => readdirSync(MAIL).map((f) => join(MAIL, f)).filter((f) => statSync(f).mtimeMs >= since - 2000).some((f) => {
        const raw = readFileSync(f, 'utf8');
        return raw.includes(`<${email}>`) && raw.includes(`plaquette-${tag}.pdf`);
      }), { timeout: 20_000 })
      .toBe(true);

    // MED-030 — the file is listed in the timeline and opens through a signed link
    const chip = page.getByRole('button', { name: `Ouvrir plaquette-${tag}.pdf` });
    await expect(chip).toBeVisible({ timeout: 15_000 });
    const linkAnswer = page.waitForResponse((r) => r.url().includes('/attachments/') && r.request().method() === 'GET');
    const popup = page.waitForEvent('popup');
    await chip.click();
    const link = (await (await linkAnswer).json()) as { url: string };
    expect(link.url).toMatch(/^\/api\/v1\/files\/private\//);
    const file = await page.request.get(`${ADMIN}${link.url}`);
    expect(file.status()).toBe(200);
    expect((await file.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    await (await popup).close();
  });

  test('CRM-030, COM-030 from a dossier · CYC-005 the dossier closed with its request (P02, P07)', async ({ page }) => {
    test.setTimeout(240_000);
    await signInDirection(page);
    const me = await myId(page);
    const tag = letters(unique());
    const objects = await adminGet<{ data: { type: string; id: string; published: boolean }[] }>(page, '/admin/lead-objects?q=DP');
    const property = objects.data.find((o) => o.type === 'PROPERTY' && o.published);
    expect(property, 'a published property of the demonstration catalogue').toBeTruthy();
    const lead = await createLead(page, { source: 'PHONE', kind: 'PROPERTY_INTEREST', propertyId: property!.id, client: { firstName: 'Karim', lastName: `Dossier${tag}`, email: `dossier-${tag}@example.test`, phone: null, whatsappOptIn: false, countryOfResidence: 'FR' }, consentContact: true, assignedAgentId: me, message: 'Intéressé par ce bien.' });
    expect(lead.dossierReference, 'a property interest opens a dossier (CYC-002)').toBeTruthy();

    // CRM-030, CRM-031, COM-020, COM-030 — the four buttons on the dossier's « Échanges » tab
    await page.goto(`${ADMIN}/dossiers/${lead.dossierReference!.toLowerCase()}?onglet=echanges`);
    const quick = page.getByRole('group', { name: 'Ajout rapide' });
    for (const name of ['Appel', 'Échange', 'E-mail', 'E-mail reçu']) await expect(quick.getByRole('button', { name, exact: true })).toBeVisible({ timeout: 20_000 });
    await quick.getByRole('button', { name: 'E-mail reçu', exact: true }).click();
    const received = page.getByRole('dialog', { name: /Noter un e-mail reçu/ });
    await received.getByLabel('Objet').fill(`Mes pièces (${tag})`);
    await received.getByLabel(/Texte/).fill('Bonjour, voici mon avis d’imposition.');
    await received.locator('input[type="file"]').setInputFiles({ name: `avis-${tag}.pdf`, mimeType: 'application/pdf', buffer: tinyPdf('Avis') });
    await expect(received.locator('[data-file="ready"]')).toHaveCount(1, { timeout: 20_000 });
    await received.getByRole('button', { name: /Noter/ }).click();
    await expect(page.getByRole('button', { name: `Ouvrir avis-${tag}.pdf` })).toBeVisible({ timeout: 20_000 });

    // CYC-005 — « Injoignable » on the request that opened the dossier offers to close it too
    await page.goto(`${ADMIN}/demandes/${lead.reference.toLowerCase()}`);
    await page.getByRole('button', { name: 'Clôturer' }).click();
    const close = page.getByRole('dialog', { name: /Clôturer la demande/ });
    await close.getByText('Réponse apportée', { exact: true }).click();
    await expect(close.getByText(/Clôturer aussi le dossier/)).toHaveCount(0);
    await close.getByText('Injoignable', { exact: true }).click();
    await close.getByText(/Clôturer aussi le dossier .* comme perdu/).click();
    await close.getByRole('button', { name: 'Clôturer la demande' }).click();
    await expect(page.getByText(new RegExp(`le dossier ${lead.dossierReference} avec elle`))).toBeVisible({ timeout: 20_000 });
    const dossier = await adminGet<{ status: string; lost: { reason: string } | null }>(page, `/admin/dossiers/${lead.dossierReference}`);
    expect(dossier.status).toBe('LOST');
    expect(dossier.lost?.reason).toBe('UNREACHABLE');
  });

  test('CRM-020, CRM-025 — a request entered « à prendre » for a client with a referent goes to him', async ({ page }) => {
    test.setTimeout(150_000);
    await signInDirection(page);
    const me = await myId(page);
    const tag = letters(unique());
    const first = await createLead(page, { source: 'PHONE', kind: 'CALLBACK_REQUEST', client: { firstName: 'Amel', lastName: `Referent${tag}`, email: `referent-${tag}@example.test`, phone: null, whatsappOptIn: false, countryOfResidence: 'FR' }, consentContact: true, assignedAgentId: me });
    const client = await adminGet<{ agent: { id: string } | null }>(page, `/admin/clients/${first.clientId}`);
    test.skip(!client.agent, 'the record has no referent: CRM-020 has nothing to route');
    const second = await createLead(page, { source: 'WHATSAPP', kind: 'CALLBACK_REQUEST', clientId: first.clientId, consentContact: true, assignedAgentId: null });
    expect(second.status, 'assigned on creation, like a request of the site (CRM-020)').toBe('IN_PROGRESS');
    const detail = await adminGet<{ agentId: string | null }>(page, `/admin/leads/${second.reference}`);
    expect(detail.agentId).toBe(client.agent!.id);
  });

  test('CRM-011 — « Créer la fiche partenaire » from a « Devenir partenaire » request, then closed', async ({ page, browser }) => {
    test.setTimeout(180_000);
    const tag = letters(unique());
    const company = `Étude Partenaire ${tag}`;
    // the public form of EP-23 (DEM-019)
    const visitor = await browser.newPage();
    await freshIp(visitor); // many forms from one address would be held as doubtful (CRM-003)
    await visitor.goto('/devenir-partenaire');
    await visitor.getByLabel('Société').fill(company);
    await visitor.getByLabel('Vous êtes').selectOption('NOTARY');
    await visitor.getByRole('textbox', { name: 'Prénom' }).fill('Inès');
    await visitor.getByLabel('Nom', { exact: true }).fill(`Notaire${tag}`);
    await visitor.getByLabel('E-mail professionnel').fill(`notaire-${tag}@example.test`);
    await visitor.getByRole('textbox', { name: /Téléphone/ }).fill('6 12 34 56 78');
    await visitor.getByLabel('Pays', { exact: true }).selectOption('FR');
    await visitor.getByLabel(/Site web/).fill('www.etude-partenaire.fr');
    await visitor.getByLabel('Votre message').fill('Nous accompagnons les actes de la diaspora.');
    await visitor.getByLabel(/J’accepte que Diaspora Patrimoine me contacte/).check();
    await visitor.getByRole('button', { name: 'Envoyer ma demande' }).click();
    await expect(visitor.getByText(/votre demande est enregistrée/)).toBeVisible({ timeout: 20_000 });
    await visitor.close();

    await signInDirection(page);
    const list = await adminGet<{ data: { reference: string; kind: string }[] }>(page, `/admin/leads?kind=PARTNER_REQUEST&status=NEW,IN_PROGRESS,CLOSED,SPAM&q=Notaire${tag}&pageSize=50`);
    const found = await (async () => {
      for (const l of list.data) {
        const d = await adminGet<{ reference: string; sent: { fields: { key: string; value: unknown }[] } }>(page, `/admin/leads/${l.reference}`);
        if (d.sent.fields.some((f) => f.key === 'company' && f.value === company)) return d.reference;
      }
      return null;
    })();
    expect(found, 'the request of the form').toBeTruthy();
    await page.goto(`${ADMIN}/demandes/${found!.toLowerCase()}`);
    const legitimate = page.getByRole('button', { name: 'Demande légitime' });
    if (await legitimate.isVisible().catch(() => false)) {
      await legitimate.click();
      await expect(page.getByText(/vérifiée|légitime/).first()).toBeVisible({ timeout: 15_000 });
    }
    await page.getByRole('button', { name: 'Autres actions' }).click();
    await page.getByRole('menuitem', { name: 'Créer la fiche partenaire…' }).click();
    const dialog = page.getByRole('dialog', { name: /Créer la fiche partenaire/ });
    await expect(dialog.getByLabel('Nom de la société')).toHaveValue(company);
    await expect(dialog.getByLabel('Catégorie')).toHaveValue('NOTARY');
    await expect(dialog.getByLabel(/Site web/)).toHaveValue('https://www.etude-partenaire.fr');
    await dialog.getByRole('button', { name: 'Créer la fiche' }).click();
    await expect(page.getByText(`Fiche partenaire « ${company} » créée, demande clôturée.`)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/partenaires/);
    await expect(page.getByText(company).first()).toBeVisible({ timeout: 20_000 });
    const lead = await adminGet<{ status: string; outcome: string | null }>(page, `/admin/leads/${found}`);
    expect(lead.status).toBe('CLOSED');
  });

  test('CRM-001 — the « Bien » filter of the list offers the properties asked, with their counts', async ({ page }) => {
    test.setTimeout(120_000);
    await signInDirection(page);
    const list = await adminGet<{ objectFacets: { type: string; id: string; label: string; count: number }[] }>(page, '/admin/leads?view=all');
    const asked = list.objectFacets.find((o) => o.type === 'PROPERTY');
    test.skip(!asked, 'no request about a property yet');
    const filtered = await adminGet<{ meta: { total: number } }>(page, `/admin/leads?view=all&propertyId=${asked!.id}`);
    expect(filtered.meta.total).toBe(asked!.count);
  });
});
