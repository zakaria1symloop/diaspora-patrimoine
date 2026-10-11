import { describe, expect, test } from 'vitest';
import {
  prequalificationScore,
  projectionBudget,
  projectionForProperty,
  projectionMatches,
  type PrequalificationInput,
  type ProjectionInput,
} from '../src/index.js';

const INDICATIVE = { nominalRateBps: 650, pricingMethod: 'AMORTIZED_RATE' as const, minDownPaymentPct: 20 };
const BASE: ProjectionInput = { downPayment: '35000', comfortableMonthly: '1040', durationMonths: 300, financing: INDICATIVE };

describe('CAL-120 projection', () => {
  test('CAL-120 steps 1–2: capacity for the comfortable monthly payment, budget by the B formula', () => {
    const r = projectionBudget(BASE);
    expect([r.financeable.toFixed(0), r.budget.toFixed(0), r.rateBps]).toEqual(['154026', '175000', 650]);
  });

  test('CAL-120 rate by duration (CAL-048) for a product with bands', () => {
    const r = projectionBudget({ ...BASE, durationMonths: 144, financing: { ...INDICATIVE, rateBands: [{ maxDurationMonths: 180, rateBps: 590 }, { maxDurationMonths: 300, rateBps: 650 }] } });
    expect(r.rateBps).toBe(590);
  });

  test('CAL-120 step 3: published, available, in the region (or the whole country), priceFromRef ≤ budget', () => {
    const props = [
      { id: 'a', priceFromRef: '150000', isPublished: true, isAvailable: true, regionId: 'ALG' },
      { id: 'b', priceFromRef: '176000', isPublished: true, isAvailable: true, regionId: 'ALG' },
      { id: 'c', priceFromRef: '120000', isPublished: true, isAvailable: true, regionId: 'ORA' },
      { id: 'd', priceFromRef: '120000', isPublished: true, isAvailable: false, regionId: 'ALG' },
      { id: 'e', priceFromRef: null, isPublished: true, isAvailable: true, regionId: 'ALG' },
    ];
    expect(projectionMatches(props, '175000', 'ALG').map((p) => p.id)).toEqual(['a']);
    expect(projectionMatches(props, '175000', null).map((p) => p.id)).toEqual(['a', 'c']);
  });

  test('CAL-120 step 4: amount to finance = price + fees − down payment, its own monthly payment', () => {
    const r = projectionForProperty('151000', BASE);
    expect([r.loan.toFixed(2), r.monthlyPayment.toFixed(2)]).toEqual(['116000.00', '783.24']);
    const withFees = projectionForProperty('151000', { ...BASE, acquisitionFeesPct: '5' });
    expect(withFees.loan.toFixed(2)).toBe('123550.00');
  });

  test('CAL-120 step 4: never negative — fees are paid from the down payment', () => {
    const r = projectionForProperty('30000', BASE);
    expect([r.loan.toFixed(2), r.monthlyPayment.toFixed(2)]).toEqual(['0.00', '0.00']);
  });
});

describe('CAL-070 prequalification score', () => {
  const EXAMPLE: PrequalificationInput = {
    phoneValid: true, emailVerified: true, reachableOnWhatsapp: false, timeframe: 'M6_12', latestEligibilityStatus: null,
    cashPurchase: false, budgetMax: '150000', downPaymentInBudgetCurrency: '30000', incomeKnown: true,
    accountCreated: true, hasPropertyInterest: true, cafe: 'NONE',
  };

  test('CAL-070 example: 15 + 14 + 20 + 10 = 59, Tiède', () => {
    expect(prequalificationScore(EXAMPLE)).toEqual({ score: 59, label: 'WARM', blocks: { reachable: 15, project: 14, financing: 20, engagement: 10 } });
  });

  test('CAL-070 financing from the latest simulation: ELIGIBLE 40 · CONDITIONAL 25 · NOT_ELIGIBLE 5', () => {
    expect(prequalificationScore({ ...EXAMPLE, latestEligibilityStatus: 'ELIGIBLE' }).blocks.financing).toBe(40);
    expect(prequalificationScore({ ...EXAMPLE, latestEligibilityStatus: 'CONDITIONAL' }).blocks.financing).toBe(25);
    expect(prequalificationScore({ ...EXAMPLE, latestEligibilityStatus: 'NOT_ELIGIBLE' }).blocks.financing).toBe(5);
  });

  test('CAL-070 without simulation: highest applicable line, no sum (cash 40 · 15 % down payment 20 · income 10 · 0)', () => {
    expect(prequalificationScore({ ...EXAMPLE, cashPurchase: true }).blocks.financing).toBe(40);
    expect(prequalificationScore({ ...EXAMPLE, downPaymentInBudgetCurrency: '22499' }).blocks.financing).toBe(10);
    expect(prequalificationScore({ ...EXAMPLE, downPaymentInBudgetCurrency: '22500' }).blocks.financing).toBe(20);
    expect(prequalificationScore({ ...EXAMPLE, budgetMax: null, incomeKnown: false }).blocks.financing).toBe(0);
  });

  test('CAL-070 engagement capped at 20; labels HOT ≥ 70, COLD < 40', () => {
    const hot = prequalificationScore({ ...EXAMPLE, reachableOnWhatsapp: true, timeframe: 'LT_6M', cafe: 'ATTENDED' });
    expect(hot.blocks.engagement).toBe(20);
    expect([hot.score, hot.label]).toEqual([80, 'HOT']);
    const cold = prequalificationScore({ ...EXAMPLE, phoneValid: false, emailVerified: false, timeframe: null, accountCreated: false, hasPropertyInterest: false });
    expect([cold.score, cold.label]).toEqual([20, 'COLD']);
  });
});
