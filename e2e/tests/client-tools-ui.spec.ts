// EC-40, EC-41, EC-42, CAT-093, SIM-033 in the browser, signed in. Screenshots in e2e/shots/client-space/.
import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { freshIp, signUpClient } from './helpers/account';
import { api, idem } from './helpers/space-api';

const SHOTS = 'shots/client-space';

test('client tools: simulations, favourites, saved search and alerts, simulator prefill', async ({ page }, info) => {
  test.setTimeout(240_000);
  mkdirSync(SHOTS, { recursive: true });
  const tag = info.project.name;
  await freshIp(page);
  await signUpClient(page);

  // EC-40 — empty, then one saved eligibility simulation and one credit simulation.
  await page.goto('/espace-client/simulations');
  await expect(page.getByText('Vous n’avez pas encore de simulation enregistrée.')).toBeVisible();
  const elig = await api(
    page,
    'POST',
    '/public/simulations/eligibility',
    { propertyCountry: 'DZ', residencyStatus: 'NON_RESIDENT', countryOfResidence: 'FR', birthYear: 1984, monthlyIncome: '3400', incomeCurrency: 'EUR', monthlyDebts: '150', downPayment: '30000', financingPreference: 'NO_PREFERENCE' },
    idem(),
  );
  const { id: simId } = await elig.json();
  await api(page, 'POST', `/public/simulations/${simId}/save`, {});
  await api(page, 'POST', `/client/simulations/${simId}/profile`, {});
  await api(
    page,
    'POST',
    '/public/simulations',
    { isSaved: true, activeIndex: 0, scenarios: [{ mode: 'FROM_AMOUNT', amount: '120000', currency: 'EUR', durationMonths: 240, annualRateBps: 650, pricingMethod: 'AMORTIZED_RATE' }] },
    idem(),
  );
  await page.reload();
  await expect(page.getByText(/894,69/)).toBeVisible();
  await page.getByRole('button', { name: 'Ouvrir' }).last().click();
  await expect(page.getByText(/avec les barèmes et les taux de ce jour-là/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ec40-simulations-${tag}.png`, fullPage: true });
  // D-099 — the result opens in a panel (full screen on a phone): close it to come back to the list.
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('button', { name: 'Renommer' }).first().click();
  await page.getByLabel('Nom de la simulation').fill('Mon T3 à Oran');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name: 'Mon T3 à Oran' })).toBeVisible();

  // SIM-033 — the eligibility simulator prefilled from the profile, with the unchecked box at the end.
  await page.goto('/financements/simulateur-eligibilite');
  await expect(page.getByText('Nous avons repris les informations de votre profil.', { exact: false })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/sim033-prefill-${tag}.png` });

  // EC-41 — the heart on a card uses the account.
  await page.goto('/programmes');
  const heart = page.getByRole('button', { name: /^Ajouter .* à mes favoris$/ }).first();
  await heart.click();
  await expect(page.getByText('Ajouté à vos favoris')).toBeVisible();
  await page.goto('/espace-client/favoris');
  await expect(page.getByText(/Ajouté le/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ec41-favoris-${tag}.png`, fullPage: true });

  // CAT-093 — « Enregistrer cette recherche » signed in: saved at once.
  await page.goto('/programmes?region=oran&enregistrer=1');
  await expect(page.getByRole('dialog').getByText('Recherche enregistrée')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/cat093-enregistree-${tag}.png` });

  // EC-42 — an alert (active at once) and the saved search.
  await api(page, 'POST', '/client/alerts', { frequency: 'DAILY', criteria: { region: 'alger', type: 'APARTMENT' } }, idem());
  await page.goto('/espace-client/alertes');
  await expect(page.getByRole('heading', { name: 'Mes recherches enregistrées' })).toBeVisible();
  await expect(page.getByText(/Active jusqu’au/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ec42-alertes-${tag}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Mettre en pause' }).click();
  await expect(page.getByText(/En pause depuis le/)).toBeVisible();

  // SFA-031 « Modifier les critères » → the catalogue with the banner « Mettre à jour l'alerte ».
  await page.getByRole('link', { name: 'Modifier les critères' }).first().click();
  await expect(page.getByRole('button', { name: 'Mettre à jour l’alerte' })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/sfa031-modifier-${tag}.png` });
  await page.getByRole('button', { name: 'Mettre à jour l’alerte' }).click();
  await expect(page.getByText('Critères mis à jour.')).toBeVisible();
});
