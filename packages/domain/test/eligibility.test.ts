import type { IndicativeScale } from '@dp/contracts';
import { describe, expect, test } from 'vitest';
import {
  advisedDownPayment,
  evaluateEligibility,
  maxBudget,
  quickSimulation,
  retainedDuration,
  type EligibilityContext,
  type EligibilityInputs,
  type EligibilityProduct,
  type ExchangeRate,
} from '../src/index.js';

// PAR-044 — starting indicative scale.
const SCALE: IndicativeScale = {
  annualRateBps: 650, minDurationMonths: 60, maxDurationMonths: 300, pricingMethod: 'AMORTIZED_RATE',
  maxDebtRatioPct: 35, minDownPaymentPct: 20, maxAgeAtEnd: 70, minAmount: 10000,
};
const EUR_DZD: ExchangeRate = { base: 'EUR', quote: 'DZD', rate: '148.50', kind: 'OFFICIAL', asOf: '2026-09-28', createdAt: '2026-09-28T08:00:00Z' };
const NOW = new Date('2026-10-09T10:00:00Z');

const ctx = (products: EligibilityProduct[] = [], extra: Partial<EligibilityContext> = {}): EligibilityContext => ({
  now: NOW,
  products,
  indicative: SCALE,
  conversion: { rates: [EUR_DZD], today: '2026-10-09', referenceCurrency: 'EUR' },
  ...extra,
});

// CAL-103 control example: visitor aged 38, income 3 400 €, debts 150 €, down payment 35 000 €, target 151 000 €.
const YACINE: EligibilityInputs = {
  residencyStatus: 'NON_RESIDENT', countryOfResidence: 'FR', birthYear: 1988,
  monthlyIncome: '3400', incomeCurrency: 'EUR', monthlyDebts: '150',
  downPayment: '35000', downPaymentCurrency: 'EUR', financingPreference: 'NO_PREFERENCE',
  targetPrice: '151000', targetCurrency: 'EUR',
};

// CAL-104 example product in dinars.
const DZD_PRODUCT: EligibilityProduct = {
  id: 'prod-dzd', bankName: 'Banque Exemple', bankIsPublic: false, financingType: 'CONVENTIONAL', pricingMethod: 'AMORTIZED_RATE',
  currency: 'DZD', nominalRateBps: 550, minAmount: '1000000', maxAmount: '30000000', minDurationMonths: 60, maxDurationMonths: 300,
  maxDebtRatioPct: 35, minDownPaymentPct: 10, maxAgeAtEnd: 70, eligibleResidency: [], acceptedIncomeCurrencies: [], acceptedResidenceCountries: [],
};

describe('CAL-103 indicative scale — control example (EP-11)', () => {
  const r = evaluateEligibility(YACINE, ctx());

  test('CAL-103 Mmax = 1 040.00 · n = 300 · C = 154 026', () => {
    expect(r.indicative).toBe(true);
    expect(r.maxMonthlyPayment).toBe('1040.00');
    expect(r.durationMonths).toBe(300);
    expect(r.capacity).toBe('154026');
  });

  test('CAL-103 B = min(189 026, 175 000) = 175 000, Lmax = 140 000, limiting factor DOWN_PAYMENT', () => {
    expect(r.maxBudget).toBe('175000');
    expect(r.maxLoan).toBe('140000');
    expect(r.limitingFactor).toBe('DOWN_PAYMENT');
  });

  test('CAL-103 advised down payment 38 600, reachable budget 192 532', () => {
    expect(r.advisedDownPayment).toBe('38600');
    expect(r.reachableBudget).toBe('192532');
    expect(r.reachableBudgetRef).toBe('192532');
    expect(r.maxBudgetRef).toBe('175000');
  });

  test('CAL-103 target 151 000: minimal down payment 30 200 ≤ 35 000, L = 116 000 ≤ C → financeable, monthly 783.24', () => {
    expect(r.target).toEqual({
      price: '151000', productId: null, case: 'FINANCEABLE', financeable: true, fees: '0',
      loan: '116000', monthlyPayment: '783.24', missingDownPayment: '0', requiredMonthlyPayment: null,
    });
  });

  test('CAL-103 status ELIGIBLE, solutions empty, fees excluded note', () => {
    expect(r.status).toBe('ELIGIBLE');
    expect(r.solutions).toEqual({});
    expect(r.products).toEqual([]);
    expect(r.feesIncluded).toBe(false);
    expect(r.acquisitionFeesPct).toBe('0.00');
    expect(r.minDownPaymentPct).toBe('20.00');
  });

  test('CAL-026 shown block of the example: ≈ 154 000 capacity, 175 000 budget, 140 000 financing, ≈ 192 000 reachable', () => {
    expect(r.shown).toEqual({ capacity: '154000', maxBudget: '175000', maxLoan: '140000', fees: '0', reachableBudget: '192000' });
  });

  test('CAL-103 down payment 0 €: B = 0, not usable → CONDITIONAL, missing down payment for the target 30 200', () => {
    const z = evaluateEligibility({ ...YACINE, downPayment: '0' }, ctx());
    expect(z.status).toBe('CONDITIONAL');
    expect(z.maxBudget).toBeNull();
    expect(z.maxLoan).toBeNull();
    expect(z.capacity).toBe('154026');
    expect(z.target?.case).toBe('DOWN_PAYMENT_SHORT');
    expect(z.target?.missingDownPayment).toBe('30200');
    expect(z.target?.requiredMonthlyPayment).toBeNull(); // 151 000 × 0.8 = 120 800 ≤ C
    expect(z.shown).toEqual({ capacity: '154000', maxBudget: null, maxLoan: null, fees: null, reachableBudget: '192000' });
  });

  test('CAL-103 down payment 100 €: B = 500, financing 400 < 10 000 → not usable, CONDITIONAL', () => {
    const z = evaluateEligibility({ ...YACINE, downPayment: '100', targetPrice: null }, ctx());
    expect(z.status).toBe('CONDITIONAL');
    expect(z.maxBudget).toBeNull();
    const { budget } = maxBudget('154026', '100', '0.2', '0');
    expect(budget.toFixed(0)).toBe('500');
  });

  test('CAL-103 visitor aged 67: nAge = 36 months < minimum duration (60) → AGE_OR_DURATION, NOT_ELIGIBLE', () => {
    const z = evaluateEligibility({ ...YACINE, birthYear: 1959 }, ctx());
    expect(z.status).toBe('NOT_ELIGIBLE');
    expect(z.reasons).toEqual(['AGE_OR_DURATION']);
    expect(z.maxBudget).toBeNull();
    expect(z.target).toBeNull();
    expect(retainedDuration(SCALE, 67)).toEqual({ n: 60, ok: false, note: null });
  });

  test('CAL-103 indicative minimum amount converted into the simulation currency (10 000 € → 1 485 000 DA)', () => {
    const z = evaluateEligibility(
      { ...YACINE, monthlyIncome: '504900', monthlyDebts: '22275', incomeCurrency: 'DZD', downPayment: '35000', targetPrice: null },
      ctx(),
    );
    expect(z.displayCurrency).toBe('DZD');
    expect(z.indicative).toBe(true);
    expect(z.status).toBe('ELIGIBLE');
    expect(z.rateDates).toEqual({ 'EUR/DZD': '2026-09-28' });
  });

  test('CAL-103 chosen type without solution while the other type has some → indicative + missing type note', () => {
    const z = evaluateEligibility({ ...YACINE, financingPreference: 'ISLAMIC' }, ctx([DZD_PRODUCT]));
    expect(z.indicative).toBe(true);
    expect(z.missingTypeNote).toBe('ISLAMIC');
    expect(evaluateEligibility(YACINE, ctx()).missingTypeNote).toBeNull();
  });
});

describe('SIM-012 monthly payment for the budget, SIM-031 solution handed to the credit simulator', () => {
  test('SIM-012 down payment limits: financing shown 140 000 over 300 months at 6.50 % → 945.29 / month', () => {
    const r = evaluateEligibility(YACINE, ctx());
    expect(r.rateBps).toBe(650);
    expect(r.pricingMethod).toBe('AMORTIZED_RATE');
    expect(r.budgetMonthlyPayment).toBe('945.29');
  });

  test('SIM-012 income limits: financing shown 154 000 → 1 039.82, never above the maximum monthly payment 1 040.00', () => {
    const r = evaluateEligibility({ ...YACINE, downPayment: '60000', targetPrice: null }, ctx());
    expect(r.limitingFactor).toBe('INCOME');
    expect(r.budgetMonthlyPayment).toBe('1039.82');
    expect(Number(r.budgetMonthlyPayment)).toBeLessThanOrEqual(Number(r.maxMonthlyPayment));
  });

  test('SIM-012 no budget to announce (CONDITIONAL, down payment 0): no monthly payment for the budget', () => {
    expect(evaluateEligibility({ ...YACINE, downPayment: '0' }, ctx()).budgetMonthlyPayment).toBeNull();
  });

  test('SIM-012 product in dinars: computed in DZD on the shown financing, converted to EUR', () => {
    const r = evaluateEligibility({ ...YACINE, downPayment: '30000' }, ctx([DZD_PRODUCT]));
    expect(r.rateBps).toBe(550);
    expect(r.budgetMonthlyPayment).toBe('1037.81');
  });
});

describe('CAL-104 example with a dinar product', () => {
  const inputs: EligibilityInputs = { ...YACINE, downPayment: '30000' };
  const r = evaluateEligibility(inputs, ctx([DZD_PRODUCT]));

  test('CAL-104 product line in DZD: Mmax 154 440.00, C 25 149 510, B 29 604 510, INCOME', () => {
    expect(r.products).toHaveLength(1);
    expect(r.products[0]).toMatchObject({
      productId: 'prod-dzd', bankName: null, financingType: 'CONVENTIONAL', eligible: true, usable: true, reasons: [],
      durationMonths: 300, rateBps: 550, maxMonthlyPayment: '154440.00', capacity: '25149510', maxBudget: '29604510',
      limitingFactor: 'INCOME', currency: 'DZD',
    });
  });

  test('CAL-104 top-level figures in EUR: 1 040.00 · 169 356 · 199 356 · 169 356, ref 199 356', () => {
    expect(r).toMatchObject({
      status: 'ELIGIBLE', indicative: false, displayCurrency: 'EUR', bestProductId: 'prod-dzd',
      maxMonthlyPayment: '1040.00', capacity: '169356', maxBudget: '199356', maxLoan: '169356', maxBudgetRef: '199356',
      refCurrency: 'EUR', minDownPaymentPct: '10.00', reachableBudget: null, reachableBudgetRef: null, durationMonths: 300,
      limitingFactor: 'INCOME', advisedDownPayment: null, acquisitionFeesPct: '0.00',
      solutions: { CONVENTIONAL: 1, ISLAMIC: 0 }, rateDates: { 'EUR/DZD': '2026-09-28' },
    });
  });

  test('CAL-104 shown block: 169 000 / 199 000 / 169 000 / fees 0 (CAL-026)', () => {
    expect(r.shown).toEqual({ capacity: '169000', maxBudget: '199000', maxLoan: '169000', fees: '0', reachableBudget: null });
  });

  test('CAL-104 target: L = 17 968 500 DA, monthly 110 342.31 DA = 743.05 €', () => {
    expect(r.target).toEqual({
      price: '151000', productId: 'prod-dzd', case: 'FINANCEABLE', financeable: true, fees: '0',
      loan: '121000', monthlyPayment: '743.05', missingDownPayment: '0', requiredMonthlyPayment: null,
    });
    expect(r.products[0]!.target).toMatchObject({ loan: '17968500', monthlyPayment: '110342.31' });
  });
});

describe('CAL-101 controls', () => {
  const run = (p: Partial<EligibilityProduct>, i: Partial<EligibilityInputs> = {}) =>
    evaluateEligibility({ ...YACINE, ...i }, ctx([{ ...DZD_PRODUCT, ...p }]));

  test('CAL-101 control 1 residency not accepted → RESIDENCY', () => {
    expect(run({ eligibleResidency: ['RESIDENT'] }).products[0]!.reasons).toEqual(['RESIDENCY']);
    expect(run({ eligibleResidency: ['NON_RESIDENT'] }).products[0]!.eligible).toBe(true);
  });
  test('CAL-101 control 2 country of residence not accepted → RESIDENCE_COUNTRY', () => {
    expect(run({ acceptedResidenceCountries: ['BE'] }).products[0]!.reasons).toEqual(['RESIDENCE_COUNTRY']);
  });
  test('CAL-101 control 3 income currency not accepted → INCOME_CURRENCY', () => {
    expect(run({ acceptedIncomeCurrencies: ['CAD'] }).products[0]!.reasons).toEqual(['INCOME_CURRENCY']);
  });
  test('CAL-101 control 4 conversion impossible → RATE_MISSING', () => {
    expect(run({ currency: 'MAD' }).products[0]!.reasons).toEqual(['RATE_MISSING']);
  });
  test('CAL-101 control 5 age limit reached → AGE_OR_DURATION', () => {
    const r = run({}, { birthYear: 1956 });
    expect(r.products[0]!.reasons).toEqual(['AGE_OR_DURATION']);
    expect(r.status).toBe('NOT_ELIGIBLE');
  });
  test('CAL-101 control 6 income below minMonthlyIncome → INCOME_TOO_LOW', () => {
    expect(run({ minMonthlyIncome: '600000' }).products[0]!.reasons).toEqual(['INCOME_TOO_LOW']);
    expect(run({ minMonthlyIncome: '504900' }).products[0]!.eligible).toBe(true);
  });
  test('CAL-101 control 7 Mmax ≤ 0 → DEBT_RATIO', () => {
    expect(run({}, { monthlyDebts: '1190' }).products[0]!.reasons).toEqual(['DEBT_RATIO']);
  });
  test('CAL-101 control 8 capacity below minAmount → AMOUNT_BELOW_MIN; capacity capped at maxAmount', () => {
    expect(run({ minAmount: '30000000', maxAmount: '50000000' }).products[0]!.reasons).toEqual(['AMOUNT_BELOW_MIN']);
    expect(run({ maxAmount: '20000000' }).products[0]!.capacity).toBe('20000000');
  });
  test('CAL-101 co-borrower and other income are added, debts subtracted', () => {
    const r = evaluateEligibility({ ...YACINE, monthlyIncome: '2000', coBorrowerIncome: '1000', otherIncome: '400' }, ctx());
    expect(r.maxMonthlyPayment).toBe('1040.00');
  });
});

describe('CAL-101 control 5 duration', () => {
  const P = { minDurationMonths: 60, maxDurationMonths: 300, maxAgeAtEnd: 70 };
  test('CAL-101 base = desired duration brought into the bounds; shorter than the minimum becomes the minimum', () => {
    expect(retainedDuration(P, 38, 36)).toEqual({ n: 60, ok: true, note: 'MIN_DURATION' });
    expect(retainedDuration(P, 38, 480)).toEqual({ n: 300, ok: true, note: 'MAX_DURATION' });
    expect(retainedDuration(P, 38, 240)).toEqual({ n: 240, ok: true, note: null });
    expect(retainedDuration(P, 38)).toEqual({ n: 300, ok: true, note: null });
  });
  test('CAL-101 nAge limits the duration, rounded down to a whole year', () => {
    expect(retainedDuration(P, 50, 300)).toEqual({ n: 240, ok: true, note: 'AGE_LIMIT' });
    expect(retainedDuration({ ...P, maxAgeAtEnd: null }, 80, 300)).toEqual({ n: 300, ok: true, note: null });
    expect(retainedDuration(P, 38, 270)).toEqual({ n: 264, ok: true, note: 'WHOLE_YEAR' });
  });
  test('CAL-101 a minimum that is not a whole number of years stays possible; only age can fail the control', () => {
    // desired 66 → floored to 60 → raised back to the 66-month minimum, allowed by nAge = 72
    expect(retainedDuration({ ...P, minDurationMonths: 66 }, 64, 66)).toEqual({ n: 66, ok: true, note: null });
    // nAge = 60 < 66 → fails
    expect(retainedDuration({ ...P, minDurationMonths: 66 }, 65)).toEqual({ n: 66, ok: false, note: null });
    expect(retainedDuration(P, 70)).toEqual({ n: 60, ok: false, note: null });
    expect(retainedDuration(P, 65)).toEqual({ n: 60, ok: true, note: null });
  });
  test('CAL-101 retained duration reported on the result', () => {
    const r = evaluateEligibility({ ...YACINE, birthYear: 1976, desiredDurationMonths: 300 }, ctx());
    expect([r.durationMonths, r.durationNote]).toEqual([240, 'AGE_LIMIT']);
  });
});

describe('CAL-101 budget, advised down payment and target cases', () => {
  test('CAL-101 B formula and limiting factor; advised (a + f) × C ÷ (1 − a) up to the hundred, reachable C ÷ (1 − a)', () => {
    expect(maxBudget('154026', '35000', '0.2', '0')).toEqual({ budget: expect.anything(), limiting: 'DOWN_PAYMENT' });
    expect(maxBudget('154026', '50000', '0.2', '0').limiting).toBe('INCOME');
    expect(maxBudget('154026', '50000', '0.2', '0').budget.toFixed(0)).toBe('204026');
    const a = advisedDownPayment('154026', '0.2', '0');
    expect([a.advised.toFixed(0), a.reachable.toFixed(0)]).toEqual(['38600', '192532']);
    expect(maxBudget('100000', '0', '0', '0')).toMatchObject({ limiting: 'INCOME' });
  });

  test('CAL-101 acquisition fees: budget × (1 + f) = financing + down payment; shown financing recomputed on the shown budget', () => {
    const r = evaluateEligibility({ ...YACINE, targetPrice: null }, ctx([], { acquisitionFeesPct: '10' }));
    // B = min((154 026 + 35 000) ÷ 1.1, 35 000 ÷ 0.3) = 116 666
    expect(r.maxBudget).toBe('116666');
    expect(r.limitingFactor).toBe('DOWN_PAYMENT');
    expect(r.maxLoan).toBe('93332'); // 116 666 × 1.1 − 35 000 = 93 332.6, down to the unit
    expect(r.feesIncluded).toBe(true);
    expect(r.acquisitionFeesPct).toBe('10.00');
    expect(r.shown).toMatchObject({ maxBudget: '116000', fees: '11600', maxLoan: '92600' });
    // advised: 0.3 × 154 026 ÷ 0.8 = 57 759.75 → 57 800
    expect(r.advisedDownPayment).toBe('57800');
  });

  test('CAL-101 target case NO_FINANCING_NEEDED when L ≤ 0', () => {
    const r = evaluateEligibility({ ...YACINE, targetPrice: '30000' }, ctx());
    expect(r.target).toMatchObject({ case: 'NO_FINANCING_NEEDED', financeable: true, loan: '0', monthlyPayment: null });
    expect(r.status).toBe('ELIGIBLE');
  });

  test('CAL-101 target case PAYMENT_TOO_HIGH: required monthly payment for L compared to Mmax → CONDITIONAL', () => {
    const r = evaluateEligibility({ ...YACINE, downPayment: '100000', targetPrice: '300000' }, ctx());
    expect(r.target).toMatchObject({ case: 'PAYMENT_TOO_HIGH', financeable: false, loan: '200000', requiredMonthlyPayment: '1350.41' });
    expect(r.status).toBe('CONDITIONAL');
  });

  test('CAL-101 target case DOWN_PAYMENT_SHORT with both shortfalls (loan T × (1 − a) still above C)', () => {
    const r = evaluateEligibility({ ...YACINE, targetPrice: '250000' }, ctx());
    // need 50 000, have 35 000 → 15 000; T × 0.8 = 200 000 > 154 026 → monthly for 200 000
    expect(r.target).toMatchObject({ case: 'DOWN_PAYMENT_SHORT', missingDownPayment: '15000', requiredMonthlyPayment: '1350.41' });
    expect(r.status).toBe('CONDITIONAL');
  });

  test('CAL-101 target case AMOUNT_BELOW_MIN when the financing need is under the minimum', () => {
    const r = evaluateEligibility({ ...YACINE, targetPrice: '40000' }, ctx());
    expect(r.target).toMatchObject({ case: 'AMOUNT_BELOW_MIN', financeable: false, loan: '5000' });
    expect(r.status).toBe('CONDITIONAL');
  });

  test('CAL-101 missing down payment rounded up to the hundred', () => {
    const r = evaluateEligibility({ ...YACINE, downPayment: '30150' }, ctx());
    expect(r.target?.missingDownPayment).toBe('100'); // 30 200 − 30 150 = 50 → 100
  });
});

describe('CAL-102 global result', () => {
  const ISLAMIC: EligibilityProduct = {
    ...DZD_PRODUCT, id: 'prod-isl', bankName: 'Al Salam', bankIsPublic: true, financingType: 'ISLAMIC', pricingMethod: 'FLAT_MARGIN',
    nominalRateBps: 450, maxDurationMonths: 240, minDownPaymentPct: 20,
  };

  test('CAL-102 best solution = usable product with the largest budget; counts per type; public bank names only', () => {
    const r = evaluateEligibility({ ...YACINE, downPayment: '30000' }, ctx([ISLAMIC, DZD_PRODUCT]));
    expect(r.bestProductId).toBe('prod-dzd');
    expect(r.solutions).toEqual({ CONVENTIONAL: 1, ISLAMIC: 1 });
    expect(r.products.map((p) => p.bankName)).toEqual(['Al Salam', null]);
  });

  test('CAL-102 target block from the product financing it with the lowest monthly payment', () => {
    const r = evaluateEligibility(YACINE, ctx([ISLAMIC, DZD_PRODUCT]));
    expect(r.products.every((p) => p.target!.financeable)).toBe(true);
    const [isl, conv] = r.products.map((p) => Number(p.target!.monthlyPayment));
    expect(conv!).toBeLessThan(isl!);
    expect(r.target!.productId).toBe('prod-dzd');
    // With 30 000 € the Islamic product (20 % minimum) no longer finances the price: only the conventional one does.
    const r2 = evaluateEligibility({ ...YACINE, downPayment: '30000' }, ctx([ISLAMIC, DZD_PRODUCT]));
    expect(r2.products[0]!.target!.case).toBe('DOWN_PAYMENT_SHORT');
    expect(r2.target!.productId).toBe('prod-dzd');
  });

  test('CAL-102 preference filters the products (ISLAMIC only)', () => {
    const r = evaluateEligibility({ ...YACINE, financingPreference: 'ISLAMIC' }, ctx([ISLAMIC, DZD_PRODUCT]));
    expect(r.products.map((p) => p.productId)).toEqual(['prod-isl']);
    expect(r.indicative).toBe(false);
  });

  test('CAL-102 no product usable: best = largest capacity, budget absent, advised down payment given', () => {
    const r = evaluateEligibility({ ...YACINE, downPayment: '0', targetPrice: null }, ctx([ISLAMIC, DZD_PRODUCT]));
    expect(r.status).toBe('CONDITIONAL');
    expect(r.maxBudget).toBeNull();
    expect(r.bestProductId).toBe('prod-dzd');
    expect(r.advisedDownPayment).not.toBeNull();
  });

  test('CAL-102 NOT_ELIGIBLE lists the reasons', () => {
    const r = evaluateEligibility({ ...YACINE, monthlyDebts: '5000' }, ctx([ISLAMIC, DZD_PRODUCT]));
    expect(r.status).toBe('NOT_ELIGIBLE');
    expect(r.reasons).toEqual(['DEBT_RATIO']);
    expect(r.bestProductId).toBeNull();
  });
});

describe('EDI-023 express calculation', () => {
  test('EDI-023 30 000 € + 500 € / month → 74 051 € → budget 104 000 €, financing shown 74 000 € over 300 months', () => {
    expect(quickSimulation({ downPayment: '30000', monthlyPayment: '500' }, SCALE, 'EUR')).toEqual({
      budget: '104000', financing: '74000', financingComputed: '74051', durationMonths: 300, annualRateBps: 650, currency: 'EUR',
    });
  });
  test('EDI-023 45 000 € + 800 € / month → 118 482 € → budget 163 000 € (dont 118 000 €)', () => {
    expect(quickSimulation({ downPayment: '45000', monthlyPayment: '800' }, SCALE, 'EUR')).toMatchObject({
      budget: '163000', financing: '118000', financingComputed: '118482',
    });
  });
  test('EDI-023 no down payment or minimum amount control (0 € + 100 €)', () => {
    expect(quickSimulation({ downPayment: '0', monthlyPayment: '100' }, SCALE, 'EUR')).toMatchObject({ financingComputed: '14810', budget: '14500', financing: '14500' });
  });
});
