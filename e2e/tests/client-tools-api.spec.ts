// EC-40 / SIM-032 / SIM-033, EC-41, EC-42 / CAT-093 through the real API, as a signed-in client.
import { expect, test } from '@playwright/test';
import { freshIp, signUpClient } from './helpers/account';
import { api, idem } from './helpers/space-api';

test('client tools: saved simulations, favourites, alerts and saved searches', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'API journey: once');
  test.setTimeout(180_000);
  await freshIp(page);
  await signUpClient(page);

  // ── EC-40 — an eligibility simulation computed signed in belongs to the account; « Enregistrer » lists it.
  const elig = await api(
    page,
    'POST',
    '/public/simulations/eligibility',
    { propertyCountry: 'DZ', residencyStatus: 'NON_RESIDENT', countryOfResidence: 'FR', birthYear: 1985, monthlyIncome: '3200', incomeCurrency: 'EUR', monthlyDebts: '0', downPayment: '30000', financingPreference: 'NO_PREFERENCE' },
    idem(),
  );
  expect(elig.status()).toBe(201);
  const { id: simId } = await elig.json();
  expect((await (await api(page, 'GET', '/client/simulations')).json()).data).toHaveLength(0);
  expect((await api(page, 'POST', `/public/simulations/${simId}/save`, {})).status()).toBe(200);
  const list = await (await api(page, 'GET', '/client/simulations')).json();
  expect(list.data).toHaveLength(1);
  expect(list.data[0].type).toBe('ELIGIBILITY');
  expect(['BUDGET', 'CAPACITY', 'NOT_ELIGIBLE']).toContain(list.data[0].headline.kind);
  // Rename, detail, PDF, apply to profile (SIM-033), prefill reads it back, delete.
  expect((await (await api(page, 'PATCH', `/client/simulations/${simId}`, { label: 'Mon projet à Oran' })).json()).label).toBe('Mon projet à Oran');
  const detail = await (await api(page, 'GET', `/client/simulations/${simId}`)).json();
  expect(Number(detail.inputs.monthlyIncome)).toBe(3200);
  const pdf = await api(page, 'GET', `/client/simulations/${simId}/pdf`);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await api(page, 'POST', `/client/simulations/${simId}/profile`, {})).status()).toBe(200);
  const prefill = await (await api(page, 'GET', '/client/simulations/prefill')).json();
  expect(prefill.residencyStatus).toBe('NON_RESIDENT');
  expect(prefill.monthlyIncome).toBe('3200.00');
  expect((await api(page, 'DELETE', `/client/simulations/${simId}`)).status()).toBe(204);
  expect((await (await api(page, 'GET', '/client/simulations')).json()).data).toHaveLength(0);

  // ── EC-41 — favourites of the account, by reference.
  const catalogue = await (await page.request.get('/api/v1/public/properties?page=1')).json();
  const refs: string[] = catalogue.data.slice(0, 2).map((c: { reference: string }) => c.reference);
  expect(refs.length).toBe(2);
  expect((await (await api(page, 'PUT', `/client/favorites/${refs[0]}`)).json()).favorite).toBe(true);
  await api(page, 'PUT', `/client/favorites/${refs[0]}`); // twice = once
  await api(page, 'PUT', `/client/favorites/${refs[1]}`);
  const favs = await (await api(page, 'GET', '/client/favorites')).json();
  expect(favs.references).toEqual([refs[1], refs[0]]); // most recently added first
  expect(favs.data[0].state).toBe('ONLINE');
  expect((await (await api(page, 'DELETE', `/client/favorites/${refs[1]}`)).json()).count).toBe(1);
  expect((await api(page, 'PUT', '/client/favorites/DP-ZZ-9999')).status()).toBe(404);

  // ── EC-42 / CAT-093 — a saved search (NONE), then it becomes an alert; an alert paused, extended, deleted.
  const saved = await api(page, 'POST', '/client/alerts', { frequency: 'NONE', criteria: { region: 'oran', vue: 'carte', sort: 'price', bbox: '1,2,3,4' } });
  expect(saved.status()).toBe(201);
  const search = (await saved.json()).alert;
  expect(search.kind).toBe('SEARCH');
  expect(search.criteria.vue).toBeUndefined(); // Q-055
  expect(search.criteria.bbox).toBeUndefined();
  expect((await (await api(page, 'POST', '/client/alerts', { frequency: 'NONE', criteria: { region: 'oran' } })).json()).outcome).toBe('ALREADY_EXISTS');
  const renamed = await (await api(page, 'PATCH', `/client/alerts/${search.id}`, { label: 'Oran, à revoir' })).json();
  expect(renamed.label).toBe('Oran, à revoir');
  const toAlert = await (await api(page, 'PATCH', `/client/alerts/${search.id}`, { frequency: 'WEEKLY' })).json();
  expect(toAlert.kind).toBe('ALERT');
  expect(toAlert.state).toBe('ACTIVE');

  const created = await api(page, 'POST', '/client/alerts', { frequency: 'DAILY', criteria: { region: 'alger', type: 'APARTMENT' } }, idem());
  expect(created.status()).toBe(201);
  const alert = (await created.json()).alert;
  expect(alert.state).toBe('ACTIVE');
  expect((await (await api(page, 'PATCH', `/client/alerts/${alert.id}`, { paused: true })).json()).state).toBe('PAUSED');
  expect((await (await api(page, 'PATCH', `/client/alerts/${alert.id}`, { paused: false })).json()).state).toBe('ACTIVE');
  expect((await (await api(page, 'PATCH', `/client/alerts/${alert.id}`, { frequency: 'INSTANT' })).json()).frequency).toBe('INSTANT');
  expect((await api(page, 'PATCH', `/client/alerts/${alert.id}`, { extend: true })).status()).toBe(200);
  const all = await (await api(page, 'GET', '/client/alerts')).json();
  expect(all.alerts).toHaveLength(2);
  expect(all.searches).toHaveLength(0);
  expect((await api(page, 'DELETE', `/client/alerts/${alert.id}`)).status()).toBe(204);
  expect((await api(page, 'DELETE', `/client/alerts/${alert.id}`)).status()).toBe(404);
});
