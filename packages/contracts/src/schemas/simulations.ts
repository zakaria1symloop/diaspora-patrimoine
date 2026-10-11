// 02-site-public/06 — simulators EP-11 (eligibility) and EP-12 (credit). The input schemas are shared by the browser
// (live validation of each step) and the API (ARC-030, TRV-060); every result comes from the server (SIM-001).
// Inputs follow CAL-100 (eligibility) and CAL-110 (credit); error messages are TRV-064 codes.
import { z } from 'zod';
import {
  CreditMode,
  PricingMethod,
  ResidencyStatus,
  type CreditWarning,
  type EligibilityReason,
  type EligibilityStatus,
  type FinancingType,
  type LimitingFactor,
  type TargetCase,
} from '../enums.js';
import type { Money } from '../http.js';
import type { PublicImage } from '../catalogue.js';
import { amountSchema, countryCodeSchema, emailSchema } from './leads.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** PAR-025 — currencies offered for income and down payment (only those CAL-010 can convert are shown). */
export const SIMULATOR_CURRENCIES = ['EUR', 'USD', 'CAD', 'GBP', 'CHF', 'AED', 'SAR', 'QAR', 'DZD'] as const;
/** CAL-100 — age of the main borrower. */
export const SIM_AGE = { min: 18, max: 85 } as const;
/** CAL-100 / CAL-110 — durations in months. */
export const SIM_DURATION = { min: 12, max: 480 } as const;
/** SIM-020 / CAL-110 — rate without product: slider 0–15 % by 0.05, field up to 30 % (bps). */
export const SIM_RATE = { sliderMaxBps: 1500, maxBps: 3000, stepBps: 5 } as const;
/** CAL-110 — insurance rate without product (bps). */
export const SIM_INSURANCE_MAX_BPS = 500;
/** CAL-111 — three scenarios at most. */
export const SIM_SCENARIOS_MAX = 3;
/** CAL-112 — the calculation reruns 300 ms after the last keystroke. */
export const SIM_DEBOUNCE_MS = 300;
/** NAV-051 — `dp_anon` lives 30 days and is set only when a simulation is launched. */
export const ANON_COOKIE_DAYS = 30;

// ─── Primitives ─────────────────────────────────────────────────────────────

const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());
const currencySchema = z.string({ error: 'REQUIRED' }).regex(/^[A-Z]{3}$/, { error: 'INVALID_CHOICE' });
const int = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v),
    z.number({ error: 'REQUIRED' }).int({ error: 'INVALID_CHOICE' }).min(min, { error: 'OUT_OF_RANGE' }).max(max, { error: 'OUT_OF_RANGE' }),
  );
const uuidSchema = z.uuid({ error: 'INVALID_CHOICE' });

// ─── EP-11 eligibility (CAL-100) ────────────────────────────────────────────

/** CAL-100 — the age (current year − birth year) must be between 18 and 85: the schema needs the year (Clock, ARC-070). */
export function eligibilityInputSchemaFor(currentYear: number) {
  return z
    .object({
      propertyCountry: countryCodeSchema,
      residencyStatus: z.enum(ResidencyStatus, { error: 'INVALID_CHOICE' }),
      countryOfResidence: countryCodeSchema,
      birthYear: int(currentYear - SIM_AGE.max, currentYear - SIM_AGE.min),
      monthlyIncome: amountSchema('MONTHLY', true),
      incomeCurrency: currencySchema,
      coBorrowerIncome: optional(amountSchema('MONTHLY')),
      otherIncome: optional(amountSchema('MONTHLY')),
      monthlyDebts: amountSchema('MONTHLY'),
      downPayment: amountSchema('CAPITAL'),
      /** Default: the income currency (CAL-100); the screen enters both in the same currency (SIM-003). */
      downPaymentCurrency: optional(currencySchema),
      /** Absent: « La plus longue possible » (SIM-010). */
      desiredDurationMonths: optional(int(SIM_DURATION.min, SIM_DURATION.max)),
      financingPreference: z.enum(['CONVENTIONAL', 'ISLAMIC', 'NO_PREFERENCE'], { error: 'INVALID_CHOICE' }).default('NO_PREFERENCE'),
      targetPrice: optional(amountSchema('CAPITAL', true)),
      targetCurrency: optional(currencySchema),
      /**
       * CAL-100 « prix lié à un bien » — the price prefilled from a property page is untouched: the server computes from
       * the original price of the property (or lot) in its currency, not from the rounded displayed price.
       */
      targetPriceLinked: z.boolean().default(false),
      propertyId: optional(uuidSchema),
      lotId: optional(uuidSchema),
    })
    .superRefine((v, ctx) => {
      if (v.targetPrice !== undefined && !v.targetCurrency) ctx.addIssue({ code: 'custom', path: ['targetCurrency'], message: 'REQUIRED' });
    })
    .transform((v) => ({ ...v, downPaymentCurrency: v.downPaymentCurrency ?? v.incomeCurrency }));
}
export type EligibilityInput = z.infer<ReturnType<typeof eligibilityInputSchemaFor>>;
export type EligibilityInputWire = z.input<ReturnType<typeof eligibilityInputSchemaFor>>;

// ─── EP-12 credit (CAL-110) ─────────────────────────────────────────────────

export const creditInputSchema = z
  .object({
    mode: z.enum(CreditMode, { error: 'INVALID_CHOICE' }),
    price: optional(amountSchema('CAPITAL', true)),
    downPayment: optional(amountSchema('CAPITAL')),
    amount: optional(amountSchema('CAPITAL', true)),
    currency: currencySchema,
    durationMonths: int(SIM_DURATION.min, SIM_DURATION.max),
    /** A chosen product: rate (CAL-048), method, insurance and fees come from it and are not editable. */
    bankProductId: optional(uuidSchema),
    annualRateBps: optional(int(0, SIM_RATE.maxBps)),
    pricingMethod: z.enum(PricingMethod, { error: 'INVALID_CHOICE' }).default('AMORTIZED_RATE'),
    insuranceRateBps: optional(int(0, SIM_INSURANCE_MAX_BPS)),
    /** CAL-110 — same « prix lié à un bien » rule as CAL-100. */
    priceLinked: z.boolean().default(false),
    propertyId: optional(uuidSchema),
    lotId: optional(uuidSchema),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'FROM_PRICE' && v.price === undefined) ctx.addIssue({ code: 'custom', path: ['price'], message: 'REQUIRED' });
    if (v.mode === 'FROM_AMOUNT' && v.amount === undefined) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'REQUIRED' });
    if (!v.bankProductId && v.annualRateBps === undefined) ctx.addIssue({ code: 'custom', path: ['annualRateBps'], message: 'REQUIRED' });
  });
export type CreditInput = z.infer<typeof creditInputSchema>;
export type CreditInputWire = z.input<typeof creditInputSchema>;

/** `POST /public/simulations/credit` — one to three scenarios (CAL-111); the schedule is detailed for `activeIndex`. */
export const creditRequestSchema = z
  .object({
    scenarios: z.array(creditInputSchema).min(1, { error: 'REQUIRED' }).max(SIM_SCENARIOS_MAX, { error: 'OUT_OF_RANGE' }),
    activeIndex: z.number().int().min(0).max(SIM_SCENARIOS_MAX - 1).default(0),
  })
  .refine((v) => v.activeIndex < v.scenarios.length, { path: ['activeIndex'], error: 'OUT_OF_RANGE' });
export type CreditRequest = z.infer<typeof creditRequestSchema>;

/** `POST /public/simulations` — writes a credit simulation, scenarios included (SIM-032 « Routes »). */
export const creditSaveSchema = z.object({
  scenarios: z.array(creditInputSchema).min(1, { error: 'REQUIRED' }).max(SIM_SCENARIOS_MAX, { error: 'OUT_OF_RANGE' }),
  activeIndex: z.number().int().min(0).max(SIM_SCENARIOS_MAX - 1).default(0),
  /** true: « Enregistrer » · false: « Recevoir par e-mail », « Être rappelé ». */
  isSaved: z.boolean(),
});
export type CreditSaveRequest = z.infer<typeof creditSaveSchema>;

/** `POST /public/simulations/{id}/email` — « la vôtre, ou celle d'un proche » (SIM-032). */
export const simulationEmailSchema = z.object({ email: emailSchema });
export type SimulationEmailRequest = z.infer<typeof simulationEmailSchema>;

/** `POST /public/simulations/pdf` — inputs in the body, nothing stored (SIM-032). */
export function simulationPdfSchemaFor(currentYear: number) {
  return z.discriminatedUnion(
    'type',
    [
      z.object({ type: z.literal('ELIGIBILITY'), inputs: eligibilityInputSchemaFor(currentYear) }),
      z.object({
        type: z.literal('CREDIT'),
        scenarios: z.array(creditInputSchema).min(1).max(SIM_SCENARIOS_MAX),
        activeIndex: z.number().int().min(0).max(SIM_SCENARIOS_MAX - 1).default(0),
      }),
    ],
    { error: 'INVALID_CHOICE' },
  );
}

// ─── Responses ──────────────────────────────────────────────────────────────

export type DurationNote = 'MIN_DURATION' | 'AGE_LIMIT' | 'MAX_DURATION' | 'WHOLE_YEAR';

/** CAL-104 served in the API-002 form: amounts as `{amount, currency}` (simulation currency, `refCurrency` for « Ref »). */
export interface EligibilityResult {
  status: EligibilityStatus;
  indicative: boolean;
  displayCurrency: string;
  refCurrency: string;
  bestProductId: string | null;
  maxMonthlyPayment: Money | null;
  capacity: Money | null;
  maxBudget: Money | null;
  maxLoan: Money | null;
  maxBudgetRef: Money | null;
  reachableBudget: Money | null;
  reachableBudgetRef: Money | null;
  advisedDownPayment: Money | null;
  minDownPaymentPct: string | null;
  durationMonths: number | null;
  durationNote: DurationNote | null;
  rateBps: number | null;
  pricingMethod: PricingMethod | null;
  /** SIM-012 « Mensualité pour ce budget ». */
  budgetMonthlyPayment: Money | null;
  limitingFactor: LimitingFactor | null;
  acquisitionFeesPct: string;
  /** CAL-106 — false: `legal.feesExcludedNote`; true: « Frais d'acquisition estimés à {pct} % du prix, inclus dans le calcul. ». */
  feesIncluded: boolean;
  /** CAL-026 — figures as displayed (screen, PDF, e-mail): nothing is recomputed by the screen. */
  shown: { capacity: Money | null; maxBudget: Money | null; maxLoan: Money | null; fees: Money | null; reachableBudget: Money | null };
  /** CAT-035, SIM-012 — budgets in the reference currency rounded like the screen: the catalogue filter (`priceMax`). */
  shownRef: { maxBudget: Money | null; reachableBudget: Money | null };
  target: {
    price: Money;
    productId: string | null;
    case: TargetCase;
    financeable: boolean;
    fees: Money;
    loan: Money;
    monthlyPayment: Money | null;
    missingDownPayment: Money;
    requiredMonthlyPayment: Money | null;
  } | null;
  solutions: Partial<Record<FinancingType, number>>;
  /** CAL-102 — distinct reasons in plain words (RATE_MISSING is never shown, SIM-014). */
  reasons: Exclude<EligibilityReason, 'RATE_MISSING'>[];
  /** CAL-103 — « Nous n'avons pas encore de solution de {type} référencée… ». */
  missingTypeNote: FinancingType | null;
  /** SIM-003 — « ≈ » only before amounts that come out of a conversion. */
  approx: { figures: boolean; target: boolean };
  /** SIM-003, TRV-022 — « Taux indicatif du {date} » once, when a converted amount is shown. */
  rateDate: string | null;
}

/** `POST /public/simulations/eligibility` → 201: computed AND written anonymously (SIM-015). */
export interface EligibilityResponse {
  id: string;
  result: EligibilityResult;
}

export interface CreditScheduleMonth {
  number: number;
  date: string;
  payment: string;
  principal: string;
  interest: string;
  insurance: string;
  remaining: string;
}

export interface CreditScheduleYear {
  year: number;
  payments: string;
  principal: string;
  interest: string;
  insurance: string;
  remaining: string;
  /** Only for the detailed scenario (`activeIndex`). */
  months: CreditScheduleMonth[];
}

export interface CreditWarningItem {
  code: CreditWarning;
  /** `{min, max}` (amounts as decimal strings in the simulation currency, or months), `{pct, amount}` for the down payment. */
  params: Record<string, string | number>;
}

/** CAL-110 outputs of one scenario. Schedule amounts are decimal strings in `currency` (two decimals, CAL-025). */
export interface CreditResult {
  /** SIM-022 — the down payment covers the price: this sentence replaces the figures (no zeros). */
  nothingToFinance: boolean;
  currency: string;
  /** CAL-110 « Financement en {devise du produit} ; équivalents à titre indicatif. » — null when the same currency. */
  productCurrency: string | null;
  amount: Money | null;
  durationMonths: number;
  annualRateBps: number | null;
  pricingMethod: PricingMethod | null;
  financingType: FinancingType | null;
  monthlyPayment: Money | null;
  monthlyInsurance: Money | null;
  monthlyTotal: Money | null;
  totalInterest: Money | null;
  totalInsurance: Money | null;
  fees: Money | null;
  otherFeesNote: string | null;
  totalCost: Money | null;
  totalRepaid: Money | null;
  warnings: CreditWarningItem[];
  /** Product bounds of the duration (slider), else 12–480 months (SIM-020). */
  durationBounds: { min: number; max: number };
  schedule: CreditScheduleYear[];
  rateDate: string | null;
}

export interface CreditResponse {
  scenarios: CreditResult[];
  /** CAL-111 — indexes of the lowest monthly payment and of the lowest total cost; null with fewer than two figures. */
  comparison: { lowestMonthlyIndex: number; lowestCostIndex: number } | null;
}

/** `POST /public/simulations` → 201. */
export interface SimulationCreatedResponse {
  id: string;
}

/** SIM-006 — a product of the selector: « {banque} – {nom du produit} » when the bank is public, else a numbered solution. */
export interface SimulatorProduct {
  id: string;
  bankName: string | null;
  productName: string | null;
  /** « Solution de crédit classique n° {ordinal} » when the bank is not public. */
  ordinal: number;
  financingType: FinancingType;
  currency: string;
  propertyCountryCode: string;
  minDurationMonths: number;
  maxDurationMonths: number;
}

/** `GET /public/simulations/options` — what the two screens need before any calculation. */
export interface SimulatorOptions {
  referenceCurrency: string;
  /** PAR-025 currencies that CAL-010 can convert. */
  currencies: string[];
  /** SIM-003 — residence country → its currency, for the countries whose currency is offered. */
  currencyByCountry: Record<string, string>;
  propertyCountries: { code: string; name: string; currency: string | null }[];
  islamicFinance: boolean;
  /** PAR-044 — starting values of EP-12 (rate, longest duration), bounds of EP-11. */
  indicative: { annualRateBps: number; minDurationMonths: number; maxDurationMonths: number; pricingMethod: PricingMethod; minDownPaymentPct: string };
  /** PAR-041 — reference financing (SIM-030 prefill from a property page). */
  reference: { downPaymentPct: number; durationMonths: number; annualRateBps: number; pricingMethod: PricingMethod };
  /** CAL-106 per property country; "0.00" = not counted. */
  acquisitionFeesPct: Record<string, string>;
  products: SimulatorProduct[];
}

/** `GET /public/simulations/property/{reference}` — SIM-030 reminder and prefill; 404 when the property is gone. */
export interface SimulatorProperty {
  id: string;
  reference: string;
  slug: string;
  title: string;
  cityRegion: string;
  countryCode: string;
  /** Displayed price (CAL-021) in the reference currency, the one the visitor read on the page. */
  priceRef: Money | null;
  /** Original price (`priceFrom`) in the property currency: used while the price stays linked (CAL-100). */
  price: Money | null;
  cover: PublicImage | null;
  /** PAR-041 of the property country (CAL-030): down payment (rounded, CAL-023), duration, rate, method. */
  financing: { downPayment: Money | null; downPaymentPct: number; durationMonths: number; annualRateBps: number; pricingMethod: PricingMethod };
  monthlyFromRef: Money | null;
}

/** CAT-035 / API-100 `estimatedBudget` of `GET /public/search-options`. */
export type EstimatedBudget = { amount: string; currency: string; simulationId: string; matchingCount: number } | null;
