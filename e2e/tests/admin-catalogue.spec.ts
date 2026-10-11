// Packages 3.4 to 3.6 — the catalogue back office (EA-40 … EA-51): programmes, properties, lots, media, lot import,
// home pins, promoters and other partners. Journeys on the shared local stack with the demonstration data; whatever a
// test creates carries a unique name and is archived or deleted through the use cases.
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, adminPost, signInDirection } from './helpers/admin.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATE = join(ROOT, '.local', 'agent6-admin-state.json');

test.describe.configure({ mode: 'serial' });

/** Reuses the saved session of the catalogue agent; signs in again (and saves) when it has expired. */
async function signedIn(page: Page): Promise<void> {
  await page.goto(`${ADMIN}/catalogue/programmes`);
  const door = page.getByRole('heading', { name: 'Se connecter' });
  await door.or(page.getByRole('navigation', { name: 'Menu principal' })).first().waitFor({ timeout: 60_000 });
  if (await door.isVisible()) {
    await signInDirection(page);
    await page.context().storageState({ path: STATE });
  }
}

// Development aid: saves the signed-in state for the smoke calls of the catalogue agent (never committed: `.local/`).
test('session', async ({ page }) => {
  test.skip(!process.env.CAT_SESSION, 'development aid only');
  test.setTimeout(120_000);
  await signInDirection(page);
  await page.context().storageState({ path: STATE });
});

/** A JSON read of the API as the signed-in staff member. */
async function apiGet<T>(page: Page, path: string): Promise<T> {
  const r = await page.request.get(`${ADMIN}/api/v1${path}`, { headers: { Origin: ADMIN } });
  expect(r.status(), path).toBe(200);
  return (await r.json()) as T;
}

const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const IMAGES = join(ROOT, 'Design', 'assets', 'demo');

test.describe('catalogue journey', () => {
  test.skip(({ isMobile }) => isMobile, 'the back office is driven at desktop width');
  // Whatever the journey created is undone through the use cases, even when a step failed.
  const made: { programId?: string; promoterId?: string; csv?: string } = {};
  test.afterEach(async ({ page, request }) => {
    if (made.programId) await adminPost(page, request, `/admin/programs/${made.programId}/archive`, {});
    if (made.promoterId) await adminPost(page, request, `/admin/promoters/${made.promoterId}/end`, { reason: 'Recette terminée' });
    if (made.csv && existsSync(made.csv)) unlinkSync(made.csv);
    await page.context().storageState({ path: STATE });
  });

  test('CTL-002 → CTL-004, CTL-022, CTL-041, CTL-060, CTL-080, CYC-120, CTL-100 … CTL-102, MOD-110: a promoter, its programme, a typology, a lot, photos, publication, an import, a suspension and its republication', async ({ page, request }) => {
    test.setTimeout(600_000);
    // A fresh session: a saved one may have been rotated by another run.
    await signInDirection(page);
    await page.context().storageState({ path: STATE });
    const stamp = Date.now().toString(36);
    const today = new Date().toISOString().slice(0, 10);

    // CTL-002 — « Nouveau promoteur »: born « En discussion », lands on its record.
    await page.goto(`${ADMIN}/promoteurs`);
    await page.getByRole('button', { name: 'Nouveau promoteur' }).first().click();
    await page.getByRole('dialog').getByLabel('Raison sociale').fill(`Recette catalogue ${stamp}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Créer le promoteur' }).click();
    await expect(page.getByRole('heading', { level: 1, name: `Recette catalogue ${stamp}` })).toBeVisible({ timeout: 30_000 });
    const promoterId = new URL(page.url()).pathname.split('/').pop()!;
    made.promoterId = promoterId;
    await expect(page.getByText('En discussion').first()).toBeVisible();

    // CTL-004 — « Sélectionner » needs the selection date and the convention's signature date.
    expect((await adminPost(page, request, `/admin/promoters/${promoterId}`, { vettedAt: today, conventionSignedAt: today }, 'PATCH')).status()).toBe(200);
    await page.reload();
    await page.getByRole('button', { name: 'Sélectionner' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sélectionner' }).click();
    await expect(page.getByText('Sélectionné').first()).toBeVisible({ timeout: 30_000 });

    // CTL-022 — a programme of this promoter, born DRAFT.
    await page.goto(`${ADMIN}/catalogue/programmes/nouveau?promoteur=${promoterId}`);
    await page.getByLabel('Nom du programme').fill(`Résidence recette ${stamp}`);
    await page.getByLabel('Région').selectOption({ index: 1 });
    await page.getByLabel('Date').fill('2028-03-01');
    await page.getByRole('button', { name: 'Créer le programme' }).click();
    await expect(page.getByRole('heading', { level: 1, name: `Résidence recette ${stamp}` })).toBeVisible({ timeout: 30_000 });
    const programId = new URL(page.url()).pathname.split('/').pop()!;
    made.programId = programId;
    await expect(page.getByText('Ce qui manque pour publier').first()).toBeVisible();
    const description = 'Une résidence de recette, construite pour vérifier le parcours du catalogue de bout en bout : programme, typologie, lots, photos, publication et import.';
    expect((await adminPost(page, request, `/admin/programs/${programId}`, { description }, 'PATCH')).status()).toBe(200);

    // CTL-041 — a typology of the programme (place, standing, promoter and delivery inherited).
    const created = await adminPost(page, request, '/admin/properties', { programId, type: 'APARTMENT', rooms: 3, surfaceM2: 85 });
    expect(created.status()).toBe(201);
    const propertyId = ((await created.json()) as { id: string }).id;
    // CAL-050 — a typed description of at least 300 characters (+8) and the programme's coordinates (+3) bring the
    // typology above the publication threshold (60) once the programme's photos are counted (MOD-236).
    const typed = `${description} Trois pièces lumineuses, une cuisine ouverte sur le séjour, deux chambres au calme côté jardin, une salle d’eau et des rangements intégrés ; une place de stationnement en sous-sol.`;
    expect((await adminPost(page, request, `/admin/properties/${propertyId}`, { description: typed }, 'PATCH')).status()).toBe(200);
    expect((await adminPost(page, request, `/admin/programs/${programId}`, { latitude: 27.87, longitude: -0.29 }, 'PATCH')).status()).toBe(200);

    // CTL-060 — « Ajouter un lot » in the table of the programme.
    await page.goto(`${ADMIN}/catalogue/programmes/${programId}?onglet=lots`);
    await page.getByRole('button', { name: 'Ajouter un lot' }).first().click();
    const add = page.getByRole('dialog');
    await add.getByLabel('Lot', { exact: true }).fill('R-101');
    await add.getByLabel('Prix', { exact: true }).fill('22 350 000');
    await add.getByLabel('Surface', { exact: true }).fill('85');
    await add.getByRole('button', { name: 'Ajouter le lot' }).click();
    await expect(page.getByText('R-101', { exact: true }).first()).toBeVisible({ timeout: 30_000 });

    // CTL-080 — three photos dropped on the programme: progress, processing, then their vignette.
    await page.goto(`${ADMIN}/catalogue/programmes/${programId}?onglet=medias`);
    await page.locator('input[type="file"]').setInputFiles(['property-el-yasmine-1.jpg', 'property-el-yasmine-2.jpg', 'property-el-yasmine-3.jpg'].map((f) => join(IMAGES, f)));
    await expect(page.getByText('Couverture').first()).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('img[src*="/media-files/media/PROGRAM/"]')).toHaveCount(3, { timeout: 120_000 });

    // CYC-125, CYC-120 — publish the programme, then the typology from its completeness card.
    await page.goto(`${ADMIN}/catalogue/programmes/${programId}`);
    await page.getByRole('button', { name: 'Publier' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publier' }).click();
    await expect(page.getByText('Publié').first()).toBeVisible({ timeout: 30_000 });
    await page.goto(`${ADMIN}/catalogue/biens/${propertyId}`);
    await expect(page.getByRole('complementary').getByRole('button', { name: 'Publier' })).toBeEnabled({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Publier' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publier' }).click();
    await expect(page.getByRole('button', { name: 'Voir sur le site' })).toBeVisible({ timeout: 30_000 });
    const property = await apiGet<{ slug: string; publication: string }>(page, `/admin/properties/${propertyId}`);
    expect(property.publication).toBe('PUBLISHED');
    // The public site shows it (revalidated after the commit).
    await expect.poll(async () => (await request.get(`${WEB}/biens/${property.slug}`)).status(), { timeout: 60_000 }).toBe(200);

    // CTL-100 … CTL-102 — import a grid: one lot updated (price), one created, one line in error; dry run, then confirm.
    const csv = join(ROOT, '.local', 'tmp', `recette-${stamp}.csv`);
    mkdirSync(dirname(csv), { recursive: true });
    made.csv = csv;
    writeFileSync(csv, `lot;bien;surface;prix;etage\r\nR-101;;85;23 000 000;1\r\nR-102;${(await apiGet<{ reference: string }>(page, `/admin/properties/${propertyId}`)).reference};86;23.500.000;RDC\r\nR-103;;80;1.500;2\r\n`);
    await page.goto(`${ADMIN}/catalogue/import?programme=${programId}`);
    // The history is fetched once the page is interactive: choosing the file before that would be lost.
    await expect(page.getByText('Aucun import pour l’instant.')).toBeVisible({ timeout: 30_000 });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choisir le fichier' }).click();
    await (await chooser).setFiles(csv);
    await expect(page.getByText('Correspondance des colonnes')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Lancer le contrôle à blanc' }).click();
    await expect(page.getByText('Contrôle à blanc : rien n’a encore été écrit')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Valeur illisible ou hors bornes : « 1.500 ».')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmer l’import' }).click();
    await expect(page.getByText('Import terminé')).toBeVisible({ timeout: 120_000 });
    const lots = await apiGet<{ data: { reference: string; price: string }[] }>(page, `/admin/programs/${programId}/lots`);
    expect(lots.data.map((l) => [l.reference, Number(l.price)]).sort()).toEqual([
      ['R-101', 23000000],
      ['R-102', 23500000],
    ]);

    // MOD-110, CTL-004 — « Suspendre »: the effects announced first, then the records unpublished; the site follows.
    await page.goto(`${ADMIN}/promoteurs/${promoterId}`);
    await page.getByRole('button', { name: 'Autres actions' }).click();
    await page.getByRole('menuitem', { name: 'Suspendre' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('1 programme et 1 bien seront dépubliés.')).toBeVisible({ timeout: 30_000 });
    await dialog.getByLabel('Raison').fill('Recette : suspension de contrôle');
    await dialog.getByRole('button', { name: 'Suspendre' }).click();
    await expect(page.getByText('Suspendu').first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await request.get(`${WEB}/biens/${property.slug}`)).status(), { timeout: 60_000 }).not.toBe(200);

    // CTL-004 « Après une suspension » — reactivate (nothing republished), then « Les republier ».
    await page.getByRole('button', { name: 'Réactiver' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Réactiver' }).click();
    await expect(page.getByText(/fiches ont été dépubliées par la suspension/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Les republier' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Les republier' }).click();
    await expect(page.getByText('2 fiches republiées.')).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await request.get(`${WEB}/biens/${property.slug}`)).status(), { timeout: 60_000 }).toBe(200);

    // Undone by afterEach: the programme (and its typology) archived, the relationship ended.
    expect((await adminPost(page, request, `/admin/programs/${programId}/archive`, {})).status()).toBe(200);
    made.programId = undefined;
  });
});

// Screenshots to LOOK at: CAT_SHOTS=<folder> CAT_URLS="name=/path,name2=/path2" (1440 × 900).
test.describe('shots', () => {
  test.skip(!process.env.CAT_SHOTS, 'set CAT_SHOTS to a folder name');
  test.use({ storageState: existsSync(STATE) ? STATE : undefined, viewport: { width: Number(process.env.CAT_WIDTH ?? 1440), height: 900 } });
  test('pages', async ({ page }) => {
    test.setTimeout(300_000);
    const out = join(process.cwd(), 'shots', process.env.CAT_SHOTS!);
    mkdirSync(out, { recursive: true });
    await signedIn(page);
    for (const pair of (process.env.CAT_URLS ?? '').split(',').filter(Boolean)) {
      const cut = pair.indexOf('=');
      const [name, path] = [pair.slice(0, cut), pair.slice(cut + 1)];
      await page.goto(`${ADMIN}${path}`);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(out, `${name}.png`), fullPage: process.env.CAT_FULL === '1' });
    }
    await page.context().storageState({ path: STATE });
  });
});
