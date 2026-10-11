// 02-site-public/09 — guided assistant: URL codec of the answers, choices offered, request content (ASS-030) and what it
// writes on the client record (ASS-031).
import { answersBefore, guidedAnswersToSearch, guidedSteps, leadSubmitSchema, parseGuidedAnswers, type GuidedAnswers } from '@dp/contracts';
import { describe, expect, it } from 'vitest';
import { usefulSteps, withoutMonthly } from '../src/assistant/guided-search.service.js';
import { completeClient, type ClientState } from '../src/leads/client-record.js';
import { guidedFacts, guidedLeadCriteria } from '../src/leads/guided-facts.js';

const full: GuidedAnswers = {
  region: ['alger', 'oran'],
  type: ['apartment', 'land'],
  rooms: ['3', '5plus'],
  budget: { kind: 'MONTHLY', max: 800 },
  delivery: 'SOON',
  purpose: 'FAMILY',
};

describe('answers codec', () => {
  it('ASS-002 the answers round-trip through the address', () => {
    const search = guidedAnswersToSearch(full);
    expect(search).toBe('?region=alger,oran&type=apartment,land&rooms=3,5plus&budget=monthly:800&delivery=soon&purpose=FAMILY');
    expect(parseGuidedAnswers(new URLSearchParams(search.slice(1)))).toEqual(full);
    expect(parseGuidedAnswers({ region: 'any', type: 'any', budget: 'unknown', delivery: 'any', purpose: 'none' })).toEqual({
      region: 'ANY',
      type: 'ANY',
      budget: 'UNKNOWN',
      delivery: 'ANY',
      purpose: 'NO_ANSWER',
    });
  });
  it('API-011 a malformed value drops that answer only', () => {
    expect(parseGuidedAnswers({ region: 'Alger!!', type: 'castle', budget: 'monthly:abc', delivery: 'tomorrow', purpose: 'FAMILY' })).toEqual({ purpose: 'FAMILY' });
    expect(parseGuidedAnswers({ type: 'castle,villa' })).toEqual({ type: ['villa'] });
  });
  it('ASS-010 2 bis is asked only for an apartment, a villa or a duplex', () => {
    expect(guidedSteps({ type: ['land'] })).not.toContain('rooms');
    expect(guidedSteps({ type: 'ANY' })).not.toContain('rooms');
    expect(guidedSteps({ type: ['land', 'villa'] })).toContain('rooms');
  });
  it('the choices of a question depend on the earlier answers only', () => {
    expect(answersBefore(full, 'budget')).toEqual({ region: ['alger', 'oran'], type: ['apartment', 'land'], rooms: ['3', '5plus'] });
    expect(answersBefore({ ...full, type: ['land'] }, 'budget')).toEqual({ region: ['alger', 'oran'], type: ['land'] });
  });
});

describe('choices offered', () => {
  it('ASS-010 a budget step without any property is not offered; steps after the one that shows everything are dropped', () => {
    expect(
      usefulSteps([
        { step: 300, count: 0 },
        { step: 650, count: 1 },
        { step: 800, count: 2 },
        { step: 1500, count: 5 },
        { step: 2000, count: 5 },
        { step: 3000, count: 5 },
      ]),
    ).toEqual([650, 800, 1500]);
    expect(usefulSteps([{ step: 300, count: 0 }])).toEqual([]);
  });
  it('ASS-010 a monthly budget is ignored when the monthly search is off', () => {
    expect(withoutMonthly(full, false).budget).toBeUndefined();
    expect(withoutMonthly(full, true)).toBe(full);
    expect(withoutMonthly({ budget: { kind: 'TOTAL', max: 150000 } }, false).budget).toEqual({ kind: 'TOTAL', max: 150000 });
  });
});

describe('GUIDED_SEARCH request', () => {
  it('ASS-030 the form accepts the answers of the questionnaire and refuses anything else as answers', () => {
    const base = {
      form: 'GUIDED_SEARCH',
      fields: { firstName: 'Amel', email: 'amel@example.test', consentContact: true, answers: full, propertyReferences: ['DP-DZ-0142'], freeText: 'Près de la mer' },
    };
    expect(leadSubmitSchema.safeParse(base).success).toBe(true);
    expect(leadSubmitSchema.safeParse({ ...base, fields: { ...base.fields, answers: { budget: { kind: 'MONTHLY', max: -5 } } } }).success).toBe(false);
    expect(leadSubmitSchema.safeParse({ ...base, fields: { ...base.fields, freeText: 'x'.repeat(501) } }).success).toBe(false);
    expect(leadSubmitSchema.safeParse({ ...base, fields: { ...base.fields, propertyReferences: Array.from({ length: 21 }, (_, i) => `R${i}`) } }).success).toBe(false);
  });
  it('ASS-030 the criteria stored are recomputed from the answers', () => {
    expect(guidedLeadCriteria(full, 2026, true)).toEqual({
      region: ['alger', 'oran'],
      type: ['apartment', 'land'],
      rooms: ['3', '5plus'],
      monthlyMax: 800,
      delivery: ['delivered', '2026', '2027', '2028'],
    });
    expect(guidedLeadCriteria(full, 2026, false).monthlyMax).toBeUndefined();
  });
  it('ASS-031 the answers become facts for the record: regions, types, smallest rooms, budget, purpose', () => {
    expect(guidedFacts(full, ['r1', 'r2'], 'EUR', true)).toEqual({
      preferredRegionIds: ['r1', 'r2'],
      preferredTypes: ['APARTMENT', 'LAND'],
      minRooms: 3,
      budget: { amount: '800', currency: 'EUR', kind: 'MONTHLY' },
      purchasePurpose: 'FAMILY',
    });
    expect(guidedFacts({ region: 'ANY', type: 'ANY', budget: 'UNKNOWN', purpose: 'NO_ANSWER' }, [], 'EUR', true)).toEqual({});
  });
  it('ASS-031 / MOD-300 only EMPTY fields of the record are completed', () => {
    const facts = guidedFacts(full, ['r1'], 'EUR', true);
    const empty = {
      firstName: null, lastName: null, phone: null, whatsappOptIn: false, countryOfResidence: null, residencyStatus: null, purchaseTimeframe: null,
      financingPreference: null, preferredContactChannel: null, preferredContactSlot: null, timezone: null, budgetMax: null, budgetCurrency: null,
      budgetMonthly: null, budgetMonthlyCurrency: null, downPayment: null, downPaymentCurrency: null, preferredRegionIds: [], preferredTypes: [],
      minRooms: null, purchasePurpose: null,
    } satisfies ClientState;
    expect(completeClient(empty, facts)).toMatchObject({ preferredRegionIds: ['r1'], preferredTypes: ['APARTMENT', 'LAND'], minRooms: 3, purchasePurpose: 'FAMILY', budgetMonthly: '800', budgetMonthlyCurrency: 'EUR' });
    const filled = { ...empty, preferredRegionIds: ['r9'], preferredTypes: ['VILLA'], minRooms: 4, purchasePurpose: 'RETURN_HOME', budgetMonthly: '1000', budgetMonthlyCurrency: 'EUR' };
    expect(completeClient(filled, facts)).toEqual({});
  });
});
