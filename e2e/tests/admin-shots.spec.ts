// Screenshots of the back office, to be LOOKED at (1440 px, and 390 px for the frame on a phone). Not a test of
// behaviour: run on demand with `ADMIN_SHOTS=<folder> npx playwright test tests/admin-shots.spec.ts --project=desktop`.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN, signInDirection } from './helpers/admin.js';

const OUT = process.env.ADMIN_SHOTS ? join(process.cwd(), 'shots', process.env.ADMIN_SHOTS) : null;

test.describe('back office — screenshots', () => {
  test.skip(!OUT, 'set ADMIN_SHOTS to a folder name');
  test.skip(({ isMobile }) => isMobile, 'one run: both widths are taken from the desktop project');

  test('door, frame, team, preferences, requests', async ({ page }) => {
    test.setTimeout(240_000);
    mkdirSync(OUT!, { recursive: true });
    const shot = async (name: string) => {
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(OUT!, `${name}.png`), fullPage: false });
    };
    await page.goto(`${ADMIN}/connexion`);
    await expect(page.getByRole('heading', { name: 'Se connecter' })).toBeVisible();
    await page.waitForTimeout(2600); // the scene draws itself once
    await shot('01-connexion-1440');
    await page.goto(`${ADMIN}/mot-de-passe-oublie`);
    await shot('02-mot-de-passe-oublie-1440');

    await signInDirection(page);
    await page.goto(`${ADMIN}/equipe`);
    await expect(page.getByRole('table')).toBeVisible();
    await shot('03-equipe-1440');
    await page.getByRole('button', { name: 'Inviter' }).click();
    await shot('04-equipe-inviter-1440');
    await page.keyboard.press('Escape');
    await page.getByRole('group').getByRole('button', { name: 'Rôle' }).click();
    await shot('05-equipe-filtre-1440');
    await page.keyboard.press('Escape');

    await page.goto(`${ADMIN}/demandes?view=all`);
    await expect(page.getByRole('heading', { name: 'Demandes', level: 1 })).toBeVisible();
    await page.waitForTimeout(1500);
    await shot('06-demandes-1440');
    const first = page.getByRole('table').getByRole('link').first();
    if (await first.count()) {
      await first.click();
      await expect(page.getByRole('heading', { name: /^Demande DEM-/ })).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1200);
      await shot('07-demande-1440');
      await page.screenshot({ path: join(OUT!, '07b-demande-pleine-1440.png'), fullPage: true });
      await page.evaluate(() => document.querySelector('main')?.scrollTo({ top: 99999 }));
      await shot('07c-demande-chronologie-1440');
    }
    await page.goto(`${ADMIN}/preferences`);
    await shot('08-preferences-profil-1440');
    await page.goto(`${ADMIN}/preferences/securite`);
    await expect(page.getByText('Cet appareil')).toBeVisible();
    await shot('09-preferences-securite-1440');
    await page.goto(`${ADMIN}/notifications`);
    await shot('10-notifications-1440');
    await page.keyboard.press('?');
    await shot('11-aide-1440');
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ADMIN}/demandes?view=all`);
    await page.waitForTimeout(1500);
    await shot('20-demandes-390');
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await shot('21-menu-390');
    await page.goto(`${ADMIN}/equipe`);
    await shot('22-equipe-390');
    await page.goto(`${ADMIN}/preferences/securite`);
    await shot('23-securite-390');
  });
});
