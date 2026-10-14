// Review of 2026-10-11 (docs/retours-site-2026-10-11.md) — one test per defect reported, each on the component that
// carries it, so that the same defect cannot come back on another page (D-098).
// NAV-010/NAV-014 menu arrows · ACC-040 comparison cards and flags · CAT-040 whole card clickable · ACC-100 carousel
// dots · ACC-045 play/pause · CAT-001 choice lists · CAT-031/D-102 filters applied by the button · CAT-034 minimum
// above maximum · SFA-020/D-103 heart without a session · TRV-080 skeletons · NAV-037 share by e-mail · TRV-123 text size.
import { expect, test } from '@playwright/test';

const PROPERTY = /\/biens\/[a-z0-9-]+$/;

test('NAV-010, NAV-014 — menu entries without a submenu carry no arrow', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    await page.getByRole('button', { name: 'Menu' }).click();
    const entries = page.locator('#menu-mobile ul a');
    await expect(entries.first()).toBeVisible();
    // one icon (the entry's own) and no chevron
    expect(await entries.evaluateAll((as) => as.filter((a) => a.querySelectorAll('svg').length > 1).length)).toBe(0);
  } else {
    await expect(page.locator('header a[href="/connexion"] svg')).toHaveCount(0);
  }
});

test('ACC-040 — the comparison: real flags, and both columns are links as a whole', async ({ page, isMobile }) => {
  await page.goto('/');
  const block = page.locator('[aria-labelledby="comparatif-titre"]');
  await expect(block.locator('svg polygon')).toHaveCount(1); // the star of the Algerian flag
  const links = block.locator('h3 a');
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute('href', /^\/biens\//);
  await expect(links.nth(1)).toHaveAttribute('href', '/financements/simulateur-credit');
  // the link spreads over its whole column: a point of the monthly band, far from the title, belongs to it
  for (const i of [0, 1]) {
    const hit = await links.nth(i).evaluate((a) => {
      const col = a.closest('h3')!.parentElement!.parentElement!;
      col.scrollIntoView({ block: 'center' });
      const r = col.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.bottom - 16)?.closest('a') === a;
    });
    expect(hit, `column ${i}`).toBe(true);
  }
  if (!isMobile) {
    await links.nth(1).evaluate((a) => a.closest('h3')!.parentElement!.parentElement!.scrollIntoView({ block: 'center' }));
    const box = (await links.nth(1).locator('xpath=../../..').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 16);
    await expect(page).toHaveURL(/\/financements\/simulateur-credit$/);
  }
});

test('ACC-030 — the Café card of the hero is clickable as a whole', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('section[data-hero] article').first();
  const cover = card.locator('a[aria-hidden="true"]');
  await expect(cover).toHaveAttribute('href', /^\/le-cafe/);
  const hit = await card.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.x + 24, r.y + 24)?.closest('a')?.getAttribute('aria-hidden') === 'true';
  });
  expect(hit).toBe(true);
});

for (const path of ['/', '/programmes']) {
  test(`CAT-040 — a property card leads to its property from its band, photo, panel and bottom band (${path})`, async ({ page }) => {
    await page.goto(path);
    const card = page.locator('article').filter({ has: page.locator('h3 a[href^="/biens/"], h2 a[href^="/biens/"]') }).first();
    const hits = await card.evaluate((el) => {
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      const at = (x: number, y: number) => Boolean(document.elementFromPoint(x, y)?.closest('a[href^="/biens/"]'));
      return [at(r.x + 16, r.y + 12), at(r.x + r.width / 2, r.y + 110), at(r.x + r.width / 2, r.y + r.height / 2 + 30), at(r.x + r.width / 2, r.bottom - 16)];
    });
    expect(hits).toEqual([true, true, true, true]);
    const box = (await card.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + 110); // the photo
    await expect(page).toHaveURL(PROPERTY);
  });
}

test('ACC-100 — phone carousels: as many dots as cards', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the dots exist under 768 px only');
  await page.goto('/');
  const lists = await page.evaluate(() =>
    [...document.querySelectorAll('ul[data-reveal]')]
      .filter((ul) => ul.nextElementSibling?.querySelector('button[aria-label]'))
      .map((ul) => ({ cards: ul.children.length, dots: ul.nextElementSibling!.querySelectorAll('button').length })),
  );
  expect(lists.length).toBeGreaterThan(0);
  for (const l of lists) expect(l.dots).toBe(l.cards);
});

test('ACC-045 — « Pause » stops the motivations, « Lecture » starts them again at once', async ({ page, isMobile }) => {
  test.skip(isMobile, 'pointer behaviour of a computer');
  test.setTimeout(90_000);
  await page.goto('/');
  const block = page.locator('section[aria-labelledby="motivations"]');
  await block.scrollIntoViewIfNeeded();
  const toggle = block.getByRole('button', { name: /défilement/i });
  const current = () => block.locator('[role="tab"][aria-selected="true"]').getAttribute('id');
  await toggle.click();
  const paused = await current();
  await page.waitForTimeout(7000);
  expect(await current()).toBe(paused);
  await toggle.click(); // the pointer stays on the button
  await expect.poll(current, { timeout: 15_000 }).not.toBe(paused);
});

test('CAT-001 — the search bar: a list of our own, the chosen value shown, « Rechercher » carries the choices', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the three-field bar is the computer form of the catalogue');
  await page.goto('/programmes');
  const bar = page.getByRole('search', { name: 'Rechercher un bien' });
  const type = bar.getByRole('combobox', { name: /Type de bien/ });
  await type.click();
  await bar.getByRole('option', { name: /Appartement T3/ }).click();
  await expect(type).toContainText('Appartement T3');
  await type.press('ArrowDown'); // keyboard: opens, moves, Enter chooses, Escape closes
  await expect(bar.getByRole('listbox')).toBeVisible();
  await type.press('Escape');
  await expect(bar.getByRole('listbox')).toBeHidden();
  await bar.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page).toHaveURL(/type=apartment&rooms=3/);
});

test('CAT-034 — a minimum above its maximum is refused before any search, and the monthly field never empties', async ({ page }) => {
  await page.goto('/programmes?filtres=1');
  const panel = page.getByRole('dialog');
  const budget = panel.getByRole('group', { name: 'Budget' });
  // the monthly slider at its top means « no limit »: the field keeps showing that top value
  const slider = budget.getByRole('slider');
  const top = await slider.getAttribute('max');
  await slider.fill('800');
  await expect(budget.getByLabel('Maximum')).toHaveValue('800');
  await slider.fill(top!);
  await expect(budget.getByLabel('Maximum')).toHaveValue(top!);

  await budget.getByRole('radio', { name: 'Prix total' }).click();
  await budget.getByLabel('Minimum').fill('300000');
  await budget.getByLabel('Maximum').fill('100000');
  await expect(budget.getByRole('alert')).toContainText('Le prix minimum dépasse le prix maximum');
  const apply = panel.getByRole('button', { name: /^Voir |^Aucun bien/ });
  await expect(apply).toBeDisabled();
  await expect(page).not.toHaveURL(/priceMin/);
  await budget.getByLabel('Maximum').fill('400000');
  await expect(budget.getByRole('alert')).toHaveCount(0);
  await expect(apply).toBeEnabled();
});

test('CAT-032, D-102 — choosing filters costs one counter request and no search', async ({ page }) => {
  await page.goto('/programmes?filtres=1');
  const panel = page.getByRole('dialog');
  await expect(panel.getByRole('heading', { name: 'Filtres' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  const counters: string[] = [];
  page.on('request', (r) => {
    if (/\/api\/v1\/public\/properties\?/.test(r.url())) counters.push(r.url());
  });
  await panel.getByRole('button', { name: /^T3/ }).click();
  await panel.getByRole('button', { name: /^T2/ }).click();
  await panel.getByLabel(/^Appartement/).check();
  await expect(panel.getByText('Vos choix ne sont pas encore appliqués.')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(counters).toHaveLength(1);
  await expect(page).not.toHaveURL(/rooms=/);
  // a chosen value stays plainly chosen under the pointer
  const pill = panel.getByRole('button', { name: /^T3/ });
  await pill.hover();
  await expect(pill).toHaveAttribute('aria-pressed', 'true');
  expect(await pill.evaluate((e) => getComputedStyle(e).color)).toBe('rgb(255, 255, 255)');
});

test('TRV-080 — skeleton cards stand for the results while a search is on its way', async ({ page, isMobile }) => {
  test.skip(isMobile, 'same component; the quick filters sit lower on a phone');
  await page.goto('/programmes');
  await page.route('**/programmes?*', async (route) => {
    if (route.request().headers()['rsc']) await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.getByRole('link', { name: 'Appartements' }).click();
  await expect(page.getByRole('status', { name: 'Chargement des biens…' })).toBeVisible();
  await expect(page).toHaveURL(/type=apartment/);
  await expect(page.getByRole('status', { name: 'Chargement des biens…' })).toHaveCount(0);
});

test('NAV-037 — « Partager » by e-mail: the mail application and the mailboxes read in a browser', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone opens the system share sheet');
  await page.goto('/programmes');
  await page.locator('article h3 a[href^="/biens/"]').first().click();
  await expect(page).toHaveURL(PROPERTY);
  await page.getByRole('button', { name: 'Partager' }).first().click();
  await page.getByRole('menuitem', { name: 'E-mail' }).click();
  const app = page.getByRole('menuitem', { name: 'Mon application de messagerie' });
  await expect(app).toHaveAttribute('href', /^mailto:\?subject=[^&]+&body=[^&]+%0D%0Ahttp/);
  await expect(page.getByRole('menuitem', { name: 'Gmail' })).toHaveAttribute('href', /^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&su=/);
  await expect(page.getByRole('menuitem', { name: 'Outlook' })).toHaveAttribute('href', /^https:\/\/outlook\.live\.com\//);
  await expect(page.getByRole('menuitem', { name: 'Yahoo Mail' })).toHaveAttribute('href', /^https:\/\/compose\.mail\.yahoo\.com\//);
});

test('TRV-123 — « Grande » and « Très grande »: no page is wider than the screen, header and footer included', async ({ page }) => {
  test.setTimeout(120_000);
  for (const path of ['/', '/programmes', '/notre-concept', '/contact']) {
    await page.goto(path);
    for (const size of ['large', 'xlarge']) {
      await page.evaluate((s) => (document.documentElement.dataset.textSize = s), size);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `${path} ${size}`).toBeLessThanOrEqual(1);
    }
  }
});
