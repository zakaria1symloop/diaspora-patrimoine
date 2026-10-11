// Money helpers: exact decimals (ARC-071), display roundings (CAL-020…CAL-028), currency conversion (CAL-010…CAL-012).
import { Decimal as DecimalBase } from 'decimal.js';

/**
 * Decimal constructor used by the whole package (ARC-071: never a float for money).
 * Isolated clone: 40 significant digits, half-up by default (07 § « Convention »).
 */
export const Decimal = DecimalBase.clone({ precision: 40, rounding: DecimalBase.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 40 });
export type Decimal = DecimalBase;

/** An amount as accepted by the package: API-002 decimal string (`"150000.00"`), integer, or Decimal. */
export type DecimalInput = Decimal | string | number;

export const ZERO = new Decimal(0);

/** Builds a Decimal. Numbers are accepted for literals only (integers, rates); amounts should come as strings. */
export function dec(value: DecimalInput): Decimal {
  return value instanceof Decimal ? value : new Decimal(DecimalBase.isDecimal(value) ? (value as DecimalBase).toString() : value);
}

/** Nullable variant of {@link dec}. */
export function decOrNull(value: DecimalInput | null | undefined): Decimal | null {
  return value === null || value === undefined ? null : dec(value);
}

export type RoundingMode = 'HALF_UP' | 'DOWN' | 'UP';

const MODES: Record<RoundingMode, DecimalBase.Rounding> = {
  HALF_UP: DecimalBase.ROUND_HALF_UP,
  DOWN: DecimalBase.ROUND_FLOOR,
  UP: DecimalBase.ROUND_CEIL,
};

/** Rounds to `dp` decimal places. `DOWN` = towards −∞ (« vers le bas »), `UP` = towards +∞, `HALF_UP` = convention of 07. */
export function roundDp(value: DecimalInput, dp: number, mode: RoundingMode = 'HALF_UP'): Decimal {
  return dec(value).toDecimalPlaces(dp, MODES[mode]);
}

/** Rounds to a multiple of `step` (100, 500, 1 000, 10…). */
export function roundToStep(value: DecimalInput, step: DecimalInput, mode: RoundingMode = 'HALF_UP'): Decimal {
  const s = dec(step);
  return dec(value).div(s).toDecimalPlaces(0, MODES[mode]).mul(s);
}

/** CAL-025 — two decimals (simulator detail, schedule). */
export function roundCents(value: DecimalInput): Decimal {
  return roundDp(value, 2);
}

/** CAL-020 — an amount in its original currency (lot price in dinars) is displayed rounded to the unit. */
export function roundOriginalAmount(value: DecimalInput): Decimal {
  return roundDp(value, 0);
}

/** CAL-021 — step of a converted property price: < 10 000 → 100 · < 100 000 → 500 · otherwise 1 000. */
export function priceStep(value: DecimalInput): Decimal {
  const v = dec(value).abs();
  if (v.lt(10_000)) return new Decimal(100);
  if (v.lt(100_000)) return new Decimal(500);
  return new Decimal(1000);
}

/**
 * CAL-021 / CAL-028 — converted property (or lot) price, rounded to the nearest step (half up).
 * 150 000,00 € → 150 000 € · 150 505,05 € → 151 000 €. The step is chosen on the unrounded amount.
 */
export function roundConvertedPrice(value: DecimalInput): Decimal {
  return roundToStep(value, priceStep(value), 'HALF_UP');
}

/** CAL-022 — indicative monthly payment (cards, lists, filter, home comparison): nearest ten. 406,25 → 410. */
export function roundIndicativeMonthly(value: DecimalInput): Decimal {
  return roundToStep(value, 10, 'HALF_UP');
}

/** CAL-023 — reference down payment of a card: nearest hundred. */
export function roundReferenceDownPayment(value: DecimalInput): Decimal {
  return roundToStep(value, 100, 'HALF_UP');
}

/** CAL-026 — capacity / budget of an eligibility result, computed and stored: unit, rounded down. */
export function roundDownUnit(value: DecimalInput): Decimal {
  return roundDp(value, 0, 'DOWN');
}

/** CAL-026 — capacity / budget as displayed (screen, PDF, e-mail, catalogue filter): down to the CAL-021 step. 199 356 → 199 000. */
export function roundDisplayedBudget(value: DecimalInput): Decimal {
  const unit = roundDownUnit(value);
  return roundToStep(unit, priceStep(unit), 'DOWN');
}

/**
 * CAL-024 — price per square metre of a lot: price ÷ surface in the property currency, rounded to the unit
 * (never computed from an already rounded price).
 */
export function pricePerSquareMetre(lotPrice: DecimalInput, surface: DecimalInput): Decimal {
  return roundDp(dec(lotPrice).div(dec(surface)), 0);
}

/** CAL-024 — converted price per square metre for display: nearest ten. */
export function roundDisplayedPricePerSquareMetre(convertedValue: DecimalInput): Decimal {
  return roundToStep(convertedValue, 10, 'HALF_UP');
}

/** CAL-024 — « de {min} à {max} / m² » when the available lots differ; `null` without lot. */
export function pricePerSquareMetreRange(values: DecimalInput[]): { min: Decimal; max: Decimal } | null {
  if (values.length === 0) return null;
  const ds = values.map(dec);
  return { min: Decimal.min(...ds), max: Decimal.max(...ds) };
}

// ---------------------------------------------------------------------------------------------
// CAL-027 — bounds of entered amounts

/** CAL-027 — `MONTHLY`: income, debts, monthly payment · `CAPITAL`: price, down payment, amount, budget, deposit, fee. */
export type AmountKind = 'MONTHLY' | 'CAPITAL';
export const AMOUNT_UPPER_BOUND: Record<AmountKind, Decimal> = {
  MONTHLY: new Decimal('1000000000'),
  CAPITAL: new Decimal('100000000000'),
};

export type AmountCheck = 'OK' | 'TOO_HIGH' | 'TOO_LOW' | 'TOO_MANY_DECIMALS';

/**
 * CAL-027 — technical bounds, valid for every currency. `TOO_HIGH` → « Ce montant est trop élevé. Vérifiez votre saisie. ».
 * `strictlyPositive` when the rule says « strictement plus » (income, credit price, amount).
 */
export function checkAmount(value: DecimalInput, kind: AmountKind, strictlyPositive = false): AmountCheck {
  const v = dec(value);
  if (v.decimalPlaces() > 2) return 'TOO_MANY_DECIMALS';
  if (strictlyPositive ? v.lte(0) : v.lt(0)) return 'TOO_LOW';
  if (v.gt(AMOUNT_UPPER_BOUND[kind])) return 'TOO_HIGH';
  return 'OK';
}

/**
 * CAL-027 — plausibility warnings (never blocking): a property price under 1 000 units of the reference currency
 * once converted, or a monthly income over 100 000 units → « Vérifiez ce montant : {montant} ».
 */
export function plausibilityWarning(
  value: DecimalInput,
  what: 'PROPERTY_PRICE_REF' | 'MONTHLY_INCOME',
): boolean {
  const v = dec(value);
  return what === 'PROPERTY_PRICE_REF' ? v.lt(1000) : v.gt(100_000);
}

// ---------------------------------------------------------------------------------------------
// CAL-010 … CAL-012 — currency conversion

export type ExchangeRateKind = 'OFFICIAL' | 'INDICATIVE';

/** A stored exchange rate: 1 `base` = `rate` `quote`. Dates: `asOf` YYYY-MM-DD, `createdAt` ISO instant. */
export interface ExchangeRate {
  base: string;
  quote: string;
  rate: DecimalInput;
  kind: ExchangeRateKind;
  asOf: string;
  createdAt: string;
  cancelled?: boolean;
}

export interface ConversionContext {
  rates: readonly ExchangeRate[];
  /** `finance.exchangeRateKind` (default `OFFICIAL`). No fall-back on the other kind (CAL-010). */
  kind?: ExchangeRateKind;
  /** `display.referenceCurrency` (default `EUR`), used as pivot (CAL-010, step 3). */
  referenceCurrency?: string;
  /** Today, YYYY-MM-DD: rates dated later are ignored. */
  today: string;
  /** `finance.exchangeRateMaxAgeDays` (default 7), for the « old rate » flag of CAL-012. */
  maxAgeDays?: number;
}

/** A rate used by a conversion, reported with every converted result (CAL-012, TRV-022). */
export interface UsedRate {
  /** Pair as stored, `BASE/QUOTE` (e.g. `EUR/DZD`). */
  pair: string;
  asOf: string;
  rate: Decimal;
}

export interface Conversion {
  amount: Decimal;
  rates: UsedRate[];
  /** Oldest `asOf` of the rates used; `null` when no rate was needed (X = Y). */
  rateDate: string | null;
  /** CAL-012 — a rate older than `maxAgeDays`: the conversion stands, the back office warns. */
  stale: boolean;
}

function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  return Math.round((Date.parse(`${toIsoDate}T00:00:00Z`) - Date.parse(`${fromIsoDate}T00:00:00Z`)) / 86_400_000);
}

/** CAL-010 step 2 — most recent non-cancelled rate of the kind linking X and Y in either direction. */
function directStep(amount: Decimal, from: string, to: string, ctx: ConversionContext): { amount: Decimal; used: UsedRate } | null {
  const kind = ctx.kind ?? 'OFFICIAL';
  let best: ExchangeRate | null = null;
  for (const r of ctx.rates) {
    if (r.cancelled || r.kind !== kind || r.asOf > ctx.today) continue;
    const links = (r.base === from && r.quote === to) || (r.base === to && r.quote === from);
    if (!links) continue;
    if (best === null || r.asOf > best.asOf || (r.asOf === best.asOf && Date.parse(r.createdAt) > Date.parse(best.createdAt))) {
      best = r;
    }
  }
  if (best === null) return null;
  const rate = dec(best.rate);
  const converted = best.base === from ? amount.mul(rate) : amount.div(rate);
  return { amount: converted, used: { pair: `${best.base}/${best.quote}`, asOf: best.asOf, rate } };
}

/**
 * CAL-010 — converts `amount` from `from` to `to`: unchanged if same currency; otherwise the most recent rate of the
 * chosen kind in either direction (X → Y: × rate; Y → X: ÷ rate); otherwise through the reference currency;
 * otherwise `null` (conversion impossible, CAL-011). The result is unrounded: each caller applies its own rounding.
 * CAL-012 — the rate dates come with the result, with the « old rate » flag.
 */
export function convert(amount: DecimalInput, from: string, to: string, ctx: ConversionContext): Conversion | null {
  const a = dec(amount);
  if (from === to) return { amount: a, rates: [], rateDate: null, stale: false };
  const finish = (value: Decimal, used: UsedRate[]): Conversion => {
    const rateDate = used.map((u) => u.asOf).sort()[0] ?? null;
    const maxAge = ctx.maxAgeDays ?? 7;
    return { amount: value, rates: used, rateDate, stale: rateDate !== null && daysBetween(rateDate, ctx.today) > maxAge };
  };
  const direct = directStep(a, from, to, ctx);
  if (direct) return finish(direct.amount, [direct.used]);
  const ref = ctx.referenceCurrency ?? 'EUR';
  if (from === ref || to === ref) return null;
  const first = directStep(a, from, ref, ctx);
  if (!first) return null;
  const second = directStep(first.amount, ref, to, ctx);
  if (!second) return null;
  return finish(second.amount, [first.used, second.used]);
}

/** Formats an amount as an API-002 decimal string with `dp` decimals (`"150000.00"`). */
export function toAmountString(value: DecimalInput, dp = 2): string {
  return dec(value).toFixed(dp);
}

/** Integer amounts without decimals (`"169356"`), others with two (`"1040.50"`) — the shape of the CAL-104 example. */
export function toCompactAmountString(value: DecimalInput): string {
  const d = dec(value);
  return d.isInteger() ? d.toFixed(0) : d.toFixed(2);
}
