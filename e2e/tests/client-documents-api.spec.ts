// Package 2.9 — EC-20/EC-21 through the real API: the demonstration dossier of the account (plan 2.9), the list as the
// client reads it (DOS-003), the three-step upload (API-080), a version (API-081) processed in the background (CYC-140),
// photos joined into one PDF (MED-032), the signed 5-minute reading address (MED-030), ownership (404), the limits
// (TOO_MANY_FILES), the transmission consent (DOS-040).
import { expect, test } from '@playwright/test';
import { freshIp, signUpClient } from './helpers/account';
import { api, demoDossierFor, idem, tinyPdf, tinyPng, uploadFile } from './helpers/space-api';

interface Doc {
  id: string;
  label: string;
  state: string;
  status: string;
  current: { number: number; files: { id: string; fileName: string; mimeType: string; assembledFromImages: number | null }[] } | null;
  actions: { deposit: boolean; edit: boolean; renew: boolean; view: boolean };
  maxFiles: number;
}

test('documents: list, upload, version, photos joined, signed reading, consent', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'API journey: once');
  test.setTimeout(240_000);
  await freshIp(page);
  const { email } = await signUpClient(page);
  demoDossierFor(email);

  const space = await (await api(page, 'GET', '/client/space')).json();
  const reference: string = space.dossiers[0].reference;
  expect(space.dossiers[0].hasDocumentList).toBe(true);

  const view = await (await api(page, 'GET', `/client/dossiers/${reference}/documents`)).json();
  const docs = view.documents as Doc[];
  // Demonstration states (validated, to renew, rejected, received) and pieces to provide.
  expect(docs.find((d) => d.label.startsWith('Passeport'))?.state).toBe('VALIDATED');
  expect(docs.find((d) => d.label.startsWith('Acte de naissance'))?.state).toBe('VALIDATED_TO_RENEW');
  expect(docs.find((d) => d.label.startsWith('Justificatif de domicile'))?.state).toBe('REJECTED');
  expect(view.consent.given).toBe(false);

  // Ownership: a dossier reference of nobody → 404.
  expect((await api(page, 'GET', '/client/dossiers/DOS-1999-9999/documents')).status()).toBe(404);

  // A PDF on a piece to provide.
  const target = docs.find((d) => d.status === 'PENDING' && d.actions.deposit)!;
  const pdfUpload = await uploadFile(page, reference, target.id, tinyPdf('Avis'), 'avis.pdf', 'application/pdf');
  const v1 = await api(page, 'POST', `/client/dossiers/${reference}/documents/${target.id}/versions`, { mode: 'REPLACE_ALL', uploadIds: [pdfUpload] }, idem());
  expect(v1.status()).toBe(201);
  expect((await v1.json()).state).toBe('SCANNING');
  // A second deposit while the first is in its security check is refused (API-081 point 2) — or already processed.
  await expect
    .poll(async () => ((await (await api(page, 'GET', `/client/dossiers/${reference}/documents/${target.id}`)).json()) as Doc).state, { timeout: 20_000 })
    .toBe('RECEIVED');

  // Two photos added to it: they become ONE PDF (MED-032), next to the kept PDF.
  const after = (await (await api(page, 'GET', `/client/dossiers/${reference}/documents/${target.id}`)).json()) as Doc;
  const kept = after.current!.files.map((f) => f.id);
  const p1 = await uploadFile(page, reference, target.id, tinyPng(80, 60, [10, 120, 200]), 'page1.png', 'image/png');
  const p2 = await uploadFile(page, reference, target.id, tinyPng(60, 80, [200, 160, 20]), 'page2.png', 'image/png');
  const v2 = await api(page, 'POST', `/client/dossiers/${reference}/documents/${target.id}/versions`, { mode: 'ADD', keptFileIds: kept, uploadIds: [p1, p2] }, idem());
  expect(v2.status()).toBe(201);
  let joined: Doc | null = null;
  await expect
    .poll(async () => {
      joined = (await (await api(page, 'GET', `/client/dossiers/${reference}/documents/${target.id}`)).json()) as Doc;
      return joined.current?.number;
    }, { timeout: 30_000 })
    .toBe(2);
  const files = joined!.current!.files;
  expect(files).toHaveLength(2);
  expect(files[1]!.assembledFromImages).toBe(2);
  expect(files[1]!.mimeType).toBe('application/pdf');

  // MED-030 — a signed address, then the file itself (inline, with Range).
  const link = await (await api(page, 'GET', `/client/dossiers/${reference}/documents/${target.id}/files/${files[1]!.id}?disposition=inline`)).json();
  expect(link.url).toMatch(/^\/api\/v1\/files\/private\/doc\./);
  expect(link.url).not.toContain('page1');
  const served = await page.request.get(link.url);
  expect(served.status()).toBe(200);
  expect(served.headers()['content-type']).toBe('application/pdf');
  expect(served.headers()['cache-control']).toContain('no-store');
  expect((await served.body()).subarray(0, 5).toString()).toBe('%PDF-');
  const ranged = await page.request.get(link.url, { headers: { Range: 'bytes=0-9' } });
  expect(ranged.status()).toBe(206);
  // A forged token is gone.
  expect((await page.request.get(link.url.replace(/.$/, (c: string) => (c === 'A' ? 'B' : 'A')))).status()).toBe(410);

  // DOS-011 / API-081 — more files than allowed: 409 TOO_MANY_FILES.
  const other = docs.find((d) => d.status === 'PENDING' && d.actions.deposit && d.id !== target.id && d.maxFiles <= 6)!;
  const ids: string[] = [];
  for (let i = 0; i <= other.maxFiles; i++) ids.push(await uploadFile(page, reference, other.id, tinyPdf(`P${i}`), `p${i}.pdf`, 'application/pdf'));
  const tooMany = await api(page, 'POST', `/client/dossiers/${reference}/documents/${other.id}/versions`, { mode: 'REPLACE_ALL', uploadIds: ids }, idem());
  expect(tooMany.status()).toBe(409);
  expect((await tooMany.json()).error.reason).toBe('TOO_MANY_FILES');

  // A validated piece outside its renewal window is locked (DOS-006).
  const passport = docs.find((d) => d.label.startsWith('Passeport'))!;
  const locked = await api(page, 'POST', `/client/dossiers/${reference}/documents/${passport.id}/uploads`, { files: [{ fileName: 'x.pdf', contentType: 'application/pdf', size: 10, sha256: 'a'.repeat(64) }] });
  expect(locked.status()).toBe(409);
  expect((await locked.json()).error.reason).toBe('DOCUMENT_LOCKED');

  // Wrong type announced: 415.
  const bad = await api(page, 'POST', `/client/dossiers/${reference}/documents/${other.id}/uploads`, { files: [{ fileName: 'x.exe', contentType: 'application/x-msdownload', size: 10, sha256: 'a'.repeat(64) }] });
  expect(bad.status()).toBe(415);

  // DOS-040 — the consent, once.
  const consent = await api(page, 'POST', `/client/dossiers/${reference}/consent`, { accepted: true });
  expect(consent.status()).toBe(200);
  expect((await consent.json()).given).toBe(true);
});
