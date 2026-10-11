// Screenshots of packages 3.2 and 3.3 to look at (1440 px; 390 px for the forms and the records): requests, a request,
// the entry form, the clients, a client record (overview, project), the e-mail window, « Mes préférences » Signature and
// Absence, the team. Run on demand: `CRM_SHOTS=<folder> npx playwright test tests/admin-crm-shots.spec.ts --project=desktop`.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, adminPost, signInDirection } from './helpers/admin.js';

const OUT = process.env.CRM_SHOTS;

test.describe('back office — CRM screenshots', () => {
  test.skip(!OUT, 'set CRM_SHOTS to a folder to take the screenshots');
  test.skip(({ isMobile }) => isMobile, 'taken on the desktop project, both widths');

  test('requests and clients at 1440 and 390', async ({ page }) => {
    test.setTimeout(300_000);
    mkdirSync(OUT!, { recursive: true });
    await expect.poll(async () => (await page.request.get(`${ADMIN}/api/v1/public/health`).catch(() => null))?.status() ?? 0, { timeout: 120_000 }).toBe(200);
    await signInDirection(page);
    const tag = Date.now().toString(36).replace(/\d/g, (d) => 'abcdefghij'[Number(d)]!);
    const r = await adminPost(page, page.request, '/admin/leads', {
      source: 'PHONE',
      kind: 'CALLBACK_REQUEST',
      client: { firstName: 'Karima', lastName: `Benali${tag}`, email: `karima-${tag}@example.test`, phone: `+3361${String(Date.now()).slice(-7)}`, whatsappOptIn: true, countryOfResidence: 'FR' },
      consentContact: true,
      message: 'Souhaite être rappelée pour un trois-pièces à Oran, budget autour de 150 000 €.',
      assignedAgentId: null,
    });
    expect(r.status(), await r.text()).toBe(201);
    const lead = (await r.json()) as { reference: string; clientId: string };

    const shot = async (name: string, path: string, wait: (p: Page) => Promise<void>) => {
      for (const width of [1440, 390]) {
        if (width === 390 && !/nouvelle|nouveau|demande-|client-/.test(name)) continue;
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.goto(`${ADMIN}${path}`);
        await wait(page);
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(OUT!, `${name}-${width}.png`), fullPage: true });
      }
    };
    await shot('demandes', '/demandes?view=all', (p) => expect(p.getByRole('row').nth(2)).toBeVisible({ timeout: 30_000 }));
    await shot('demande-record', `/demandes/${lead.reference.toLowerCase()}`, (p) => expect(p.getByRole('button', { name: 'Prendre en charge' })).toBeVisible({ timeout: 30_000 }));
    await shot('demande-nouvelle', '/demandes/nouvelle', (p) => expect(p.getByRole('heading', { name: 'Saisir une demande' })).toBeVisible({ timeout: 30_000 }));
    await shot('clients', '/clients?view=all', (p) => expect(p.getByRole('row').nth(2)).toBeVisible({ timeout: 30_000 }));
    await shot('client-nouveau', '/clients/nouveau', (p) => expect(p.getByRole('heading', { name: 'Créer un client' })).toBeVisible({ timeout: 30_000 }));
    await shot('client-record', `/clients/${lead.clientId}`, (p) => expect(p.getByText('Informations clés')).toBeVisible({ timeout: 30_000 }));
    await shot('client-projet', `/clients/${lead.clientId}?onglet=projet`, (p) => expect(p.getByText('Mon projet')).toBeVisible({ timeout: 30_000 }));
    await shot('preferences-signature', '/preferences/signature', (p) => expect(p.getByText('Ce que le client lira')).toBeVisible({ timeout: 30_000 }));
    await shot('preferences-absence', '/preferences/absence', (p) => expect(p.getByText('Pendant votre absence')).toBeVisible({ timeout: 30_000 }));
    await shot('equipe', '/equipe', (p) => expect(p.getByRole('row').nth(1)).toBeVisible({ timeout: 30_000 }));

    // the windows: call and e-mail, at 1440
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${ADMIN}/demandes/${lead.reference.toLowerCase()}`);
    await page.getByRole('group', { name: 'Ajout rapide' }).getByRole('button', { name: 'Appel', exact: true }).click();
    await page.getByRole('dialog', { name: 'Noter un appel' }).getByRole('button', { name: /^Joint/ }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT!, 'fenetre-appel-1440.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('group', { name: 'Ajout rapide' }).getByRole('button', { name: 'E-mail', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Écrire un e-mail' }).locator('iframe')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT!, 'fenetre-email-1440.png') });
  });
});
