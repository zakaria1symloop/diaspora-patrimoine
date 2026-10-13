// DEM-022 — a signed-in client sends his requests from his account: the forms show « {Prénom Nom} · {e-mail} ·
// {téléphone} » and « Modifier mes coordonnées » instead of the contact fields, ask only what his record lacks, replace
// the consent box by the sentence recorded as consent; the server attaches the request to HIS record whatever e-mail
// the browser carries (a request sent with another address used to land on another client's record).
import { expect, test, type Page } from '@playwright/test';
import { freshIp, signUpClient } from './helpers/account';

async function availableProperty(page: Page): Promise<{ slug: string; reference: string }> {
  const res = await page.request.get('/api/v1/public/properties?limit=12');
  const list = (await res.json()) as { data: { slug: string; reference: string; availability: string }[] };
  const p = list.data.find((x) => x.availability === 'AVAILABLE');
  test.skip(!p, 'no available property in the demo data');
  return p!;
}

async function formToken(page: Page, form: string): Promise<string> {
  const res = await page.request.post('/api/v1/public/form-token', { data: { form } });
  return ((await res.json()) as { token: string }).token;
}

test('DEM-022 — « Exprimer mon intérêt » signed in: his details, only the missing country asked, the sentence as consent', async ({ page }) => {
  test.setTimeout(180_000);
  await freshIp(page);
  const { email } = await signUpClient(page);
  const property = await availableProperty(page);

  await page.goto(`/biens/${property.slug}?interet=1`);
  const dialog = page.getByRole('dialog');
  const summary = dialog.getByTestId('signed-in-contact');
  await expect(summary).toContainText(email, { timeout: 30_000 });
  await expect(summary).toContainText('Karima Testeuse');
  await expect(dialog.getByRole('link', { name: 'Modifier mes coordonnées' })).toHaveAttribute('href', '/espace-client/profil');
  // name, e-mail and phone are on the record: not asked again; the country is not (sign-up does not ask it): asked
  await expect(dialog.getByRole('textbox', { name: 'E-mail' })).toHaveCount(0);
  await expect(dialog.getByRole('textbox', { name: 'Prénom' })).toHaveCount(0);
  await expect(dialog.getByRole('textbox', { name: 'Téléphone' })).toHaveCount(0);
  const country = dialog.getByLabel('Pays de résidence');
  await expect(country).toBeVisible();
  // the consent box gives way to the sentence; no « créer mon espace » for someone who has one
  await expect(dialog.getByRole('checkbox', { name: /J’accepte que Diaspora Patrimoine/ })).toHaveCount(0);
  await expect(dialog.getByRole('checkbox', { name: /Créer mon espace/ })).toHaveCount(0);
  await expect(dialog.getByText('En envoyant, vous demandez à être contacté au sujet de cette demande.')).toBeVisible();

  await country.selectOption('FR');
  await page.waitForTimeout(3_000); // a human takes a few seconds (spam signal on a too-fast submission, DEM-030)
  await dialog.getByRole('button', { name: 'Envoyer ma demande' }).click();
  // the confirmation names the account's address: the request is on his record
  await expect(dialog.getByText(email)).toBeVisible({ timeout: 30_000 });
});

test('DEM-022 — the server attaches a signed-in request to the account, not to the e-mail the browser sent', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'an API journey: once is enough');
  test.setTimeout(180_000);
  await freshIp(page);
  const { email } = await signUpClient(page);
  const property = await availableProperty(page);
  const fields = {
    firstName: 'Autre',
    lastName: 'Personne',
    email: `quelquun-dautre-${Date.now()}@example.test`,
    phone: '+33612345679',
    countryOfResidence: 'FR',
    consentContact: true,
  };
  const body = { form: 'PROPERTY_INTEREST', fields, context: { propertyReference: property.reference }, tracking: { locale: 'fr' } };

  const token = await formToken(page, 'PROPERTY_INTEREST');
  await page.waitForTimeout(3_000);
  const signedIn = await page.request.post('/api/v1/public/leads', { data: body, headers: { 'X-Form-Token': token, 'Idempotency-Key': crypto.randomUUID() } });
  expect(signedIn.status()).toBe(201);
  expect(((await signedIn.json()) as { email: string }).email).toBe(email);

  // without a session, the signed-in sentence is not a consent
  const anonymous = await page.context().browser()!.newContext();
  try {
    const anon = anonymous.request;
    const t2 = ((await (await anon.post('http://localhost:3000/api/v1/public/form-token', { data: { form: 'PROPERTY_INTEREST' } })).json()) as { token: string }).token;
    const refused = await anon.post('http://localhost:3000/api/v1/public/leads', {
      data: { ...body, fields: { ...fields, consentKey: 'lead.contact.signedIn.v1' } },
      headers: { 'X-Form-Token': t2, 'Idempotency-Key': crypto.randomUUID(), 'X-Forwarded-For': '198.51.100.77' },
    });
    expect(refused.status()).toBe(422);
  } finally {
    await anonymous.close();
  }
});
