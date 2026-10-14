// Review of 13/10/2026 (`docs/retours-site-2026-10-13.md`, D-107): a sign-up with a partner's or a team member's
// address is told by e-mail; a double click sends one request; the request windows close on a tap outside; the
// simulator's switch has the same space on both sides; « Mon espace » leads to the space; the profile refuses a minor
// (SEC-095) and asks before a link takes its changes away (TRV-093); a message sent is found again beside the form.
import { expect, test, type Page } from '@playwright/test';
import { freshIp, mailLink, signUpClient, unique } from './helpers/account';
import { DIRECTION_EMAIL } from './helpers/admin';

async function availableProperty(page: Page): Promise<string> {
  const res = await page.request.get('/api/v1/public/properties?limit=12');
  const list = (await res.json()) as { data: { slug: string; availability: string }[] };
  const p = list.data.find((x) => x.availability === 'AVAILABLE');
  test.skip(!p, 'no available property in the demo data');
  return p!.slug;
}

test('D-107, AUTH-003 — a client sign-up with the address of a team account: same screen, and its owner is told by e-mail', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'an e-mail journey: once is enough');
  test.setTimeout(120_000);
  await freshIp(page);
  // a team account of the installation: the e2e Direction account, or the one named by E2E_STAFF_EMAIL
  const staff = (process.env.E2E_STAFF_EMAIL ?? DIRECTION_EMAIL).toLowerCase();
  await page.goto('/inscription');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.getByLabel('Prénom').fill('Karima');
  await page.getByLabel('Nom', { exact: true }).fill('Testeuse');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(staff);
  await page.getByPlaceholder(/6 12 34 56 78/).fill('612345678');
  await page.getByLabel('Mot de passe', { exact: true }).fill(`Une maison ${unique()} au bord de la mer`);
  await page.getByLabel(/J’accepte les/).check();
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page.getByRole('heading', { name: 'Vérifiez votre boîte e-mail' })).toBeVisible({ timeout: 30_000 });
  const sentence = await mailLink(staff, 'C_ACCOUNT_EXISTS', /compte partenaire ou de l['’]équipe/);
  expect(sentence).toBeTruthy();
});

test('D-107 — a double click on « Envoyer ma demande » sends one request', async ({ page }) => {
  test.setTimeout(120_000);
  await freshIp(page);
  const slug = await availableProperty(page);
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/api/v1/public/leads')) posts.push(r.url());
  });
  await page.goto(`/biens/${slug}?interet=1`);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Prénom' }).fill('Karima');
  await dialog.getByRole('textbox', { name: 'Nom', exact: true }).fill('Testeuse');
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill(`double-${unique()}@example.test`);
  await dialog.getByRole('textbox', { name: 'Téléphone' }).fill('612345678');
  await dialog.locator('select[id$="-countryOfResidence"]').selectOption('FR');
  await dialog.getByRole('checkbox', { name: /J’accepte que Diaspora Patrimoine/ }).check();
  await page.waitForTimeout(3_000); // a human takes a few seconds (spam signal on a too-fast submission, DEM-030)
  await dialog.getByRole('button', { name: 'Envoyer ma demande' }).dblclick();
  await expect(dialog.getByText(/votre demande est enregistrée/)).toBeVisible({ timeout: 30_000 });
  expect(posts).toHaveLength(1);
});

test('D-107 — a request window closes on a tap outside it (its draft is kept, TRV-092)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'full screen on a phone: there is no outside');
  const slug = await availableProperty(page);
  await page.goto(`/biens/${slug}?interet=1`);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Prénom' }).fill('Karima');
  await page.mouse.click(5, 5); // the backdrop, in a corner of the screen
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/interet=1/);
  await page.goto(`/biens/${slug}?interet=1`);
  await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Prénom' })).toHaveValue('Karima');
});

test('D-107 — the credit simulator switch: the same space on both sides', async ({ page }) => {
  await page.goto('/financements/simulateur-credit');
  const track = page.locator('fieldset').filter({ hasText: 'Je connais le prix du bien' }).locator('div').first();
  const gaps = await track.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const labels = [...el.querySelectorAll('label')].map((l) => l.getBoundingClientRect());
    return { left: Math.min(...labels.map((r) => r.left)) - box.left, right: box.right - Math.max(...labels.map((r) => r.right)) };
  });
  expect(Math.abs(gaps.left - gaps.right)).toBeLessThanOrEqual(1);
});

test('D-107, SEC-095, TRV-093, MSG-021 — the client space: « Mon espace », a minor refused, unsaved changes, a message found again', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'a journey of rules, not of layout: once is enough (it creates an account)');
  test.setTimeout(240_000);
  await freshIp(page);
  await signUpClient(page);

  // « Mon espace » (header of the site, on a computer): its chevron opens the menu, the label leads to the dashboard
  await page.goto('/programmes');
  await page.getByRole('button', { name: 'Ouvrir le menu de mon espace' }).click();
  await expect(page.getByRole('menuitem', { name: 'Tableau de bord' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.move(5, 300); // away from the header: the menu opened on hover closes
  await page.getByRole('link', { name: 'Mon espace', exact: true }).click();
  await expect(page).toHaveURL(/\/espace-client$/);

  // SEC-095 — a birth date under 18 years is refused
  await page.goto('/espace-client/profil');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined); // the profile is hydrated
  const identity = page.locator('#identite');
  const year = new Date().getFullYear() - 10;
  const birth = identity.getByLabel('Date de naissance');
  await expect(async () => {
    await birth.fill(`${year}-05-01`);
    await expect(birth).toHaveValue(`${year}-05-01`, { timeout: 1_000 });
    await expect(identity.getByRole('button', { name: 'Enregistrer' })).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await identity.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(identity.getByText(/personnes majeures/)).toBeVisible({ timeout: 15_000 });

  // TRV-093 — a link of the site, with the change still unsaved: « Rester » keeps the page and the value
  await page.getByRole('link', { name: 'Messages' }).first().click();
  const ask = page.getByRole('dialog', { name: 'Vous avez des modifications non enregistrées.' });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Rester' }).click();
  await expect(page).toHaveURL(/\/espace-client\/profil/);
  await expect(identity.getByLabel('Date de naissance')).toHaveValue(`${year}-05-01`);
  // « Quitter » goes
  await page.getByRole('link', { name: 'Messages' }).first().click();
  await page.getByRole('dialog', { name: 'Vous avez des modifications non enregistrées.' }).getByRole('button', { name: 'Quitter' }).click();
  await expect(page).toHaveURL(/\/espace-client\/messages/);

  // MSG-021 — the message sent is found again beside the form
  const text = `Bonjour, je voudrais faire le point sur mon projet (${unique()}).`;
  await page.getByLabel('Votre message').fill(text);
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 30_000 });
});
