// Card values of a property: price, reference down payment and indicative monthly payment (CAL-028, CAL-030…CAL-032).
import type { ReferenceFinancing } from '@dp/contracts';
import { monthlyPayment } from './loan.js';
import {
  convert,
  dec,
  roundConvertedPrice,
  roundIndicativeMonthly,
  roundReferenceDownPayment,
  type ConversionContext,
  type Decimal,
  type DecimalInput,
  type UsedRate,
} from './money.js';

/** CAL-030 step 1 — `finance.reference.{country}`, otherwise `finance.reference.default`. */
export function pickReferenceFinancing(
  byCountry: Readonly<Record<string, ReferenceFinancing | undefined>>,
  fallback: ReferenceFinancing,
  countryCode: string,
): ReferenceFinancing {
  return byCountry[countryCode] ?? fallback;
}

export interface ReferenceCardValues {
  /** CAL-030 step 2 — converted price rounded by steps (CAL-021); `null` when no lot or no rate (CAL-031). */
  priceFromRef: Decimal | null;
  /** CAL-030 step 3 / CAL-023 — nearest hundred. */
  downPaymentRef: Decimal | null;
  /** CAL-030 step 5 — the unrounded monthly payment (2 decimals in a simulator, CAL-025). */
  monthlyExact: Decimal | null;
  /** CAL-030 step 6 / CAL-022 — nearest ten. */
  monthlyFromRef: Decimal | null;
  /** Rates used (CAL-012). */
  rates: UsedRate[];
}

/**
 * CAL-030 — card values of a published property, in the reference currency:
 * price → `priceFromRef` (CAL-010 + CAL-021) → `downPaymentRef` = price × pct ÷ 100 (CAL-023) → financed = price − down
 * payment → monthly payment by the method (CAL-040/CAL-041) → `monthlyFromRef` (CAL-022).
 * CAL-031 — no `priceFrom` or impossible conversion: all three values are `null`.
 * CAL-106 — acquisition fees are never included here.
 */
export function referenceCardValues(
  property: { priceFrom: DecimalInput | null; currency: string },
  financing: ReferenceFinancing,
  ctx: ConversionContext & { referenceCurrency: string },
): ReferenceCardValues {
  const none: ReferenceCardValues = { priceFromRef: null, downPaymentRef: null, monthlyExact: null, monthlyFromRef: null, rates: [] };
  if (property.priceFrom === null) return none;
  const conv = convert(property.priceFrom, property.currency, ctx.referenceCurrency, ctx);
  if (conv === null) return none;
  const priceFromRef = roundConvertedPrice(conv.amount);
  const downPaymentRef = roundReferenceDownPayment(priceFromRef.mul(dec(financing.downPaymentPct)).div(100));
  const financed = priceFromRef.sub(downPaymentRef);
  const exact = monthlyPayment(financed, financing.durationMonths, financing.annualRateBps, financing.pricingMethod);
  return { priceFromRef, downPaymentRef, monthlyExact: exact, monthlyFromRef: roundIndicativeMonthly(exact), rates: conv.rates };
}

/** The card cache fields of a property, as used by the filters and the program price. */
export interface PropertyCardCache {
  priceFromRef: DecimalInput | null;
  monthlyFromRef: DecimalInput | null;
}

export type BudgetFilter = { kind: 'MONTHLY'; max: DecimalInput } | { kind: 'TOTAL'; max: DecimalInput };

/**
 * CAL-032 — « Budget mensuel : jusqu'à M » keeps `monthlyFromRef` ≤ M; « Budget total : jusqu'à B » keeps
 * `priceFromRef` ≤ B (the two filters exclude each other). CAL-031 — a property without the value never matches.
 */
export function matchesBudgetFilter(property: PropertyCardCache, filter: BudgetFilter): boolean {
  const value = filter.kind === 'MONTHLY' ? property.monthlyFromRef : property.priceFromRef;
  return value !== null && dec(value).lte(dec(filter.max));
}

/**
 * CAL-028 — « à partir de {prix} » of a program: the smallest `priceFromRef` of its published and available
 * properties, with the monthly payment of the property giving that price; `null` without such a property.
 */
export function programPriceFrom<T extends PropertyCardCache & { isPublished: boolean; isAvailable: boolean }>(
  properties: readonly T[],
): { priceFromRef: Decimal; monthlyFromRef: Decimal | null; property: T } | null {
  let best: T | null = null;
  for (const p of properties) {
    if (!p.isPublished || !p.isAvailable || p.priceFromRef === null) continue;
    if (best === null || dec(p.priceFromRef).lt(dec(best.priceFromRef!))) best = p;
  }
  if (best === null) return null;
  return {
    priceFromRef: dec(best.priceFromRef!),
    monthlyFromRef: best.monthlyFromRef === null ? null : dec(best.monthlyFromRef),
    property: best,
  };
}
