// CAT-030, CAT-031, D-098 — the filters: a panel docked on the right on a computer (results visible beside it, each
// choice applied by itself), a full-screen window with a draft on a phone. NAV-010 — the header keeps one height.
import { expect, test } from '@playwright/test';

test('filters: docked panel applies each choice live (computer) · draft until « Voir » (phone)', async ({ page }, info) => {
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
    await expect(page).toHaveURL(/type=duplex/); // applied without « Voir »
    await expect(page).toHaveURL(/filtres=1/); // and the panel stays open
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
