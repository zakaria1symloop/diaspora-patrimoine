// CAT-035 — the filters window offers « Estimer mon budget » until the visitor has an eligibility simulation, then
// the line « Avec votre budget estimé (…), x biens sur m sont finançables. » and « Afficher seulement ces biens ».
import { expect, test } from '@playwright/test';

test('catalogue filters: estimated budget from the visitor’s own eligibility simulation', async ({ page }) => {
  await page.goto('/programmes?filtres=1');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('link', { name: 'Estimer mon budget' })).toBeVisible();

  // the same browser makes a simulation (sets dp_anon), as the simulator page would
  const res = await page.request.post('/api/v1/public/simulations/eligibility', {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: {
      propertyCountry: 'DZ',
      residencyStatus: 'NON_RESIDENT',
      countryOfResidence: 'FR',
      birthYear: 1985,
      monthlyIncome: '4000',
      incomeCurrency: 'EUR',
      monthlyDebts: '0',
      downPayment: '30000',
    },
  });
  expect(res.status()).toBe(201);

  await page.goto('/programmes?filtres=1');
  const line = dialog.getByText(/^Avec votre budget estimé \(.+\), \d+ biens? sur \d+ sont finançables\.$/);
  await expect(line).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole('button', { name: 'Afficher seulement ces biens' }).click();
  await expect(dialog.getByRole('radio', { name: /prix/i })).toHaveAttribute('aria-checked', 'true');
});
