// Leftovers of packages 3.4 to 3.6, against the real stack:
//   FIC-055, DEM-018 « Signaler une erreur sur cette fiche » from a public page → R_LISTING_ERROR, a task for the team;
//   CTL-006 « Écrire au promoteur » — to one of his contacts, a second in copy, with his template (P_PROMOTER_STOCK_CHECK),
//     found in `.local/mail` with its `Cc:`;
//   CYC-123, CAL-080, AUT-074, AUT-078 — the scheduled task `catalogue.nightly` runs (by hand, AUT-082);
//   TRV-052 « Régénérer l'adresse » — the old address of a renamed programme answers with the new one (NAV-040);
//   FIC-120 « Aperçu » — a programme that is not online opens by its signed link, marked as a preview, with its band;
//   CTL-060 — a programme saved « Livré » proposes to carry the date over to its lots.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { freshIp } from './helpers/account.js';
import { ADMIN, adminPost, signInDirection } from './helpers/admin.js';

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const letters = (tag: string) => tag.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]!);
const MAIL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.local', 'mail');

async function adminGet<T>(page: Page, path: string): Promise<T> {
  const r = await page.request.get(`${ADMIN}/api/v1${path}`);
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()) as T;
}

test.describe('catalogue — leftovers of packages 3.4 to 3.6', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop journeys');
  test.beforeEach(async ({ request }) => {
    await request.get(`${ADMIN}/connexion`, { timeout: 60_000 }).catch(() => undefined);
    await expect.poll(async () => (await request.get(`${ADMIN}/api/v1/public/health`).catch(() => null))?.status() ?? 0, { timeout: 120_000, intervals: [1000, 2000, 3000] }).toBe(200);
  });

  test('FIC-055, DEM-018 — « Signaler une erreur sur cette fiche » gives the team a task (R_LISTING_ERROR)', async ({ page, browser }) => {
    test.setTimeout(180_000);
    await signInDirection(page);
    const objects = await adminGet<{ data: { type: string; id: string; published: boolean; reference: string | null }[] }>(page, '/admin/lead-objects?q=DP');
    const property = objects.data.find((o) => o.type === 'PROPERTY' && o.published)!;
    const detail = await adminGet<{ slug?: string; publicPath?: string | null }>(page, `/admin/properties/${property.id}`);
    const path = detail.publicPath ?? (detail.slug ? `/biens/${detail.slug}` : null);
    test.skip(!path, 'the property has no public address');

    const visitor = await browser.newPage();
    await freshIp(visitor);
    await visitor.goto(path!);
    await visitor.getByRole('button', { name: 'Signaler une erreur sur cette fiche' }).click();
    const win = visitor.getByRole('dialog', { name: 'Signaler une erreur sur cette fiche' });
    await win.getByRole('button', { name: 'Envoyer' }).click();
    await expect(win.getByText(/Choisissez|obligatoire|Indiquez/).first()).toBeVisible();
    const tag = letters(unique());
    await win.getByLabel('Qu’est-ce qui est inexact ?').selectOption('PRICE');
    await win.getByLabel('Précisez').fill(`Le prix affiché ne correspond plus (${tag}).`);
    await win.getByRole('button', { name: 'Envoyer' }).click();
    await expect(win.getByText('Merci. Nous vérifions cette fiche.')).toBeVisible({ timeout: 20_000 });
    await visitor.close();

    // R_LISTING_ERROR — « Vérifier la fiche {bien} : erreur signalée », for the team
    await expect
      .poll(async () => (await adminGet<{ data: { title: string; description?: string | null }[] }>(page, `/admin/tasks?view=team&q=${encodeURIComponent('erreur signalée')}&pageSize=50`)).data.some((x) => x.title.startsWith('Vérifier la fiche')), { timeout: 30_000 })
      .toBe(true);
  });

  test('CTL-006 — « Écrire au promoteur »: one contact, another in copy, his template', async ({ page }) => {
    test.setTimeout(180_000);
    await signInDirection(page);
    const tag = letters(unique());
    const created = await adminPost(page, page.request, '/admin/promoters', { legalName: `Promoteur ${tag}`, brandName: null, countryCode: 'DZ' });
    expect(created.status(), await created.text()).toBe(201);
    const { id } = (await created.json()) as { id: string };
    for (const [name, primary] of [['Amel Contact', true], ['Karim Copie', false]] as const) {
      const c = await adminPost(page, page.request, `/admin/promoters/${id}/contacts`, { fullName: `${name} ${tag}`, email: `${name.split(' ')[0]!.toLowerCase()}-${tag}@example.test`, isPrimary: primary });
      expect(c.status(), await c.text()).toBeLessThan(300);
    }
    const since = Date.now();
    await page.goto(`${ADMIN}/promoteurs/${id}`);
    await page.getByRole('button', { name: 'Écrire au promoteur' }).click();
    const win = page.getByRole('dialog', { name: 'Écrire un e-mail' });
    await expect(win.getByLabel('Contact')).toBeVisible({ timeout: 20_000 });
    await win.getByLabel('En copie').selectOption({ label: `Karim Copie ${tag} · karim-${tag}@example.test` });
    await win.getByLabel('Modèle').selectOption({ label: 'Vérification des disponibilités' });
    await expect(win.getByLabel('Objet')).toHaveValue(/^Vos disponibilités sont-elles à jour\s?\?$/); // TRV-010: a narrow space before « ? »
    await win.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByText('E-mail envoyé.')).toBeVisible({ timeout: 20_000 });

    // the .eml: to the main contact, the other in copy (outside a sandbox; in a sandbox the subject names them)
    await expect
      .poll(() => readdirSync(MAIL).map((f) => join(MAIL, f)).filter((f) => statSync(f).mtimeMs >= since - 2000).some((f) => {
        const raw = readFileSync(f, 'utf8');
        return raw.includes(`amel-${tag}@example.test`) && raw.includes(`karim-${tag}@example.test`);
      }), { timeout: 20_000 })
      .toBe(true);
  });

  test('CYC-123, CAL-080, AUT-074, AUT-078 — `catalogue.nightly` runs', async ({ page }) => {
    test.setTimeout(240_000);
    await signInDirection(page);
    const r = await adminPost(page, page.request, '/admin/diagnostics/run-job', { job: 'catalogue.nightly' });
    expect(r.status(), await r.text()).toBe(200);
    const body = (await r.json()) as { ran: boolean; counters: Record<string, number> | null };
    expect(body.ran).toBe(true);
    expect(Object.keys(body.counters ?? {}).sort()).toEqual(['archived', 'overdue', 'relevance', 'soldOut']);
  });
  /** A draft programme of a new promoter, with one property and one lot (the catalogue's reference data). */
  async function draftProgram(page: Page, tag: string) {
    const ref = await adminGet<{ regions: { id: string; countryCode: string }[] }>(page, '/admin/catalogue/reference');
    const region = ref.regions.find((r) => r.countryCode === 'DZ')!;
    const promoter = await adminPost(page, page.request, '/admin/promoters', { legalName: `Promoteur ${tag}`, brandName: null, countryCode: 'DZ' });
    const { id: promoterId } = (await promoter.json()) as { id: string };
    const created = await adminPost(page, page.request, '/admin/programs', { promoterId, name: `Résidence ${tag}`, standing: 'STANDING', countryCode: 'DZ', regionId: region.id, cityId: null, deliveryStatus: 'ON_PLAN', deliveryDate: `${new Date().getFullYear() + 2}-01-01`, deliveryDatePrecision: 'QUARTER' });
    expect(created.status(), await created.text()).toBe(201);
    return ((await created.json()) as { id: string }).id;
  }

  test('TRV-052, NAV-040 — « Régénérer l’adresse »: the old address of a renamed programme redirects to the new one', async ({ page }) => {
    test.setTimeout(150_000);
    await signInDirection(page);
    const tag = letters(unique());
    const id = await draftProgram(page, tag);
    const before = await adminGet<{ slug: string; version: number }>(page, `/admin/programs/${id}`);
    const renamed = await adminPost(page, page.request, `/admin/programs/${id}`, { name: `Les Jardins ${tag}`, version: before.version }, 'PATCH');
    expect(renamed.status(), await renamed.text()).toBe(200);
    expect((await adminGet<{ slug: string }>(page, `/admin/programs/${id}`)).slug, 'a change of name keeps the address (TRV-052)').toBe(before.slug);
    const regen = await adminPost(page, page.request, `/admin/programs/${id}/regenerate-slug`, {});
    expect(regen.status(), await regen.text()).toBe(200);
    const after = (await regen.json()) as { slug: string };
    expect(after.slug).not.toBe(before.slug);
    expect(after.slug).toContain('jardins');
    const old = await page.request.get(`${ADMIN}/api/v1/public/programs/${before.slug}`);
    expect(await old.json()).toEqual({ redirect: `/programmes/${after.slug}` });
  });

  test('FIC-120 — « Aperçu »: a programme that is not online opens by its signed link, with its band; not without', async ({ page, browser }) => {
    test.setTimeout(150_000);
    await signInDirection(page);
    const tag = letters(unique());
    const id = await draftProgram(page, tag);
    const { slug } = await adminGet<{ slug: string }>(page, `/admin/programs/${id}`);
    expect((await page.request.get(`${ADMIN}/api/v1/public/programs/${slug}`)).status(), 'a draft is not online').toBe(404);
    const link = await adminPost(page, page.request, `/admin/programs/${id}/preview-link`, {});
    expect(link.status(), await link.text()).toBe(200);
    const { url } = (await link.json()) as { url: string };
    const token = new URL(url).searchParams.get('apercu')!;
    const detail = await page.request.get(`${ADMIN}/api/v1/public/programs/${slug}?apercu=${token}`);
    expect(detail.status()).toBe(200);
    expect(((await detail.json()) as { isPreview: boolean }).isPreview).toBe(true);
    expect(detail.headers()['cache-control']).toContain('no-store');
    const visitor = await browser.newPage();
    await visitor.goto(`/programmes/${slug}?apercu=${token}`);
    await expect(visitor.getByText('Aperçu : cette fiche n’est pas en ligne.')).toBeVisible({ timeout: 30_000 });
    await visitor.close();
  });

  test('CTL-060 — a programme saved « Livré » proposes to carry the date over to its lots (none: nothing proposed)', async ({ page }) => {
    test.setTimeout(150_000);
    await signInDirection(page);
    const tag = letters(unique());
    const id = await draftProgram(page, tag);
    await page.goto(`${ADMIN}/catalogue/programmes/${id}`);
    await page.getByRole('button', { name: 'Modifier la section Livraison' }).click();
    await page.getByLabel('Statut', { exact: true }).selectOption('DELIVERED');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    // the programme has no lot: the proposal does not open (CTL-060 — there is nothing to carry over)
    await expect(page.getByRole('dialog', { name: 'Reporter la date de livraison sur les lots ?' })).toHaveCount(0, { timeout: 5_000 });
    await expect.poll(async () => (await adminGet<{ deliveryStatus: string }>(page, `/admin/programs/${id}`)).deliveryStatus, { timeout: 15_000 }).toBe('DELIVERED');
  });
});
