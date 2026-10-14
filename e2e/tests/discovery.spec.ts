// CAT-090 … CAT-092, SFA-020 … SFA-024, CAT-070 … CAT-072, SFA-035, PRO-031 — map and grouped views, comparator,
// favourites without account, alert creation and the pages with a token. Runs against the local stack and its demo
// catalogue (PAR-082); the e-mails land as .eml files in .local/mail.
import { expect, test } from '@playwright/test';

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

test('comparator: « Comparer » on two cards fills the tray, then the page shows one column per property', async ({ page, isMobile }) => {
  await page.goto('/programmes');
  await page.evaluate(() => localStorage.removeItem('dp_compare'));
  await page.reload();
  const boxes = page.getByRole('checkbox', { name: /^Comparer / });
  // The visible box is the label around the (visually hidden) checkbox.
  await boxes.nth(0).locator('xpath=..').click();
  await boxes.nth(1).locator('xpath=..').click();
  await expect(boxes.nth(1)).toBeChecked();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dp_compare') ?? '[]') as string[]);
  expect(stored).toHaveLength(2);
  // D-095: the tray on a computer, a pill on a phone — both lead to the comparator.
  await page.getByRole('link', { name: 'Comparer (2)' }).first().click();
  await expect(page).toHaveURL(/\/comparer\?biens=/);
  await expect(page.getByRole('heading', { level: 1, name: 'Comparer les biens' })).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(isMobile ? 4 : 4); // criterion + 2 columns + « Ajouter un bien »
  await page.getByText('Afficher seulement les différences').click();
  await expect(page.getByRole('rowheader', { name: 'Standing' })).toBeVisible();
  // « Retirer » takes the property out of the address and of the browser set.
  await page.getByRole('button', { name: /^Retirer .* de la comparaison$/ }).first().click();
  await expect(page).toHaveURL(/\/comparer\?biens=[A-Z0-9-]+$/);
  await expect(page.getByText('Ajoutez un deuxième bien pour voir les différences.')).toBeVisible();
});

test('comparator: an unknown reference is left out with its line', async ({ page }) => {
  await page.goto('/programmes');
  const ref = await page.locator('[id^="bien-"]').first().getAttribute('id');
  await page.goto(`/comparer?biens=${ref!.replace('bien-', '')},DP-DZ-9999`);
  await expect(page.getByText('Un bien de cette comparaison n’est plus proposé.')).toBeVisible();
});

test('favourites (SFA-020, D-103): without a session the heart asks to sign in and adds nothing', async ({ page }) => {
  await page.goto('/programmes');
  await page.evaluate(() => localStorage.removeItem('dp_favorites'));
  await page.reload();
  const heart = page.getByRole('button', { name: /^Ajouter .* à mes favoris$/ }).first();
  const reference = (await page.locator('[id^="bien-"]').first().getAttribute('id'))!.replace('bien-', '');
  await heart.click();
  const dialog = page.getByRole('dialog', { name: 'Gardez ce bien dans vos favoris' });
  await expect(dialog).toBeVisible();
  // The card's link was not followed, nothing was kept without an account.
  await expect(page).toHaveURL(/\/programmes$/);
  expect(await page.evaluate(() => localStorage.getItem('dp_favorites'))).toBeNull();
  // Sign-in and sign-up come back to this page; the property waits for the session (lib/after-sign-in.ts).
  await expect(dialog.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/connexion?suite=%2Fprogrammes');
  await expect(dialog.getByRole('link', { name: 'Créer mon espace' })).toHaveAttribute('href', '/inscription?suite=%2Fprogrammes');
  expect(await page.evaluate(() => localStorage.getItem('dp_favorite_pending'))).toBe(reference);
  await dialog.getByRole('button', { name: 'Plus tard' }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('dp_favorite_pending'))).toBeNull();
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
});

test('favourites (SFA-022, SFA-024): what a browser kept from before still shows on /favoris and can be removed', async ({ page }) => {
  await page.goto('/programmes');
  const heart = page.getByRole('button', { name: /^Ajouter .* à mes favoris$/ }).first();
  const label = (await heart.getAttribute('aria-label'))!;
  const title = label.replace(/^Ajouter /, '').replace(/ à mes favoris$/, '');
  const reference = (await page.locator('[id^="bien-"]').first().getAttribute('id'))!.replace('bien-', '');
  await page.evaluate((ref) => localStorage.setItem('dp_favorites', JSON.stringify([{ ref, at: Date.now() }])), reference);
  await page.goto('/favoris');
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible();
  await expect(page.getByText(/^Ajouté le /)).toBeVisible();
  // Removing it from the page leads to the empty state (SFA-024).
  await page.getByRole('button', { name: new RegExp(`^Retirer ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} de mes favoris$`) }).click();
  await expect(page.getByText('Touchez le cœur d’un bien pour le retrouver ici.')).toBeVisible();
});

test('alert: « Créer une alerte » opens the window from the address and sends the confirmation (CAT-071)', async ({ page }) => {
  await page.goto('/programmes?region=alger&alerte=1');
  const dialog = page.getByRole('dialog', { name: 'Créer une alerte' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Alger')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Votre adresse e-mail' }).fill(`alerte-${unique()}@example.test`);
  await dialog.getByText('Une fois par semaine').click();
  await dialog.getByRole('button', { name: 'Créer l’alerte' }).click();
  await expect(dialog.getByText('Vérifiez votre boîte : un e-mail vous attend pour activer l’alerte.')).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole('button', { name: 'Continuer ma recherche' }).click();
  await expect(page).not.toHaveURL(/alerte=1/);
});

test('alert and preferences: a link that is not valid offers a new one (TRV-125)', async ({ page }) => {
  await page.goto('/alertes/am00000000000000000000000000000000000000000000000000000000000000000000000000');
  await expect(page.getByRole('heading', { level: 1, name: 'Ce lien a expiré ou a déjà été utilisé.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Votre adresse e-mail' }).fill(`personne-${unique()}@example.test`);
  await page.getByRole('button', { name: 'Recevoir un nouveau lien' }).click();
  await expect(page.getByText(/C’est envoyé\. Si une alerte existe pour cette adresse/)).toBeVisible();
  await page.goto('/preferences/p0000');
  await expect(page.getByRole('heading', { level: 1, name: 'Ce lien a expiré ou a déjà été utilisé.' })).toBeVisible();
});

test('grouped view: one card per programme unfolding into its properties (CAT-091)', async ({ page }) => {
  await page.goto('/programmes?groupe=programme');
  const first = page.locator('details').first();
  await first.locator('summary').click();
  await expect(first.locator('article').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Grouper par programme' })).toHaveAttribute('aria-pressed', 'true');
});

test('map view: offered only with a map style; markers are buttons (CAT-090, FIC-061)', async ({ page }) => {
  await page.goto('/programmes');
  const mapLink = page.getByRole('link', { name: 'Carte', exact: true });
  test.skip((await mapLink.count()) === 0, 'MAP_STYLE_URL is not configured: the « Carte » button is hidden (FIC-061)');
  await mapLink.click();
  await expect(page).toHaveURL(/vue=carte/);
  await expect(page.getByRole('region', { name: 'Carte des biens' })).toBeVisible();
  const marker = page.getByRole('button', { name: /bien/ }).filter({ has: page.locator('span') }).first();
  await expect(marker).toBeVisible({ timeout: 20_000 });
});
