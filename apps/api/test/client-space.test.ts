// Package 2.8 — rules of the client space that do not need the database: PRO-003 (profile completed), MSG-040 (icon by
// destination), ECL-020 (six displayed steps), ECL-021 (next step), ECL-022 (banners), and the shared request schemas
// (MSG-021 bounds, PRO-051: the transmission agreement is only withdrawn here, DOS-040 gives it).
import { describe, expect, it } from 'vitest';
import { TIMELINE_FAMILIES, clientMessageRequestSchema, consentChangeRequestSchema, notificationReadRequestSchema, profileUpdateRequestSchema, timelineFamilyOf } from '@dp/contracts';
import { FixedClock } from '../src/platform/clock.js';
import { DossierViews, type DossierRow } from '../src/client-space/dossier-view.js';
import { targetOf } from '../src/client-space/notifications.service.js';
import { profileCompletePct } from '../src/client-space/space.service.js';
import type { SpaceReader } from '../src/client-space/space-reader.js';

const now = new Date('2026-10-09T10:00:00Z');

function row(over: Partial<DossierRow> = {}): DossierRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    reference: 'DOS-2026-00001',
    clientId: '00000000-0000-4000-8000-000000000002',
    stage: 'INTEREST',
    status: 'OPEN',
    financingRequested: true,
    assignedAgentId: null,
    propertyId: null,
    firstContactAt: null,
    holdReason: null,
    holdUntil: null,
    holdClientNote: null,
    signingScheduledFor: null,
    keysHandedAt: null,
    completenessPct: 0,
    requiredDocsCount: 0,
    satisfiedDocsCount: 0,
    clientNextStep: null,
    checklistInstantiatedAt: null,
    lastActivityAt: now,
    createdAt: new Date('2026-10-01T08:00:00Z'),
    ...over,
  };
}

/** A reader whose database answers what each test needs (only the reads the rule makes). */
function views(db: { history?: { toStage: string; changedAt: Date }[]; candidates?: unknown[]; appointment?: unknown; documents?: { status: string; isRequired: boolean; providedBy: string; dueAt: Date | null }[] } = {}) {
  const prisma = {
    dossierStageHistory: { findMany: async () => db.history ?? [] },
    dossierCandidate: { findMany: async () => db.candidates ?? [] },
    appointment: { findFirst: async () => db.appointment ?? null },
    dossierDocument: { count: async () => (db.documents ?? []).length, findMany: async () => db.documents ?? [] },
    property: { findUnique: async () => null },
    reservation: { count: async () => 0 },
    consent: { findFirst: async () => null },
  };
  const reader = {
    prisma,
    advisorCard: async () => null,
    propertySummaries: async () => new Map(),
    promiseOf: async (lead: { reference: string } | null) =>
      lead ? { leadReference: lead.reference, kind: 'CALLBACK_REQUEST', preferredCallbackDate: null, preferredSlot: null, timeZone: 'Europe/Paris', breached: false, createdAt: now.toISOString() } : null,
  } as unknown as SpaceReader;
  return new DossierViews(reader, new FixedClock(now));
}

const lead = { reference: 'DEM-2026-00001', kind: 'CALLBACK_REQUEST', status: 'NEW', firstContactAt: null, slaBreachedAt: null, preferredCallbackDate: null, preferredSlot: null, callerTimezone: null, createdAt: now };

describe('PRO-003 — profile completed', () => {
  const empty = { firstName: null, lastName: null, phone: null, countryOfResidence: null, residencyStatus: null, purchaseTimeframe: null, budgetMax: null, budgetMonthly: null, downPayment: null, financingPreference: null };
  it('counts nine pieces of information, integer part', () => {
    expect(profileCompletePct(empty)).toBe(0);
    expect(profileCompletePct({ ...empty, firstName: 'Karima', lastName: 'B', phone: '+33612345678' })).toBe(33);
  });
  it('counts the budget once, total or monthly', () => {
    const base = { ...empty, firstName: 'K', lastName: 'B', phone: '+3361', countryOfResidence: 'FR', residencyStatus: 'NON_RESIDENT', purchaseTimeframe: 'LT_6M', downPayment: 1, financingPreference: 'CASH' };
    expect(profileCompletePct({ ...base, budgetMonthly: 800 })).toBe(100);
    expect(profileCompletePct({ ...base, budgetMax: 150000, budgetMonthly: 800 })).toBe(100);
    expect(profileCompletePct(base)).toBe(88);
  });
});

describe('MSG-040 — icon by the destination of the link', () => {
  it.each([
    ['/espace-client/dossiers/dos-2026-00001/pieces', 'DOCUMENT'],
    ['/espace-client/dossiers/dos-2026-00001/financement', 'FINANCING'],
    ['/espace-client/dossiers/dos-2026-00001', 'DOSSIER'],
    ['/espace-client/messages', 'MESSAGE'],
    ['/espace-client/interets', 'PROPERTY'],
    ['/espace-client/biens-proposes', 'PROPERTY'],
    ['/espace-client/rendez-vous', 'APPOINTMENT'],
    ['/espace-client', 'OTHER'],
    [null, 'OTHER'],
  ])('%s → %s', (link, target) => expect(targetOf(link)).toBe(target));
});

describe('ECL-020 — the six steps the client sees', () => {
  it('at QUALIFICATION: steps 1 and 2 done with their dates, 3 current, the rest upcoming', async () => {
    const v = await views({ history: [{ toStage: 'INTEREST', changedAt: new Date('2026-10-01T08:00:00Z') }, { toStage: 'QUALIFICATION', changedAt: new Date('2026-10-02T08:00:00Z') }] }).view(
      row({ stage: 'QUALIFICATION' }),
      'Europe/Paris',
      null,
    );
    expect(v.steps.map((s) => s.state)).toEqual(['DONE', 'DONE', 'CURRENT', 'UPCOMING', 'UPCOMING', 'UPCOMING']);
    expect(v.steps[1]!.reachedAt).toBe('2026-10-01T08:00:00.000Z');
    expect(v.steps[2]!.reachedAt).toBe('2026-10-02T08:00:00.000Z');
    expect(v.completenessPct).toBeNull(); // ECL-023: from DOCUMENTS on
  });
  it('without financing, step 5 is « Non concerné »', async () => {
    const v = await views().view(row({ stage: 'MATCHING', financingRequested: false }), null, null);
    expect(v.steps[4]!.state).toBe('NOT_CONCERNED');
  });
  it('a won dossier has its six steps checked and a WON banner', async () => {
    const v = await views().view(row({ stage: 'ACQUISITION', status: 'WON' }), null, null);
    expect(v.steps.every((s) => s.state === 'DONE' || s.state === 'NOT_CONCERNED')).toBe(true);
    expect(v.banner?.kind).toBe('WON');
    expect(v.nextStep?.code).toBe('WON');
  });
});

describe('ECL-023 — the figures behind the completeness bar', () => {
  const doc = (status: string, over: Partial<{ isRequired: boolean; providedBy: string; dueAt: Date | null }> = {}) => ({ status, isRequired: true, providedBy: 'CLIENT', dueAt: null, ...over });
  const documents = [
    doc('PENDING', { dueAt: new Date('2026-10-21T00:00:00Z') }),
    doc('PENDING', { dueAt: new Date('2026-10-15T00:00:00Z') }),
    doc('REJECTED'),
    doc('RECEIVED'),
    doc('VALIDATED'),
    doc('PENDING', { isRequired: false }), // optional: not counted (ECL-011 « Ce qui compte »)
    doc('PENDING', { providedBy: 'OPERATOR' }), // expected from us: not something the client has to do
  ];
  it('counts what the client has to provide, redo and what is being checked, with the nearest due date', async () => {
    const v = await views({ documents }).view(row({ stage: 'DOCUMENTS', checklistInstantiatedAt: now, completenessPct: 20, requiredDocsCount: 5, satisfiedDocsCount: 1 }), null, null);
    expect(v.completenessPct).toBe(20);
    expect(v.documents).toEqual({ required: 5, satisfied: 1, toProvide: 2, toRedo: 1, inReview: 1, nearestDue: '2026-10-15' });
  });
  it('no figures before the pieces step, on a closed dossier, or without a list', async () => {
    expect((await views({ documents }).view(row({ stage: 'MATCHING' }), null, null)).documents).toBeNull();
    expect((await views({ documents }).view(row({ stage: 'DOCUMENTS', status: 'LOST' }), null, null)).documents).toBeNull();
    expect((await views().view(row({ stage: 'DOCUMENTS' }), null, null)).documents).toBeNull();
  });
});

describe('ECL-031 — families of the « Suivi » filter', () => {
  it('every kind of line belongs to exactly one family; an unknown kind falls in PROJECT', () => {
    const all = Object.values(TIMELINE_FAMILIES).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(timelineFamilyOf('LEAD_SENT_AGAIN')).toBe('REQUESTS');
    expect(timelineFamilyOf('PROPERTY_SELECTED')).toBe('PROPERTY');
    expect(timelineFamilyOf('DOCUMENTS_REQUESTED')).toBe('DOCUMENTS');
    expect(timelineFamilyOf('BANK_APPROVED')).toBe('FINANCING');
    expect(timelineFamilyOf('PUT_ON_HOLD')).toBe('PROJECT');
    expect(timelineFamilyOf('SOMETHING_NEW')).toBe('PROJECT');
  });
});

describe('ECL-021 / ECL-022 — next step and banners', () => {
  it('INTEREST with an open request: the promise of that request', async () => {
    const n = await views().nextStep(row(), lead, null);
    expect(n?.code).toBe('INTEREST');
    expect(n?.promise?.leadReference).toBe('DEM-2026-00001');
  });
  it('INTEREST without request: « Votre demande est enregistrée. » alone', async () => {
    expect((await views().nextStep(row(), null, null))?.code).toBe('INTEREST_PLAIN');
  });
  it('QUALIFICATION: the call to come, then the advisor at work once contacted', async () => {
    expect((await views().nextStep(row({ stage: 'QUALIFICATION' }), lead, null))?.code).toBe('QUALIFICATION_CALL');
    expect((await views().nextStep(row({ stage: 'QUALIFICATION', firstContactAt: now }), lead, null))?.code).toBe('QUALIFICATION');
  });
  it("the advisor's own sentence wins", async () => {
    const n = await views().nextStep(row({ clientNextStep: 'Je vous envoie trois biens jeudi.' }), lead, null);
    expect(n).toMatchObject({ code: 'ADVISOR', advisorText: 'Je vous envoie trois biens jeudi.' });
  });
  it('MATCHING: proposals waiting before a visit, a selection request first of all', async () => {
    const proposed = { status: 'VIEWED', sentAt: now, selectionRequestedAt: null, property: { title: 'F3 Alger' } };
    const asked = { status: 'INTERESTED', sentAt: null, selectionRequestedAt: now, property: { title: 'Villa Oran' } };
    expect((await views({ candidates: [proposed] }).nextStep(row({ stage: 'MATCHING' }), null, null))?.code).toBe('MATCHING_PROPOSALS');
    const n = await views({ candidates: [proposed, asked] }).nextStep(row({ stage: 'MATCHING' }), null, null);
    expect(n).toMatchObject({ code: 'MATCHING_SELECTION_REQUESTED', params: { property: 'Villa Oran' } });
    expect((await views().nextStep(row({ stage: 'MATCHING' }), null, null))?.code).toBe('MATCHING_PREPARING');
  });
  it('a closed dossier has no next step but its banner; a paused one says when it resumes', async () => {
    const lost = await views().view(row({ status: 'LOST' }), null, null);
    expect(lost.nextStep).toBeNull();
    expect(lost.banner?.kind).toBe('LOST');
    const held = await views().view(row({ status: 'ON_HOLD', holdReason: 'CLIENT_REQUEST', holdUntil: new Date('2026-11-02T00:00:00Z'), holdClientNote: 'votre avis d’imposition' }), null, null);
    expect(held.banner).toMatchObject({ kind: 'ON_HOLD', holdUntil: '2026-11-02', holdClientNote: 'votre avis d’imposition' });
  });
});

describe('shared request schemas', () => {
  it('MSG-021 — 10 to 2 000 characters, a known origin, a dossier reference or null', () => {
    expect(clientMessageRequestSchema.safeParse({ message: 'Trop court' }).success).toBe(true);
    expect(clientMessageRequestSchema.safeParse({ message: 'court' }).success).toBe(false);
    expect(clientMessageRequestSchema.safeParse({ message: 'x'.repeat(2001) }).success).toBe(false);
    expect(clientMessageRequestSchema.safeParse({ message: 'Bonjour à vous', prefilledFrom: 'HACK' }).success).toBe(false);
    expect(clientMessageRequestSchema.safeParse({ message: 'Bonjour à vous', submittedFromPath: 'https://evil.example' }).success).toBe(false);
    expect(clientMessageRequestSchema.parse({ message: 'Bonjour à vous' })).toMatchObject({ prefilledFrom: null, dossierReference: null });
  });
  it('PRO-051 — the transmission agreement is withdrawn here, never given (DOS-040)', () => {
    expect(consentChangeRequestSchema.safeParse({ type: 'DATA_SHARING_PARTNERS', granted: false }).success).toBe(true);
    expect(consentChangeRequestSchema.safeParse({ type: 'DATA_SHARING_PARTNERS', granted: true }).success).toBe(false);
    expect(consentChangeRequestSchema.safeParse({ type: 'MARKETING_EMAIL', granted: true }).success).toBe(true);
    expect(consentChangeRequestSchema.safeParse({ type: 'TERMS_OF_USE', granted: false }).success).toBe(false);
  });
  it('NOT-032 — read by ids or by object', () => {
    expect(notificationReadRequestSchema.safeParse({ entityType: 'Dossier', entityId: '00000000-0000-4000-8000-000000000001' }).success).toBe(true);
    expect(notificationReadRequestSchema.safeParse({ ids: [] }).success).toBe(false);
  });
  it('PRO-001 — one section per call, with its version', () => {
    expect(profileUpdateRequestSchema.safeParse({ section: 'identity', version: 3, values: { firstName: 'Karima', lastName: 'B', birthDate: null, nationalities: ['DZ'] } }).success).toBe(true);
    expect(profileUpdateRequestSchema.safeParse({ section: 'identity', values: { firstName: 'K', lastName: 'B', birthDate: null, nationalities: [] } }).success).toBe(false);
    expect(profileUpdateRequestSchema.safeParse({ section: 'finances', version: 1, values: { currency: 'EUR', monthlyIncome: 'abc', otherMonthlyIncome: null, monthlyDebts: null, downPayment: null } }).success).toBe(false);
  });
});
