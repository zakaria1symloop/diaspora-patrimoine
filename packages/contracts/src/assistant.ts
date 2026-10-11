// 02-site-public/09 — guided search assistant (EP-22, mode GUIDED, ASS-001…ASS-031). The answers of the five questions
// are one structure, shared by the browser (session storage, ASS-004), the read routes (`GET /public/assistant/*`) and
// the request it may end with (`GUIDED_SEARCH`, ASS-030). Pure: no I/O.
import { z } from 'zod';
import type { CatalogueCriteria, PropertyCard, PropertyTypeSlug } from './catalogue.js';
import { PurchasePurpose } from './enums.js';

/** ASS-010 — the questions, in their order (`rooms` is « 2 bis », asked only for apartments, villas, duplexes). */
export const GUIDED_STEPS = ['region', 'type', 'rooms', 'budget', 'delivery', 'purpose'] as const;
export type GuidedStep = (typeof GUIDED_STEPS)[number];

/** ASS-010 question 2 — the order of the choices. */
export const GUIDED_TYPES = ['apartment', 'villa', 'duplex', 'studio', 'land', 'commercial'] as const satisfies readonly PropertyTypeSlug[];
/** ASS-010 question 2 bis — asked only when one of these types is chosen. */
export const GUIDED_ROOMS_TYPES = ['apartment', 'villa', 'duplex'] as const satisfies readonly PropertyTypeSlug[];
/** ASS-010 question 2 bis — T2 · T3 · T4 · T5 et plus. */
export const GUIDED_ROOMS = ['2', '3', '4', '5plus'] as const;
export type GuidedRooms = (typeof GUIDED_ROOMS)[number];
/** ASS-010 question 4 — « Disponible tout de suite » · « D'ici un à deux ans » · « Peu importe ». */
export const GUIDED_DELIVERY = ['NOW', 'SOON', 'ANY'] as const;
export type GuidedDelivery = (typeof GUIDED_DELIVERY)[number];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uniq = <T>(values: T[]) => [...new Set(values)];

/**
 * The raw answers (ASS-030 « les réponses brutes à chaque question »). Each question has its neutral way out
 * (ASS-003): `ANY`, `UNKNOWN`, `NO_ANSWER`. An absent key = not answered yet.
 */
export const guidedAnswersSchema = z
  .object({
    region: z.union([z.literal('ANY'), z.array(z.string().max(80).regex(SLUG)).min(1).max(30).transform(uniq)]).optional(),
    type: z.union([z.literal('ANY'), z.array(z.enum(GUIDED_TYPES)).min(1).max(6).transform(uniq)]).optional(),
    rooms: z.union([z.literal('ANY'), z.array(z.enum(GUIDED_ROOMS)).min(1).max(4).transform(uniq)]).optional(),
    budget: z
      .union([
        z.literal('UNKNOWN'),
        z.object({ kind: z.enum(['MONTHLY', 'TOTAL']), max: z.number().int().positive().max(100_000_000) }),
      ])
      .optional(),
    delivery: z.enum(GUIDED_DELIVERY).optional(),
    purpose: z.union([z.literal('NO_ANSWER'), z.enum(PurchasePurpose)]).optional(),
  })
  .strip();
export type GuidedAnswers = z.infer<typeof guidedAnswersSchema>;

/** ASS-010 2 bis — the rooms question is asked only when an apartment, a villa or a duplex is chosen. */
export function asksRooms(answers: GuidedAnswers): boolean {
  return Array.isArray(answers.type) && answers.type.some((t) => (GUIDED_ROOMS_TYPES as readonly string[]).includes(t));
}

/** The questions actually asked for these answers, in order. */
export function guidedSteps(answers: GuidedAnswers): GuidedStep[] {
  return GUIDED_STEPS.filter((s) => s !== 'rooms' || asksRooms(answers));
}

/** « Question {n} sur 5 » — 2 bis shares the number of question 2. */
export function guidedQuestionNumber(step: GuidedStep): number {
  return { region: 1, type: 2, rooms: 2, budget: 3, delivery: 4, purpose: 5 }[step];
}

/** Keeps only the answers BEFORE `step` (the options of a question depend on the earlier answers only). */
export function answersBefore(answers: GuidedAnswers, step: GuidedStep): GuidedAnswers {
  const out: GuidedAnswers = {};
  for (const s of GUIDED_STEPS) {
    if (s === step) break;
    if (answers[s] !== undefined) (out as Record<string, unknown>)[s] = answers[s];
  }
  if (!asksRooms(out)) delete out.rooms;
  return out;
}

// ─── URL codec of the read routes (API-011: an unknown or malformed value is ignored) ──────────────────────────────

type Params = URLSearchParams | Record<string, string | string[] | undefined>;
function read(params: Params, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}
const list = (raw: string | undefined) => (raw ? raw.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean) : []);

/** `region=alger,oran|any` · `type=apartment|any` · `rooms=3,4|any` · `budget=monthly:800|total:150000|unknown` · `delivery=now|soon|any` · `purpose=FAMILY|none`. */
export function guidedAnswersToSearch(a: GuidedAnswers): string {
  const out = new URLSearchParams();
  if (a.region) out.set('region', a.region === 'ANY' ? 'any' : a.region.join(','));
  if (a.type) out.set('type', a.type === 'ANY' ? 'any' : a.type.join(','));
  if (a.rooms) out.set('rooms', a.rooms === 'ANY' ? 'any' : a.rooms.join(','));
  if (a.budget) out.set('budget', a.budget === 'UNKNOWN' ? 'unknown' : `${a.budget.kind.toLowerCase()}:${a.budget.max}`);
  if (a.delivery) out.set('delivery', a.delivery.toLowerCase());
  if (a.purpose) out.set('purpose', a.purpose === 'NO_ANSWER' ? 'none' : a.purpose);
  const s = out.toString().replace(/%2C/g, ',').replace(/%3A/g, ':');
  return s ? `?${s}` : '';
}

export function parseGuidedAnswers(params: Params): GuidedAnswers {
  const raw: Record<string, unknown> = {};
  const region = read(params, 'region');
  if (region) raw.region = region === 'any' ? 'ANY' : list(region).filter((v) => SLUG.test(v));
  const type = read(params, 'type');
  if (type) raw.type = type === 'any' ? 'ANY' : list(type).filter((v) => (GUIDED_TYPES as readonly string[]).includes(v));
  const rooms = read(params, 'rooms');
  if (rooms) raw.rooms = rooms === 'any' ? 'ANY' : list(rooms).filter((v) => (GUIDED_ROOMS as readonly string[]).includes(v));
  const budget = read(params, 'budget');
  if (budget === 'unknown') raw.budget = 'UNKNOWN';
  else if (budget) {
    const m = /^(monthly|total):(\d{1,9})$/.exec(budget);
    if (m) raw.budget = { kind: m[1]!.toUpperCase(), max: Number(m[2]) };
  }
  const delivery = read(params, 'delivery')?.toUpperCase();
  if (delivery && (GUIDED_DELIVERY as readonly string[]).includes(delivery)) raw.delivery = delivery;
  const purpose = read(params, 'purpose');
  if (purpose === 'none') raw.purpose = 'NO_ANSWER';
  else if (purpose && purpose in PurchasePurpose) raw.purpose = purpose;
  // Each key is validated on its own: one bad value drops that answer only.
  const out: Record<string, unknown> = {};
  const shape = guidedAnswersSchema.shape;
  for (const [k, v] of Object.entries(raw)) {
    const parsed = shape[k as keyof typeof shape].safeParse(v);
    if (parsed.success && parsed.data !== undefined) out[k] = parsed.data;
  }
  return out as GuidedAnswers;
}

// ─── Read models ──────────────────────────────────────────────────────────────────────────────────────────────────

/** `GET /public/assistant/questions` — the choices of every question, each computed from the EARLIER answers only. */
export interface GuidedQuestionsResponse {
  /** `features.assistant.mode` (AI behaves as GUIDED until the conversational package, ASS-050). */
  mode: 'GUIDED' | 'AI';
  /** ASS-010 question 1 — regions with published and available properties (CAT-021). */
  regions: { slug: string; name: string }[];
  /** Question 2 — the types that still have a property (« Un choix sans aucun bien n'est pas proposé »). */
  types: PropertyTypeSlug[];
  /** Question 2 bis. */
  rooms: GuidedRooms[];
  /** Question 3 — `null` when `features.monthlyBudgetSearch` is false (total only). */
  monthlySteps: number[] | null;
  totalSteps: number[];
  /** Question 4. */
  delivery: Exclude<GuidedDelivery, 'ANY'>[];
  /** Question 5 — `PurchasePurpose` (no property behind it: always all). */
  purposes: PurchasePurpose[];
  /** Currency of the budget steps (`display.referenceCurrency`, DEM-007). */
  currency: string;
}

/** `GET /public/assistant/results` — ASS-020, ASS-021. */
export interface GuidedResultsResponse {
  /** `EXACT`: the answers match; `RELAXED`: nearest ones (CAT-061 order); `NONE`: nothing, the form opens (ASS-021). */
  outcome: 'EXACT' | 'RELAXED' | 'NONE';
  /** Properties matching the criteria applied (`criteria`). */
  total: number;
  /** Six at most, by relevance (CAT-040). */
  cards: PropertyCard[];
  /** ASS-030 — twenty references at most, the properties shown to the visitor, joined to the request. */
  references: string[];
  /** The criteria of the questionnaire (CAT-020): « Voir tous les résultats », « Créer une alerte ». */
  criteria: CatalogueCriteria;
  /** The criteria that produced the cards (= `criteria` unless relaxed). */
  appliedCriteria: CatalogueCriteria;
  /** CAT-040 line 9 — down-payment percentage of the reference financing. */
  referenceDownPaymentPct: string;
}
