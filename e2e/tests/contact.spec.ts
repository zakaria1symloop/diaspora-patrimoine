// EP-19, DEM-015 — the contact page: subject preselected by the address, « Être rappelé » becomes a callback request
// that reaches the API and ends on the confirmation (DEM-030). Runs against the local stack; the e-mails land in
// apps/api/.local/mail.
import { expect, test } from '@playwright/test';
import { freshIp, mailLink } from './helpers/account';

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

test('contact: ?objet=rappel preselects « Être rappelé » and sends a callback request', async ({ page }) => {
  await page.goto('/contact?objet=rappel');
  await expect(page.getByRole('heading', { level: 1, name: 'Contact' })).toBeVisible();
  await expect(page.getByLabel('Objet')).toHaveValue('CALLBACK');

  // phone required, message optional for a callback
  await page.getByRole('button', { name: 'Envoyer mon message' }).click();
  await expect(page.getByRole('textbox', { name: 'Prénom' })).toBeFocused();

  await page.getByRole('textbox', { name: 'Prénom' }).fill('Test');
  await page.getByLabel('Nom', { exact: true }).fill('Contact');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(`contact-${unique()}@example.test`);
  await page.getByRole('textbox', { name: /Téléphone/ }).fill('6 12 34 56 78');
  await page.getByLabel(/J’accepte que Diaspora Patrimoine me contacte/).check();
  await page.getByRole('button', { name: 'Envoyer mon message' }).click();

  await expect(page.getByText('Merci Test, votre demande est enregistrée.')).toBeVisible({ timeout: 15_000 });
  // DEM-023: the reference is shown to a signed-in client only
  await expect(page.getByText(/Référence : /)).toHaveCount(0);
});

test('contact: a general question needs a message of 10 characters', async ({ page }) => {
  await page.goto('/contact');
  await page.getByRole('textbox', { name: 'Prénom' }).fill('Test');
  await page.getByLabel('Nom', { exact: true }).fill('Question');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(`question-${unique()}@example.test`);
  await page.getByLabel('Objet').selectOption('OTHER');
  await page.getByLabel('Votre message').fill('Trop court');
  await page.getByLabel(/J’accepte que Diaspora Patrimoine me contacte/).check();
  await page.getByLabel('Votre message').fill('Court');
  await page.getByRole('button', { name: 'Envoyer mon message' }).click();
  await expect(page.getByLabel('Votre message')).toBeFocused();

  await page.getByLabel('Votre message').fill('Quels documents faut-il pour un crédit depuis la France ?');
  await page.getByRole('button', { name: 'Envoyer mon message' }).click();
  await expect(page.getByText('Merci Test, votre demande est enregistrée.')).toBeVisible({ timeout: 15_000 });
});

test('contact: « Créer mon espace » sends the activation link with the acknowledgement (DEM-021)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one journey is enough; it creates an account');
  await freshIp(page);
  const email = `contact-account-${unique()}@example.test`;
  await page.goto('/contact');
  await page.getByRole('textbox', { name: 'Prénom' }).fill('Test');
  await page.getByLabel('Nom', { exact: true }).fill('Compte');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
  await page.getByLabel('Objet').selectOption('OTHER');
  // A unique text: the same message from another address within 24 h is a spam signal (DEM-031), and reruns happen.
  await page.getByLabel('Votre message').fill(`Je voudrais suivre ma demande depuis mon espace (${unique()}).`);
  await page.getByLabel(/J’accepte que Diaspora Patrimoine me contacte/).check();
  await page.getByLabel('Créer mon espace client en même temps').check();
  await page.getByRole('button', { name: 'Envoyer mon message' }).click();
  await expect(page.getByText('Merci Test, votre demande est enregistrée.')).toBeVisible({ timeout: 15_000 });
  const link = await mailLink(email, 'C_LEAD_ACK_CONTACT', /http:\/\/localhost:3000\/(activation|verification)\/[A-Za-z0-9_-]+/);
  expect(link).toMatch(/\/(activation|verification)\//);
});
