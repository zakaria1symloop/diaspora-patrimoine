// A client space with real data in every page, built through the real flows and the real API (no mock, no direct
// database write): favourites, an interest sent from a property (it opens a dossier, CYC-002), a callback request, a
// saved eligibility and two credit simulations, an active alert, a paused one and a saved search, the demonstration
// dossier with its pieces, its proposals and its follow-up (`demo -- --dossier-pour=`, PAR-082), a message to the
// advisor. Same steps as `e2e/space-full-shots.mjs`, for the specs that need a filled space.
import { expect, type Page } from '@playwright/test';
import type { APIResponse } from '@playwright/test';
import { api as rawApi, demoDossierFor, idem } from './space-api';

/**
 * The local API restarts whenever its code is rebuilt (several people work on it at once): a call caught during a
 * restart answers 5xx through the site's proxy. Every call below is safe to repeat (reads, idempotent writes, or a
 * write carrying its Idempotency-Key), so it is repeated until the API is back.
 */
async function retry(send: () => Promise<APIResponse>): Promise<APIResponse> {
  for (let i = 0; ; i++) {
    const res = await send().catch((err: Error) => (i >= 24 ? Promise.reject(err) : null)); // a dropped connection
    if (res && (res.status() < 500 || i >= 24)) return res;
    await new Promise((r) => setTimeout(r, 5000));
  }
}
const api = (page: Page, method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => retry(() => rawApi(page, method, path, body, extra));

/** Waits until the local API answers (it may be restarting). */
export async function apiReady(page: Page): Promise<void> {
  await retry(() => page.request.get('/api/v1/public/health'));
}

export interface FilledSpace {
  /** The dossier with a list of pieces (lower case, as in the addresses). */
  documentsDossier: string;
  /** Every dossier of the client (lower case). */
  dossiers: string[];
}

export async function fillSpace(page: Page, email: string): Promise<FilledSpace> {
  const catalogue = await (await retry(() => page.request.get('/api/v1/public/properties?page=1'))).json();
  const cards: { reference: string; title: string; slug: string; priceFromRef: { amount: string; currency: string } | null }[] = catalogue.data;
  expect(cards.length, 'the demonstration catalogue is needed: pnpm --filter @dp/api demo').toBeGreaterThanOrEqual(4);
  const others = cards.filter((c) => c.reference !== 'DP-DZ-0142');

  for (const c of cards.slice(0, 4)) expect((await api(page, 'PUT', `/client/favorites/${c.reference}`)).ok()).toBe(true);

  // DEM-011 — an interest sent signed in; DEM-030: a form sent in under 3 s is suspect, so the token ages first.
  const token = (await (await retry(() => page.request.post('/api/v1/public/form-token', { data: { form: 'PROPERTY_INTEREST' } }))).json()).token as string;
  const callbackToken = (await (await retry(() => page.request.post('/api/v1/public/form-token', { data: { form: 'CALLBACK_REQUEST' } }))).json()).token as string;
  await page.waitForTimeout(4000);
  const target = others[0]!;
  const person = { firstName: 'Karima', lastName: 'Testeuse', email, phone: '+33612345678', whatsappOptIn: false };
  const interestKey = idem();
  const interest = await retry(() => page.request.post('/api/v1/public/leads', {
    headers: { ...interestKey, 'X-Form-Token': token },
    data: {
      form: 'PROPERTY_INTEREST',
      fields: { ...person, countryOfResidence: 'FR', message: 'Ce bien m’intéresse, pouvez-vous me rappeler en fin de journée ?', consentContact: true },
      context: { propertyReference: target.reference, propertyTitle: target.title, priceShown: target.priceFromRef?.amount, currencyShown: target.priceFromRef?.currency },
      tracking: { locale: 'fr', submittedFromPath: `/biens/${target.slug}` },
    },
  }));
  expect(interest.status(), await interest.text()).toBe(201);
  const callbackKey = idem();
  await retry(() => page.request.post('/api/v1/public/leads', {
    headers: { ...callbackKey, 'X-Form-Token': callbackToken },
    data: { form: 'CALLBACK_REQUEST', fields: { ...person, subject: 'FINANCING', preferredSlot: 'EVENING', consentContact: true }, context: {}, tracking: { locale: 'fr', submittedFromPath: '/financements' } },
  }));

  const elig = await api(
    page,
    'POST',
    '/public/simulations/eligibility',
    { propertyCountry: 'DZ', residencyStatus: 'NON_RESIDENT', countryOfResidence: 'FR', birthYear: 1984, monthlyIncome: '3400', incomeCurrency: 'EUR', monthlyDebts: '150', downPayment: '30000', financingPreference: 'NO_PREFERENCE' },
    idem(), // one key for the call and its repetitions (`retry`)
  );
  expect(elig.status()).toBe(201);
  const { id: simId } = await elig.json();
  await api(page, 'POST', `/public/simulations/${simId}/save`, {});
  for (const [amount, months] of [
    ['120000', 240],
    ['95000', 180],
  ] as const) {
    await api(page, 'POST', '/public/simulations', { isSaved: true, activeIndex: 0, scenarios: [{ mode: 'FROM_AMOUNT', amount, currency: 'EUR', durationMonths: months, annualRateBps: 650, pricingMethod: 'AMORTIZED_RATE' }] }, idem());
  }

  await api(page, 'POST', '/client/alerts', { frequency: 'DAILY', criteria: { region: 'alger', type: 'APARTMENT' } }, idem());
  const weekly = await (await api(page, 'POST', '/client/alerts', { frequency: 'WEEKLY', criteria: { region: 'oran' } }, idem())).json();
  await api(page, 'PATCH', `/client/alerts/${weekly.alert.id}`, { paused: true });
  await api(page, 'POST', '/client/alerts', { frequency: 'NONE', criteria: { type: 'VILLA' } });

  demoDossierFor(email);
  const space = await (await api(page, 'GET', '/client/space')).json();
  const dossiers: { reference: string; hasDocumentList: boolean }[] = space.dossiers;
  const withList = dossiers.find((d) => d.hasDocumentList);
  expect(withList, 'the demonstration dossier').toBeTruthy();

  const message = await api(
    page,
    'POST',
    '/client/leads',
    { message: 'Bonjour, puis-je déposer mon avis d’imposition de l’an dernier ?', prefilledFrom: 'DOCUMENTS', dossierReference: withList!.reference, submittedFromPath: '/espace-client/messages' },
    idem(),
  );
  expect(message.status()).toBe(201);
  // the notifications are written from the outbox, after the commit
  await expect(async () => expect((await (await api(page, 'GET', '/client/space')).json()).unreadNotifications).toBeGreaterThan(0)).toPass({ timeout: 20_000 });
  return { documentsDossier: withList!.reference.toLowerCase(), dossiers: dossiers.map((d) => d.reference.toLowerCase()) };
}
