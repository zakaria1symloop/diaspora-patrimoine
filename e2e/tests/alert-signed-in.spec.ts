// CAT-071 — a signed-in client's alert uses his account's address (prefilled, read-only) and is active at once:
// « Votre alerte est active. », and no confirmation e-mail.
import { expect, test } from '@playwright/test';
import { freshIp, signUpClient } from './helpers/account';

test('alert: a signed-in client’s alert is active at once on his address', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one journey is enough; it creates an account');
  test.setTimeout(120_000);
  await freshIp(page);
  const { email } = await signUpClient(page);

  await page.goto('/programmes?region=oran&alerte=1');
  const dialog = page.getByRole('dialog', { name: 'Créer une alerte' });
  const address = dialog.getByLabel('Votre adresse e-mail');
  await expect(address).toHaveValue(email);
  await expect(address).toHaveAttribute('readonly', '');
  await dialog.getByRole('button', { name: 'Créer l’alerte' }).click();
  await expect(dialog.getByText('Votre alerte est active.')).toBeVisible({ timeout: 15_000 });
});
