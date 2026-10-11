// The two simulators on the API side: inputs → @dp/domain (CAL-100…CAL-111, nothing recomputed here) → responses in the
// API-002 form. Pure: the caller loads the context (rates, scale, products) and the « linked » property prices.
import type {
  CreditInput,
  CreditRequest,
  CreditResponse,
  CreditResult,
  CreditScheduleYear,
  CreditWarningItem,
  EligibilityInput,
  EligibilityResult,
  Money,
} from '@dp/contracts';
import { SIM_DURATION } from '@dp/contracts';
import {
  compareScenarios,
  convert,
  dec,
  evaluateEligibility,
  roundCents,
  roundDisplayedBudget,
  simulateCredit,
  type Decimal,
  type DecimalInput,
  type EligibilityInputs,
  type EligibilityOutputs,
} from '@dp/domain';
import { AppError } from '../platform/errors.js';
import type { LoadedProduct, SimContext } from './context.js';

/** A price « lié à un bien » (CAL-100, CAL-110): the original price of the property or lot, in its currency. */
export interface LinkedPrice {
  amount: string;
  currency: string;
}

/** SIM-008 — no usable rate for the chosen currency: never a partial result. */
export const simulatorUnavailable = () => AppError.conflictState('SIMULATOR_UNAVAILABLE');

const money = (v: DecimalInput | null | undefined, currency: string): Money | null =>
  v === null || v === undefined ? null : { amount: dec(v).toFixed(2), currency };

// ─── EP-11 ──────────────────────────────────────────────────────────────────

export function eligibilityDomainInputs(input: EligibilityInput, linked: LinkedPrice | null): EligibilityInputs {
  const target = input.targetPriceLinked && linked ? linked : input.targetPrice ? { amount: input.targetPrice, currency: input.targetCurrency! } : null;
  return {
    residencyStatus: input.residencyStatus,
    countryOfResidence: input.countryOfResidence,
    birthYear: input.birthYear,
    monthlyIncome: input.monthlyIncome,
    incomeCurrency: input.incomeCurrency,
    coBorrowerIncome: input.coBorrowerIncome ?? null,
    otherIncome: input.otherIncome ?? null,
    monthlyDebts: input.monthlyDebts,
    downPayment: input.downPayment,
    downPaymentCurrency: input.downPaymentCurrency,
    desiredDurationMonths: input.desiredDurationMonths ?? null,
    financingPreference: input.financingPreference,
    targetPrice: target?.amount ?? null,
    targetCurrency: target?.currency ?? null,
  };
}

/** CAL-100 … CAL-106 through the domain; SIM-008 when every product failed for a missing rate. */
export function computeEligibility(input: EligibilityInput, ctx: SimContext, linked: LinkedPrice | null): { inputs: EligibilityInputs; outputs: EligibilityOutputs } {
  const inputs = eligibilityDomainInputs(input, linked);
  const outputs = evaluateEligibility(inputs, {
    now: ctx.now,
    products: ctx.products.filter((p) => p.propertyCountryCode === input.propertyCountry),
    indicative: ctx.scale,
    acquisitionFeesPct: ctx.acquisitionFeesPct,
    conversion: ctx.conversion,
  });
  if (outputs.status === 'NOT_ELIGIBLE' && outputs.reasons.length > 0 && outputs.reasons.every((r) => r === 'RATE_MISSING')) throw simulatorUnavailable();
  return { inputs, outputs };
}

/** CAL-104 in the API-002 form, with the « ≈ » flags and the rate date of SIM-003. */
export function toEligibilityResult(out: EligibilityOutputs, inputs: EligibilityInputs): EligibilityResult {
  const d = out.displayCurrency;
  const m = (v: string | null) => money(v, d);
  const ref = (v: string | null) => money(v, out.refCurrency);
  const productCurrency = (id: string | null) => out.products.find((p) => p.productId === id)?.currency ?? d;
  const figures = !out.indicative && productCurrency(out.bestProductId) !== d;
  const target = out.target !== null && ((inputs.targetCurrency ?? d) !== d || productCurrency(out.target.productId) !== d);
  const dates = Object.values(out.rateDates).sort();
  return {
    status: out.status,
    indicative: out.indicative,
    displayCurrency: d,
    refCurrency: out.refCurrency,
    bestProductId: out.bestProductId,
    maxMonthlyPayment: m(out.maxMonthlyPayment),
    capacity: m(out.capacity),
    maxBudget: m(out.maxBudget),
    maxLoan: m(out.maxLoan),
    maxBudgetRef: ref(out.maxBudgetRef),
    reachableBudget: m(out.reachableBudget),
    reachableBudgetRef: ref(out.reachableBudgetRef),
    advisedDownPayment: m(out.advisedDownPayment),
    minDownPaymentPct: out.minDownPaymentPct,
    durationMonths: out.durationMonths,
    durationNote: out.durationNote,
    rateBps: out.rateBps,
    pricingMethod: out.pricingMethod,
    budgetMonthlyPayment: m(out.budgetMonthlyPayment),
    limitingFactor: out.limitingFactor,
    acquisitionFeesPct: out.acquisitionFeesPct,
    feesIncluded: out.feesIncluded,
    shown: {
      capacity: m(out.shown.capacity),
      maxBudget: m(out.shown.maxBudget),
      maxLoan: m(out.shown.maxLoan),
      fees: m(out.shown.fees),
      reachableBudget: m(out.shown.reachableBudget),
    },
    // CAT-035 — the catalogue filter uses the budget in the reference currency, rounded like the screen (CAL-026).
    shownRef: {
      maxBudget: out.maxBudgetRef ? ref(roundDisplayedBudget(out.maxBudgetRef).toFixed(0)) : null,
      reachableBudget: out.reachableBudgetRef ? ref(roundDisplayedBudget(out.reachableBudgetRef).toFixed(0)) : null,
    },
    target: out.target
      ? {
          price: m(out.target.price)!,
          productId: out.target.productId,
          case: out.target.case,
          financeable: out.target.financeable,
          fees: m(out.target.fees)!,
          loan: m(out.target.loan)!,
          monthlyPayment: m(out.target.monthlyPayment),
          missingDownPayment: m(out.target.missingDownPayment)!,
          requiredMonthlyPayment: m(out.target.requiredMonthlyPayment),
        }
      : null,
    solutions: out.solutions,
    reasons: out.reasons.filter((r): r is Exclude<typeof r, 'RATE_MISSING'> => r !== 'RATE_MISSING'),
    missingTypeNote: out.missingTypeNote,
    approx: { figures, target },
    rateDate: figures || target ? (dates[0] ?? null) : null,
  };
}

// ─── EP-12 ──────────────────────────────────────────────────────────────────

/**
 * CAL-110 — one scenario. Amounts are converted into the product currency when a product in another currency is chosen
 * (a linked price is taken from the property's own currency), computed there by the domain, then each figure is
 * converted back for display; totals are the conversion of the totals. SIM-022: a duration outside the product bounds
 * is brought back to the bound, with its warning.
 */
export function computeCredit(input: CreditInput, ctx: SimContext, linked: LinkedPrice | null, detail: boolean): CreditResult {
  const cur = input.currency;
  const product: LoadedProduct | null = input.bankProductId ? (ctx.products.find((p) => p.id === input.bankProductId) ?? null) : null;
  if (input.bankProductId && !product) throw AppError.validation([{ field: 'bankProductId', code: 'INVALID_CHOICE', params: null }]);
  const fin = product?.currency ?? cur;
  const used = new Map<string, string>();
  const conv = (v: DecimalInput, from: string, to: string): Decimal => {
    const r = convert(v, from, to, ctx.conversion);
    if (!r) throw simulatorUnavailable();
    r.rates.forEach((u) => used.set(u.pair, u.asOf));
    return from === to ? r.amount : roundCents(r.amount);
  };
  const back = (v: Decimal): Decimal => roundCents(fin === cur ? v : conv(v, fin, cur));
  const s = (v: Decimal) => v.toFixed(2);

  const priceLinked = input.mode === 'FROM_PRICE' && input.priceLinked && linked !== null;
  const priceSim = input.mode === 'FROM_PRICE' ? (priceLinked ? conv(linked!.amount, linked!.currency, cur) : dec(input.price!)) : null;
  const price = input.mode === 'FROM_PRICE' ? (priceLinked ? conv(linked!.amount, linked!.currency, fin) : conv(input.price!, cur, fin)) : null;
  const down = input.mode === 'FROM_PRICE' ? conv(input.downPayment ?? '0', cur, fin) : null;
  const amount = input.mode === 'FROM_AMOUNT' ? conv(input.amount!, cur, fin) : null;

  const bounds = product ? { min: product.minDurationMonths, max: product.maxDurationMonths } : { min: SIM_DURATION.min, max: SIM_DURATION.max };
  const warnings: CreditWarningItem[] = [];
  let n = input.durationMonths;
  if (product && (n < bounds.min || n > bounds.max)) {
    warnings.push({ code: 'DURATION_OUT_OF_PRODUCT_BOUNDS', params: { min: bounds.min, max: bounds.max } });
    n = Math.min(Math.max(n, bounds.min), bounds.max);
  }

  const out = simulateCredit({
    mode: input.mode,
    price,
    downPayment: down,
    amount,
    durationMonths: n,
    product,
    annualRateBps: input.annualRateBps ?? ctx.scale.annualRateBps,
    pricingMethod: input.pricingMethod,
    insuranceRateBps: input.insuranceRateBps ?? null,
    indicativeMinDownPaymentPct: product ? null : ctx.scale.minDownPaymentPct,
    now: ctx.now,
  });
  const dates = [...used.values()].sort();
  const base = {
    currency: cur,
    productCurrency: fin !== cur ? fin : null,
    durationMonths: n,
    durationBounds: bounds,
    rateDate: dates[0] ?? null,
    otherFeesNote: product?.otherFeesNote ?? null,
  };
  if (out.nothingToFinance) {
    return {
      ...base,
      nothingToFinance: true,
      amount: null,
      annualRateBps: null,
      pricingMethod: null,
      financingType: null,
      monthlyPayment: null,
      monthlyInsurance: null,
      monthlyTotal: null,
      totalInterest: null,
      totalInsurance: null,
      fees: null,
      totalCost: null,
      totalRepaid: null,
      warnings: [],
      schedule: [],
    };
  }

  for (const code of out.warnings) {
    if (code === 'AMOUNT_OUT_OF_PRODUCT_BOUNDS' && product) {
      warnings.push({ code, params: { min: s(back(dec(product.minAmount))), max: s(back(dec(product.maxAmount))) } });
    } else if (code === 'DOWN_PAYMENT_BELOW_MIN') {
      const pct = dec(product ? product.minDownPaymentPct : ctx.scale.minDownPaymentPct);
      warnings.push({ code, params: { pct: pct.toFixed(2), amount: s(roundCents(priceSim!.mul(pct).div(100))) } });
    }
  }

  const schedule: CreditScheduleYear[] = out.yearly.map((y) => ({
    year: y.year,
    payments: s(back(y.payments)),
    principal: s(back(y.principal)),
    interest: s(back(y.interest)),
    insurance: s(back(y.insurance)),
    remaining: s(back(y.remaining)),
    months: detail
      ? out.schedule
          .filter((r) => Math.ceil(r.number / 12) === y.year)
          .map((r) => ({
            number: r.number,
            date: r.date,
            payment: s(back(r.payment)),
            principal: s(back(r.principal)),
            interest: s(back(r.interest)),
            insurance: s(back(r.insurance)),
            remaining: s(back(r.remaining)),
          }))
      : [],
  }));
  const mm = (v: Decimal) => money(back(v), cur);
  return {
    ...base,
    nothingToFinance: false,
    amount: mm(out.amount),
    annualRateBps: out.annualRateBps,
    pricingMethod: out.pricingMethod,
    financingType: product?.financingType ?? (out.pricingMethod === 'FLAT_MARGIN' ? 'ISLAMIC' : 'CONVENTIONAL'),
    monthlyPayment: mm(out.monthlyPayment),
    monthlyInsurance: mm(out.monthlyInsurance),
    monthlyTotal: mm(out.monthlyTotal),
    totalInterest: mm(out.totalInterest),
    totalInsurance: mm(out.totalInsurance),
    fees: mm(out.fees),
    totalCost: mm(out.totalCost),
    totalRepaid: mm(out.totalRepaid),
    warnings,
    schedule,
  };
}

/** CAL-111 — up to three scenarios; the lowest monthly payment and total cost are marked (scenarios with figures only). */
export function computeCreditScenarios(req: CreditRequest, ctx: SimContext, linked: (i: number) => LinkedPrice | null): CreditResponse {
  const scenarios = req.scenarios.map((sc, i) => computeCredit(sc, ctx, linked(i), i === req.activeIndex));
  const withFigures = scenarios.map((r, i) => ({ r, i })).filter((x) => !x.r.nothingToFinance);
  let comparison: CreditResponse['comparison'] = null;
  if (withFigures.length >= 2) {
    const c = compareScenarios(withFigures.map((x) => ({ monthlyPayment: x.r.monthlyPayment!.amount, totalCost: x.r.totalCost!.amount })));
    comparison = { lowestMonthlyIndex: withFigures[c.lowestMonthlyIndex]!.i, lowestCostIndex: withFigures[c.lowestCostIndex]!.i };
  }
  return { scenarios, comparison };
}
