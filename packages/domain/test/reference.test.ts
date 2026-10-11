import type { ReferenceFinancing } from '@dp/contracts';
import { describe, expect, test } from 'vitest';
import {
  matchesBudgetFilter,
  pickReferenceFinancing,
  programPriceFrom,
  referenceCardValues,
  type ExchangeRate,
} from '../src/index.js';

// PAR-041 — starting reference financing.
const PAR_041: ReferenceFinancing = { downPaymentPct: 20, durationMonths: 300, annualRateBps: 650, pricingMethod: 'AMORTIZED_RATE' };
const EUR_DZD: ExchangeRate = { base: 'EUR', quote: 'DZD', rate: '148.50', kind: 'OFFICIAL', asOf: '2026-09-28', createdAt: '2026-09-28T08:00:00Z' };
const ctx = { rates: [EUR_DZD], today: '2026-10-09', referenceCurrency: 'EUR' };
const str = (v: { toFixed(dp: number): string } | null, dp = 0) => (v === null ? null : v.toFixed(dp));

describe('CAL-030 indicative monthly payment of a card', () => {
  test('CAL-030 example: 150 000 € → down payment 30 000 € → financed 120 000 € → 810.2486… → 810 € / month', () => {
    const r = referenceCardValues({ priceFrom: '150000', currency: 'EUR' }, PAR_041, ctx);
    expect(str(r.priceFromRef)).toBe('150000');
    expect(str(r.downPaymentRef)).toBe('30000');
    expect(str(r.monthlyExact, 4)).toBe('810.2486');
    expect(str(r.monthlyExact, 2)).toBe('810.25'); // CAL-025, in a simulator
    expect(str(r.monthlyFromRef)).toBe('810');
  });

  test('CAL-030 B-304 from its dinar price: 22 275 000 DA at 148.50 → 150 000 € → 810 €', () => {
    const r = referenceCardValues({ priceFrom: '22275000', currency: 'DZD' }, PAR_041, ctx);
    expect([str(r.priceFromRef), str(r.downPaymentRef), str(r.monthlyFromRef)]).toEqual(['150000', '30000', '810']);
    expect(r.rates).toEqual([{ pair: 'EUR/DZD', asOf: '2026-09-28', rate: expect.anything() }]);
  });

  test('CAL-030 reference data: 240 000 € → 48 000 € → 1 296.40 € → 1 300 €; 410 000 € → 82 000 € → 2 214.68 € → 2 210 €', () => {
    const a = referenceCardValues({ priceFrom: '240000', currency: 'EUR' }, PAR_041, ctx);
    expect([str(a.downPaymentRef), str(a.monthlyExact, 2), str(a.monthlyFromRef)]).toEqual(['48000', '1296.40', '1300']);
    const b = referenceCardValues({ priceFrom: '410000', currency: 'EUR' }, PAR_041, ctx);
    expect([str(b.downPaymentRef), str(b.monthlyExact, 2), str(b.monthlyFromRef)]).toEqual(['82000', '2214.68', '2210']);
  });

  test('CAL-030 the price is rounded by steps before the down payment (22 350 000 DA → 151 000 € → 30 200 €)', () => {
    const r = referenceCardValues({ priceFrom: '22350000', currency: 'DZD' }, PAR_041, ctx);
    expect([str(r.priceFromRef), str(r.downPaymentRef)]).toEqual(['151000', '30200']);
  });

  test('CAL-030 rate 0 allowed (PAR-041): 120 000 € over 300 months → 400 €', () => {
    const r = referenceCardValues({ priceFrom: '150000', currency: 'EUR' }, { ...PAR_041, annualRateBps: 0 }, ctx);
    expect(str(r.monthlyFromRef)).toBe('400');
  });

  test('CAL-030 step 1: per-country reference financing, otherwise the default', () => {
    const dz: ReferenceFinancing = { ...PAR_041, annualRateBps: 700 };
    expect(pickReferenceFinancing({ DZ: dz }, PAR_041, 'DZ')).toBe(dz);
    expect(pickReferenceFinancing({ DZ: dz }, PAR_041, 'MA')).toBe(PAR_041);
  });
});

describe('CAL-031 / CAL-032 / CAL-028', () => {
  test('CAL-031 no priceFrom or impossible conversion: the three values are null', () => {
    const none = { priceFromRef: null, downPaymentRef: null, monthlyExact: null, monthlyFromRef: null, rates: [] };
    expect(referenceCardValues({ priceFrom: null, currency: 'DZD' }, PAR_041, ctx)).toEqual(none);
    expect(referenceCardValues({ priceFrom: '1000000', currency: 'MAD' }, PAR_041, ctx)).toEqual(none);
  });

  test('CAL-032 monthly budget keeps monthlyFromRef ≤ M; total budget keeps priceFromRef ≤ B; null never matches', () => {
    const p = { priceFromRef: '150000', monthlyFromRef: '810' };
    expect(matchesBudgetFilter(p, { kind: 'MONTHLY', max: 810 })).toBe(true);
    expect(matchesBudgetFilter(p, { kind: 'MONTHLY', max: 800 })).toBe(false);
    expect(matchesBudgetFilter(p, { kind: 'TOTAL', max: 150000 })).toBe(true);
    expect(matchesBudgetFilter(p, { kind: 'TOTAL', max: 149999 })).toBe(false);
    expect(matchesBudgetFilter({ priceFromRef: null, monthlyFromRef: null }, { kind: 'MONTHLY', max: 5000 })).toBe(false);
  });

  test('CAL-028 program price: smallest priceFromRef of published and available properties, with that property monthly', () => {
    const props = [
      { id: 'T4', priceFromRef: '186000', monthlyFromRef: '1000', isPublished: true, isAvailable: false },
      { id: 'T3', priceFromRef: '150000', monthlyFromRef: '810', isPublished: true, isAvailable: true },
      { id: 'T2', priceFromRef: '118000', monthlyFromRef: '640', isPublished: false, isAvailable: true },
      { id: 'T5', priceFromRef: '248000', monthlyFromRef: '1340', isPublished: true, isAvailable: true },
    ];
    const r = programPriceFrom(props)!;
    expect([r.property.id, str(r.priceFromRef), str(r.monthlyFromRef)]).toEqual(['T3', '150000', '810']);
    expect(programPriceFrom([props[0]!])).toBeNull();
  });
});
