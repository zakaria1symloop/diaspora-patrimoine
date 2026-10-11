// Work package 2.6 — simulators through the API layer (calc.ts → @dp/domain → API-002 responses), the PDF model, and the
// SIMULATION_FOLLOWUP request (DEM-016). Figures: Design/donnees-de-reference.md § 5.
import { creditRequestSchema, eligibilityInputSchemaFor, leadSubmitSchema, type IndicativeScale } from '@dp/contracts';
import { describe, expect, it } from 'vitest';
import { completeClient } from '../src/leads/client-record.js';
import { mergeFacts, simulationFacts, type FollowupSimulation } from '../src/leads/simulation-followup.js';
import { computeCredit, computeCreditScenarios, computeEligibility, toEligibilityResult } from '../src/simulations/calc.js';
import type { LoadedProduct, SimContext } from '../src/simulations/context.js';
import { creditPdfModel, eligibilityPdfModel, targetSentence, type PdfCompany } from '../src/simulations/pdf/simulation-pdf.js';
import { AppError } from '../src/platform/errors.js';

const SCALE: IndicativeScale = {
  annualRateBps: 650, minDurationMonths: 60, maxDurationMonths: 300, pricingMethod: 'AMORTIZED_RATE',
  maxDebtRatioPct: 35, minDownPaymentPct: 20, maxAgeAtEnd: 70, minAmount: 10000,
};
const NOW = new Date('2026-10-08T10:00:00Z');
const conversion = {
  rates: [{ base: 'EUR', quote: 'DZD', rate: '148.50', kind: 'OFFICIAL' as const, asOf: '2026-10-08', createdAt: '2026-10-08T08:00:00Z' }],
  kind: 'OFFICIAL' as const,
  referenceCurrency: 'EUR',
  today: '2026-10-08',
  maxAgeDays: 7,
};
const ctx = (products: LoadedProduct[] = []): SimContext => ({
  now: NOW, today: '2026-10-08', conversion, referenceCurrency: 'EUR', scale: SCALE,
  reference: { downPaymentPct: 20, durationMonths: 300, annualRateBps: 650, pricingMethod: 'AMORTIZED_RATE' },
  acquisitionFeesPct: '0', products, islamicFinance: true, country: 'DZ',
});
const parseElig = (v: Record<string, unknown>) => eligibilityInputSchemaFor(2026).parse(v);
const YACINE = {
  propertyCountry: 'DZ', residencyStatus: 'NON_RESIDENT', countryOfResidence: 'FR', birthYear: 1988,
  monthlyIncome: '3400', incomeCurrency: 'EUR', monthlyDebts: '150', downPayment: '35000',
  targetPrice: '151000', targetCurrency: 'EUR',
};
const eur = (amount: string) => ({ amount, currency: 'EUR' });

describe('EP-11 through the API layer (CAL-103 reference example)', () => {
  const input = parseElig(YACINE);
  const { inputs, outputs } = computeEligibility(input, ctx(), null);
  const r = toEligibilityResult(outputs, inputs);

  it('CAL-103 capacity 154 026, budget 175 000, advised down payment 38 600, reachable 192 532, ELIGIBLE', () => {
    expect(r.status).toBe('ELIGIBLE');
    expect(r.indicative).toBe(true);
    expect(r.capacity).toEqual(eur('154026.00'));
    expect(r.maxBudget).toEqual(eur('175000.00'));
    expect(r.maxLoan).toEqual(eur('140000.00'));
    expect(r.advisedDownPayment).toEqual(eur('38600.00'));
    expect(r.reachableBudget).toEqual(eur('192532.00'));
    expect(r.maxMonthlyPayment).toEqual(eur('1040.00'));
    expect(r.durationMonths).toBe(300);
    expect(r.limitingFactor).toBe('DOWN_PAYMENT');
  });

  it('SIM-013 target 151 000 financeable, monthly 783.24', () => {
    expect(r.target).toMatchObject({ case: 'FINANCEABLE', monthlyPayment: eur('783.24'), loan: eur('116000.00') });
    expect(targetSentence(r).replace(/[  ]/g, ' ')).toBe('Ce bien est dans votre budget. Mensualité estimée : 783,24 € / mois* sur 25 ans.');
  });

  it('CAL-026 shown figures (screen, PDF, e-mail) and CAT-035 catalogue budget in the reference currency', () => {
    expect(r.shown).toEqual({ capacity: eur('154000.00'), maxBudget: eur('175000.00'), maxLoan: eur('140000.00'), fees: eur('0.00'), reachableBudget: eur('192000.00') });
    expect(r.shownRef).toEqual({ maxBudget: eur('175000.00'), reachableBudget: eur('192000.00') });
  });

  it('SIM-012 « Mensualité pour ce budget » 945.29; SIM-003 no « ≈ » with the indicative scale', () => {
    expect(r.budgetMonthlyPayment).toEqual(eur('945.29'));
    expect(r.approx).toEqual({ figures: false, target: false });
    expect(r.rateDate).toBeNull();
  });

  it('CAL-102 without down payment: CONDITIONAL, no budget (never 0), missing down payment 30 200', () => {
    const z = computeEligibility(parseElig({ ...YACINE, downPayment: '0' }), ctx(), null);
    const rz = toEligibilityResult(z.outputs, z.inputs);
    expect(rz.status).toBe('CONDITIONAL');
    expect(rz.maxBudget).toBeNull();
    expect(rz.shown.maxBudget).toBeNull();
    expect(rz.target?.missingDownPayment).toEqual(eur('30200.00'));
  });

  it('CAL-100 « prix lié à un bien »: the original 22 275 000 DA is used, converted (≈ and rate date shown)', () => {
    const linked = computeEligibility(parseElig({ ...YACINE, targetPrice: '150000', targetPriceLinked: true }), ctx(), { amount: '22275000', currency: 'DZD' });
    const rl = toEligibilityResult(linked.outputs, linked.inputs);
    expect(rl.target?.price).toEqual(eur('150000.00'));
    expect(rl.approx.target).toBe(true);
    expect(rl.rateDate).toBe('2026-10-08');
  });

  it('CAL-100 age between 18 and 85; target currency required with a target price', () => {
    expect(() => parseElig({ ...YACINE, birthYear: 1940 })).toThrow();
    expect(() => parseElig({ ...YACINE, birthYear: 2010 })).toThrow();
    expect(() => parseElig({ ...YACINE, targetCurrency: undefined })).toThrow();
    expect(parseElig(YACINE).downPaymentCurrency).toBe('EUR');
  });

  it('SIM-008 no usable rate for the income currency: unavailable, never a partial result', () => {
    expect(() => computeEligibility(parseElig({ ...YACINE, incomeCurrency: 'USD', targetCurrency: 'USD' }), ctx(), null)).toThrow(AppError);
  });

  it('SIM-014 NOT_ELIGIBLE at 67 years: AGE_OR_DURATION', () => {
    const o = computeEligibility(parseElig({ ...YACINE, birthYear: 1959 }), ctx(), null);
    const ro = toEligibilityResult(o.outputs, o.inputs);
    expect(ro.status).toBe('NOT_ELIGIBLE');
    expect(ro.reasons).toEqual(['AGE_OR_DURATION']);
  });
});

describe('EP-12 through the API layer (reference figures)', () => {
  const parse = (v: unknown) => creditRequestSchema.parse(v);
  const base = { mode: 'FROM_PRICE', price: '150000', downPayment: '30000', currency: 'EUR', durationMonths: 300, annualRateBps: 650 };

  it('CAL-110 150 000 − 30 000 over 25 years at 6.50 % → 810.25 / month, cost 123 073.90, total 243 073.90', () => {
    const r = computeCredit(parse({ scenarios: [base] }).scenarios[0]!, ctx(), null, true);
    expect(r.monthlyPayment).toEqual(eur('810.25'));
    expect(r.totalInterest).toEqual(eur('123073.90'));
    expect(r.totalCost).toEqual(eur('123073.90'));
    expect(r.totalRepaid).toEqual(eur('243073.90'));
    expect(r.amount).toEqual(eur('120000.00'));
    expect(r.warnings).toEqual([]);
  });

  it('CAL-043 schedule by year 1–3 and month detail (January: 650.00 interest, 160.25 principal; last 809.15)', () => {
    const r = computeCredit(parse({ scenarios: [base] }).scenarios[0]!, ctx(), null, true);
    expect(r.schedule.slice(0, 3).map((y) => [y.principal, y.interest, y.remaining])).toEqual([
      ['1981.34', '7741.66', '118018.66'],
      ['2114.02', '7608.98', '115904.64'],
      ['2255.59', '7467.41', '113649.05'],
    ]);
    expect(r.schedule[0]!.months[0]).toMatchObject({ number: 1, interest: '650.00', principal: '160.25', payment: '810.25' });
    expect(r.schedule[24]!.months[11]).toMatchObject({ number: 300, payment: '809.15', remaining: '0.00' });
    expect(r.schedule[0]!.months).toHaveLength(12);
  });

  it('CAL-111 scenarios 20 / 25 / 30 years: 894.69 · 810.25 · 758.48; lowest monthly = 30 years, lowest cost = 20 years', () => {
    const amount = (n: number) => ({ mode: 'FROM_AMOUNT', amount: '120000', currency: 'EUR', durationMonths: n, annualRateBps: 650 });
    const r = computeCreditScenarios(parse({ scenarios: [amount(240), amount(300), amount(360)], activeIndex: 1 }), ctx(), () => null);
    expect(r.scenarios.map((s) => s.monthlyPayment?.amount)).toEqual(['894.69', '810.25', '758.48']);
    expect(r.scenarios.map((s) => Math.round(Number(s.totalCost?.amount)))).toEqual([94725, 123074, 153055]);
    expect(r.comparison).toEqual({ lowestMonthlyIndex: 2, lowestCostIndex: 0 });
    // Only the scenario being set gets its monthly detail.
    expect(r.scenarios[0]!.schedule[0]!.months).toEqual([]);
    expect(r.scenarios[1]!.schedule[0]!.months).toHaveLength(12);
  });

  it('SIM-022 down payment 15 000 → financed 135 000 over 20 years → 1 006.52, warning « au moins 20 % d’apport, soit 30 000 »', () => {
    const r = computeCredit(parse({ scenarios: [{ ...base, downPayment: '15000', durationMonths: 240 }] }).scenarios[0]!, ctx(), null, false);
    expect(r.amount).toEqual(eur('135000.00'));
    expect(r.monthlyPayment).toEqual(eur('1006.52'));
    expect(r.warnings).toEqual([{ code: 'DOWN_PAYMENT_BELOW_MIN', params: { pct: '20.00', amount: '30000.00' } }]);
  });

  it('SIM-022 down payment ≥ price: nothingToFinance, no figures nor zeros', () => {
    const r = computeCredit(parse({ scenarios: [{ ...base, downPayment: '150000' }] }).scenarios[0]!, ctx(), null, true);
    expect(r.nothingToFinance).toBe(true);
    expect(r.monthlyPayment).toBeNull();
    expect(r.schedule).toEqual([]);
  });

  it('SIM-030 from a property page: linked price 22 275 000 DA, reference financing → 810.25 at the cent', () => {
    const r = computeCredit(parse({ scenarios: [{ ...base, price: '150000', priceLinked: true }] }).scenarios[0]!, ctx(), { amount: '22275000', currency: 'DZD' }, false);
    expect(r.monthlyPayment).toEqual(eur('810.25'));
    expect(r.rateDate).toBe('2026-10-08');
  });

  it('SIM-022 product bounds: duration brought back to the bound with its warning, amount outside the bounds warned', () => {
    const product: LoadedProduct = {
      id: '0190b8d0-0000-7000-8000-000000000001', name: 'Habitat', bankName: 'Banque', bankIsPublic: true, financingType: 'CONVENTIONAL',
      pricingMethod: 'AMORTIZED_RATE', currency: 'EUR', nominalRateBps: 550, minAmount: '10000', maxAmount: '100000',
      minDurationMonths: 60, maxDurationMonths: 240, maxDebtRatioPct: '35', minDownPaymentPct: '10', maxAgeAtEnd: 70,
      eligibleResidency: [], acceptedIncomeCurrencies: [], acceptedResidenceCountries: [], propertyCountryCode: 'DZ',
      otherFeesNote: null, ordinal: 1, insuranceRateBps: null, fileFeeFixed: null, fileFeePct: null,
    };
    const r = computeCredit(parse({ scenarios: [{ ...base, bankProductId: product.id, annualRateBps: undefined }] }).scenarios[0]!, ctx([product]), null, false);
    expect(r.durationMonths).toBe(240);
    expect(r.annualRateBps).toBe(550);
    expect(r.warnings.map((w) => w.code).sort()).toEqual(['AMOUNT_OUT_OF_PRODUCT_BOUNDS', 'DURATION_OUT_OF_PRODUCT_BOUNDS']);
    expect(r.warnings.find((w) => w.code === 'AMOUNT_OUT_OF_PRODUCT_BOUNDS')?.params).toEqual({ min: '10000.00', max: '100000.00' });
  });
});

describe('SIM-040 PDF model', () => {
  const company: PdfCompany = {
    companyName: 'Diaspora Patrimoine', legalName: '', address: '12 rue de l’Exemple, 69002 Lyon', phone: '+33 1 23 45 67 89', email: 'contact@diaspora-patrimoine.exemple',
    monthlyFootnote: '*Exemple indicatif', simulatorDisclaimer: 'Les simulateurs…', feesExcludedNote: 'Hors frais d’acquisition…',
  };
  it('SIM-040 eligibility: settings, result, TRV-023 + TRV-024 + CAL-106 notices, indicative banner, contact footer', () => {
    const input = parseElig(YACINE);
    const { inputs, outputs } = computeEligibility(input, ctx(), null);
    const m = eligibilityPdfModel({ company, input, result: toEligibilityResult(outputs, inputs), reference: null, now: NOW, timeZone: 'Europe/Paris', countryName: (c) => c, property: null });
    expect(m.notes).toEqual(['*Exemple indicatif', 'Les simulateurs…', 'Hors frais d’acquisition…']);
    expect(m.blocks.some((b) => b.kind === 'paragraph' && b.text.startsWith('Estimation réalisée avec un barème indicatif'))).toBe(true);
    expect(m.footer).toContain('contact@diaspora-patrimoine.exemple');
  });
  it('SIM-040 credit: schedule by year (25 rows) and compared scenarios', () => {
    const req = creditRequestSchema.parse({ scenarios: [
      { mode: 'FROM_AMOUNT', amount: '120000', currency: 'EUR', durationMonths: 300, annualRateBps: 650 },
      { mode: 'FROM_AMOUNT', amount: '120000', currency: 'EUR', durationMonths: 240, annualRateBps: 650 },
    ] });
    const response = computeCreditScenarios(req, ctx(), () => null);
    const m = creditPdfModel({ company, scenarios: req.scenarios, activeIndex: 0, response, reference: 'x', now: NOW, timeZone: 'Europe/Paris', productLabel: () => 'Barème indicatif', property: null });
    const tables = m.blocks.filter((b) => b.kind === 'table');
    expect(tables).toHaveLength(2);
    expect(tables[0]!.kind === 'table' && tables[0]!.rows).toHaveLength(25);
  });
});

describe('DEM-016 SIMULATION_FOLLOWUP request', () => {
  const fields = {
    firstName: 'Yacine', lastName: 'Benali', email: 'yacine.benali@exemple.fr', phone: '+33612345678', consentContact: true,
  };
  it('DEM-016 the form is accepted with its simulation id; without it, refused', () => {
    const ok = leadSubmitSchema.safeParse({ form: 'SIMULATION_FOLLOWUP', fields, simulationId: '01a1202c-b36a-7015-b6da-509bbbbfef8f' });
    expect(ok.success).toBe(true);
    expect(leadSubmitSchema.safeParse({ form: 'SIMULATION_FOLLOWUP', fields }).success).toBe(false);
    expect(leadSubmitSchema.safeParse({ form: 'SIMULATION_FOLLOWUP', fields: { ...fields, lastName: '' }, simulationId: '01a1202c-b36a-7015-b6da-509bbbbfef8f' }).success).toBe(false);
  });

  const sim: FollowupSimulation = {
    id: 's', type: 'ELIGIBILITY', anonymousId: 'a',
    inputs: parseElig(YACINE),
    outputs: computeEligibility(parseElig(YACINE), ctx(), null).outputs,
  };

  it('MOD-300 the simulation completes empty fields: income group, down payment, budget', () => {
    const facts = simulationFacts(sim, null, conversion);
    expect(facts.income).toEqual({ monthlyIncome: '3400', otherMonthlyIncome: null, monthlyDebts: '150', currency: 'EUR' });
    expect(facts.downPayment).toEqual({ amount: '35000', currency: 'EUR' });
    expect(facts.budget).toEqual({ amount: '175000', currency: 'EUR', kind: 'TOTAL' });
    const out = completeClient(null, mergeFacts({ firstName: 'Yacine' }, facts));
    expect(out).toMatchObject({ monthlyIncome: '3400', monthlyDebts: '150', incomeCurrency: 'EUR', downPayment: '35000', budgetMax: '175000', residencyStatus: 'NON_RESIDENT' });
  });

  it('MOD-303 a record already in dinars: the amounts are converted into its currency, to the unit', () => {
    const facts = simulationFacts(sim, { incomeCurrency: 'DZD', downPaymentCurrency: null, budgetCurrency: null }, conversion);
    expect(facts.income).toEqual({ monthlyIncome: '504900', otherMonthlyIncome: null, monthlyDebts: '22275', currency: 'DZD' });
  });

  it('MOD-303 no rate for the record currency: the group is not taken', () => {
    const facts = simulationFacts(sim, { incomeCurrency: 'CAD', downPaymentCurrency: null, budgetCurrency: null }, conversion);
    expect(facts.income).toBeUndefined();
    expect(facts.downPayment).toEqual({ amount: '35000', currency: 'EUR' });
  });

  it('MOD-300 a value already present is never overwritten; another income currency never mixes (MOD-303)', () => {
    const current = {
      firstName: null, lastName: null, phone: null, whatsappOptIn: false, countryOfResidence: null, residencyStatus: null, purchaseTimeframe: null,
      financingPreference: null, preferredContactChannel: null, preferredContactSlot: null, timezone: null, budgetMax: null, budgetCurrency: null,
      budgetMonthly: null, budgetMonthlyCurrency: null, downPayment: null, downPaymentCurrency: null, preferredRegionIds: [],
      monthlyIncome: '5000', otherMonthlyIncome: null, monthlyDebts: null, incomeCurrency: 'EUR',
    };
    const out = completeClient(current, { income: { monthlyIncome: '3400', monthlyDebts: '150', currency: 'EUR' } });
    expect(out).toEqual({ monthlyDebts: '150' });
    expect(completeClient(current, { income: { monthlyDebts: '150', currency: 'DZD' } })).toEqual({});
  });
});
