// 02-site-public/09 § 4 (ASS-050 to ASS-052) and 05-phases-ulterieures/04 (IA-001 to IA-005, IA-010 to IA-013) — the
// conversational search assistant (EP-22, `features.assistant.mode` = AI, D-090). Shared by the API (validation of the
// visitor's request and of the model's output) and the site (stream reader, criteria pills). Pure: no I/O.
//
// The model never writes what the visitor sees as data: it proposes catalogue criteria (validated here, then normalised
// by `parseCatalogueCriteria`, CAT-020) and short explanations; the properties, prices, monthly payments and delivery
// dates shown come from the catalogue routes only (IA-004, IA-012).
import { z } from 'zod';
import type { GuidedResultsResponse } from './assistant.js';
import { PROPERTY_TYPE_SLUGS, ROOMS_VALUES, STANDING_SLUGS, type CatalogueCriteria } from './catalogue.js';

/** A visitor message: 500 characters at most (the size of the guided free text, ASS-011). */
export const AI_MESSAGE_MAX_LENGTH = 500;
/** Visitor messages in one conversation; beyond, the assistant hands over to an advisor (DEM-017). */
export const AI_VISITOR_TURNS_MAX = 12;
/** The criteria of a pill edit travel as a catalogue query string (CAT-020 keys). */
export const AI_CRITERIA_QUERY_MAX_LENGTH = 1000;

/** IA-013 — a conversation is kept 30 days, then purged. */
export const AI_CONVERSATION_RETENTION_DAYS = 30;

// ─── Request of `POST /public/assistant/messages` ────────────────────────────────────────────────────────────────

/**
 * Either a visitor message (the model answers) or an edit of the criteria pills (IA-011; no model call: the catalogue
 * search runs again on the edited criteria). `conversationId` is absent on the first message.
 */
export const assistantMessageRequestSchema = z
  .object({
    conversationId: z.uuid().optional(),
    message: z.string().trim().min(1, { error: 'REQUIRED' }).max(AI_MESSAGE_MAX_LENGTH, { error: 'TOO_LONG' }).optional(),
    criteria: z.string().max(AI_CRITERIA_QUERY_MAX_LENGTH, { error: 'TOO_LONG' }).optional(),
  })
  .strict()
  .refine((v) => (v.message === undefined) !== (v.criteria === undefined), { error: 'REQUIRED', path: ['message'] });
export type AssistantMessageRequest = z.infer<typeof assistantMessageRequestSchema>;

// ─── Tools offered to the model (ASS-052: three, server side) ────────────────────────────────────────────────────

/** The three tools, and nothing else (prompt injection cannot add one: unknown names are refused). */
export const AI_TOOL_NAMES = ['search_properties', 'search_help', 'offer_callback'] as const;
export type AiToolName = (typeof AI_TOOL_NAMES)[number];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugs = (max: number) => z.array(z.string().max(80).regex(SLUG)).min(1).max(max);

/**
 * `search_properties` — the catalogue criteria the model may propose (CAT-020 subset). Validated strictly: an unknown
 * key or a malformed value refuses the whole call (the model is asked again, then the guided mode takes over).
 */
export const aiSearchInputSchema = z.strictObject({
  region: slugs(10).optional().describe('Region slugs, taken from the catalogue vocabulary only.'),
  city: slugs(10).optional().describe('City slugs, taken from the catalogue vocabulary only.'),
  type: z.array(z.enum(PROPERTY_TYPE_SLUGS)).min(1).max(6).optional().describe('Property types.'),
  rooms: z.array(z.enum(ROOMS_VALUES)).min(1).max(5).optional().describe('Number of main rooms (T2 = "2"); "5plus" for five and more.'),
  priceMax: z.number().int().positive().max(100_000_000).optional().describe('Maximum total price in the reference currency, only if the visitor gave one.'),
  priceMin: z.number().int().min(0).max(100_000_000).optional().describe('Minimum total price, only if the visitor gave one.'),
  monthlyMax: z.number().int().positive().max(1_000_000).optional().describe('Maximum monthly payment, only if the visitor gave one; excludes priceMin and priceMax.'),
  surfaceMin: z.number().int().min(0).max(100_000).optional().describe('Minimum surface in square metres.'),
  delivery: z
    .array(z.string().regex(/^(delivered|later|\d{4})$/))
    .min(1)
    .max(4)
    .optional()
    .describe('"delivered" for available now, a year among the next three, or "later".'),
  standing: z.array(z.enum(STANDING_SLUGS)).min(1).max(3).optional().describe('Finishing level.'),
  financing: z.boolean().optional().describe('Only properties eligible to a partner bank financing.'),
  islamic: z.boolean().optional().describe('Only properties eligible to an Islamic financing.'),
});
export type AiSearchInput = z.infer<typeof aiSearchInputSchema>;

/** `search_help` — the published FAQ questions and pages (IA-010 point 2). */
export const aiHelpInputSchema = z.strictObject({
  query: z.string().trim().min(2).max(200).describe('What the visitor wants to know, in a few words.'),
});
export type AiHelpInput = z.infer<typeof aiHelpInputSchema>;

/** IA-010 point 3, IA-012 — why the assistant hands over to an advisor. */
export const AI_HANDOFF_REASONS = ['PERSONAL_SITUATION', 'NO_RELIABLE_ANSWER', 'VISITOR_ASKED', 'OUT_OF_SCOPE'] as const;
export type AiHandoffReason = (typeof AI_HANDOFF_REASONS)[number];

/** `offer_callback` — shows « Être rappelé » (DEM-017). */
export const aiCallbackInputSchema = z.strictObject({
  reason: z.enum(AI_HANDOFF_REASONS).describe('Why a human advisor should take over.'),
});
export type AiCallbackInput = z.infer<typeof aiCallbackInputSchema>;

/**
 * The validated tool input as catalogue URL parameters: the result goes through `parseCatalogueCriteria` (the one
 * normaliser of the site and the API), so the criteria applied are those any catalogue address would give.
 */
export function aiSearchToParams(input: AiSearchInput): URLSearchParams {
  const out = new URLSearchParams();
  const set = (k: string, v: string | number | boolean | string[] | undefined) => {
    if (v === undefined || v === false) return;
    out.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v));
  };
  set('region', input.region);
  set('city', input.city);
  set('type', input.type);
  set('rooms', input.rooms);
  if (input.monthlyMax !== undefined) set('monthlyMax', input.monthlyMax);
  else {
    set('priceMin', input.priceMin);
    set('priceMax', input.priceMax);
  }
  set('surfaceMin', input.surfaceMin);
  set('delivery', input.delivery);
  set('standing', input.standing);
  set('financing', input.financing);
  set('islamic', input.islamic);
  return out;
}

// ─── Criteria pills (IA-011) ─────────────────────────────────────────────────────────────────────────────────────

/** The criteria the assistant keeps (CAT-020 subset of `aiSearchInputSchema`), in the order of the pills. */
export const AI_CRITERIA_KEYS = ['type', 'rooms', 'region', 'city', 'monthlyMax', 'priceMin', 'priceMax', 'surfaceMin', 'delivery', 'standing', 'financing', 'islamic'] as const;
export type AiCriteriaKey = (typeof AI_CRITERIA_KEYS)[number];

export interface AiCriteriaPill {
  key: AiCriteriaKey;
  /** One value of a list criterion; the number of a bound; '1' for a flag. */
  value: string;
}

/** Keeps the keys of the assistant only (nothing of sort, page, view). */
export function aiCriteria(c: CatalogueCriteria): CatalogueCriteria {
  const out: Record<string, unknown> = {};
  for (const k of AI_CRITERIA_KEYS) if (c[k] !== undefined) out[k] = c[k];
  return out as CatalogueCriteria;
}

/** One pill per value: « Appartement · T3 · Alger · jusqu'à 500 € / mois » (IA-011). */
export function criteriaPills(c: CatalogueCriteria): AiCriteriaPill[] {
  const pills: AiCriteriaPill[] = [];
  for (const key of AI_CRITERIA_KEYS) {
    const v = c[key];
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const item of v) pills.push({ key, value: String(item) });
    else pills.push({ key, value: v === true ? '1' : String(v) });
  }
  return pills;
}

/** The criteria without one pill (removing a region also removes its cities: CAT-020, city needs one region). */
export function withoutPill(c: CatalogueCriteria, pill: AiCriteriaPill): CatalogueCriteria {
  const next = { ...c } as Record<string, unknown>;
  const v = next[pill.key];
  if (Array.isArray(v)) {
    const rest = v.filter((x) => String(x) !== pill.value);
    if (rest.length) next[pill.key] = rest;
    else delete next[pill.key];
  } else delete next[pill.key];
  if (pill.key === 'region') delete next.city;
  return next as CatalogueCriteria;
}

// ─── Stream of the answer (`text/event-stream`) ──────────────────────────────────────────────────────────────────

/** IA-010 point 2 — a source the answer relies on: a published FAQ question or page. */
export interface AiSource {
  kind: 'FAQ' | 'PAGE';
  title: string;
  /** Site address: `/faq#q-{slug}` or `/infos/{slug}`. */
  href: string;
}

/** Names of the region and city slugs of the criteria (the pills show names, the criteria keep slugs). */
export interface AiCriteriaNames {
  region: Record<string, string>;
  city: Record<string, string>;
}

/**
 * Events of `POST /public/assistant/messages`, in order: `start`, then any of `delta` (the answer, as it is written),
 * `criteria`, `results`, `sources`, `handoff`, `limit`; then `end`. `fallback` replaces everything after `start` when the
 * model cannot answer (not configured, unavailable, too slow, over budget, invalid output): the site shows the guided
 * questionnaire, without an error message (ASS-052).
 */
export type AiStreamEvent =
  | { type: 'start'; conversationId: string; turn: number }
  | { type: 'delta'; text: string }
  | { type: 'criteria'; criteria: CatalogueCriteria; names: AiCriteriaNames }
  | { type: 'results'; results: GuidedResultsResponse }
  | { type: 'sources'; sources: AiSource[] }
  | { type: 'handoff'; reason: AiHandoffReason }
  | { type: 'limit' }
  | { type: 'end'; generated: boolean }
  | { type: 'fallback' };

export function encodeAiEvent(e: AiStreamEvent): string {
  return `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
}

/**
 * Reads the complete events of an SSE buffer; returns them with the unfinished rest. Lines other than `data:` are
 * ignored; a malformed or unknown event is dropped (the stream is untrusted input for the site too).
 */
export function readAiEvents(buffer: string): { events: AiStreamEvent[]; rest: string } {
  const events: AiStreamEvent[] = [];
  const normalised = buffer.replace(/\r\n/g, '\n');
  const blocks = normalised.split('\n\n');
  const rest = blocks.pop() ?? '';
  const known = new Set(['start', 'delta', 'criteria', 'results', 'sources', 'handoff', 'limit', 'end', 'fallback']);
  for (const block of blocks) {
    const data = block
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trimStart())
      .join('\n');
    if (!data) continue;
    try {
      const e = JSON.parse(data) as AiStreamEvent;
      if (e && typeof e === 'object' && known.has(e.type)) events.push(e);
    } catch {
      /* dropped */
    }
  }
  return { events, rest };
}

/** `GET /public/assistant/status` — the mode the visitor gets now (AI only when the provider can answer, ASS-052). */
export interface AssistantStatusResponse {
  mode: 'GUIDED' | 'AI';
}

/**
 * ASS-030, IA-013 — what a `GUIDED_SEARCH` request started from the conversation carries, written by the server from
 * the conversation it keeps (never the browser's word for it): the visitor's messages (personal data masked), the
 * criteria understood, the reason of the handover.
 */
export interface AiLeadSummary {
  conversationId: string;
  visitorMessages: string[];
  handoffReason: AiHandoffReason | null;
  turns: number;
}
