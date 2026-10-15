// Leftovers of packages 3.4 to 3.6, against the real stack:
//   FIC-055, DEM-018 « Signaler une erreur sur cette fiche » from a public page → R_LISTING_ERROR, a task for the team;
//   CTL-006 « Écrire au promoteur » — to one of his contacts, a second in copy, with his template (P_PROMOTER_STOCK_CHECK),
//     found in `.local/mail` with its `Cc:`;
//   CYC-123, CAL-080, AUT-074, AUT-078 — the scheduled task `catalogue.nightly` runs (by hand, AUT-082).
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
});
