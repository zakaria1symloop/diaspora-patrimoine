// Packages 3.7 and 3.8 through the real API, both sides: the team opens a dossier (PIP-015), notes a call held (TAC-044,
// first contact CYC-004), qualifies it (CYC-021), proposes properties (PIP-031); the client answers from his space
// (INT-020, INT-030); the dossier and a task reflect it (R_SELECTION_REQUESTED, AUT-035); the team confirms the choice
// (CYC-071), pauses and resumes (CYC-031, CYC-032), closes and reopens (CYC-035, CYC-036).
import { expect, test, type Page } from '@playwright/test';
import type { AdminDossierList, AppointmentItem, CandidateList, ClientPick, DossierCreated, DossierDetail, PropertyPick, TaskList } from '@dp/contracts';
import { signUpClient } from './helpers/account.js';
import { ADMIN, adminPost, signInDirection } from './helpers/admin.js';
import { api } from './helpers/space-api.js';

const get = async <T>(page: Page, path: string): Promise<T> => {
  const r = await page.request.get(`${ADMIN}/api/v1${path}`);
  expect(r.status(), path).toBe(200);
  return (await r.json()) as T;
};

async function until<T>(read: () => Promise<T>, ok: (v: T) => boolean, label: string): Promise<T> {
  for (let i = 0; i < 40; i++) {
    const v = await read();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`timeout: ${label}`);
}

test.describe('PIP-015, CYC-021, PIP-031, INT-020, INT-030, CYC-071 — a dossier from both sides', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('the team proposes, the client answers, the dossier and a task reflect it', async ({ browser }) => {
    test.setTimeout(240_000);
    const clientPage = await (await browser.newContext()).newPage();
    const { email } = await signUpClient(clientPage, 'Nadia');
    const adminPage = await (await browser.newContext()).newPage();
    await signInDirection(adminPage);

    // PIP-015 — open a dossier for this client, with a considered property
    const clients = await get<{ data: ClientPick[] }>(adminPage, `/admin/dossiers/pickers/clients?q=${encodeURIComponent(email)}`);
    const client = clients.data[0]!;
    expect(client, 'client found by the picker').toBeTruthy();
    const props = await get<{ data: PropertyPick[] }>(adminPage, '/admin/dossiers/pickers/properties');
    const available = props.data.filter((p) => p.availability === 'AVAILABLE');
    expect(available.length).toBeGreaterThan(2);
    const created = await adminPost(adminPage, adminPage.request, '/admin/dossiers', { clientId: client.id, propertyId: available[0]!.id, financingRequested: true });
    expect(created.status()).toBe(201);
    const { reference, id } = (await created.json()) as DossierCreated;
    let d = await get<DossierDetail>(adminPage, `/admin/dossiers/${reference}`);
    expect(d.stage).toBe('QUALIFICATION'); // CYC-020: an adviser → QUALIFICATION at once
    expect(d.action).toBe('QUALIFY');
    expect(d.conditions.find((c) => c.code === 'FIRST_CONTACT')?.met).toBe(false);

    // A second dossier for the same retained property would be refused; considering it is only announced
    const twice = await adminPost(adminPage, adminPage.request, '/admin/dossiers', { clientId: client.id, propertyId: available[0]!.id, financingRequested: true });
    expect(twice.status()).toBe(409);
    expect((await twice.json()).error.reason).toBe('DOSSIER_CONSIDERS_PROPERTY');

    // CYC-021 — qualifying without first contact is refused with the missing conditions (API-102)
    const refused = await adminPost(adminPage, adminPage.request, `/admin/dossiers/${id}/qualify`, { version: d.version, client: {} });
    expect(refused.status()).toBe(409);
    const body = await refused.json();
    expect(body.error.reason).toBe('MISSING_CONDITIONS');
    expect(body.error.details.map((x: { field: string }) => x.field)).toContain('FIRST_CONTACT');

    // TAC-044 — a call that has just started, noted at once: a past hour creates it « Tenu »; held after the opening of
    // the dossier, it is its first contact (CYC-004: facts after the creation of a dossier opened by hand)
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const part = (k: string) => parts.find((x) => x.type === k)!.value;
    await new Promise((r) => setTimeout(r, 1100));
    const call = await adminPost(adminPage, adminPage.request, '/admin/appointments', { clientId: client.id, dossierId: id, type: 'CALL', date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}`, durationMinutes: 5, zone: 'Europe/Paris', notifyClient: true });
    expect(call.status()).toBe(201);
    expect(((await call.json()) as AppointmentItem).status).toBe('DONE');
    d = await get<DossierDetail>(adminPage, `/admin/dossiers/${reference}`);
    expect(d.conditions.find((c) => c.code === 'FIRST_CONTACT')?.met).toBe(true);

    // CRM-050 — the window completes the record and qualifies in one gesture
    const qualified = await adminPost(adminPage, adminPage.request, `/admin/dossiers/${id}/qualify`, {
      version: d.version,
      client: { countryOfResidence: 'FR', residencyStatus: 'NON_RESIDENT', budgetMax: '180000', budgetCurrency: 'EUR', downPayment: '30000', downPaymentCurrency: 'EUR', financingPreference: 'CONVENTIONAL', purchaseTimeframe: 'M6_12' },
    });
    expect(qualified.status(), await qualified.text()).toBe(200);
    d = (await qualified.json()) as DossierDetail;
    expect(d.stage).toBe('MATCHING');

    // PIP-031 — one draft, then one sending that takes the draft with it
    const draft = await adminPost(adminPage, adminPage.request, `/admin/dossiers/${id}/candidates/propose`, { propertyIds: [available[1]!.id], send: false });
    expect(draft.status()).toBe(200);
    const sent = await adminPost(adminPage, adminPage.request, `/admin/dossiers/${id}/candidates/propose`, { propertyIds: [available[2]!.id], message: 'Deux biens près de la mer.', send: true });
    expect(sent.status()).toBe(200);
    expect((await sent.json()).sent).toBe(2);

    // The client sees the proposals, grouped by sending (INT-010), and answers (INT-020)
    const pr = await api(clientPage, 'GET', '/client/proposals');
    expect(pr.status(), await pr.text()).toBe(200);
    const proposals = await pr.json();
    const cards = proposals.groups.flatMap((g: { items: { id: string; property: { reference: string } }[] }) => g.items);
    const target = cards.find((c: { property: { reference: string } }) => c.property.reference === available[1]!.reference);
    expect(target, 'the proposal is in the client space').toBeTruthy();
    expect((await api(clientPage, 'POST', `/client/candidates/${target.id}/interested`, { comment: 'La vue me plaît.' })).status()).toBe(200);
    // INT-030 — « Je retiens ce bien »: the status does not change, the choice waits for the adviser
    const asked = await api(clientPage, 'POST', `/client/candidates/${target.id}/select-request`, {});
    expect(asked.status(), await asked.text()).toBe(200);
    expect((await asked.json()).status).toBe('INTERESTED');

    // The dossier and a task reflect it (R_SELECTION_REQUESTED, AUT-043)
    const list = await get<CandidateList>(adminPage, `/admin/dossiers/${id}/candidates`);
    const row = list.data.find((c) => c.id === target.id)!;
    expect(row.selectionRequestedAt).not.toBeNull();
    expect(row.clientComment).toBe('La vue me plaît.');
    const tasks = await until(() => get<TaskList>(adminPage, `/admin/tasks?view=team&dossierId=${id}`), (r) => r.data.some((t) => t.title.startsWith('Confirmer le bien retenu')), 'selection task');
    const task = tasks.data.find((t) => t.title.startsWith('Confirmer le bien retenu'))!;
    expect(task.origin).toBe('WORKFLOW');
    expect(task.priority).toBe('HIGH');

    // CYC-071 — the adviser confirms: the property is retained, the task closes by itself (AUT-035)
    const confirmed = await adminPost(adminPage, adminPage.request, `/admin/dossiers/${id}/candidates/${target.id}/confirm-selection`, {});
    expect(confirmed.status(), await confirmed.text()).toBe(200);
    expect((await confirmed.json()).status).toBe('SELECTED');
    await until(() => get<TaskList>(adminPage, `/admin/tasks?view=done&dossierId=${id}`), (r) => r.data.some((t) => t.id === task.id && t.status === 'DONE' && t.closedAutomatically), 'task closed');
    d = await get<DossierDetail>(adminPage, `/admin/dossiers/${reference}`);
    expect(d.property?.id).toBe(available[1]!.id);
    expect(d.conditions.find((c) => c.code === 'SELECTED_CANDIDATE')?.met).toBe(true);

    // EC-11 « Mon bien » — the client reads his retained property
    const mine = await (await api(clientPage, 'GET', `/client/dossiers/${reference}/property`)).json();
    expect(mine.property.reference).toBe(available[1]!.reference);

    // CYC-031, CYC-032 — pause (WAITING_CLIENT informs him) and resumption
    const held = await adminPost(adminPage, adminPage.request, `/admin/dossiers/${id}/hold`, { reason: 'WAITING_CLIENT', clientNote: 'Votre avis de situation.', notifyClient: false });
    expect(held.status()).toBe(200);
    expect(((await held.json()) as DossierDetail).status).toBe('ON_HOLD');
    expect((await adminPost(adminPage, adminPage.request, `/admin/dossiers/${id}/qualify`, { version: 1, client: {} })).status()).toBe(409);
    const resumed = await adminPost(adminPage, adminPage.request, `/admin/dossiers/${id}/resume`, {});
    expect(((await resumed.json()) as DossierDetail).status).toBe('OPEN');

    // CYC-035, CYC-036 — closing, then reopening at the most advanced stage whose conditions still hold
    const closed = await adminPost(adminPage, adminPage.request, `/admin/dossiers/${id}/close`, { reason: 'BUDGET', note: null, notifyClient: false });
    expect(((await closed.json()) as DossierDetail).status).toBe('LOST');
    const reopened = await adminPost(adminPage, adminPage.request, `/admin/dossiers/${id}/reopen`, { reason: 'Le client revient vers nous.' });
    const back = (await reopened.json()) as DossierDetail;
    expect(back.status).toBe('OPEN');
    expect(back.stage).toBe('MATCHING');

    // PIP-010 — the list finds it by its reference
    const found = await get<AdminDossierList>(adminPage, `/admin/dossiers?view=all&q=${reference}`);
    expect(found.data.map((x) => x.reference)).toContain(reference);
  });
});
