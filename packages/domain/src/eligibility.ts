// Eligibility simulator (CAL-100…CAL-107) and express calculation (EDI-023).
import type { IndicativeScale } from '@dp/contracts';
import { capacity, monthlyPayment, rateForDuration, type PricingMethod, type RateBand } from './loan.js';
import {
  Decimal,
  ZERO,
  convert,
  dec,
  decOrNull,
  roundCents,
  roundDisplayedBudget,
  roundDownUnit,
  roundDp,
  roundToStep,
  toCompactAmountString,
  type ConversionContext,
  type DecimalInput,
  type UsedRate,
} from './money.js';

export type FinancingType = 'CONVENTIONAL' | 'ISLAMIC';
export type FinancingPreference = 'CONVENTIONAL' | 'ISLAMIC' | 'NO_PREFERENCE';
export type ResidencyStatus = 'NON_RESIDENT' | 'EXPATRIATE' | 'RESIDENT' | 'OTHER';
export type EligibilityStatus = 'ELIGIBLE' | 'CONDITIONAL' | 'NOT_ELIGIBLE';
export type EligibilityReason =
  | 'RESIDENCY'
  | 'RESIDENCE_COUNTRY'
  | 'INCOME_CURRENCY'
  | 'RATE_MISSING'
  | 'AGE_OR_DURATION'
  | 'INCOME_TOO_LOW'
  | 'DEBT_RATIO'
  | 'AMOUNT_BELOW_MIN';
export type LimitingFactor = 'INCOME' | 'DOWN_PAYMENT';
export type TargetCase = 'NO_FINANCING_NEEDED' | 'FINANCEABLE' | 'DOWN_PAYMENT_SHORT' | 'PAYMENT_TOO_HIGH' | 'AMOUNT_BELOW_MIN';
/**
 * CAL-101 control 5 — why the retained duration differs from the desired one: the product minimum
 * (« c'est le minimum de cette solution »), the age limit (« limitée par l'âge en fin de financement »), the product
 * maximum, or the rounding down to a whole year.
 */
export type DurationNote = 'MIN_DURATION' | 'AGE_LIMIT' | 'MAX_DURATION' | 'WHOLE_YEAR';

/** A product to evaluate (`BankProduct`, MOD § 3.5): usable (MOD-113), of the property country, public in simulators. */
export interface EligibilityProduct {
  id: string;
  bankName: string;
  /** `Bank.isPublic`: otherwise the bank name is not shown (CAL-102, SIM-006). */
  bankIsPublic: boolean;
  financingType: FinancingType;
  pricingMethod: PricingMethod;
  currency: string;
  nominalRateBps: number;
  rateBands?: readonly RateBand[] | null;
  minAmount: DecimalInput;
  maxAmount: DecimalInput;
  minDurationMonths: number;
  maxDurationMonths: number;
  maxDebtRatioPct: DecimalInput;
  minDownPaymentPct: DecimalInput;
  maxAgeAtEnd: number | null;
  minMonthlyIncome?: DecimalInput | null;
  /** Empty = every situation. */
  eligibleResidency: readonly ResidencyStatus[];
  /** Empty = every currency. */
  acceptedIncomeCurrencies: readonly string[];
  /** Empty = every country. */
  acceptedResidenceCountries: readonly string[];
}

/** CAL-100 — `Simulation.inputs` of type `ELIGIBILITY` (validated upstream by the contracts schema). */
export interface EligibilityInputs {
  residencyStatus: ResidencyStatus;
  countryOfResidence: string;
  birthYear: number;
  monthlyIncome: DecimalInput;
  incomeCurrency: string;
  coBorrowerIncome?: DecimalInput | null;
  otherIncome?: DecimalInput | null;
  monthlyDebts: DecimalInput;
  downPayment: DecimalInput;
  downPaymentCurrency: string;
  desiredDurationMonths?: number | null;
  financingPreference: FinancingPreference;
  /**
   * Target price. CAL-100 « prix lié à un bien »: while the visitor keeps the price prefilled from a property, the
   * caller passes the original price in its currency (`priceFrom` or the lot price), not the rounded displayed one.
   */
  targetPrice?: DecimalInput | null;
  targetCurrency?: string | null;
}

export interface EligibilityContext {
  /** Clock (ARC-070): age = current year − birth year (main borrower only). */
  now: Date;
  /** Usable products (MOD-113) of the chosen property country, `isPublicInSimulators`; filtered here by preference. */
  products: readonly EligibilityProduct[];
  /** `finance.indicative` (PAR-044), used when no product is to be evaluated (CAL-103). */
  indicative: IndicativeScale;
  /** `finance.acquisitionFeesPct.{country}` (CAL-106), default 0. */
  acquisitionFeesPct?: DecimalInput | null;
  conversion: ConversionContext & { referenceCurrency: string };
}

/** One line of `outputs.products` (amounts in the product currency). */
export interface ProductEvaluation {
  productId: string | null;
  bankName: string | null;
  financingType: FinancingType | null;
  /** Passes the eight controls. */
  eligible: boolean;
  /** Mobilisable as is: `Lmax` ≥ `minAmount` (CAL-101). */
  usable: boolean;
  reasons: EligibilityReason[];
  durationMonths: number | null;
  durationNote: DurationNote | null;
  rateBps: number | null;
  maxMonthlyPayment: string | null;
  capacity: string | null;
  maxBudget: string | null;
  maxLoan: string | null;
  limitingFactor: LimitingFactor | null;
  advisedDownPayment: string | null;
  reachableBudget: string | null;
  target: TargetOutput | null;
  currency: string;
}

export interface TargetOutput {
  price: string;
  productId: string | null;
  case: TargetCase;
  financeable: boolean;
  fees: string;
  loan: string;
  monthlyPayment: string | null;
  missingDownPayment: string;
  requiredMonthlyPayment: string | null;
}

export interface ShownBlock {
  capacity: string | null;
  maxBudget: string | null;
  maxLoan: string | null;
  fees: string | null;
  reachableBudget: string | null;
}

/** CAL-104 — `Simulation.outputs`. */
export interface EligibilityOutputs {
  status: EligibilityStatus;
  indicative: boolean;
  displayCurrency: string;
  bestProductId: string | null;
  maxMonthlyPayment: string | null;
  capacity: string | null;
  maxBudget: string | null;
  maxLoan: string | null;
  maxBudgetRef: string | null;
  refCurrency: string;
  minDownPaymentPct: string | null;
  reachableBudget: string | null;
  reachableBudgetRef: string | null;
  durationMonths: number | null;
  durationNote: DurationNote | null;
  /** Rate (bps, CAL-048) and method of the best solution — what SIM-031 hands to the credit simulator. */
  rateBps: number | null;
  pricingMethod: PricingMethod | null;
  /**
   * SIM-012 « Mensualité pour ce budget » — monthly payment of the financing shown in the budget detail (`shown.maxLoan`)
   * over the retained duration, at the best solution's rate (2 decimals, simulation currency). Null without a budget.
   */
  budgetMonthlyPayment: string | null;
  limitingFactor: LimitingFactor | null;
  advisedDownPayment: string | null;
  acquisitionFeesPct: string;
  /** CAL-106 — false: the `legal.feesExcludedNote` notice applies. */
  feesIncluded: boolean;
  shown: ShownBlock;
  target: TargetOutput | null;
  /** Products passing the eight controls, per type; `{}` with the indicative scale (CAL-103). */
  solutions: Partial<Record<FinancingType, number>>;
  products: ProductEvaluation[];
  /** Distinct failure reasons (for the NOT_ELIGIBLE explanation, CAL-102). */
  reasons: EligibilityReason[];
  /** CAL-103 — chosen type with no solution while the other type has some. */
  missingTypeNote: FinancingType | null;
  rateDates: Record<string, string>;
}

// ---------------------------------------------------------------------------------------------

interface NormalizedProduct {
  id: string | null;
  bankName: string | null;
  financingType: FinancingType | null;
  pricingMethod: PricingMethod;
  currency: string;
  nominalRateBps: number;
  rateBands: readonly RateBand[] | null;
  minAmount: Decimal | null;
  maxAmount: Decimal | null;
  minDurationMonths: number;
  maxDurationMonths: number;
  maxDebtRatioPct: Decimal;
  minDownPaymentPct: Decimal;
  maxAgeAtEnd: number | null;
  minMonthlyIncome: Decimal | null;
  eligibleResidency: readonly ResidencyStatus[];
  acceptedIncomeCurrencies: readonly string[];
  acceptedResidenceCountries: readonly string[];
  /** Conversion of the indicative minimum amount failed (CAL-103): RATE_MISSING. */
  minAmountMissing?: boolean;
}

interface TargetEval {
  case: TargetCase;
  financeable: boolean;
  t: Decimal;
  fees: Decimal;
  loan: Decimal;
  monthly: Decimal | null;
  missing: Decimal;
  required: Decimal | null;
}

interface Evaluation {
  p: NormalizedProduct;
  reason: EligibilityReason | null;
  n: number | null;
  durationNote: DurationNote | null;
  rateBps: number | null;
  mmax: Decimal | null;
  c: Decimal | null;
  b: Decimal | null;
  lmax: Decimal | null;
  limiting: LimitingFactor | null;
  advised: Decimal | null;
  reachable: Decimal | null;
  usable: boolean;
  d: Decimal | null;
  target: TargetEval | null;
}

class RateCollector {
  readonly used = new Map<string, string>();
  constructor(private readonly ctx: ConversionContext) {}
  conv(amount: DecimalInput, from: string, to: string): Decimal | null {
    const r = convert(amount, from, to, this.ctx);
    if (r === null) return null;
    r.rates.forEach((u: UsedRate) => this.used.set(u.pair, u.asOf));
    return r.amount;
  }
}

const ceilHundred = (v: Decimal): Decimal => roundToStep(v, 100, 'UP');

/**
 * CAL-101 control 5 — duration: base = desired duration or the product maximum, brought into the product bounds;
 * `nAge` = (maxAgeAtEnd − age) × 12 or unlimited; n = min(base, nAge) rounded down to a whole year, raised to the
 * product minimum if below; the control fails unless n ≤ nAge.
 */
export function retainedDuration(
  product: { minDurationMonths: number; maxDurationMonths: number; maxAgeAtEnd: number | null },
  age: number,
  desiredDurationMonths?: number | null,
): { n: number; ok: boolean; note: DurationNote | null } {
  const desired = desiredDurationMonths ?? null;
  const raw = desired ?? product.maxDurationMonths;
  const base = Math.min(Math.max(raw, product.minDurationMonths), product.maxDurationMonths);
  const nAge = product.maxAgeAtEnd === null ? Number.POSITIVE_INFINITY : (product.maxAgeAtEnd - age) * 12;
  let n = Math.floor(Math.min(base, nAge) / 12) * 12;
  if (n < product.minDurationMonths) n = product.minDurationMonths;
  const ok = n <= nAge;
  let note: DurationNote | null = null;
  if (desired !== null && n !== desired) {
    if (nAge < base) note = 'AGE_LIMIT';
    else if (n === product.minDurationMonths && desired < n) note = 'MIN_DURATION';
    else if (desired > product.maxDurationMonths) note = 'MAX_DURATION';
    else note = 'WHOLE_YEAR';
  }
  return { n, ok, note };
}

/**
 * CAL-101 — maximum budget `B` = min((C + D) ÷ (1 + f), D ÷ (a + f) when a + f > 0), rounded down to the unit;
 * limiting factor `DOWN_PAYMENT` when the second limit is the lower one, otherwise `INCOME`.
 */
export function maxBudget(c: DecimalInput, d: DecimalInput, a: DecimalInput, f: DecimalInput): { budget: Decimal; limiting: LimitingFactor } {
  const C = dec(c);
  const D = dec(d);
  const af = dec(a).add(dec(f));
  const byIncome = C.add(D).div(dec(f).add(1));
  if (af.gt(0)) {
    const byDownPayment = D.div(af);
    if (byDownPayment.lt(byIncome)) return { budget: roundDownUnit(byDownPayment), limiting: 'DOWN_PAYMENT' };
  }
  return { budget: roundDownUnit(byIncome), limiting: 'INCOME' };
}

/**
 * CAL-101 — advised down payment to use the whole capacity: (a + f) × C ÷ (1 − a), rounded up to the hundred;
 * reachable budget C ÷ (1 − a), rounded down to the unit.
 */
export function advisedDownPayment(c: DecimalInput, a: DecimalInput, f: DecimalInput): { advised: Decimal; reachable: Decimal } {
  const C = dec(c);
  const oneMinusA = new Decimal(1).sub(dec(a));
  return {
    advised: ceilHundred(dec(a).add(dec(f)).mul(C).div(oneMinusA)),
    reachable: roundDownUnit(C.div(oneMinusA)),
  };
}

function evaluateTarget(
  t: Decimal,
  d: Decimal,
  a: Decimal,
  f: Decimal,
  c: Decimal,
  minAmount: Decimal | null,
  n: number,
  rateBps: number,
  method: PricingMethod,
): TargetEval {
  const fees = f.mul(t);
  const l = t.add(fees).sub(d);
  const needDown = a.add(f).mul(t);
  const min = minAmount ?? ZERO;
  const base = { t, fees, loan: Decimal.max(l, 0), monthly: null, missing: ZERO, required: null };
  if (l.lte(0)) return { ...base, case: 'NO_FINANCING_NEEDED', financeable: true };
  if (d.gte(needDown) && l.lte(c) && l.gte(min)) {
    return { ...base, case: 'FINANCEABLE', financeable: true, monthly: monthlyPayment(l, n, rateBps, method) };
  }
  if (d.lt(needDown)) {
    const loanAfterTopUp = t.mul(new Decimal(1).sub(a));
    return {
      ...base,
      case: 'DOWN_PAYMENT_SHORT',
      financeable: false,
      missing: ceilHundred(needDown.sub(d)),
      required: loanAfterTopUp.gt(c) ? monthlyPayment(loanAfterTopUp, n, rateBps, method) : null,
    };
  }
  if (l.gt(c)) return { ...base, case: 'PAYMENT_TOO_HIGH', financeable: false, required: monthlyPayment(l, n, rateBps, method) };
  return { ...base, case: 'AMOUNT_BELOW_MIN', financeable: false };
}

function evaluate(
  p: NormalizedProduct,
  inputs: EligibilityInputs,
  age: number,
  f: Decimal,
  rc: RateCollector,
): Evaluation {
  const ev: Evaluation = {
    p, reason: null, n: null, durationNote: null, rateBps: null, mmax: null, c: null, b: null, lmax: null,
    limiting: null, advised: null, reachable: null, usable: false, d: null, target: null,
  };
  const fail = (reason: EligibilityReason): Evaluation => ({ ...ev, reason });
  // 1–3
  if (p.eligibleResidency.length > 0 && !p.eligibleResidency.includes(inputs.residencyStatus)) return fail('RESIDENCY');
  if (p.acceptedResidenceCountries.length > 0 && !p.acceptedResidenceCountries.includes(inputs.countryOfResidence)) return fail('RESIDENCE_COUNTRY');
  if (p.acceptedIncomeCurrencies.length > 0 && !p.acceptedIncomeCurrencies.includes(inputs.incomeCurrency)) return fail('INCOME_CURRENCY');
  // 4
  const toP = (v: DecimalInput | null | undefined, cur: string): Decimal | null => rc.conv(v ?? 0, cur, p.currency);
  const income = toP(inputs.monthlyIncome, inputs.incomeCurrency);
  const co = toP(inputs.coBorrowerIncome, inputs.incomeCurrency);
  const other = toP(inputs.otherIncome, inputs.incomeCurrency);
  const debts = toP(inputs.monthlyDebts, inputs.incomeCurrency);
  const d = toP(inputs.downPayment, inputs.downPaymentCurrency);
  const hasTarget = inputs.targetPrice !== null && inputs.targetPrice !== undefined;
  const t = hasTarget ? toP(inputs.targetPrice, inputs.targetCurrency ?? inputs.incomeCurrency) : null;
  if (!income || !co || !other || !debts || !d || (hasTarget && !t) || p.minAmountMissing) return fail('RATE_MISSING');
  // 5
  const dur = retainedDuration(p, age, inputs.desiredDurationMonths);
  if (!dur.ok) return { ...fail('AGE_OR_DURATION'), n: dur.n };
  const n = dur.n;
  // 6
  const totalIncome = income.add(co).add(other);
  if (p.minMonthlyIncome && totalIncome.lt(p.minMonthlyIncome)) return { ...fail('INCOME_TOO_LOW'), n };
  // 7
  const mmax = totalIncome.mul(p.maxDebtRatioPct).div(100).sub(debts);
  if (mmax.lte(0)) return { ...fail('DEBT_RATIO'), n };
  // 8
  const rateBps = rateForDuration(p, n);
  let c = capacity(mmax, n, rateBps, p.pricingMethod);
  if (p.maxAmount && c.gt(p.maxAmount)) c = p.maxAmount;
  if (p.minAmount && c.lt(p.minAmount)) return { ...fail('AMOUNT_BELOW_MIN'), n, rateBps, mmax, c };

  const a = p.minDownPaymentPct.div(100);
  const { budget: b, limiting } = maxBudget(c, d, a, f);
  const lmax = b.mul(f.add(1)).sub(d);
  const usable = lmax.gt(0) && lmax.gte(p.minAmount ?? ZERO);
  const adv = limiting === 'DOWN_PAYMENT' ? advisedDownPayment(c, a, f) : null;
  const target = t ? evaluateTarget(t, d, a, f, c, p.minAmount, n, rateBps, p.pricingMethod) : null;
  return {
    ...ev, n, durationNote: dur.note, rateBps, mmax, c, b, lmax, limiting, usable, d, target,
    advised: adv?.advised ?? null, reachable: adv?.reachable ?? null,
  };
}

function normalizeProduct(p: EligibilityProduct): NormalizedProduct {
  return {
    id: p.id,
    bankName: p.bankIsPublic ? p.bankName : null,
    financingType: p.financingType,
    pricingMethod: p.pricingMethod,
    currency: p.currency,
    nominalRateBps: p.nominalRateBps,
    rateBands: p.rateBands ?? null,
    minAmount: dec(p.minAmount),
    maxAmount: dec(p.maxAmount),
    minDurationMonths: p.minDurationMonths,
    maxDurationMonths: p.maxDurationMonths,
    maxDebtRatioPct: dec(p.maxDebtRatioPct),
    minDownPaymentPct: dec(p.minDownPaymentPct),
    maxAgeAtEnd: p.maxAgeAtEnd,
    minMonthlyIncome: decOrNull(p.minMonthlyIncome),
    eligibleResidency: p.eligibleResidency,
    acceptedIncomeCurrencies: p.acceptedIncomeCurrencies,
    acceptedResidenceCountries: p.acceptedResidenceCountries,
  };
}

/** CAL-103 — the indicative scale as the single product, in the simulation currency; no residence control, no maximum. */
function indicativeProduct(scale: IndicativeScale, displayCurrency: string, rc: RateCollector, ref: string): NormalizedProduct {
  const minAmount = rc.conv(scale.minAmount, ref, displayCurrency);
  return {
    id: null,
    bankName: null,
    financingType: null,
    pricingMethod: scale.pricingMethod,
    currency: displayCurrency,
    nominalRateBps: scale.annualRateBps,
    rateBands: null,
    minAmount,
    maxAmount: null,
    minDurationMonths: scale.minDurationMonths,
    maxDurationMonths: scale.maxDurationMonths,
    maxDebtRatioPct: dec(scale.maxDebtRatioPct),
    minDownPaymentPct: dec(scale.minDownPaymentPct),
    maxAgeAtEnd: scale.maxAgeAtEnd,
    minMonthlyIncome: null,
    eligibleResidency: [],
    acceptedIncomeCurrencies: [],
    acceptedResidenceCountries: [],
    minAmountMissing: minAmount === null,
  };
}

/**
 * CAL-100 … CAL-104, CAL-106 — eligibility simulation.
 * Products are filtered by preference (`NO_PREFERENCE`: both types); none → indicative scale (CAL-103). Each product
 * goes through the eight controls of CAL-101 in its own currency, then budget, limiting factor, advised down payment,
 * financing at the maximum budget, usability and the target price case. CAL-102 chooses the status and the best
 * solution; top-level figures come from that single product, converted to the simulation currency (capacity and
 * budget rounded down to the unit, monthly payments to 2 decimals), with the `shown` block of CAL-026.
 */
export function evaluateEligibility(inputs: EligibilityInputs, ctx: EligibilityContext): EligibilityOutputs {
  const displayCurrency = inputs.incomeCurrency;
  const ref = ctx.conversion.referenceCurrency;
  const rc = new RateCollector(ctx.conversion);
  const age = ctx.now.getUTCFullYear() - inputs.birthYear;
  const f = (decOrNull(ctx.acquisitionFeesPct) ?? ZERO).div(100);

  const wanted = ctx.products.filter(
    (p) => inputs.financingPreference === 'NO_PREFERENCE' || p.financingType === inputs.financingPreference,
  );
  const indicative = wanted.length === 0;
  const missingTypeNote: FinancingType | null =
    indicative && inputs.financingPreference !== 'NO_PREFERENCE' && ctx.products.length > 0 ? inputs.financingPreference : null;
  const evaluated = (indicative ? [indicativeProduct(ctx.indicative, displayCurrency, rc, ref)] : wanted.map(normalizeProduct)).map((p) =>
    evaluate(p, inputs, age, f, rc),
  );

  // Conversions back to the simulation / reference currency.
  const toDisplay = (v: Decimal, from: string): Decimal => rc.conv(v, from, displayCurrency) ?? v;
  const toRef = (v: Decimal, from: string): Decimal | null => rc.conv(v, from, ref);

  const passing = evaluated.filter((e) => e.reason === null);
  const usable = passing.filter((e) => e.usable);
  const byRate = (x: Evaluation, y: Evaluation): number => (x.rateBps ?? 0) - (y.rateBps ?? 0);
  const disp = (e: Evaluation, v: Decimal | null): Decimal => (v === null ? ZERO : toDisplay(v, e.p.currency));
  let best: Evaluation | null = null;
  if (usable.length > 0) {
    best = [...usable].sort((x, y) => disp(y, y.b).cmp(disp(x, x.b)) || disp(y, y.c).cmp(disp(x, x.c)) || byRate(x, y))[0]!;
  } else if (passing.length > 0) {
    best = [...passing].sort((x, y) => disp(y, y.c).cmp(disp(x, x.c)) || byRate(x, y))[0]!;
  }

  // Target block (CAL-102): the product financing the price with the lowest monthly payment, else the best solution.
  let targetEval: Evaluation | null = null;
  const financing = passing.filter((e) => e.target?.financeable);
  if (financing.length > 0) {
    targetEval = [...financing].sort((x, y) => disp(x, x.target!.monthly ?? ZERO).cmp(disp(y, y.target!.monthly ?? ZERO)))[0]!;
  } else if (best?.target) {
    targetEval = best;
  }

  const status: EligibilityStatus =
    passing.length === 0
      ? 'NOT_ELIGIBLE'
      : usable.length > 0 && (inputs.targetPrice == null || financing.length > 0)
        ? 'ELIGIBLE'
        : 'CONDITIONAL';

  const s = (v: Decimal | null): string | null => (v === null ? null : toCompactAmountString(v));
  const productLine = (e: Evaluation): ProductEvaluation => ({
    productId: e.p.id,
    bankName: e.p.bankName,
    financingType: e.p.financingType,
    eligible: e.reason === null,
    usable: e.usable,
    reasons: e.reason ? [e.reason] : [],
    durationMonths: e.n,
    durationNote: e.durationNote,
    rateBps: e.rateBps,
    maxMonthlyPayment: e.mmax ? roundCents(e.mmax).toFixed(2) : null,
    capacity: s(e.c),
    maxBudget: e.reason === null ? s(e.b) : null,
    maxLoan: e.reason === null ? s(e.lmax && roundDownUnit(e.lmax)) : null,
    limitingFactor: e.limiting,
    advisedDownPayment: s(e.advised),
    reachableBudget: s(e.reachable),
    target: e.target ? targetOutput(e, e.target, e.p.currency, (v) => v, (v) => v) : null,
    currency: e.p.currency,
  });

  const targetOutput = (
    e: Evaluation,
    t: TargetEval,
    _cur: string,
    conv: (v: Decimal) => Decimal,
    priceOf: (v: Decimal) => Decimal,
  ): TargetOutput => ({
    price: toCompactAmountString(roundCents(priceOf(t.t))),
    productId: e.p.id,
    case: t.case,
    financeable: t.financeable,
    fees: toCompactAmountString(roundCents(conv(t.fees))),
    loan: toCompactAmountString(roundCents(conv(t.loan))),
    monthlyPayment: t.monthly ? roundCents(conv(roundCents(t.monthly))).toFixed(2) : null,
    missingDownPayment: toCompactAmountString(t.missing.isZero() ? ZERO : ceilHundred(conv(t.missing))),
    requiredMonthlyPayment: t.required ? roundCents(conv(roundCents(t.required))).toFixed(2) : null,
  });

  const feesPct = roundDp(f.mul(100), 2).toFixed(2);
  const reasons = [...new Set(evaluated.map((e) => e.reason).filter((r): r is EligibilityReason => r !== null))];
  const solutions: Partial<Record<FinancingType, number>> = {};
  if (!indicative) {
    solutions.CONVENTIONAL = passing.filter((e) => e.p.financingType === 'CONVENTIONAL').length;
    solutions.ISLAMIC = passing.filter((e) => e.p.financingType === 'ISLAMIC').length;
  }
  const products = indicative ? [] : evaluated.map(productLine);

  if (best === null) {
    return {
      status, indicative, displayCurrency, bestProductId: null, maxMonthlyPayment: null, capacity: null, maxBudget: null,
      maxLoan: null, maxBudgetRef: null, refCurrency: ref, minDownPaymentPct: null, reachableBudget: null,
      reachableBudgetRef: null, durationMonths: null, durationNote: null, rateBps: null, pricingMethod: null, budgetMonthlyPayment: null,
      limitingFactor: null, advisedDownPayment: null,
      acquisitionFeesPct: feesPct, feesIncluded: f.gt(0),
      shown: { capacity: null, maxBudget: null, maxLoan: null, fees: null, reachableBudget: null },
      target: null, solutions, products, reasons, missingTypeNote, rateDates: Object.fromEntries(rc.used),
    };
  }

  const cur = best.p.currency;
  const capacityD = roundDownUnit(toDisplay(best.c!, cur));
  const budgetD = best.usable ? roundDownUnit(toDisplay(best.b!, cur)) : null;
  const loanD = best.usable ? roundDownUnit(toDisplay(best.lmax!, cur)) : null;
  const budgetRefRaw = best.usable ? toRef(best.b!, cur) : null;
  const reachableD = best.reachable ? roundDownUnit(toDisplay(best.reachable, cur)) : null;
  const reachableRefRaw = best.reachable ? toRef(best.reachable, cur) : null;
  const advisedD = best.advised ? ceilHundred(toDisplay(best.advised, cur)) : null;
  const downPaymentD = rc.conv(inputs.downPayment, inputs.downPaymentCurrency, displayCurrency) ?? dec(inputs.downPayment);

  // CAL-026 — the `shown` block: capacity, budget and reachable budget down to the CAL-021 step; fees and financing
  // recomputed on the displayed budget so that budget × (1 + f) = financing + down payment on screen.
  const shownBudget = budgetD ? roundDisplayedBudget(budgetD) : null;
  const shownFees = shownBudget ? roundDp(shownBudget.mul(f), 0) : null;
  const shown: ShownBlock = {
    capacity: s(roundDisplayedBudget(capacityD)),
    maxBudget: s(shownBudget),
    maxLoan: shownBudget && shownFees ? s(shownBudget.add(shownFees).sub(downPaymentD)) : null,
    fees: s(shownFees),
    reachableBudget: s(reachableD && roundDisplayedBudget(reachableD)),
  };
  // SIM-012 — the monthly payment of the financing shown (computed in the product currency, converted for display).
  const shownLoan = shownBudget && shownFees ? shownBudget.add(shownFees).sub(downPaymentD) : null;
  const shownLoanP = shownLoan && shownLoan.gt(0) ? rc.conv(shownLoan, displayCurrency, cur) : null;
  const budgetMonthly = shownLoanP ? roundCents(toDisplay(roundCents(monthlyPayment(shownLoanP, best.n!, best.rateBps!, best.p.pricingMethod)), cur)) : null;

  return {
    status,
    indicative,
    displayCurrency,
    bestProductId: best.p.id,
    maxMonthlyPayment: roundCents(toDisplay(best.mmax!, cur)).toFixed(2),
    capacity: s(capacityD),
    maxBudget: s(budgetD),
    maxLoan: s(loanD),
    maxBudgetRef: s(budgetRefRaw && roundDownUnit(budgetRefRaw)),
    refCurrency: ref,
    minDownPaymentPct: roundDp(best.p.minDownPaymentPct, 2).toFixed(2),
    reachableBudget: s(reachableD),
    reachableBudgetRef: s(reachableRefRaw && roundDownUnit(reachableRefRaw)),
    durationMonths: best.n,
    durationNote: best.durationNote,
    rateBps: best.rateBps,
    pricingMethod: best.p.pricingMethod,
    budgetMonthlyPayment: budgetMonthly ? budgetMonthly.toFixed(2) : null,
    limitingFactor: best.limiting,
    advisedDownPayment: s(advisedD),
    acquisitionFeesPct: feesPct,
    feesIncluded: f.gt(0),
    shown,
    target: targetEval
      ? targetOutput(
          targetEval,
          targetEval.target!,
          displayCurrency,
          (v) => toDisplay(v, targetEval.p.currency),
          () =>
            rc.conv(inputs.targetPrice!, inputs.targetCurrency ?? inputs.incomeCurrency, displayCurrency) ??
            toDisplay(targetEval.target!.t, targetEval.p.currency),
        )
      : null,
    solutions,
    products,
    reasons,
    missingTypeNote,
    rateDates: Object.fromEntries(rc.used),
  };
}

// ---------------------------------------------------------------------------------------------
// EDI-023 — express calculation (POST /simulations/quick)

export interface QuickSimulationResult {
  /** Down payment + computed financing, rounded down to the CAL-021 step. */
  budget: string;
  /** Displayed financing = displayed budget − down payment. */
  financing: string;
  /** Computed financing, to the unit (CAL-042, rounded down), which prefills EP-12 (SIM-031). */
  financingComputed: string;
  durationMonths: number;
  annualRateBps: number;
  currency: string;
}

/**
 * EDI-023 — express calculation with the indicative scale (CAL-103), without down payment, minimum amount or income
 * control: financing = capital whose monthly payment over `maxDurationMonths` equals the entered one (CAL-042 at the
 * scale rate and method); budget = down payment + financing, rounded down to the CAL-021 step; displayed financing =
 * budget − down payment. Amounts in the reference currency.
 */
export function quickSimulation(
  input: { downPayment: DecimalInput; monthlyPayment: DecimalInput },
  scale: IndicativeScale,
  referenceCurrency: string,
): QuickSimulationResult {
  const d = dec(input.downPayment);
  const financingComputed = capacity(input.monthlyPayment, scale.maxDurationMonths, scale.annualRateBps, scale.pricingMethod);
  const budget = roundDisplayedBudget(d.add(financingComputed));
  const financing = Decimal.max(budget.sub(d), 0);
  return {
    budget: toCompactAmountString(budget),
    financing: toCompactAmountString(financing),
    financingComputed: toCompactAmountString(financingComputed),
    durationMonths: scale.maxDurationMonths,
    annualRateBps: scale.annualRateBps,
    currency: referenceCurrency,
  };
}
