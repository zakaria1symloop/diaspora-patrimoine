// Back office — package 3.3 « Clients », against the real stack (P07, P26):
//   CRM-040 the list shows « Origine »;
//   CAL-070 « son compte » — inviting a record to its space creates the account: the STORED score (the list's) follows;
//   CRM-048, TRV-094, P26 — two people edit the same record: the second sees who and when, « Recharger », « Copier mes
//     changements »;
//   CRM-060 « Ne pas contacter » (reason required), CRM-065 / CYC-061 archive refused with a live dossier, then possible.
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, adminPost, signInDirection } from './helpers/admin.js';

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const letters = (tag: string) => tag.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]!);

async function adminGet<T>(page: Page, path: string): Promise<T> {
  const r = await page.request.get(`${ADMIN}/api/v1${path}`);
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()) as T;
}

async function newClient(page: Page, lastName: string, extra: Record<string, unknown> = {}) {
  const r = await adminPost(page, page.request, '/admin/clients', { firstName: 'Lamia', lastName, email: `${lastName.toLowerCase()}@example.test`, source: 'PHONE', ...extra });
  expect(r.status(), await r.text()).toBe(201);
  return ((await r.json()) as { id: string }).id;
}

test.describe('back office — clients, package 3.3', () => {
  test.skip(({ isMobile }) => isMobile, 'the back office is designed for 1280 px and more (TRV-130)');
  test.beforeEach(async ({ request }) => {
    await request.get(`${ADMIN}/connexion`, { timeout: 60_000 }).catch(() => undefined);
    await expect.poll(async () => (await request.get(`${ADMIN}/api/v1/public/health`).catch(() => null))?.status() ?? 0, { timeout: 120_000, intervals: [1000, 2000, 3000] }).toBe(200);
  });

  test('CRM-040 « Origine » in the list · CAL-070 the stored score follows the account', async ({ page }) => {
    test.setTimeout(150_000);
    await signInDirection(page);
    const name = `Score${letters(unique())}`;
    const id = await newClient(page, name);
    await page.goto(`${ADMIN}/clients?q=${name}`);
    await expect(page.getByRole('columnheader', { name: /^Origine/ })).toBeVisible({ timeout: 30_000 });

    const stored = async () => (await adminGet<{ data: { id: string; score: number | null }[] }>(page, `/admin/clients?q=${name}`)).data.find((c) => c.id === id)?.score ?? null;
    const before = await stored();
    const invited = await adminPost(page, page.request, `/admin/clients/${id}/invite`, {});
    expect(invited.status(), await invited.text()).toBe(200);
    // CAL-070 « Compte créé : 5 » — recomputed when the account event leaves the outbox
    await expect.poll(stored, { timeout: 30_000 }).toBe((before ?? 0) + 5);
  });

  test('CRM-048, TRV-094, P26 — the second save of the same record says who and when', async ({ page }) => {
    test.setTimeout(150_000);
    await signInDirection(page);
    const name = `Conflit${letters(unique())}`;
    const id = await newClient(page, name);
    await page.goto(`${ADMIN}/clients/${id}?onglet=projet`);
    await page.getByRole('button', { name: 'Modifier : Identité' }).click();
    const first = page.getByLabel('Prénom');
    await expect(first).toBeVisible({ timeout: 20_000 });

    // meanwhile, someone saves the same section
    const detail = await adminGet<{ version: number }>(page, `/admin/clients/${id}`);
    const other = await adminPost(page, page.request, `/admin/clients/${id}`, { section: 'identity', version: detail.version, values: { firstName: 'Lamya', lastName: name, birthDate: null, nationalities: [] } }, 'PATCH');
    expect(other.status(), await other.text()).toBe(200);

    await first.fill('Lamiaa');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(/Cette fiche a été modifiée par .+ à \d{2} h \d{2}/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Recharger' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copier mes changements' })).toBeVisible();
  });

  test('CRM-060 « Ne pas contacter » · CRM-065, CYC-061 archive refused with a live dossier, then archived and restored', async ({ page }) => {
    test.setTimeout(150_000);
    await signInDirection(page);
    const name = `Archive${letters(unique())}`;
    const id = await newClient(page, name);

    // CRM-060 — the reason is required
    const noReason = await adminPost(page, page.request, `/admin/clients/${id}/do-not-contact`, { enabled: true, reason: '' });
    expect(noReason.status()).toBe(422);
    expect((await adminPost(page, page.request, `/admin/clients/${id}/do-not-contact`, { enabled: true, reason: 'Ne souhaite plus être appelé' })).status()).toBe(200);
    expect((await adminGet<{ banners: Record<string, unknown> }>(page, `/admin/clients/${id}`)).banners).toBeTruthy();
    expect((await adminPost(page, page.request, `/admin/clients/${id}/do-not-contact`, { enabled: false })).status()).toBe(200);

    // CYC-061 — a live dossier forbids the archive
    const objects = await adminGet<{ data: { type: string; id: string; published: boolean }[] }>(page, '/admin/lead-objects?q=DP');
    const property = objects.data.find((o) => o.type === 'PROPERTY' && o.published)!;
    const lead = await adminPost(page, page.request, '/admin/leads', { source: 'PHONE', kind: 'PROPERTY_INTEREST', propertyId: property.id, clientId: id, consentContact: true, assignedAgentId: null });
    expect(lead.status(), await lead.text()).toBe(201);
    const refused = await adminPost(page, page.request, `/admin/clients/${id}/archive`, { reason: null });
    expect(refused.status()).toBe(409);

    // a record without live dossier archives, then is restored
    const free = await newClient(page, `${name}b`);
    expect((await adminPost(page, page.request, `/admin/clients/${free}/archive`, { reason: 'Projet abandonné' })).status()).toBe(200);
    expect((await adminGet<{ status: string }>(page, `/admin/clients/${free}`)).status).toBe('ARCHIVED');
    expect((await adminPost(page, page.request, `/admin/clients/${free}/unarchive`, {})).status()).toBe(200);
    expect((await adminGet<{ status: string }>(page, `/admin/clients/${free}`)).status).not.toBe('ARCHIVED');
  });
});
