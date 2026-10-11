// Financing formulas (CAL-040…CAL-048), credit simulator (CAL-110) and scenario comparison (CAL-111).
import { Decimal, ZERO, dec, decOrNull, roundCents, roundDownUnit, type DecimalInput } from './money.js';

export type PricingMethod = 'AMORTIZED_RATE' | 'FLAT_MARGIN';

/** A duration band of `BankProduct.rateBands`. */
export interface RateBand {
  maxDurationMonths: number;
  rateBps: number;
}

/** Notations of 07 § 4: `t` = bps ÷ 10 000. */
export function annualRate(rateBps: number | DecimalInput): Decimal {
  return dec(rateBps).div(10_000);
}

/** Notations of 07 § 4: `r` = `t` ÷ 12. */
export function monthlyRate(rateBps: number | DecimalInput): Decimal {
  return annualRate(rateBps).div(12);
}

/**
 * CAL-048 — rate of a product for a duration `n`: the first band whose `maxDurationMonths` ≥ `n`; beyond the last
 * band, the last one; without bands, `nominalRateBps`.
 */
export function rateForDuration(product: { nominalRateBps: number; rateBands?: readonly RateBand[] | null }, durationMonths: number): number {
  const bands = product.rateBands;
  if (!bands || bands.length === 0) return product.nominalRateBps;
  const band = bands.find((b) => b.maxDurationMonths >= durationMonths) ?? bands[bands.length - 1]!;
  return band.rateBps;
}

/** CAL-041 — total margin = P × t × (n / 12), unrounded. */
export function flatMarginTotal(amount: DecimalInput, durationMonths: number, rateBps: number): Decimal {
  return dec(amount).mul(annualRate(rateBps)).mul(durationMonths).div(12);
}

/**
 * CAL-040 (`AMORTIZED_RATE`: r = 0 → P / n, otherwise P × r / (1 − (1 + r)^(−n))) and
 * CAL-041 (`FLAT_MARGIN`: (P + P × t × n / 12) / n). Unrounded: callers round (CAL-022, CAL-025).
 */
export function monthlyPayment(amount: DecimalInput, durationMonths: number, rateBps: number, method: PricingMethod): Decimal {
  const p = dec(amount);
  if (method === 'FLAT_MARGIN') return p.add(flatMarginTotal(p, durationMonths, rateBps)).div(durationMonths);
  const r = monthlyRate(rateBps);
  if (r.isZero()) return p.div(durationMonths);
  return p.mul(r).div(new Decimal(1).sub(r.add(1).pow(-durationMonths)));
}

/**
 * CAL-042 — capacity: largest amount financeable for a maximum monthly payment `Mmax`, rounded down to the unit.
 * `AMORTIZED_RATE`: r = 0 → Mmax × n, otherwise Mmax × (1 − (1 + r)^(−n)) / r · `FLAT_MARGIN`: Mmax × n / (1 + t × n / 12).
 */
export function capacity(maxMonthly: DecimalInput, durationMonths: number, rateBps: number, method: PricingMethod): Decimal {
  return roundDownUnit(capacityExact(maxMonthly, durationMonths, rateBps, method));
}

/** CAL-042 before the rounding. */
export function capacityExact(maxMonthly: DecimalInput, durationMonths: number, rateBps: number, method: PricingMethod): Decimal {
  const m = dec(maxMonthly);
  if (method === 'FLAT_MARGIN') {
    return m.mul(durationMonths).div(annualRate(rateBps).mul(durationMonths).div(12).add(1));
  }
  const r = monthlyRate(rateBps);
  if (r.isZero()) return m.mul(durationMonths);
  return m.mul(new Decimal(1).sub(r.add(1).pow(-durationMonths))).div(r);
}

// ---------------------------------------------------------------------------------------------
// CAL-044 — insurance and fees

/** CAL-044 — monthly insurance = P × insuranceRateBps ÷ 10 000 ÷ 12, rounded to 2 decimals, constant. */
export function monthlyInsurance(amount: DecimalInput, insuranceRateBps: number | null | undefined): Decimal {
  if (!insuranceRateBps) return ZERO;
  return roundCents(dec(amount).mul(insuranceRateBps).div(10_000).div(12));
}

/** CAL-044 — file fees = fileFeeFixed + P × fileFeePct ÷ 100, rounded to 2 decimals. */
export function fileFees(amount: DecimalInput, fileFeeFixed?: DecimalInput | null, fileFeePct?: DecimalInput | null): Decimal {
  const fixed = decOrNull(fileFeeFixed) ?? ZERO;
  const pct = decOrNull(fileFeePct) ?? ZERO;
  return roundCents(fixed.add(dec(amount).mul(pct).div(100)));
}

// ---------------------------------------------------------------------------------------------
// CAL-043 — schedule

export interface ScheduleRow {
  number: number;
  /** Due date, YYYY-MM-DD. */
  date: string;
  /** Instalment excluding insurance. */
  payment: Decimal;
  principal: Decimal;
  /** Interest, or margin for `FLAT_MARGIN`. */
  interest: Decimal;
  insurance: Decimal;
  /** Remaining principal after this instalment. */
  remaining: Decimal;
}

export interface ScheduleYear {
  /** Year of the loan: 1 = instalments 1–12, 2 = 13–24… */
  year: number;
  payments: Decimal;
  principal: Decimal;
  interest: Decimal;
  insurance: Decimal;
  /** Remaining principal at the end of the year. */
  remaining: Decimal;
}

export interface LoanParams {
  amount: DecimalInput;
  durationMonths: number;
  annualRateBps: number;
  pricingMethod: PricingMethod;
  insuranceRateBps?: number | null;
  fileFeeFixed?: DecimalInput | null;
  fileFeePct?: DecimalInput | null;
  /** Start date YYYY-MM-DD; the first instalment falls one month later. Default: first day of the month after `now`. */
  startDate?: string;
  /** Calculation instant (Clock, ARC-070), used for the default start date. */
  now?: Date;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** Adds months to a YYYY-MM-DD date, clamping the day to the end of the target month. */
export function addMonthsToDate(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = total - ty * 12 + 1;
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return `${pad(ty, 4)}-${pad(tm)}-${pad(Math.min(d, lastDay))}`;
}

/** CAL-043 — default start date: first day of the month following the calculation (UTC). */
export function defaultStartDate(now: Date): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  return m === 12 ? `${pad(y + 1, 4)}-01-01` : `${pad(y, 4)}-${pad(m + 1)}-01`;
}

/**
 * CAL-043 — monthly schedule.
 * `AMORTIZED_RATE`: M rounded to 2 decimals first; interest = remaining × r (2 decimals); principal = M − interest;
 * last instalment: principal = remaining, instalment adjusted by the rounding gap.
 * `FLAT_MARGIN`: P ÷ n of principal + total margin ÷ n of margin (2 decimals each); the last absorbs the rounding gap.
 * Each row also carries the constant monthly insurance (CAL-044).
 */
export function schedule(params: LoanParams): ScheduleRow[] {
  const p = dec(params.amount);
  const n = params.durationMonths;
  if (params.startDate === undefined && params.now === undefined) throw new RangeError('CAL-043: startDate or now (Clock) required');
  const start = params.startDate ?? defaultStartDate(params.now!);
  const insurance = monthlyInsurance(p, params.insuranceRateBps);
  const rows: ScheduleRow[] = [];
  let remaining = p;

  if (params.pricingMethod === 'FLAT_MARGIN') {
    const totalMargin = roundCents(flatMarginTotal(p, n, params.annualRateBps));
    const principalPart = roundCents(p.div(n));
    const marginPart = roundCents(totalMargin.div(n));
    let marginSum = ZERO;
    for (let k = 1; k <= n; k++) {
      const last = k === n;
      const principal = last ? remaining : principalPart;
      const interest = last ? totalMargin.sub(marginSum) : marginPart;
      marginSum = marginSum.add(interest);
      remaining = remaining.sub(principal);
      rows.push({ number: k, date: addMonthsToDate(start, k), payment: principal.add(interest), principal, interest, insurance, remaining });
    }
    return rows;
  }

  const r = monthlyRate(params.annualRateBps);
  const m = roundCents(monthlyPayment(p, n, params.annualRateBps, 'AMORTIZED_RATE'));
  for (let k = 1; k <= n; k++) {
    const interest = roundCents(remaining.mul(r));
    const principal = k === n ? remaining : m.sub(interest);
    remaining = remaining.sub(principal);
    rows.push({ number: k, date: addMonthsToDate(start, k), payment: principal.add(interest), principal, interest, insurance, remaining });
  }
  return rows;
}

/** CAL-043 — the schedule « par année » (sums per year of the loan, remaining principal at year end). */
export function scheduleByYear(rows: readonly ScheduleRow[]): ScheduleYear[] {
  const years: ScheduleYear[] = [];
  for (const row of rows) {
    const year = Math.ceil(row.number / 12);
    let y = years[years.length - 1];
    if (!y || y.year !== year) {
      y = { year, payments: ZERO, principal: ZERO, interest: ZERO, insurance: ZERO, remaining: row.remaining };
      years.push(y);
    }
    y.payments = y.payments.add(row.payment);
    y.principal = y.principal.add(row.principal);
    y.interest = y.interest.add(row.interest);
    y.insurance = y.insurance.add(row.insurance);
    y.remaining = row.remaining;
  }
  return years;
}

export interface LoanResult {
  /** Monthly payment excluding insurance, 2 decimals (the big figure, CAL-045). */
  monthlyPayment: Decimal;
  /** CAL-044 */
  monthlyInsurance: Decimal;
  /** Monthly payment including insurance (shown below, CAL-045). */
  monthlyTotal: Decimal;
  /** CAL-043 — sum of the schedule interest (or margin), not M × n − P. */
  totalInterest: Decimal;
  /** CAL-044 — rounded monthly insurance × n. */
  totalInsurance: Decimal;
  /** CAL-044 — file fees. */
  fees: Decimal;
  /** CAL-045 — interest + insurance + fees. */
  totalCost: Decimal;
  /** CAL-045 — P + total cost. */
  totalRepaid: Decimal;
  schedule: ScheduleRow[];
  yearly: ScheduleYear[];
}

/** CAL-043, CAL-044, CAL-045 — full result of a financing: monthly payments, schedule, totals. */
export function computeLoan(params: LoanParams): LoanResult {
  const p = dec(params.amount);
  const rows = schedule(params);
  const m = roundCents(monthlyPayment(p, params.durationMonths, params.annualRateBps, params.pricingMethod));
  const ins = monthlyInsurance(p, params.insuranceRateBps);
  const totalInterest = rows.reduce((s, r) => s.add(r.interest), ZERO);
  const totalInsurance = ins.mul(params.durationMonths);
  const fees = fileFees(p, params.fileFeeFixed, params.fileFeePct);
  const totalCost = totalInterest.add(totalInsurance).add(fees);
  return {
    monthlyPayment: m,
    monthlyInsurance: ins,
    monthlyTotal: m.add(ins),
    totalInterest,
    totalInsurance,
    fees,
    totalCost,
    totalRepaid: p.add(totalCost),
    schedule: rows,
    yearly: scheduleByYear(rows),
  };
}

// ---------------------------------------------------------------------------------------------
// CAL-045 — bank offer

/**
 * CAL-045 — credit cost of a recorded bank offer: offer monthly payment × n − granted amount, plus the offer's
 * insurance and fees when entered.
 */
export function offerCreditCost(
  offerMonthly: DecimalInput,
  durationMonths: number,
  grantedAmount: DecimalInput,
  extras: { totalInsurance?: DecimalInput | null; fees?: DecimalInput | null } = {},
): Decimal {
  return dec(offerMonthly)
    .mul(durationMonths)
    .sub(dec(grantedAmount))
    .add(decOrNull(extras.totalInsurance) ?? ZERO)
    .add(decOrNull(extras.fees) ?? ZERO);
}

/** CAL-045 — the entered offer monthly payment differs from the computed one by more than 1 % → warn the adviser. */
export function offerDeviates(offerMonthly: DecimalInput, computedMonthly: DecimalInput): boolean {
  const c = dec(computedMonthly);
  if (c.isZero()) return !dec(offerMonthly).isZero();
  return dec(offerMonthly).sub(c).abs().div(c).gt('0.01');
}

// ---------------------------------------------------------------------------------------------
// CAL-046 — indicative APR

/**
 * CAL-046 — indicative annual percentage rate (hidden while `finance.showApr` is false): monthly rate `i` such that
 * P − fees = Σ_{k=1..n} (M + insurance) / (1 + i)^k, then i × 12. Returned as a fraction (0.065 = 6.50 %), 6 decimals.
 * Solved by bisection on exact decimals; `null` when no rate in ]−100 %, 1 200 %] satisfies the equation.
 */
export function indicativeApr(input: {
  amount: DecimalInput;
  monthlyPayment: DecimalInput;
  monthlyInsurance?: DecimalInput | null;
  fees?: DecimalInput | null;
  durationMonths: number;
}): Decimal | null {
  const target = dec(input.amount).sub(decOrNull(input.fees) ?? ZERO);
  const pay = dec(input.monthlyPayment).add(decOrNull(input.monthlyInsurance) ?? ZERO);
  const n = input.durationMonths;
  const pv = (i: Decimal): Decimal => (i.isZero() ? pay.mul(n) : pay.mul(new Decimal(1).sub(i.add(1).pow(-n))).div(i));
  // pv is decreasing in i.
  let lo = new Decimal('-0.99');
  let hi = new Decimal(1);
  if (pv(lo).lt(target) || pv(hi).gt(target)) return null;
  for (let k = 0; k < 200; k++) {
    const mid = lo.add(hi).div(2);
    if (pv(mid).gt(target)) lo = mid;
    else hi = mid;
    if (hi.sub(lo).lt('1e-14')) break;
  }
  return lo.add(hi).div(2).mul(12).toDecimalPlaces(6);
}

// ---------------------------------------------------------------------------------------------
// CAL-110 — credit simulator

/** Product fields used by the credit simulator (`BankProduct`, MOD § 3.5), amounts in the product currency. */
export interface CreditProduct {
  pricingMethod: PricingMethod;
  nominalRateBps: number;
  rateBands?: readonly RateBand[] | null;
  minAmount: DecimalInput;
  maxAmount: DecimalInput;
  minDurationMonths: number;
  maxDurationMonths: number;
  minDownPaymentPct: DecimalInput;
  insuranceRateBps?: number | null;
  fileFeeFixed?: DecimalInput | null;
  fileFeePct?: DecimalInput | null;
}

export type CreditWarning = 'AMOUNT_OUT_OF_PRODUCT_BOUNDS' | 'DURATION_OUT_OF_PRODUCT_BOUNDS' | 'DOWN_PAYMENT_BELOW_MIN';

export interface CreditInput {
  mode: 'FROM_PRICE' | 'FROM_AMOUNT';
  price?: DecimalInput | null;
  downPayment?: DecimalInput | null;
  amount?: DecimalInput | null;
  durationMonths: number;
  /** Chosen product (amounts already in the product currency): rate (CAL-048), method, insurance and fees come from it. */
  product?: CreditProduct | null;
  /** Without product. */
  annualRateBps?: number;
  pricingMethod?: PricingMethod;
  insuranceRateBps?: number | null;
  /** Without product: minimum down payment of the indicative scale (PAR-044, Q-053). */
  indicativeMinDownPaymentPct?: DecimalInput | null;
  startDate?: string;
  now?: Date;
}

export type CreditOutput =
  | { nothingToFinance: true }
  | (LoanResult & { nothingToFinance: false; amount: Decimal; annualRateBps: number; pricingMethod: PricingMethod; warnings: CreditWarning[] });

/**
 * CAL-110 — credit simulator, in the financing currency. `FROM_PRICE`: amount = price − down payment; a down payment
 * ≥ price is not an error, only `nothingToFinance` (SIM-022). Warnings: amount / duration outside the product bounds,
 * down payment below the minimum (product, or indicative scale without product).
 */
export function simulateCredit(input: CreditInput): CreditOutput {
  const amount = input.mode === 'FROM_AMOUNT' ? dec(input.amount ?? 0) : dec(input.price ?? 0).sub(dec(input.downPayment ?? 0));
  if (amount.lte(0)) return { nothingToFinance: true };
  const product = input.product ?? null;
  const n = input.durationMonths;
  const rateBps = product ? rateForDuration(product, n) : (input.annualRateBps ?? 0);
  const method: PricingMethod = product ? product.pricingMethod : (input.pricingMethod ?? 'AMORTIZED_RATE');
  const warnings: CreditWarning[] = [];
  if (product) {
    if (amount.lt(dec(product.minAmount)) || amount.gt(dec(product.maxAmount))) warnings.push('AMOUNT_OUT_OF_PRODUCT_BOUNDS');
    if (n < product.minDurationMonths || n > product.maxDurationMonths) warnings.push('DURATION_OUT_OF_PRODUCT_BOUNDS');
  }
  const minPct = product ? dec(product.minDownPaymentPct) : decOrNull(input.indicativeMinDownPaymentPct);
  if (input.mode === 'FROM_PRICE' && minPct && dec(input.downPayment ?? 0).lt(dec(input.price ?? 0).mul(minPct).div(100))) {
    warnings.push('DOWN_PAYMENT_BELOW_MIN');
  }
  const loan = computeLoan({
    amount,
    durationMonths: n,
    annualRateBps: rateBps,
    pricingMethod: method,
    insuranceRateBps: product ? product.insuranceRateBps : input.insuranceRateBps,
    fileFeeFixed: product?.fileFeeFixed,
    fileFeePct: product?.fileFeePct,
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.now !== undefined ? { now: input.now } : {}),
  });
  return { ...loan, nothingToFinance: false, amount, annualRateBps: rateBps, pricingMethod: method, warnings };
}

/**
 * CAL-111 — comparison of up to three scenarios: index of the lowest monthly payment and of the lowest total cost
 * (first one on a tie).
 */
export function compareScenarios(scenarios: readonly { monthlyPayment: DecimalInput; totalCost: DecimalInput }[]): {
  lowestMonthlyIndex: number;
  lowestCostIndex: number;
} {
  if (scenarios.length === 0 || scenarios.length > 3) throw new RangeError('CAL-111: one to three scenarios');
  let lowestMonthlyIndex = 0;
  let lowestCostIndex = 0;
  scenarios.forEach((s, i) => {
    if (dec(s.monthlyPayment).lt(dec(scenarios[lowestMonthlyIndex]!.monthlyPayment))) lowestMonthlyIndex = i;
    if (dec(s.totalCost).lt(dec(scenarios[lowestCostIndex]!.totalCost))) lowestCostIndex = i;
  });
  return { lowestMonthlyIndex, lowestCostIndex };
}
