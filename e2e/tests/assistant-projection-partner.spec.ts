// EP-22 (ASS-001…ASS-031), EP-20 (DEM-013), EP-23 (DEM-019) against the local stack (web :3000, API :4000, embedded
// PostgreSQL, catalogue as installed). Each test sends from its own forwarded address: DEM-032 limits requests per IP.
import { expect, test, type Page } from '@playwright/test';

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const randomIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': randomIp() });
});

const continueButton = (page: Page) => page.getByRole('button', { name: 'Continuer' });
/** The choices of the question on screen (a fieldset named by its question). */
const regionChoices = (page: Page) => page.getByRole('group', { name: /Où souhaitez-vous acheter/ }).getByRole('checkbox');

/** Answers the questions with the first offered choice of each (or its neutral way out when none is offered). */
async function answerAll(page: Page) {
  await expect(page.getByText('Question 1 sur 5')).toBeVisible();
  await regionChoices(page).first().check();
  await continueButton(page).click();
  await expect(page).toHaveURL(/q=2$/);
  await page.getByRole('checkbox', { name: 'Appartement' }).check();
  await continueButton(page).click();
  await expect(page).toHaveURL(/q=2bis$/);
  await expect(page.getByText('Combien de pièces ?')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Peu importe' }).check();
  await continueButton(page).click();
  await expect(page).toHaveURL(/q=3$/);
  await page.getByRole('radio', { name: 'Je ne sais pas encore' }).check();
  await continueButton(page).click();
  await expect(page).toHaveURL(/q=4$/);
  await page.getByRole('radio', { name: 'Peu importe' }).check();
  await continueButton(page).click();
  await expect(page).toHaveURL(/q=5$/);
  await page.getByRole('radio', { name: 'Loger ma famille' }).check();
  await continueButton(page).click();
  await expect(page).toHaveURL(/q=precision$/);
  await page.getByLabel(/Votre précision/).fill('Proche d’une école, si possible.');
  await page.getByRole('button', { name: 'Voir les biens' }).click();
  await expect(page).toHaveURL(/q=resultats$/);
}

test('assistant: a neutral way out is required to go on, « Retour » keeps the answer, the browser Back too', async ({ page }) => {
  await page.goto('/assistant');
  await expect(page.getByRole('heading', { level: 1, name: 'Assistant de recherche' })).toBeVisible();
  await expect(page.getByText('Bonjour. Cinq questions, et je vous montre les biens qui vous correspondent.')).toBeVisible();
  await continueButton(page).click();
  await expect(page.getByText('Choisissez une réponse pour continuer.')).toBeVisible();

  // « Peu importe » excludes the other choices (ASS-003)
  const first = regionChoices(page).first();
  await first.check();
  await page.getByRole('checkbox', { name: 'Peu importe' }).check();
  await expect(first).not.toBeChecked();
  await first.check();
  await expect(page.getByRole('checkbox', { name: 'Peu importe' })).not.toBeChecked();
  await continueButton(page).click();
  await expect(page).toHaveURL(/q=2$/);
  await expect(page.getByText('Question 2 sur 5')).toBeVisible();

  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page).toHaveURL(/q=1$/);
  await expect(first).toBeChecked();
  await continueButton(page).click();
  await expect(page).toHaveURL(/q=2$/);
  await page.goBack();
  await expect(page).toHaveURL(/q=1$/);
});

test('assistant: answers survive leaving the page (ASS-004), « Recommencer » clears them', async ({ page }) => {
  await page.goto('/assistant');
  await regionChoices(page).first().check();
  await continueButton(page).click();
  await page.getByRole('checkbox', { name: 'Appartement' }).check();
  await continueButton(page).click();
  await expect(page).toHaveURL(/q=2bis$/);

  await page.goto('/');
  await page.goto('/assistant');
  await expect(page).toHaveURL(/q=2bis$/);
  await expect(page.getByText('Combien de pièces ?')).toBeVisible();
  // a link to a later question resumes at the first open one
  await page.goto('/assistant?q=5');
  await expect(page).toHaveURL(/q=2bis$/);

  await page.getByRole('button', { name: 'Recommencer' }).click();
  await expect(page).toHaveURL(/q=1$/);
  await expect(page.getByRole('group', { name: /Où souhaitez-vous acheter/ }).locator('input:checked')).toHaveCount(0);
});

test('assistant: results, then « Recevoir ces biens et être accompagné » sends a GUIDED_SEARCH request', async ({ page }) => {
  await page.goto('/assistant');
  await answerAll(page);
  await expect(page.getByText(/Voici \d+ biens? qu/).or(page.getByText('Aucun bien ne correspond exactement. Voici les plus proches.'))).toBeVisible({ timeout: 15_000 });
  const cards = page.getByRole('list', { name: 'Biens proposés par l’assistant' }).getByRole('listitem');
  expect(await cards.count()).toBeGreaterThan(0);
  expect(await cards.count()).toBeLessThanOrEqual(6);
  await expect(page.getByRole('link', { name: 'Voir tous les résultats' })).toHaveAttribute('href', /\/programmes\?.*type=apartment/);
  // the free text is part of the thread
  await expect(page.getByText('Proche d’une école, si possible.')).toBeVisible();

  await page.getByRole('button', { name: 'Recevoir ces biens et être accompagné' }).click();
  await page.getByRole('button', { name: 'Recevoir ces biens' }).click();
  await expect(page.getByRole('textbox', { name: 'Prénom' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Prénom' }).fill('Test');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(`assistant-${unique()}@example.test`);
  await page.getByLabel(/J’accepte que Diaspora Patrimoine me contacte/).check();
  await page.getByRole('button', { name: 'Recevoir ces biens' }).click();
  await expect(page.getByText('Merci Test, votre demande est enregistrée.')).toBeVisible({ timeout: 15_000 });
  // no phone given: the advisor answers by e-mail (DEM-023)
  await expect(page.getByText(/Un conseiller vous répond par e-mail/)).toBeVisible();
});

test('projection page: first screen creates the request, the second completes it, then the confirmation', async ({ page }) => {
  await page.goto('/projection');
  await expect(page.getByRole('heading', { level: 1, name: 'Recevez votre projection' })).toBeVisible();
  await page.getByLabel('Votre apport').fill('30 000');
  await page.getByLabel('Mensualité confortable').fill('800');
  await page.getByLabel('Votre e-mail').fill(`projection-${unique()}@example.test`);
  await page.getByLabel(/J’accepte que Diaspora Patrimoine me contacte/).check();
  await page.getByRole('button', { name: 'Recevoir ma projection' }).click();
  await expect(page.getByText(/C’est noté\. Votre projection arrive/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('textbox', { name: 'Prénom' }).fill('Test');
  await page.getByLabel('Nom', { exact: true }).fill('Projection');
  await page.getByRole('button', { name: 'Compléter ma demande' }).click();
  await expect(page.getByText('Merci Test, votre demande est enregistrée.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Votre projection arrive/)).toBeVisible();
});

test('partner page: promoters and banks are sent to their door; the request ends on the review delay', async ({ page }) => {
  await page.goto('/devenir-partenaire');
  await expect(page.getByRole('heading', { level: 1, name: 'Devenir partenaire' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Créez votre espace partenaire' })).toHaveAttribute('href', '/partenaires/inscription');

  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(page.getByLabel('Société')).toBeFocused();

  await page.getByLabel('Société').fill('Étude Test');
  await page.getByLabel('Vous êtes').selectOption('NOTARY');
  await page.getByRole('textbox', { name: 'Prénom' }).fill('Test');
  await page.getByLabel('Nom', { exact: true }).fill('Partenaire');
  await page.getByLabel('E-mail professionnel').fill(`partner-${unique()}@example.test`);
  await page.getByRole('textbox', { name: /Téléphone/ }).fill('6 12 34 56 78');
  await page.getByLabel('Pays', { exact: true }).selectOption('FR');
  await page.getByLabel(/Site web/).fill('not a site');
  await page.getByLabel('Votre message').fill('Nous accompagnons des acquéreurs de la diaspora pour leurs actes.');
  await page.getByLabel(/J’accepte que Diaspora Patrimoine me contacte/).check();
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(page.getByText(/Saisissez l’adresse complète du site/)).toBeVisible();

  // a site typed without its scheme is completed
  await page.getByLabel(/Site web/).fill('www.etude-test.fr');
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(page.getByText('Merci Test, votre demande est enregistrée.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Nous revenons vers vous sous \d+ jours? ouvrés?\./)).toBeVisible();
});
