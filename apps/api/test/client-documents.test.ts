// Package 2.9 — pure rules of the client's pieces (DOS-003, DOS-014, API-081, CAL-055, MED-011, MED-032), the checklist
// planning (GED-020), the signed private-file address (MED-030), the favourites changes (AUT-062).
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { favoriteChangeKindOf, favoriteChangeOf } from '../src/client-tools/favorites-watch.js';
import { evaluate, planChecklist } from '../src/documents/checklist.js';
import {
  clientActions,
  clientState,
  completeness,
  depositKind,
  formatList,
  inRenewalWindow,
  isEncryptedPdf,
  planVersion,
  shownValidity,
  sniffDocumentType,
} from '../src/documents/document-rules.js';
import { assemblePdf, imageReadable, UnreadableImageError } from '../src/documents/pdf-assembly.js';
import { contentDisposition, parseRange, signPrivateFile, verifyPrivateFile } from '../src/files/private-files.js';
import { headlineOf } from '../src/simulations/client-simulations.service.js';

const base = { dossierStage: 'DOCUMENTS', dossierStatus: 'OPEN' as const, today: '2026-10-09', warningDays: 15 };

describe('DOS-003 — the state the client reads', () => {
  it('a security check takes the line', () => {
    expect(clientState({ ...base, status: 'PENDING', expiresAt: null, scanning: true, hasRenewal: false })).toBe('SCANNING');
  });
  it('validated, to renew within 15 days, renewal pending', () => {
    expect(clientState({ ...base, status: 'VALIDATED', expiresAt: '2027-01-01', scanning: false, hasRenewal: false })).toBe('VALIDATED');
    expect(clientState({ ...base, status: 'VALIDATED', expiresAt: '2026-10-20', scanning: false, hasRenewal: false })).toBe('VALIDATED_TO_RENEW');
    expect(clientState({ ...base, status: 'VALIDATED', expiresAt: '2026-10-20', scanning: false, hasRenewal: true })).toBe('VALIDATED_RENEWAL_PENDING');
  });
  it('CYC-141 — renewal only at the DOCUMENTS step', () => {
    expect(inRenewalWindow({ ...base, status: 'VALIDATED', expiresAt: '2026-10-20', dossierStage: 'BANK_REVIEW' })).toBe(false);
    expect(inRenewalWindow({ ...base, status: 'VALIDATED', expiresAt: '2026-10-09' })).toBe(false);
  });
  it('a passed validity is not shown (CYC-145)', () => {
    expect(shownValidity({ status: 'VALIDATED', expiresAt: '2026-10-01', today: '2026-10-09' })).toBeNull();
    expect(shownValidity({ status: 'VALIDATED', expiresAt: '2026-12-01', today: '2026-10-09' })).toBe('2026-12-01');
  });
});

describe('DOS-006, DOS-014, DOS-016 — actions', () => {
  const a = { ...base, providedBy: 'CLIENT', isInternal: false, scanning: false, partyRestricted: false, filesPurged: false };
  it('pending: deposit; received: edit; validated: nothing (locked)', () => {
    expect(clientActions({ ...a, status: 'PENDING', expiresAt: null, hasCurrentFiles: false })).toMatchObject({ deposit: true, edit: false, renew: false });
    expect(clientActions({ ...a, status: 'RECEIVED', expiresAt: null, hasCurrentFiles: true })).toMatchObject({ deposit: false, edit: true, view: true });
    expect(clientActions({ ...a, status: 'VALIDATED', expiresAt: null, hasCurrentFiles: true })).toMatchObject({ deposit: false, edit: false, renew: false, view: true });
  });
  it('closed dossier, team piece, restricted person: read only', () => {
    expect(clientActions({ ...a, dossierStatus: 'WON', status: 'PENDING', expiresAt: null, hasCurrentFiles: false }).deposit).toBe(false);
    expect(clientActions({ ...a, providedBy: 'OPERATOR', status: 'PENDING', expiresAt: null, hasCurrentFiles: false }).deposit).toBe(false);
    expect(clientActions({ ...a, partyRestricted: true, status: 'PENDING', expiresAt: null, hasCurrentFiles: false }).deposit).toBe(false);
  });
  it('API-081 point 3 — nature of a deposit', () => {
    expect(depositKind({ ...base, status: 'REJECTED', expiresAt: null, isRenewal: true })).toBe('REPLACEMENT');
    expect(depositKind({ ...base, status: 'VALIDATED', expiresAt: '2026-10-20', isRenewal: true })).toBe('RENEWAL');
    expect(depositKind({ ...base, status: 'VALIDATED', expiresAt: '2026-10-20', isRenewal: false })).toBe('LOCKED');
    expect(depositKind({ ...base, status: 'WAIVED', expiresAt: null, isRenewal: false })).toBe('LOCKED');
  });
});

describe('API-081 points 4 and 5 — the version plan', () => {
  const uploads = new Map([
    ['i1', { mimeType: 'image/jpeg' }],
    ['i2', { mimeType: 'image/png' }],
    ['p1', { mimeType: 'application/pdf' }],
  ]);
  const plan = (o: Partial<Parameters<typeof planVersion>[0]>) =>
    planVersion({ mode: 'REPLACE_ALL', keptFileIds: [], uploadIds: [], currentFileIds: ['f1', 'f2'], uploads, keptMime: new Map(), maxFiles: 2, ...o });
  it('MED-032 — all images of a deposit count as ONE file', () => {
    expect(plan({ uploadIds: ['i1', 'i2', 'p1'] })).toMatchObject({ ok: true, fileCount: 2, imageCount: 2 });
  });
  it('TOO_MANY_FILES after joining the images', () => {
    expect(plan({ mode: 'ADD', keptFileIds: ['f1', 'f2'], uploadIds: ['p1'] })).toEqual({ ok: false, error: 'TOO_MANY_FILES' });
  });
  it('ADD keeps every current file; REMOVE keeps at least one and not all; REPLACE_ALL keeps none', () => {
    expect(plan({ mode: 'ADD', keptFileIds: ['f1'], uploadIds: ['p1'], maxFiles: 5 })).toEqual({ ok: false, error: 'KEPT_INVALID' });
    expect(plan({ mode: 'REMOVE', keptFileIds: ['f1', 'f2'] })).toEqual({ ok: false, error: 'KEPT_INVALID' });
    expect(plan({ mode: 'REMOVE', keptFileIds: ['f2'] })).toMatchObject({ ok: true, fileCount: 1 });
    expect(plan({ mode: 'REPLACE_ALL', keptFileIds: ['f1'], uploadIds: ['p1'] })).toEqual({ ok: false, error: 'KEPT_INVALID' });
    expect(plan({ mode: 'REPLACE_ALL' })).toEqual({ ok: false, error: 'MODE_INVALID' });
  });
  it('a file not of the current version, or cited twice, is refused', () => {
    expect(plan({ mode: 'REMOVE', keptFileIds: ['zz'] })).toEqual({ ok: false, error: 'KEPT_INVALID' });
    expect(plan({ mode: 'ADD', keptFileIds: ['f1', 'f1'], uploadIds: ['p1'] })).toEqual({ ok: false, error: 'KEPT_INVALID' });
  });
  it('more than 30 images: TOO_MANY_IMAGES', () => {
    const many = new Map(Array.from({ length: 31 }, (_, i) => [`x${i}`, { mimeType: 'image/jpeg' }]));
    expect(planVersion({ mode: 'REPLACE_ALL', keptFileIds: [], uploadIds: [...many.keys()], currentFileIds: [], uploads: many, keptMime: new Map(), maxFiles: 5 })).toEqual({ ok: false, error: 'TOO_MANY_IMAGES' });
  });
});

describe('CAL-055 — completeness', () => {
  it('validated or waived count; removed borrowers and internal pieces do not; 100 without required piece', () => {
    const d = (status: 'PENDING' | 'VALIDATED' | 'WAIVED', extra = {}) => ({ isRequired: true, isInternal: false, partyRemoved: false, status, ...extra });
    expect(completeness([d('VALIDATED'), d('WAIVED'), d('PENDING')])).toEqual({ required: 3, satisfied: 2, pct: 66 });
    expect(completeness([d('PENDING', { partyRemoved: true }), d('PENDING', { isInternal: true })])).toEqual({ required: 0, satisfied: 0, pct: 100 });
  });
});

describe('MED-011 — real type', () => {
  it('reads PDF, JPEG, PNG, HEIC from the content, not the name', async () => {
    expect(sniffDocumentType(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
    expect(sniffDocumentType(await sharp({ create: { width: 4, height: 4, channels: 3, background: '#f00' } }).png().toBuffer())).toBe('image/png');
    expect(sniffDocumentType(Buffer.from('MZ\x90\x00 not allowed'))).toBeNull();
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(8)]);
    expect(sniffDocumentType(heic)).toBe('image/heic');
  });
  it('a protected PDF is detected', () => {
    expect(isEncryptedPdf(Buffer.from('%PDF-1.4\ntrailer<</Root 1 0 R/Encrypt 5 0 R>>\n%%EOF'))).toBe(true);
    expect(isEncryptedPdf(Buffer.from('%PDF-1.4\ntrailer<</Root 1 0 R>>\n%%EOF'))).toBe(false);
  });
  it('formats as read (« jpeg » folded into « jpg »)', () => {
    expect(formatList(['pdf', 'jpg', 'jpeg', 'png', 'heic'])).toEqual(['pdf', 'jpg', 'png', 'heic']);
  });
});

describe('MED-032 — photos joined into one PDF', () => {
  it('one page per image, in order; an unreadable image is reported with its index', async () => {
    const a = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#0af' } }).jpeg().toBuffer();
    const b = await sharp({ create: { width: 600, height: 900, channels: 3, background: '#fa0' } }).png().toBuffer();
    const { pdf, pages } = await assemblePdf([a, b], 'Relevés');
    expect(pages).toBe(2);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(2);
    const broken = Buffer.concat([b.subarray(0, 40)]);
    expect(await imageReadable(broken)).toBe(false);
    await expect(assemblePdf([a, broken], 'x')).rejects.toBeInstanceOf(UnreadableImageError);
  });
});

describe('GED-020 — checklist planning', () => {
  const item = (code: string, o: Record<string, unknown> = {}) =>
    ({ id: code, code, perParty: true, appliesToRoles: ['PRIMARY', 'CO_BORROWER'], appliesWhen: null, ...o }) as never;
  const parties = [
    { id: 'p', role: 'PRIMARY' as const, employmentType: null, residencyStatus: null },
    { id: 'c', role: 'CO_BORROWER' as const, employmentType: 'PERMANENT' as const, residencyStatus: 'RESIDENT' as const },
  ];
  it('one piece per concerned person; unknown data → no piece and the person is reported', () => {
    const r = planChecklist(
      [item('ID'), item('PAY', { appliesWhen: { employmentType: ['PERMANENT'], financingRequested: true } }), item('FAMILY', { perParty: false })],
      parties,
      { employmentType: null, residencyStatus: 'NON_RESIDENT' },
      { financingRequested: true, financingType: 'CONVENTIONAL', hasCoBorrower: true },
    );
    expect(r.pieces.map((p) => `${(p.item as unknown as { code: string }).code}:${p.partyId}`)).toEqual(['ID:p', 'ID:c', 'PAY:c', 'FAMILY:null']);
    expect(r.missingPartyIds).toEqual(['p']);
  });
  it('MOD-340 — a type condition only for a CONVENTIONAL / ISLAMIC dossier; cash buyers skip financing lines', () => {
    expect(evaluate({ financingType: ['ISLAMIC'] }, { employmentType: null, residencyStatus: null }, { financingRequested: true, financingType: 'NO_PREFERENCE', hasCoBorrower: false })).toBe(false);
    expect(evaluate({ financingRequested: true }, { employmentType: null, residencyStatus: null }, { financingRequested: false, financingType: 'CASH', hasCoBorrower: false })).toBe(false);
  });
});

describe('MED-030 — signed private address', () => {
  const key = 'k'.repeat(48);
  const id = '01a12000-0000-7000-8000-000000000001';
  it('identifiers only, 5 minutes, forged or expired → null', () => {
    const now = new Date('2026-10-09T10:00:00Z');
    const { token } = signPrivateFile(key, 'doc', id, 'inline', now);
    expect(token.startsWith(`doc.${id}.i.`)).toBe(true);
    expect(verifyPrivateFile(key, token, now)).toEqual({ kind: 'doc', id, disposition: 'inline' });
    expect(verifyPrivateFile(key, token, new Date(now.getTime() + 5 * 60_000 + 1000))).toBeNull();
    expect(verifyPrivateFile('other'.repeat(10), token, now)).toBeNull();
    expect(verifyPrivateFile(key, token.replace('.i.', '.a.'), now)).toBeNull();
  });
  it('ranges and file names', () => {
    expect(parseRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=200-', 100)).toBe('invalid');
    expect(contentDisposition('attachment', 'Relevé été.pdf')).toContain("filename*=UTF-8''Relev%C3%A9%20%C3%A9t%C3%A9.pdf");
  });
});

describe('AUT-062 — favourite changes', () => {
  it('a price drop of 3 % in the property currency; last lots; unavailable', () => {
    expect(favoriteChangeOf('property.price_changed', { from: '10000000.00', to: '9600000.00' }, 3)).toEqual({ kind: 'PRICE_DROP' });
    expect(favoriteChangeOf('property.price_changed', { from: '10000000.00', to: '9800000.00' }, 3)).toBeNull();
    expect(favoriteChangeOf('property.price_changed', { from: '9000000.00', to: '9800000.00' }, 3)).toBeNull();
    expect(favoriteChangeOf('property.availability_changed', { from: 'AVAILABLE', to: 'AVAILABLE', lotsAvailable: 2, lotsAvailableBefore: 3 }, 3)).toEqual({ kind: 'LAST_LOTS', lots: 2 });
    expect(favoriteChangeOf('property.availability_changed', { from: 'AVAILABLE', to: 'AVAILABLE', lotsAvailable: 2, lotsAvailableBefore: 1 }, 3)).toBeNull();
    expect(favoriteChangeOf('property.availability_changed', { from: 'AVAILABLE', to: 'SOLD', lotsAvailable: 0, lotsAvailableBefore: 1 }, 3)).toEqual({ kind: 'UNAVAILABLE' });
  });
});

describe('EC-41 / AUT-062 — what changed on a favourite, read back from the notification', () => {
  it('the kind travels in the key of the notification; keys of before are read by their event', () => {
    expect(favoriteChangeKindOf('NC_FAVORITE_UPDATE:PRICE_DROP:property.price_changed:01a1')).toBe('PRICE_DROP');
    expect(favoriteChangeKindOf('NC_FAVORITE_UPDATE:LAST_LOTS:property.availability_changed:01a2')).toBe('LAST_LOTS');
    expect(favoriteChangeKindOf('NC_FAVORITE_UPDATE:UNAVAILABLE:archived:01a3')).toBe('UNAVAILABLE');
    expect(favoriteChangeKindOf('NC_FAVORITE_UPDATE:property.price_changed:01a4')).toBe('PRICE_DROP');
    expect(favoriteChangeKindOf('NC_FAVORITE_UPDATE:archived:01a5')).toBe('UNAVAILABLE');
    expect(favoriteChangeKindOf('NC_FAVORITE_UPDATE:property.availability_changed:01a6')).toBeNull(); // last lots or unavailable: unknown
    expect(favoriteChangeKindOf(null)).toBeNull();
  });
});

describe('SFA-010 — headline of a credit simulation', () => {
  it('the monthly payment of the active scenario, to the cent', () => {
    const h = headlineOf({
      type: 'CREDIT',
      inputs: { activeIndex: 0, scenarios: [] },
      outputs: { scenarios: [{ monthlyPayment: { amount: '894.69', currency: 'EUR' }, durationMonths: 240, amount: { amount: '120000.00', currency: 'EUR' }, annualRateBps: 650, productCurrency: null }] },
    } as never);
    expect(h).toEqual({ kind: 'MONTHLY', amount: { amount: '894.69', currency: 'EUR' }, durationMonths: 240, principal: { amount: '120000.00', currency: 'EUR' }, annualRateBps: 650, converted: false });
  });
});
