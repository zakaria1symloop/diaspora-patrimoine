// Screenshots of the dossiers of the back office (EA-21, EA-22, PIP-015), to be LOOKED at with real data (1440 px).
// Not a test of behaviour: `DOSSIER_SHOTS=<folder> npx playwright test tests/admin-dossiers-shots.spec.ts --project=desktop`.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN, signInDirection } from './helpers/admin.js';

const OUT = process.env.DOSSIER_SHOTS ? join(process.cwd(), 'shots', process.env.DOSSIER_SHOTS) : null;
const REF = process.env.DOSSIER_REF ?? null;

test.describe('dossiers — screenshots', () => {
  test.skip(!OUT, 'set DOSSIER_SHOTS to a folder name');
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('list, creation, record and its tabs', async ({ page }) => {
    test.setTimeout(300_000);
    mkdirSync(OUT!, { recursive: true });
    const shot = async (name: string, full = false) => {
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(OUT!, `${name}.png`), fullPage: full });
    };
    await signInDirection(page);
    await page.goto(`${ADMIN}/dossiers?view=all`);
    await expect(page.getByRole('heading', { name: 'Tous les dossiers', level: 1 })).toBeVisible();
    await shot('01-liste');
    await page.goto(`${ADMIN}/dossiers/nouveau`);
    await shot('02-creation');
    const href = REF ? `/dossiers/${REF.toLowerCase()}` : await page.goto(`${ADMIN}/dossiers?view=all`).then(() => page.locator('table a[href^="/dossiers/dos-"]').first().getAttribute('href'));
    for (const tab of ['', '?onglet=biens', '?onglet=echanges', '?onglet=taches', '?onglet=historique']) {
      await page.goto(`${ADMIN}${href}${tab}`);
      await shot(`03-fiche${tab.replace('?onglet=', '-') || '-apercu'}`, true);
    }
    // EA-30 — tasks, the detail on the right, the window
    await page.goto(`${ADMIN}/taches?view=team`);
    await expect(page.getByRole('heading', { name: 'Tâches', level: 1 })).toBeVisible();
    await shot('04-taches');
    const firstTask = page.locator('[data-task] button').nth(1);
    if (await firstTask.count()) {
      await firstTask.click();
      await shot('04-taches-detail');
    }
    await page.goto(`${ADMIN}/taches?nouvelle=1`);
    await shot('04-taches-nouvelle');
    // EA-31 — agenda: week, month, list, window, an appointment opened
    await page.goto(`${ADMIN}/agenda`);
    await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();
    await shot('05-agenda-semaine');
    const event = page.locator('button[class*="__event"]').first();
    if (await event.count()) {
      await event.click();
      await shot('05-agenda-semaine-rdv');
    }
    await page.goto(`${ADMIN}/agenda?vue=mois`);
    await shot('05-agenda-mois');
    await page.goto(`${ADMIN}/agenda?vue=liste`);
    await shot('05-agenda-liste');
    const row = page.locator('ul li button').filter({ hasText: /h/ }).first();
    if (await row.count()) {
      await row.click();
      await shot('05-agenda-rdv');
    }
    await page.goto(`${ADMIN}/agenda?nouveau=1`);
    await shot('05-agenda-nouveau');
  });
});
