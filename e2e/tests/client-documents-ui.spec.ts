// EC-20 / EC-21 in the browser: « Mes pièces » of the demonstration dossier (plan 2.9), a deposit of two photos joined
// into one document (MED-032), the line passing to « Reçue », the viewer (signed address), the transmission consent.
// Screenshots are written to e2e/shots/client-space/ (desktop 1440 and phone).
import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { freshIp, signUpClient } from './helpers/account';
import { api, demoDossierFor, tinyPng } from './helpers/space-api';

const SHOTS = 'shots/client-space';

test('documents: « Mes pièces », deposit of photos, viewer, consent', async ({ page }, info) => {
  test.setTimeout(240_000);
  mkdirSync(SHOTS, { recursive: true });
  const tag = info.project.name;
  await freshIp(page);
  const { email } = await signUpClient(page);
  demoDossierFor(email);
  const space = await (await api(page, 'GET', '/client/space')).json();
  const reference: string = space.dossiers[0].reference;

  await page.goto(`/espace-client/dossiers/${reference}/pieces`);
  await expect(page.getByText(/Votre dossier est complet à \d+ %/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Votre accord pour transmettre votre dossier' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ec20-pieces-${tag}.png`, fullPage: true });

  // « Toutes »: the demonstration states.
  await page.getByRole('button', { name: 'Toutes' }).click();
  await expect(page.getByText('À refaire').first()).toBeVisible();
  await expect(page.getByText(/Validée · à renouveler avant le/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ec20-pieces-toutes-${tag}.png`, fullPage: true });

  // EC-21 — deposit two photos on the first piece to provide.
  await page.getByRole('button', { name: /^À fournir/ }).click();
  await page.getByRole('button', { name: 'Déposer', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Document à plat, bien éclairé')).toBeVisible();
  await dialog.locator('input[type=file][multiple]').setInputFiles([
    { name: 'page-1.png', mimeType: 'image/png', buffer: tinyPng(400, 560, [230, 230, 240]) },
    { name: 'page-2.png', mimeType: 'image/png', buffer: tinyPng(400, 560, [240, 235, 220]) },
  ]);
  await expect(dialog.getByText('Vos 2 photos seront réunies en un seul document.')).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${SHOTS}/ec21-depot-${tag}.png` });
  await dialog.getByRole('button', { name: 'Envoyer 1 fichier' }).click();
  await expect(dialog.getByText(/Merci. Votre pièce est reçue/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ec21-merci-${tag}.png` });
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('button', { name: 'Toutes' }).click();
  await expect(page.getByText('2 photos réunies en un document')).toBeVisible({ timeout: 20_000 });

  // DOS-005 — the viewer opens the current file through a signed address.
  await page.getByRole('button', { name: 'Voir' }).first().click();
  await expect(page.getByRole('dialog').locator('iframe')).toHaveAttribute('src', /\/api\/v1\/files\/private\/doc\./);
  await page.screenshot({ path: `${SHOTS}/ec20-visionneuse-${tag}.png` });
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();

  // DOS-040 — the consent.
  await page.getByLabel('J’accepte la transmission de mon dossier à ces partenaires.').check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText(/Accord de transmission donné le/)).toBeVisible();
});
