import { callbackLabel as label, workdaysLabel } from '@dp/i18n';
import { leadSubmitSchema, type LeadSubmitInput } from '@dp/contracts';
import type { BusinessCalendar } from '@dp/domain';
import { describe, expect, it } from 'vitest';
import { completeClient, type ClientState } from '../src/leads/client-record.js';
import { buildSupplement, changedFields, isDuplicateOf, sameObject } from '../src/leads/duplicate.js';
import { signFormToken, verifyFormToken } from '../src/leads/form-token.js';
import { buildResponse, kindOf, referrerDomain, validateCallbackDate } from '../src/leads/lead-input.js';
import { propertyOutcome } from '../src/leads/lead-objects.js';
import { AppError } from '../src/platform/errors.js';

const now = new Date('2026-10-14T10:00:00Z'); // Wednesday
const cal: BusinessCalendar = { timeZone: 'Europe/Paris', workdays: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', holidays: [] };

describe('callback expression', () => {
  const base = { firstContactBusinessDays: 2, timeZone: 'Europe/Paris' };
  // TRV-010: the messages use no-break spaces (« 48 h », « : »); compared here with plain spaces.
  const callbackLabel = (i: Parameters<typeof label>[0]) => label(i).replace(/[  ]/g, ' ');
  it('NOT-053 no day, no moment → « sous 48 h ouvrées »', () => {
    expect(callbackLabel(base)).toBe('sous 48 h ouvrées');
    expect(callbackLabel({ ...base, preferredSlot: 'ANYTIME' })).toBe('sous 48 h ouvrées');
  });
  it('NOT-053 a moment only → « …, de préférence le matin (heure of the person) »', () => {
    expect(callbackLabel({ ...base, preferredSlot: 'MORNING' })).toBe('sous 48 h ouvrées, de préférence le matin (heure : France)');
    expect(callbackLabel({ ...base, timeZone: 'America/Toronto', preferredSlot: 'EVENING' })).toBe('sous 48 h ouvrées, de préférence le soir (heure : Toronto)');
  });
  it('NOT-053 a day → the day, never « 48 h »', () => {
    expect(callbackLabel({ ...base, preferredCallbackDate: '2026-10-15' })).toBe('jeudi 15 octobre');
    expect(callbackLabel({ ...base, preferredCallbackDate: '2026-10-15', preferredSlot: 'AFTERNOON' })).toBe('jeudi 15 octobre, de préférence l’après-midi (heure : France)');
  });
  it('NOT-053 the delay follows sla.firstContactBusinessDays: 1 → 24 h, 3 and more → « {n} jours ouvrés »', () => {
    expect(callbackLabel({ ...base, firstContactBusinessDays: 1 })).toBe('sous 24 h ouvrées');
    expect(callbackLabel({ ...base, firstContactBusinessDays: 3 })).toBe('sous 3 jours ouvrés');
    expect(callbackLabel({ ...base, firstContactBusinessDays: 3, variant: 'email' })).toBe('sous 3 jours ouvrés');
  });
  it('NOT-053 e-mail variant explains business days from business.calendar.workdays', () => {
    expect(callbackLabel({ ...base, variant: 'email', workdays: [1, 2, 3, 4, 5] })).toBe('sous 48 h ouvrées (deux jours ouvrés, du lundi au vendredi)');
    expect(callbackLabel({ ...base, firstContactBusinessDays: 1, variant: 'email', workdays: [1, 2, 3, 4, 5] })).toBe('sous 24 h ouvrées (un jour ouvré, du lundi au vendredi)');
    expect(workdaysLabel([1, 2, 4])).toBe('lundi, mardi et jeudi');
  });
});

describe('second identical request', () => {
  const earlier = { kind: 'CONTACT_MESSAGE', email: 'a@b.fr', status: 'NEW', createdAt: new Date(now.getTime() - 3_600_000), propertyId: null, programId: null };
  const next = { kind: 'CONTACT_MESSAGE', email: 'A@B.fr', propertyId: null, programId: null };
  it('DEM-024 same e-mail, kind and object within 24 h, first not closed → duplicate', () => {
    expect(isDuplicateOf(earlier, next, now)).toBe(true);
  });
  it('DEM-024 not a duplicate: other kind, closed or spam first request, 24 h passed, other object', () => {
    expect(isDuplicateOf({ ...earlier, kind: 'CALLBACK_REQUEST' }, next, now)).toBe(false);
    expect(isDuplicateOf({ ...earlier, status: 'CLOSED' }, next, now)).toBe(false);
    expect(isDuplicateOf({ ...earlier, status: 'SPAM' }, next, now)).toBe(false);
    expect(isDuplicateOf({ ...earlier, createdAt: new Date(now.getTime() - 24 * 3_600_000) }, next, now)).toBe(false);
    expect(isDuplicateOf({ ...earlier, propertyId: 'p1' }, next, now)).toBe(false);
  });
  it('DEM-024 same object: same property, or same program without property, or none', () => {
    expect(sameObject({ propertyId: 'p1', programId: null }, { propertyId: 'p1', programId: 'g1' })).toBe(true);
    expect(sameObject({ propertyId: 'p1', programId: null }, { propertyId: 'p2', programId: null })).toBe(false);
    expect(sameObject({ propertyId: null, programId: 'g1' }, { propertyId: null, programId: 'g1' })).toBe(true);
    expect(sameObject({ propertyId: null, programId: 'g1' }, { propertyId: null, programId: null })).toBe(false);
  });
  it('DEM-024 the supplement keeps only what differs, with its date and the new message', () => {
    const prev = { firstName: 'Yacine', phone: '+33612345678', subject: 'OTHER', consentContact: true, consentKey: 'lead.contact.v1' };
    const nxt = { firstName: 'Yacine', phone: '+33698765432', subject: 'OTHER', whatsappOptIn: true, consentContact: true, consentKey: 'lead.contact.v1', message: 'Autre message' };
    expect(changedFields(prev, nxt)).toEqual({ phone: '+33698765432', whatsappOptIn: true, message: 'Autre message' });
    const s = buildSupplement(prev, 'Premier message', nxt, now, false);
    expect(s).toEqual({ receivedAt: now.toISOString(), fields: { phone: '+33698765432', whatsappOptIn: true }, message: 'Autre message' });
    expect(buildSupplement(prev, 'Autre message', nxt, now, true)).toMatchObject({ message: null, step2: null });
  });
});

describe('response of POST /public/leads', () => {
  const fields = { firstName: 'Yacine', email: 'y@b.fr', preferredCallbackDate: '2026-10-15', preferredSlot: 'MORNING', createAccount: true, phone: '+33612345678' };
  it('DEM-027 exactly kind, firstName, email, preferredCallbackDate, preferredSlot, accountHint, propertyOutcome', () => {
    const r = buildResponse('CALLBACK_REQUEST', fields, null, null);
    expect(Object.keys(r).sort()).toEqual(['accountHint', 'email', 'firstName', 'kind', 'preferredCallbackDate', 'preferredSlot', 'propertyOutcome']);
    expect(r).toEqual({ kind: 'CALLBACK_REQUEST', firstName: 'Yacine', email: 'y@b.fr', preferredCallbackDate: '2026-10-15', preferredSlot: 'MORNING', accountHint: true, propertyOutcome: null });
  });
  it('DEM-027 absent values are null, never omitted (API-002); no id, no reference, no date', () => {
    const r = buildResponse('PROJECTION_REQUEST', { email: 'y@b.fr' }, null, 'tok');
    expect(r).toEqual({ kind: 'PROJECTION_REQUEST', firstName: null, email: 'y@b.fr', preferredCallbackDate: null, preferredSlot: null, accountHint: false, propertyOutcome: null, completionToken: 'tok' });
  });
  it('DEM-027 completionToken only for a projection', () => {
    expect(buildResponse('CONTACT_MESSAGE', { email: 'y@b.fr' }, null, 'tok')).not.toHaveProperty('completionToken');
  });
  it('DEM-026 property outcome: reserved → RESERVED (candidate INTERESTED); sold, withdrawn, archived → UNAVAILABLE; offline → nothing', () => {
    expect(propertyOutcome({ availability: 'RESERVED', archivedAt: null })).toEqual({ outcome: 'RESERVED', candidateStatus: 'INTERESTED' });
    expect(propertyOutcome({ availability: 'SOLD', archivedAt: null })).toEqual({ outcome: 'UNAVAILABLE', candidateStatus: 'UNAVAILABLE' });
    expect(propertyOutcome({ availability: 'WITHDRAWN', archivedAt: null }).outcome).toBe('UNAVAILABLE');
    expect(propertyOutcome({ availability: 'AVAILABLE', archivedAt: now }).outcome).toBe('UNAVAILABLE');
    expect(propertyOutcome({ availability: 'AVAILABLE', archivedAt: null })).toEqual({ outcome: null, candidateStatus: 'INTERESTED' });
  });
  it('DEM-015 « Être rappelé » from the contact page is a CALLBACK_REQUEST', () => {
    const contact = (subject: string): LeadSubmitInput => ({
      form: 'CONTACT_MESSAGE',
      fields: { firstName: 'A', lastName: 'B', email: 'a@b.fr', phone: '+33612345678', subject: subject as 'CALLBACK', message: 'Un message assez long', consentContact: true },
    });
    expect(kindOf(leadSubmitSchema.parse(contact('CALLBACK')))).toBe('CALLBACK_REQUEST');
    expect(kindOf(leadSubmitSchema.parse(contact('FINANCING')))).toBe('CONTACT_MESSAGE');
  });
});

describe('shared form schemas', () => {
  const issues = (input: unknown) => {
    const r = leadSubmitSchema.safeParse(input);
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}:${i.message}`);
  };
  it('DEM-015 a contact message needs 10 characters, unless the subject is CALLBACK, where the phone is required', () => {
    const base = { firstName: 'A', lastName: 'B', email: 'a@b.fr', consentContact: true };
    expect(issues({ form: 'CONTACT_MESSAGE', fields: { ...base, subject: 'CALLBACK' } })).toEqual(['fields.phone:REQUIRED']);
    expect(issues({ form: 'CONTACT_MESSAGE', fields: { ...base, subject: 'OTHER' } })).toEqual(['fields.message:REQUIRED']);
  });
  it('an empty optional message may be sent as null (the forms send null for every empty optional field)', () => {
    const base = { firstName: 'A', lastName: 'B', email: 'a@b.fr', phone: '+33612345678', consentContact: true, message: null };
    expect(issues({ form: 'CONTACT_MESSAGE', fields: { ...base, subject: 'CALLBACK' } })).toEqual([]);
    expect(issues({ form: 'CALLBACK_REQUEST', fields: { ...base, subject: null } })).toEqual([]);
    expect(issues({ form: 'CONTACT_MESSAGE', fields: { ...base, subject: 'OTHER' } })).toEqual(['fields.message:REQUIRED']);
  });
  it('DEM-020 the consent box must be checked (MUST_ACCEPT); TRV-042/TRV-043/TRV-040 field rules', () => {
    const r = issues({ form: 'CALLBACK_REQUEST', fields: { firstName: 'J0hn', email: 'nope', phone: '+3361', consentContact: false } });
    expect(r).toEqual(['fields.firstName:INVALID_NAME', 'fields.phone:INVALID_PHONE', 'fields.email:INVALID_EMAIL', 'fields.consentContact:MUST_ACCEPT']);
  });
  it('DEM-013 projection: down payment ≥ 0, monthly budget > 0, decimal strings (DEM-007)', () => {
    const base = { email: 'a@b.fr', consentContact: true };
    expect(issues({ form: 'PROJECTION_REQUEST', fields: { ...base, downPayment: '0', monthlyBudget: '650' } })).toEqual([]);
    expect(issues({ form: 'PROJECTION_REQUEST', fields: { ...base, downPayment: '1 000', monthlyBudget: '0' } })).toEqual([
      'fields.downPayment:INVALID_AMOUNT',
      'fields.monthlyBudget:OUT_OF_RANGE',
    ]);
  });
  it('DEM-016 SIMULATION_FOLLOWUP (work package 2.6): its fields and the simulation id are required', () => {
    expect(issues({ form: 'SIMULATION_FOLLOWUP', fields: {} })).toEqual([
      'fields.firstName:REQUIRED',
      'fields.lastName:REQUIRED',
      'fields.email:REQUIRED',
      'fields.phone:REQUIRED',
      'fields.consentContact:MUST_ACCEPT',
      'simulationId:INVALID_CHOICE',
    ]);
  });
});

describe('form token', () => {
  const key = 'k'.repeat(40);
  it('DEM-030 the signed token dates the opening and lasts 24 hours', () => {
    const { token, expiresAt } = signFormToken(key, 'CALLBACK_REQUEST', now);
    expect(expiresAt.getTime() - now.getTime()).toBe(24 * 3_600_000);
    const ok = verifyFormToken(key, token, new Date(now.getTime() + 5_000));
    expect(ok).toMatchObject({ ok: true, claims: { form: 'CALLBACK_REQUEST', openedAt: now.getTime() } });
    expect(verifyFormToken(key, token, new Date(now.getTime() + 24 * 3_600_000))).toEqual({ ok: false, reason: 'EXPIRED' });
  });
  it('DEM-030 a forged, altered or missing token is refused', () => {
    const { token } = signFormToken(key, 'CALLBACK_REQUEST', now);
    expect(verifyFormToken('x'.repeat(40), token, now)).toEqual({ ok: false, reason: 'INVALID' });
    expect(verifyFormToken(key, `${token}x`, now)).toEqual({ ok: false, reason: 'INVALID' });
    expect(verifyFormToken(key, undefined, now)).toEqual({ ok: false, reason: 'MISSING' });
  });
});

describe('context and record', () => {
  it('NAV-053 only the referrer domain is kept', () => {
    expect(referrerDomain('https://www.google.com/search?q=dz')).toBe('www.google.com');
    expect(referrerDomain('facebook.com')).toBe('facebook.com');
    expect(referrerDomain(undefined)).toBeNull();
  });
  it('DEM-008 the chosen day is one of the next working days', () => {
    expect(() => validateCallbackDate('2026-10-15', now, cal)).not.toThrow(); // Thursday
    expect(() => validateCallbackDate('2026-10-17', now, cal)).toThrow(AppError); // Saturday
    expect(() => validateCallbackDate('2026-10-01', now, cal)).toThrow(AppError); // past
    expect(() => validateCallbackDate('2026-11-30', now, cal)).toThrow(AppError); // too far
    expect(() => validateCallbackDate(undefined, now, cal)).not.toThrow();
  });
  it('MOD-300 a request completes only the empty fields of the record; MOD-303 never two currencies in a group', () => {
    const current = {
      firstName: 'Yacine', lastName: null, phone: '+33612345678', whatsappOptIn: false, countryOfResidence: null, residencyStatus: null,
      purchaseTimeframe: null, financingPreference: null, preferredContactChannel: null, preferredContactSlot: null, timezone: null,
      budgetMax: null, budgetCurrency: 'DZD', budgetMonthly: null, budgetMonthlyCurrency: null, downPayment: null, downPaymentCurrency: null, preferredRegionIds: [],
    } as ClientState;
    const patch = completeClient(current, {
      firstName: 'Yassine', lastName: 'Benali', phone: '+33698765432', countryOfResidence: 'FR',
      budget: { amount: '150000', currency: 'EUR', kind: 'TOTAL' }, downPayment: { amount: '20000', currency: 'EUR' },
    });
    expect(patch).toEqual({ lastName: 'Benali', countryOfResidence: 'FR', downPayment: '20000', downPaymentCurrency: 'EUR' });
  });
});
