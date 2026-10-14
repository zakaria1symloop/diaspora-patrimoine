// Review of 2026-10-12 (docs/retours-site-2026-10-12.md) — the items not covered by the review of 2026-10-11
// (public-review.spec.ts): promoter cards with a picture, filters and pages (EDI-030, EDI-035), the promoter's page
// (EDI-031), bank cards (EDI-020), Café dates filters (CAF-003), the assistant's choices (ASS-010) — D-105.
// The demo catalogue (`pnpm --filter @dp/api demo`): four promoters (Alger ×2, Oran ×2, three with a programme on sale),
// one bank, three Cafés (Paris, Marseille, Paris; October, November, December; the last one not yet open).
import { expect, test } from '@playwright/test';

test('EDI-030, D-105 — promoter cards carry a picture and lead to the promoter as a whole', async ({ page }) => {
  await page.goto('/promoteurs');
  const cards = page.locator('section[aria-labelledby="liste"] article');
  await expect(cards).toHaveCount(4);
  // a promoter without a cover shows one of its programmes' pictures
  await expect(cards.first().locator('img').first()).toBeVisible();
  const link = cards.first().locator('a').first();
  await expect(link).toHaveAttribute('href', /^\/promoteurs\//);
  const hit = await link.evaluate((a) => {
    const card = a.closest('article')!;
    card.scrollIntoView({ block: 'center' });
    const r = card.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + 24)?.closest('a') === a; // on the picture, far from the name
  });
  expect(hit).toBe(true);
});

test('EDI-030, D-102, D-105 — promoter filters apply with « Afficher », kept in the address', async ({ page }) => {
  await page.goto('/promoteurs');
  const list = page.locator('section[aria-labelledby="liste"]');
  await page.getByLabel('Nom du promoteur').fill('djazair');
  await expect(page).not.toHaveURL(/q=/); // nothing is searched while typing
  await page.getByRole('button', { name: 'Afficher' }).click();
  await expect(page).toHaveURL(/q=djazair/);
  await expect(list.locator('article')).toHaveCount(1);
  await expect(list.getByRole('heading', { name: 'El Djazaïr Habitat' })).toBeVisible();

  await page.getByRole('link', { name: 'Effacer les filtres' }).click();
  await expect(list.locator('article')).toHaveCount(4);

  await page.getByRole('combobox', { name: /Région/ }).click();
  await page.getByRole('option', { name: /^Oran/ }).click();
  await page.getByLabel('Avec des biens en vente').check();
  await page.getByRole('button', { name: 'Afficher' }).click();
  await expect(page).toHaveURL(/region=Oran/);
  await expect(page).toHaveURL(/vente=1/);
  await expect(list.locator('article')).toHaveCount(1); // Sahel Immobilier; Résidences du Littoral has nothing on sale
  await expect(page.getByRole('status').filter({ hasText: /promoteur/ })).toHaveText('1 promoteur');

  await page.goto('/promoteurs?q=introuvable');
  await expect(page.getByText('Aucun promoteur ne correspond à ces critères.')).toBeVisible();
  // pages of nine: four promoters fit on one, no pagination is shown
  await expect(page.getByRole('navigation', { name: /pagination/i })).toHaveCount(0);
});

test('EDI-031, D-105 — the promoter page is headed by a picture', async ({ page }) => {
  await page.goto('/promoteurs/bahia-promotion');
  await expect(page.locator('header img').first()).toBeVisible();
  await expect(page.getByText('1 programme en vente')).toBeVisible();
});

test('EDI-035, D-105 — Nos partenaires: one group at a time, promoters as cards with their filters', async ({ page }) => {
  await page.goto('/nos-partenaires');
  await expect(page.getByRole('heading', { name: 'Promoteurs' })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="groupe-promoteurs"] article')).toHaveCount(4);
  await page.getByRole('link', { name: /^Banques/ }).click();
  await expect(page).toHaveURL(/groupe=banques/);
  await expect(page.getByRole('heading', { name: 'Promoteurs' })).toHaveCount(0);
  await expect(page.getByText('Al Salam Bank Algeria')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Banques/ })).toHaveAttribute('aria-current', 'true');
});

test('EDI-020, D-105 — partner banks are cards with a logo or a monogram', async ({ page }) => {
  await page.goto('/financements');
  const banks = page.locator('#banques');
  await expect(banks.getByText('Al Salam Bank Algeria')).toBeVisible();
  await expect(banks.getByText('AS', { exact: true })).toBeVisible(); // no logo uploaded: its initials
});

test('CAF-003, D-105 — « Prochaines dates » filter by place, month and seats left', async ({ page }) => {
  await page.goto('/le-cafe');
  const dates = page.locator('section[aria-labelledby="dates"] article');
  await expect(dates).toHaveCount(3);
  await page.getByRole('link', { name: 'Novembre 2026' }).click();
  await expect(page).toHaveURL(/mois=2026-11/);
  await expect(dates).toHaveCount(1);
  await page.getByRole('link', { name: 'Paris' }).click(); // the month is kept: no Paris Café in November
  await expect(page).toHaveURL(/lieu=Paris.*mois=2026-11|mois=2026-11.*lieu=Paris/);
  await expect(page.getByText('Aucune date ne correspond à ces critères.')).toBeVisible();
  await page.getByRole('link', { name: 'Voir toutes les dates' }).click();
  await expect(dates).toHaveCount(3);
  await page.getByRole('link', { name: 'Avec des places libres' }).click();
  await expect(dates).toHaveCount(2); // the December Café is not open yet
});

test('ASS-010, D-105 — the assistant: choices in a grid, what is chosen counted, the neutral answer apart', async ({ page }) => {
  await page.goto('/assistant');
  await expect(page.getByText('Aucun choix pour l’instant')).toBeVisible();
  const region = page.getByRole('checkbox').first();
  await region.check();
  await expect(page.getByText('1 choix retenu')).toBeVisible();
  await expect(page.getByText('Ou bien')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Peu importe' }).check();
  await expect(region).not.toBeChecked(); // the neutral answer replaces the others
  await expect(page.getByText('Aucun choix pour l’instant')).toBeVisible();
});
