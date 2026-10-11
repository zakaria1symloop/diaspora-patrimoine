// Projection prepared by an adviser (CAL-120) and prequalification score (CAL-070).
import { maxBudget } from './eligibility.js';
import { capacity, monthlyPayment, rateForDuration, type PricingMethod, type RateBand } from './loan.js';
import { Decimal, ZERO, dec, decOrNull, roundCents, type DecimalInput } from './money.js';

/** Financing chosen by the adviser: a bank product or the indicative scale (PAR-044), same fields. */
export interface ProjectionFinancing {
  nominalRateBps: number;
  rateBands?: readonly RateBand[] | null;
  pricingMethod: PricingMethod;
  minDownPaymentPct: DecimalInput;
}

export interface ProjectionInput {
  /** In the request currency (the reference currency, DEM-013). */
  downPayment: DecimalInput;
  comfortableMonthly: DecimalInput;
  durationMonths: number;
  financing: ProjectionFinancing;
  /** `finance.acquisitionFeesPct.{country}` (CAL-106), default 0. */
  acquisitionFeesPct?: DecimalInput | null;
}

export interface ProjectionResult {
  /** CAL-120 step 1 — capacity (CAL-042) at this duration and its rate (CAL-048). */
  financeable: Decimal;
  /** CAL-120 step 2 — formula of `B` (CAL-101). */
  budget: Decimal;
  durationMonths: number;
  rateBps: number;
}

/** CAL-120 steps 1–2 — financeable amount and budget of a projection. */
export function projectionBudget(input: ProjectionInput): ProjectionResult {
  const rateBps = rateForDuration(input.financing, input.durationMonths);
  const financeable = capacity(input.comfortableMonthly, input.durationMonths, rateBps, input.financing.pricingMethod);
  const f = (decOrNull(input.acquisitionFeesPct) ?? ZERO).div(100);
  const { budget } = maxBudget(financeable, input.downPayment, dec(input.financing.minDownPaymentPct).div(100), f);
  return { financeable, budget, durationMonths: input.durationMonths, rateBps };
}

/**
 * CAL-120 step 3 — matching properties: published, available, of the region (or the whole country without region),
 * `priceFromRef` ≤ budget. The caller sorts them by relevance (CAL-080, {@link compareRelevance}).
 */
export function projectionMatches<T extends { priceFromRef: DecimalInput | null; isPublished: boolean; isAvailable: boolean; regionId: string | null }>(
  properties: readonly T[],
  budget: DecimalInput,
  regionId: string | null,
): T[] {
  const b = dec(budget);
  return properties.filter(
    (p) => p.isPublished && p.isAvailable && p.priceFromRef !== null && dec(p.priceFromRef).lte(b) && (regionId === null || p.regionId === regionId),
  );
}

/**
 * CAL-120 step 4 — for a retained property: amount to finance = price + acquisition fees − down payment, never negative
 * (fees are paid from the down payment, CAL-106), and its own monthly payment (2 decimals).
 */
export function projectionForProperty(
  price: DecimalInput,
  input: ProjectionInput,
): { price: Decimal; downPayment: Decimal; loan: Decimal; monthlyPayment: Decimal } {
  const p = dec(price);
  const f = (decOrNull(input.acquisitionFeesPct) ?? ZERO).div(100);
  const d = dec(input.downPayment);
  const loan = Decimal.max(roundCents(p.mul(f.add(1)).sub(d)), 0);
  const rateBps = rateForDuration(input.financing, input.durationMonths);
  const m = loan.isZero() ? ZERO : roundCents(monthlyPayment(loan, input.durationMonths, rateBps, input.financing.pricingMethod));
  return { price: p, downPayment: d, loan, monthlyPayment: m };
}

// ---------------------------------------------------------------------------------------------
// CAL-070 — prequalification score

export type PurchaseTimeframe = 'LT_6M' | 'M6_12' | 'GT_12M' | 'UNDEFINED';
export type PrequalificationLabel = 'HOT' | 'WARM' | 'COLD';

export interface PrequalificationInput {
  /** `Client.phone` set and `Client.phoneCheckNeeded` false. */
  phoneValid: boolean;
  /** `User.emailVerifiedAt` set (false without account). */
  emailVerified: boolean;
  reachableOnWhatsapp: boolean;
  timeframe: PurchaseTimeframe | null;
  /** Status of the most recent eligibility simulation, `null` without simulation. */
  latestEligibilityStatus: 'ELIGIBLE' | 'CONDITIONAL' | 'NOT_ELIGIBLE' | null;
  /** `financingPreference = CASH`. */
  cashPurchase: boolean;
  budgetMax: DecimalInput | null;
  /** `Client.downPayment` converted into the budget currency (CAL-010); `null` when unknown or no rate. */
  downPaymentInBudgetCurrency: DecimalInput | null;
  incomeKnown: boolean;
  accountCreated: boolean;
  hasPropertyInterest: boolean;
  cafe: 'NONE' | 'REGISTERED' | 'ATTENDED';
}

/**
 * CAL-070 — prequalification score (0–100): reachable 20 · project 20 · financing 40 (latest simulation, otherwise the
 * highest applicable line, no sum) · engagement 20 (capped). Labels: HOT ≥ 70, WARM 40–69, COLD < 40.
 */
export function prequalificationScore(input: PrequalificationInput): {
  score: number;
  label: PrequalificationLabel;
  blocks: { reachable: number; project: number; financing: number; engagement: number };
} {
  const reachable = (input.phoneValid ? 10 : 0) + (input.emailVerified ? 5 : 0) + (input.reachableOnWhatsapp ? 5 : 0);
  const project = { LT_6M: 20, M6_12: 14, GT_12M: 6, UNDEFINED: 0 }[input.timeframe ?? 'UNDEFINED'];
  let financing = 0;
  if (input.latestEligibilityStatus !== null) {
    financing = { ELIGIBLE: 40, CONDITIONAL: 25, NOT_ELIGIBLE: 5 }[input.latestEligibilityStatus];
  } else {
    const budget = decOrNull(input.budgetMax);
    const down = decOrNull(input.downPaymentInBudgetCurrency);
    if (input.cashPurchase && budget !== null) financing = 40;
    else if (budget !== null && budget.gt(0) && down !== null && down.gte(budget.mul('0.15'))) financing = 20;
    else if (input.incomeKnown) financing = 10;
  }
  const engagement = Math.min(
    20,
    (input.accountCreated ? 5 : 0) + (input.hasPropertyInterest ? 5 : 0) + (input.cafe === 'ATTENDED' ? 10 : input.cafe === 'REGISTERED' ? 5 : 0),
  );
  const score = reachable + project + financing + engagement;
  const label: PrequalificationLabel = score >= 70 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD';
  return { score, label, blocks: { reachable, project, financing, engagement } };
}
