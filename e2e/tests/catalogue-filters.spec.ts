// CAT-030, CAT-031, D-098, D-102 — the filters: a panel docked on the right on a computer (results visible beside it),
// a full-screen window on a phone; in both the choices are a draft, applied together by « Voir {m} biens ».
// NAV-010 — the header keeps one height.
import { expect, test } from '@playwright/test';

test('filters: a draft until « Voir » — the docked panel stays open beside the results (computer), the window closes (phone)', async ({ page }, info) => {
  await page.goto('/programmes?filtres=1');
  const panel = page.getByRole('dialog');
  await expect(panel.getByRole('heading', { name: 'Filtres' })).toBeVisible();
  const duplex = panel.getByLabel(/Duplex/);

  if (info.project.name === 'desktop') {
    // beside the panel, not under it: the first card stays fully visible and clickable
    const card = page.locator('main ul[role="list"] > li').first();
    const [cardBox, panelBox] = [await card.boundingBox(), await panel.boundingBox()];
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(panelBox!.x + 1);

    await duplex.check();
    await expect(panel.getByRole('button', { name: /Voir 1 bien/ })).toBeVisible();
    await expect(page).not.toHaveURL(/type=duplex/); // a draft: nothing is searched while choosing (D-102)
    await panel.getByRole('button', { name: /Voir 1 bien/ }).click();
    await expect(page).toHaveURL(/type=duplex/);
    await expect(page).toHaveURL(/filtres=1/); // the panel stays open beside the results
    await expect(page.getByText(/^1 bien correspond$/)).toBeVisible();
    await expect(duplex).toBeChecked();

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page).toHaveURL(/\/programmes\?type=duplex$/);
  } else {
    await duplex.check();
    await expect(page).not.toHaveURL(/type=duplex/); // a draft
    await panel.getByRole('button', { name: /Voir 1 bien/ }).click();
    await expect(page).toHaveURL(/\/programmes\?type=duplex$/);
  }
});

test('header: one height while the page scrolls (no jump around a threshold)', async ({ page }) => {
  await page.goto('/programmes');
  const heights = new Set<number>();
  for (let y = 0; y <= 320; y += 16) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    heights.add(await page.evaluate(() => Math.round(document.querySelector('header')!.getBoundingClientRect().height)));
  }
  expect([...heights]).toHaveLength(1);
});
