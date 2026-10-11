import { describe, expect, test } from 'vitest';
import {
  addMonthsToDate,
  capacity,
  compareScenarios,
  computeLoan,
  defaultStartDate,
  fileFees,
  flatMarginTotal,
  indicativeApr,
  monthlyInsurance,
  monthlyPayment,
  offerCreditCost,
  offerDeviates,
  rateForDuration,
  roundCents,
  schedule,
  simulateCredit,
  type CreditProduct,
} from '../src/index.js';

const c2 = (v: { toFixed(dp: number): string }) => v.toFixed(2);
const START = '2026-12-01';

describe('CAL-040 amortized monthly payment', () => {
  test('CAL-040 example: P = 120 000, n = 300, t = 0 → M = 400.00', () => {
    expect(c2(roundCents(monthlyPayment(120000, 300, 0, 'AMORTIZED_RATE')))).toBe('400.00');
  });
  test('CAL-040 example: P = 120 000, n = 240, t = 5.5 % → M = 825.46', () => {
    expect(c2(roundCents(monthlyPayment(120000, 240, 550, 'AMORTIZED_RATE')))).toBe('825.46');
  });
  test('CAL-040 example: P = 100 000, n = 180, t = 4 % → M = 739.69', () => {
    expect(c2(roundCents(monthlyPayment(100000, 180, 400, 'AMORTIZED_RATE')))).toBe('739.69');
  });
  test('CAL-030 example: P = 120 000, n = 300, t = 6.5 % → M = 810.2486…', () => {
    expect(monthlyPayment(120000, 300, 650, 'AMORTIZED_RATE').toFixed(4)).toBe('810.2486');
  });
});

describe('CAL-041 flat margin', () => {
  test('CAL-041 example: P = 120 000, n = 240, t = 4 % → margin 96 000 → M = 900.00', () => {
    expect(flatMarginTotal(120000, 240, 400).toFixed(2)).toBe('96000.00');
    expect(c2(roundCents(monthlyPayment(120000, 240, 400, 'FLAT_MARGIN')))).toBe('900.00');
  });
});

describe('CAL-042 capacity', () => {
  test('CAL-042 example: Mmax = 1 040, n = 300, t = 0 → P = 312 000', () => {
    expect(capacity(1040, 300, 0, 'AMORTIZED_RATE').toFixed(0)).toBe('312000');
  });
  test('CAL-042 example: Mmax = 154 440, n = 300, t = 5.5 %, AMORTIZED_RATE → P = 25 149 510', () => {
    expect(capacity(154440, 300, 550, 'AMORTIZED_RATE').toFixed(0)).toBe('25149510');
  });
  test('CAL-042 example: Mmax = 900, n = 240, t = 4 %, FLAT_MARGIN → P = 120 000', () => {
    expect(capacity(900, 240, 400, 'FLAT_MARGIN').toFixed(0)).toBe('120000');
  });
  test('CAL-042 result rounded down to the unit (CAL-103: Mmax 1 040, 300 months, 6.5 % → 154 026)', () => {
    expect(capacity(1040, 300, 650, 'AMORTIZED_RATE').toFixed(0)).toBe('154026');
  });
});

describe('CAL-043 schedule', () => {
  test('CAL-043 example: P = 120 000, n = 240, t = 5.5 % → 239 × 825.46, last 827.70, interest 78 112.64, final 0.00', () => {
    const rows = schedule({ amount: 120000, durationMonths: 240, annualRateBps: 550, pricingMethod: 'AMORTIZED_RATE', startDate: START });
    expect(rows).toHaveLength(240);
    expect(rows.slice(0, 239).every((r) => c2(r.payment) === '825.46')).toBe(true);
    expect(c2(rows[239]!.payment)).toBe('827.70');
    expect(c2(rows.reduce((s, r) => s.add(r.interest), rows[0]!.interest.mul(0)))).toBe('78112.64');
    expect(c2(rows[239]!.remaining)).toBe('0.00');
  });

  test('CAL-043 EP-12: 120 000 € over 300 months at 6.5 % → 299 × 810.25, last 809.15; first month 650.00 interest, 160.25 principal', () => {
    const rows = schedule({ amount: 120000, durationMonths: 300, annualRateBps: 650, pricingMethod: 'AMORTIZED_RATE', startDate: START });
    expect(rows.slice(0, 299).every((r) => c2(r.payment) === '810.25')).toBe(true);
    expect(c2(rows[299]!.payment)).toBe('809.15');
    expect([c2(rows[0]!.interest), c2(rows[0]!.principal)]).toEqual(['650.00', '160.25']);
    expect(c2(rows[299]!.remaining)).toBe('0.00');
  });

  test('CAL-043 EP-12 yearly table: years 1–3 principal / interest / remaining', () => {
    const r = computeLoan({ amount: 120000, durationMonths: 300, annualRateBps: 650, pricingMethod: 'AMORTIZED_RATE', startDate: START });
    const y = r.yearly.slice(0, 3).map((x) => [c2(x.principal), c2(x.interest), c2(x.remaining)]);
    expect(y).toEqual([
      ['1981.34', '7741.66', '118018.66'],
      ['2114.02', '7608.98', '115904.64'],
      ['2255.59', '7467.41', '113649.05'],
    ]);
    expect(r.yearly).toHaveLength(25);
  });

  test('CAL-043 rate 0: P / n rounded, the last instalment absorbs the gap', () => {
    const rows = schedule({ amount: 1000, durationMonths: 3, annualRateBps: 0, pricingMethod: 'AMORTIZED_RATE', startDate: START });
    expect(rows.map((r) => c2(r.payment))).toEqual(['333.33', '333.33', '333.34']);
    expect(rows.every((r) => r.interest.isZero())).toBe(true);
    expect(c2(rows[2]!.remaining)).toBe('0.00');
  });

  test('CAL-043 FLAT_MARGIN: P ÷ n principal + margin ÷ n, the last absorbs the rounding gap', () => {
    const rows = schedule({ amount: 1000, durationMonths: 3, annualRateBps: 400, pricingMethod: 'FLAT_MARGIN', startDate: START });
    // margin = 1000 × 0.04 × 3/12 = 10.00 → 3.33 + 3.33 + 3.34
    expect(rows.map((r) => [c2(r.principal), c2(r.interest)])).toEqual([
      ['333.33', '3.33'],
      ['333.33', '3.33'],
      ['333.34', '3.34'],
    ]);
    const big = computeLoan({ amount: 120000, durationMonths: 240, annualRateBps: 400, pricingMethod: 'FLAT_MARGIN', startDate: START });
    expect(c2(big.monthlyPayment)).toBe('900.00');
    expect(c2(big.totalInterest)).toBe('96000.00');
    expect(c2(big.schedule[239]!.remaining)).toBe('0.00');
  });

  test('CAL-043 dates: first instalment one month after the start; default start = first day of the following month', () => {
    expect(defaultStartDate(new Date('2026-10-09T10:00:00Z'))).toBe('2026-11-01');
    expect(defaultStartDate(new Date('2026-12-31T10:00:00Z'))).toBe('2027-01-01');
    const rows = schedule({ amount: 1000, durationMonths: 2, annualRateBps: 0, pricingMethod: 'AMORTIZED_RATE', now: new Date('2026-10-09T10:00:00Z') });
    expect(rows.map((r) => r.date)).toEqual(['2026-12-01', '2027-01-01']);
    expect(addMonthsToDate('2027-01-31', 1)).toBe('2027-02-28');
    expect(() => schedule({ amount: 1000, durationMonths: 2, annualRateBps: 0, pricingMethod: 'AMORTIZED_RATE' })).toThrow(RangeError);
  });
});

describe('CAL-044 / CAL-045 insurance, fees, totals', () => {
  test('CAL-044 example: P = 120 000, insurance 0.36 %, n = 240 → 36.00 per month, 8 640.00 in total', () => {
    expect(c2(monthlyInsurance(120000, 36))).toBe('36.00');
    const r = computeLoan({ amount: 120000, durationMonths: 240, annualRateBps: 550, pricingMethod: 'AMORTIZED_RATE', insuranceRateBps: 36, startDate: START });
    expect(c2(r.totalInsurance)).toBe('8640.00');
    expect(c2(r.monthlyTotal)).toBe('861.46');
    expect(c2(r.schedule[0]!.insurance)).toBe('36.00');
  });

  test('CAL-044 file fees = fixed + P × pct ÷ 100, 2 decimals', () => {
    expect(c2(fileFees(120000, '500', '0.5'))).toBe('1100.00');
    expect(c2(fileFees(120000, null, null))).toBe('0.00');
  });

  test('CAL-045 EP-12: cost 123 073.90 €, total repaid 243 073.90 € (interest summed on the schedule)', () => {
    const r = computeLoan({ amount: 120000, durationMonths: 300, annualRateBps: 650, pricingMethod: 'AMORTIZED_RATE', startDate: START });
    expect(c2(r.monthlyPayment)).toBe('810.25');
    expect(c2(r.totalInterest)).toBe('123073.90');
    expect(c2(r.totalCost)).toBe('123073.90');
    expect(c2(r.totalRepaid)).toBe('243073.90');
    // Not M × n − P:
    expect(c2(r.monthlyPayment.mul(300).sub(120000))).toBe('123075.00');
  });

  test('CAL-045 total cost = interest + insurance + fees', () => {
    const r = computeLoan({
      amount: 120000, durationMonths: 240, annualRateBps: 550, pricingMethod: 'AMORTIZED_RATE',
      insuranceRateBps: 36, fileFeeFixed: '500', fileFeePct: '0.5', startDate: START,
    });
    expect(c2(r.totalCost)).toBe('87852.64'); // 78 112.64 + 8 640.00 + 1 100.00
    expect(c2(r.totalRepaid)).toBe('207852.64');
  });

  test('CAL-045 bank offer: cost = offer monthly × n − granted amount (+ insurance, fees); > 1 % gap warns', () => {
    expect(c2(offerCreditCost('825.46', 240, 120000))).toBe('78110.40');
    expect(c2(offerCreditCost('825.46', 240, 120000, { totalInsurance: '8640', fees: '1100' }))).toBe('87850.40');
    expect(offerDeviates('833.71', '825.46')).toBe(false); // 0.9994 %
    expect(offerDeviates('833.72', '825.46')).toBe(true); // 1.0007 %
  });
});

describe('CAL-046 indicative APR', () => {
  test('CAL-046 without fees nor insurance the APR is the nominal rate (6.50 %)', () => {
    const apr = indicativeApr({ amount: 120000, monthlyPayment: '810.2486', durationMonths: 300 })!;
    expect(apr.toFixed(4)).toBe('0.0650');
  });
  test('CAL-046 fees and insurance raise the APR above the nominal rate', () => {
    const apr = indicativeApr({ amount: 120000, monthlyPayment: '825.46', monthlyInsurance: '36', fees: '1100', durationMonths: 240 })!;
    expect(apr.gt('0.0550')).toBe(true);
    // The returned rate solves P − fees = Σ (M + insurance) / (1 + i)^k.
    const i = apr.div(12);
    let pv = i.mul(0);
    for (let k = 1; k <= 240; k++) pv = pv.add(i.add(1).pow(-k).mul('861.46'));
    expect(pv.sub(118900).abs().lt(5)).toBe(true);
    expect(apr.toFixed(3)).toBe('0.061');
  });
});

describe('CAL-048 rate by duration', () => {
  const product = { nominalRateBps: 700, rateBands: [{ maxDurationMonths: 180, rateBps: 590 }, { maxDurationMonths: 300, rateBps: 650 }] };
  test('CAL-048 example: bands 180 → 5.90 %, 300 → 6.50 %; 144 months → 5.90 %, 240 months → 6.50 %', () => {
    expect(rateForDuration(product, 144)).toBe(590);
    expect(rateForDuration(product, 180)).toBe(590);
    expect(rateForDuration(product, 240)).toBe(650);
  });
  test('CAL-048 beyond the last band: the last one; without bands: nominalRateBps', () => {
    expect(rateForDuration(product, 360)).toBe(650);
    expect(rateForDuration({ nominalRateBps: 700 }, 240)).toBe(700);
  });
});

describe('CAL-110 credit simulator', () => {
  test('CAL-110 EP-12: 150 000 € − 30 000 € over 300 months at 6.5 % → 810.25 €', () => {
    const r = simulateCredit({ mode: 'FROM_PRICE', price: '150000', downPayment: '30000', durationMonths: 300, annualRateBps: 650, indicativeMinDownPaymentPct: 20, startDate: START });
    if (r.nothingToFinance) throw new Error('expected a result');
    expect(c2(r.amount)).toBe('120000.00');
    expect(c2(r.monthlyPayment)).toBe('810.25');
    expect(r.warnings).toEqual([]);
  });

  test('CAL-110 EP-12 warning: down payment 15 000 € → 135 000 € over 20 years → 1 006.52 €, DOWN_PAYMENT_BELOW_MIN', () => {
    const r = simulateCredit({ mode: 'FROM_PRICE', price: '150000', downPayment: '15000', durationMonths: 240, annualRateBps: 650, indicativeMinDownPaymentPct: 20, startDate: START });
    if (r.nothingToFinance) throw new Error('expected a result');
    expect(c2(r.amount)).toBe('135000.00');
    expect(c2(r.monthlyPayment)).toBe('1006.52');
    expect(r.warnings).toEqual(['DOWN_PAYMENT_BELOW_MIN']);
  });

  test('CAL-110 a down payment ≥ price is not an error: nothingToFinance only', () => {
    expect(simulateCredit({ mode: 'FROM_PRICE', price: '150000', downPayment: '150000', durationMonths: 300, annualRateBps: 650, startDate: START })).toEqual({ nothingToFinance: true });
  });

  test('CAL-110 FROM_AMOUNT prefilled from EDI-023: 74 051 € → 500.00 € (74 000 € would give 499.65 €)', () => {
    const r = simulateCredit({ mode: 'FROM_AMOUNT', amount: '74051', durationMonths: 300, annualRateBps: 650, startDate: START });
    if (r.nothingToFinance) throw new Error('expected a result');
    expect(c2(r.monthlyPayment)).toBe('500.00');
    expect(c2(roundCents(monthlyPayment(74000, 300, 650, 'AMORTIZED_RATE')))).toBe('499.65');
  });

  test('CAL-110 with a product: rate by duration, method, insurance and fees from the product; bounds warnings', () => {
    const product: CreditProduct = {
      pricingMethod: 'AMORTIZED_RATE', nominalRateBps: 700, rateBands: [{ maxDurationMonths: 180, rateBps: 590 }, { maxDurationMonths: 300, rateBps: 650 }],
      minAmount: '1000000', maxAmount: '30000000', minDurationMonths: 60, maxDurationMonths: 240, minDownPaymentPct: 10,
      insuranceRateBps: 36, fileFeeFixed: '10000', fileFeePct: null,
    };
    const r = simulateCredit({ mode: 'FROM_AMOUNT', amount: '500000', durationMonths: 300, product, startDate: START });
    if (r.nothingToFinance) throw new Error('expected a result');
    expect(r.annualRateBps).toBe(650);
    expect(r.warnings).toEqual(['AMOUNT_OUT_OF_PRODUCT_BOUNDS', 'DURATION_OUT_OF_PRODUCT_BOUNDS']);
    expect(c2(r.monthlyInsurance)).toBe('150.00');
    expect(c2(r.fees)).toBe('10000.00');
  });
});

describe('CAL-111 scenarios', () => {
  const run = (n: number) => computeLoan({ amount: 120000, durationMonths: n, annualRateBps: 650, pricingMethod: 'AMORTIZED_RATE', startDate: START });
  test('CAL-111 EP-12: 20 years 894.69 € (cost 94 725) · 25 years 810.25 € (123 074) · 30 years 758.48 € (153 055)', () => {
    const [a, b, c] = [run(240), run(300), run(360)];
    expect([c2(a.monthlyPayment), c2(b.monthlyPayment), c2(c.monthlyPayment)]).toEqual(['894.69', '810.25', '758.48']);
    expect([a.totalCost.toFixed(0), b.totalCost.toFixed(0), c.totalCost.toFixed(0)]).toEqual(['94725', '123074', '153055']);
  });
  test('CAL-111 lowest monthly payment (30 years) and lowest total cost (20 years) highlighted', () => {
    expect(compareScenarios([run(240), run(300), run(360)])).toEqual({ lowestMonthlyIndex: 2, lowestCostIndex: 0 });
  });
  test('CAL-111 at most three scenarios', () => {
    expect(() => compareScenarios([run(240), run(240), run(240), run(240)])).toThrow(RangeError);
  });
});
