// CAF-024, CYC-186 — a signed-in client who registers again for the same Café gets his registration UPDATED (seats,
// questions) instead of the anonymous « C'est noté » that changes nothing. Uses the next demo Café; the registration
// is cancelled at the end so the demo seats stay as they were.
import { expect, test, type Page } from '@playwright/test';
import { freshIp, signUpClient } from './helpers/account';

async function nextCafe(page: Page): Promise<string> {
  const res = await page.request.get('/api/v1/public/events');
  const list = (await res.json()) as { data: { slug: string; state: { kind: string } }[] };
  const open = list.data.find((c) => c.state.kind === 'OPEN' || c.state.kind === 'FEW');
  test.skip(!open, 'no Café open for registration in the demo data');
  return open!.slug;
}

async function register(page: Page, slug: string, email: string, seats: number) {
  await page.goto(`/le-cafe/${slug}`);
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Je m’inscris' }) }).first();
  await form.getByLabel('Prénom').fill('Karima');
  await form.getByLabel('Nom', { exact: true }).fill('Testeuse');
  await form.getByRole('textbox', { name: 'E-mail' }).fill(email);
  await form.getByLabel('Vous venez à combien ?').selectOption(String(seats));
  await form.getByLabel(/J’accepte que Diaspora Patrimoine m’envoie/).check();
  await page.waitForTimeout(3_000); // a human takes a few seconds (spam signal on a too-fast submission, DEM-030)
  await form.getByRole('button', { name: 'Je m’inscris' }).click();
}

test('café: a signed-in client registering again updates his registration', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one journey is enough; it creates an account');
  test.setTimeout(120_000);
  await freshIp(page);
  const { email } = await signUpClient(page);
  const slug = await nextCafe(page);

  await register(page, slug, email, 1);
  await expect(page.getByText('C’est noté, Karima. Votre place est réservée.')).toBeVisible({ timeout: 15_000 });

  await register(page, slug, email, 2);
  await expect(page.getByText('Vous étiez déjà inscrit à ce Café : nous avons mis à jour votre inscription.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('C’est noté, Karima. Vos 2 places sont réservées.')).toBeVisible();

  // clean-up: cancel through the manage link, as the holder would
  const manage = await page.getByRole('link', { name: /Gérer mon inscription/ }).getAttribute('href');
  const token = manage!.split('/').pop()!;
  const del = await page.request.delete(`/api/v1/public/registrations/${token}`, { data: {} });
  expect(del.status()).toBe(200);
});
