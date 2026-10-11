import { describe, expect, test } from 'vitest';
import {
  checkAmount,
  convert,
  dec,
  plausibilityWarning,
  pricePerSquareMetre,
  pricePerSquareMetreRange,
  priceStep,
  roundCents,
  roundConvertedPrice,
  roundDisplayedBudget,
  roundDisplayedPricePerSquareMetre,
  roundDownUnit,
  roundIndicativeMonthly,
  roundOriginalAmount,
  roundReferenceDownPayment,
  toAmountString,
  toCompactAmountString,
  type ConversionContext,
  type ExchangeRate,
} from '../src/index.js';

const s = (v: { toFixed(dp?: number): string }, dp = 2) => v.toFixed(dp);

// PAR-042 — starting rate EUR → DZD 148.50.
const EUR_DZD: ExchangeRate = { base: 'EUR', quote: 'DZD', rate: '148.50', kind: 'OFFICIAL', asOf: '2026-09-28', createdAt: '2026-09-28T08:00:00Z' };
const ctx = (rates: ExchangeRate[], extra: Partial<ConversionContext> = {}): ConversionContext => ({ rates, today: '2026-10-09', ...extra });

describe('CAL-010 currency conversion', () => {
  test('CAL-010 same currency: amount unchanged, no rate', () => {
    const r = convert('150000.00', 'EUR', 'EUR', ctx([]))!;
    expect(s(r.amount)).toBe('150000.00');
    expect(r.rates).toEqual([]);
    expect(r.rateDate).toBeNull();
  });

  test('CAL-010 direction X → Y multiplies, Y → X divides (no priority to the entry direction)', () => {
    expect(s(convert('150000', 'EUR', 'DZD', ctx([EUR_DZD]))!.amount)).toBe('22275000.00');
    expect(s(convert('22275000', 'DZD', 'EUR', ctx([EUR_DZD]))!.amount)).toBe('150000.00');
  });

  test('CAL-010 the most recent asOf wins, whatever the direction; then the latest createdAt', () => {
    const reverseNewer: ExchangeRate = { base: 'DZD', quote: 'EUR', rate: '0.0065', kind: 'OFFICIAL', asOf: '2026-10-01', createdAt: '2026-10-01T08:00:00Z' };
    expect(s(convert('100', 'EUR', 'DZD', ctx([EUR_DZD, reverseNewer]))!.amount, 4)).toBe(dec(100).div('0.0065').toFixed(4));
    const sameDayLater: ExchangeRate = { ...EUR_DZD, rate: '150', createdAt: '2026-09-28T15:00:00Z' };
    expect(s(convert('1', 'EUR', 'DZD', ctx([EUR_DZD, sameDayLater]))!.amount)).toBe('150.00');
  });

  test('CAL-010 cancelled rates, rates of the other kind and future rates are ignored', () => {
    const cancelled: ExchangeRate = { ...EUR_DZD, rate: '200', asOf: '2026-10-05', cancelled: true };
    const indicative: ExchangeRate = { ...EUR_DZD, rate: '250', asOf: '2026-10-06', kind: 'INDICATIVE' };
    const future: ExchangeRate = { ...EUR_DZD, rate: '300', asOf: '2026-10-20' };
    expect(s(convert('1', 'EUR', 'DZD', ctx([EUR_DZD, cancelled, indicative, future]))!.amount)).toBe('148.50');
    // No fall-back on the other kind.
    expect(convert('1', 'EUR', 'DZD', ctx([indicative]))).toBeNull();
    expect(s(convert('1', 'EUR', 'DZD', ctx([indicative], { kind: 'INDICATIVE' }))!.amount)).toBe('250.00');
  });

  test('CAL-010 through the reference currency when no direct rate (X → R → Y)', () => {
    const eurCad: ExchangeRate = { base: 'EUR', quote: 'CAD', rate: '1.50', kind: 'OFFICIAL', asOf: '2026-10-02', createdAt: '2026-10-02T08:00:00Z' };
    const r = convert('300', 'CAD', 'DZD', ctx([EUR_DZD, eurCad]))!;
    expect(s(r.amount)).toBe('29700.00');
    expect(r.rates.map((u) => u.pair)).toEqual(['EUR/CAD', 'EUR/DZD']);
    expect(r.rateDate).toBe('2026-09-28');
  });

  test('CAL-010 / CAL-011 no rate at all: conversion impossible (null)', () => {
    expect(convert('1', 'USD', 'DZD', ctx([EUR_DZD]))).toBeNull();
    expect(convert('1', 'EUR', 'DZD', ctx([]))).toBeNull();
  });

  test('CAL-012 the rate date comes with the result; older than maxAgeDays (7) → stale but converted', () => {
    expect(convert('1', 'EUR', 'DZD', ctx([EUR_DZD], { today: '2026-10-05' }))!.stale).toBe(false);
    const old = convert('1', 'EUR', 'DZD', ctx([EUR_DZD], { today: '2026-10-09' }))!;
    expect(old.stale).toBe(true);
    expect(old.rateDate).toBe('2026-09-28');
    expect(s(old.amount)).toBe('148.50');
  });
});

describe('CAL-020 … CAL-028 display roundings', () => {
  test('CAL-020 an amount in its original currency is rounded to the unit', () => {
    expect(s(roundOriginalAmount('22275000.49'), 0)).toBe('22275000');
    expect(s(roundOriginalAmount('22275000.50'), 0)).toBe('22275001');
  });

  test('CAL-021 example: B-304, 22 275 000 DA at 148.50 = 150 000.00 € → 150 000 €', () => {
    const eur = convert('22275000', 'DZD', 'EUR', ctx([EUR_DZD]))!.amount;
    expect(s(eur)).toBe('150000.00');
    expect(s(roundConvertedPrice(eur), 0)).toBe('150000');
  });

  test('CAL-021 example: 22 350 000 DA = 150 505.05 € → 151 000 €', () => {
    const eur = convert('22350000', 'DZD', 'EUR', ctx([EUR_DZD]))!.amount;
    expect(s(eur)).toBe('150505.05');
    expect(s(roundConvertedPrice(eur), 0)).toBe('151000');
  });

  test('CAL-021 steps and boundaries: < 10 000 → 100 · < 100 000 → 500 · ≥ 100 000 → 1 000, half up', () => {
    expect(s(priceStep('9999.99'), 0)).toBe('100');
    expect(s(priceStep('10000'), 0)).toBe('500');
    expect(s(priceStep('99999.99'), 0)).toBe('500');
    expect(s(priceStep('100000'), 0)).toBe('1000');
    expect(s(roundConvertedPrice('9949.99'), 0)).toBe('9900');
    expect(s(roundConvertedPrice('9950'), 0)).toBe('10000');
    expect(s(roundConvertedPrice('10249.99'), 0)).toBe('10000');
    expect(s(roundConvertedPrice('10250'), 0)).toBe('10500');
    expect(s(roundConvertedPrice('99749.99'), 0)).toBe('99500');
    expect(s(roundConvertedPrice('99750'), 0)).toBe('100000');
    expect(s(roundConvertedPrice('150499.99'), 0)).toBe('150000');
    expect(s(roundConvertedPrice('150500'), 0)).toBe('151000');
  });

  test('CAL-022 example: indicative monthly payment 406.25 € → 410 € (nearest ten, half up)', () => {
    expect(s(roundIndicativeMonthly('406.25'), 0)).toBe('410');
    expect(s(roundIndicativeMonthly('405.00'), 0)).toBe('410');
    expect(s(roundIndicativeMonthly('404.99'), 0)).toBe('400');
  });

  test('CAL-022 reference data: 810.25 → 810 · 1 296.40 → 1 300 · 2 214.68 → 2 210', () => {
    expect(s(roundIndicativeMonthly('810.25'), 0)).toBe('810');
    expect(s(roundIndicativeMonthly('1296.40'), 0)).toBe('1300');
    expect(s(roundIndicativeMonthly('2214.68'), 0)).toBe('2210');
  });

  test('CAL-023 reference down payment: nearest hundred', () => {
    expect(s(roundReferenceDownPayment('30000'), 0)).toBe('30000');
    expect(s(roundReferenceDownPayment('30150'), 0)).toBe('30200');
    expect(s(roundReferenceDownPayment('30149.99'), 0)).toBe('30100');
  });

  test('CAL-024 price per m² of B-304: 22 275 000 ÷ 85 = 262 059 DA / m² → ≈ 1 760 € / m²', () => {
    const perSqm = pricePerSquareMetre('22275000', 85);
    expect(s(perSqm, 0)).toBe('262059');
    const eur = convert(perSqm, 'DZD', 'EUR', ctx([EUR_DZD]))!.amount;
    expect(s(roundDisplayedPricePerSquareMetre(eur), 0)).toBe('1760');
    const range = pricePerSquareMetreRange(['1760', '1810', '1790'])!;
    expect([s(range.min, 0), s(range.max, 0)]).toEqual(['1760', '1810']);
    expect(pricePerSquareMetreRange([])).toBeNull();
  });

  test('CAL-025 simulator detail and schedule keep two decimals', () => {
    expect(s(roundCents('810.2486'))).toBe('810.25');
    expect(s(roundCents('0.005'))).toBe('0.01');
  });

  test('CAL-026 example: capacity / budget stored to the unit rounded down, displayed down to the step: 199 356 → ≈ 199 000', () => {
    expect(s(roundDownUnit('199356.97'), 0)).toBe('199356');
    expect(s(roundDisplayedBudget('199356'), 0)).toBe('199000');
    expect(s(roundDisplayedBudget('199999.99'), 0)).toBe('199000');
    expect(s(roundDisplayedBudget('74051'), 0)).toBe('74000');
    expect(s(roundDisplayedBudget('9999'), 0)).toBe('9900');
  });

  test('CAL-027 bounds: monthly ≤ 1 000 000 000, capital ≤ 100 000 000 000, two decimals at most', () => {
    expect(checkAmount('1000000000', 'MONTHLY')).toBe('OK');
    expect(checkAmount('1000000000.01', 'MONTHLY')).toBe('TOO_HIGH');
    expect(checkAmount('100000000000', 'CAPITAL')).toBe('OK');
    expect(checkAmount('100000000000.01', 'CAPITAL')).toBe('TOO_HIGH');
    expect(checkAmount('0', 'MONTHLY')).toBe('OK');
    expect(checkAmount('0', 'MONTHLY', true)).toBe('TOO_LOW');
    expect(checkAmount('-1', 'CAPITAL')).toBe('TOO_LOW');
    expect(checkAmount('12.345', 'CAPITAL')).toBe('TOO_MANY_DECIMALS');
  });

  test('CAL-027 plausibility warnings: property price < 1 000 ref units, monthly income > 100 000', () => {
    expect(plausibilityWarning('999.99', 'PROPERTY_PRICE_REF')).toBe(true);
    expect(plausibilityWarning('1000', 'PROPERTY_PRICE_REF')).toBe(false);
    expect(plausibilityWarning('100000.01', 'MONTHLY_INCOME')).toBe(true);
    expect(plausibilityWarning('100000', 'MONTHLY_INCOME')).toBe(false);
  });

  test('CAL-104 amount strings: API-002 shape and compact integer shape', () => {
    expect(toAmountString('150000')).toBe('150000.00');
    expect(toCompactAmountString('169356')).toBe('169356');
    expect(toCompactAmountString('1040.5')).toBe('1040.50');
  });
});
