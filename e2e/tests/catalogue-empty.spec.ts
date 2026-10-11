// CAT-060, CAT-061 — an empty filtered result keeps the region's name, offers « Élargir le budget (+20 %) » and shows
// relaxed suggestions. Uses the demo catalogue (no property in Alger under 100 000 €; the T2 at 118 000 € once widened).
import { expect, test } from '@playwright/test';

test('catalogue: empty result with suggestions and the region name', async ({ page }) => {
  await page.goto('/programmes?region=alger&priceMax=100000');
  await expect(page.getByRole('heading', { level: 1, name: 'Programmes neufs à Alger' })).toBeVisible();
  await expect(page.getByText('Aucun bien ne correspond à ces filtres pour l’instant.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ces biens pourraient vous intéresser' })).toBeVisible();
  const suggestions = page.getByRole('region', { name: 'Ces biens pourraient vous intéresser' }).getByRole('listitem');
  await expect(suggestions).toHaveCount(1);

  await page.getByRole('link', { name: 'Élargir le budget (+20 %)' }).click();
  await expect(page).toHaveURL(/priceMax=120000/);
  await expect(page.getByText(/^1 bien correspond$/)).toBeVisible();
});
