// ASS-052, IA-010 to IA-012 — one visitor turn of the conversational assistant: the model writes, proposes tool calls,
// the server validates each call (zod, then the catalogue normaliser) and runs it, at most a few steps. Nothing the model
// returns is shown as data: the cards come from the catalogue search, the sources from the published FAQ and pages.
// Any provider failure, a model too slow or output that stays invalid ends the turn in `fallback` (guided mode).
import {
  aiCallbackInputSchema,
  aiCriteria,
  aiHelpInputSchema,
  aiSearchInputSchema,
  aiSearchToParams,
  AI_TOOL_NAMES,
  parseCatalogueCriteria,
  type AiCriteriaNames,
  type AiHandoffReason,
  type AiSearchInput,
  type AiSource,
  type AiStreamEvent,
  type CatalogueCriteria,
  type GuidedResultsResponse,
} from '@dp/contracts';
import type { AssistantModel, ModelMessage, ModelToolCall, ModelToolResult, ModelUsage } from './assistant-model.js';
import type { HelpHit } from './help-search.js';
import { costMicros } from './pricing.js';
import { ASSISTANT_INSTRUCTIONS, assistantTools, turnContext, type VocabularyEntry } from './prompt.js';

export const TURN_LIMITS = {
  /** Model steps in one turn (a search, then the answer; a help search; a correction). */
  maxSteps: 4,
  /** Tool calls refused for invalid input in one turn before the guided mode takes over. */
  maxInvalidCalls: 2,
  maxOutputTokens: 700,
  /** A step must finish or start writing within this delay (« trop lent »). */
  firstOutputMs: 15_000,
  /** The whole turn. */
  turnMs: 45_000,
  /** Earlier messages replayed to the model (texts only). */
  historyMessages: 16,
};
export type TurnLimits = typeof TURN_LIMITS;

export interface Vocabulary {
  regions: VocabularyEntry[];
  cities: VocabularyEntry[];
}

export interface TurnPorts {
  model: AssistantModel;
  search(criteria: CatalogueCriteria): Promise<GuidedResultsResponse>;
  help(query: string): Promise<HelpHit[]>;
  vocabulary: Vocabulary;
  currency: string;
  monthlySearch: boolean;
  /** Year of the business calendar (CAT-020 `delivery`). */
  year: number;
}

export interface TurnInput {
  /** Earlier messages, personal data already masked. */
  history: { role: 'visitor' | 'assistant'; text: string }[];
  /** This message, personal data already masked. */
  message: string;
  criteria: CatalogueCriteria;
}

export interface TurnOutcome {
  fallback: boolean;
  /** The answer written (empty on fallback before any text). */
  text: string;
  criteria: CatalogueCriteria;
  /** Properties shown in this turn (ASS-030). */
  references: string[];
  handoff: AiHandoffReason | null;
  steps: number;
  usage: ModelUsage;
  costMicros: number;
  flags: string[];
  /** Why the turn fell back (logged, never shown). */
  failure: 'PROVIDER' | 'TIMEOUT' | 'INVALID_OUTPUT' | 'EMPTY' | null;
}

class TurnTimeout extends Error {}

/** Names of the slugs of a set of criteria (the pills show names). */
export function criteriaNames(c: CatalogueCriteria, v: Vocabulary): AiCriteriaNames {
  const names: AiCriteriaNames = { region: {}, city: {} };
  for (const s of c.region ?? []) names.region[s] = v.regions.find((r) => r.slug === s)?.name ?? s;
  for (const s of c.city ?? []) names.city[s] = v.cities.find((r) => r.slug === s)?.name ?? s;
  return names;
}

/**
 * The tool input → catalogue criteria. Unknown places are dropped (and told back to the model); cities without a region
 * bring their region (CAT-020: a city needs exactly one region); a monthly budget is dropped when that search is off.
 */
export function criteriaFromTool(input: AiSearchInput, v: Vocabulary, year: number, monthlySearch: boolean): { criteria: CatalogueCriteria; dropped: string[] } {
  const dropped: string[] = [];
  const fixed: AiSearchInput = { ...input };
  if (fixed.region) {
    const known = fixed.region.filter((s) => v.regions.some((r) => r.slug === s));
    dropped.push(...fixed.region.filter((s) => !known.includes(s)).map((s) => `region:${s}`));
    fixed.region = known.length ? known : undefined;
  }
  if (fixed.city) {
    const known = fixed.city.filter((s) => v.cities.some((c) => c.slug === s));
    dropped.push(...fixed.city.filter((s) => !known.includes(s)).map((s) => `city:${s}`));
    fixed.city = known.length ? known : undefined;
    if (fixed.city && !fixed.region) {
      fixed.region = [...new Set(fixed.city.map((s) => v.cities.find((c) => c.slug === s)!.region!))];
    }
  }
  if (!monthlySearch && fixed.monthlyMax !== undefined) {
    delete fixed.monthlyMax;
    dropped.push('monthlyMax');
  }
  const parsed = aiCriteria(parseCatalogueCriteria(aiSearchToParams(fixed), year));
  if (fixed.city && !parsed.city) dropped.push(...fixed.city.map((s) => `city:${s}`));
  return { criteria: parsed, dropped };
}

/** Money, rates and delays in the answer that the visitor did not write (IA-012): a quality flag, never shown. */
export function figuresNotFromData(answer: string, visitorTexts: string[]): string[] {
  const FIGURE = /\d[\d\s.,  ]*\s?(?:€|eur\b|euros?\b|da\b|dzd\b|dinars?\b|%|mois\b|ans?\b|years?\b|months?\b)/gi;
  const digits = (s: string) => s.replace(/\D/g, '');
  const said = new Set(visitorTexts.flatMap((t) => (t.match(/\d[\d\s.,  ]*/g) ?? []).map(digits)));
  return (answer.match(FIGURE) ?? []).filter((f) => !said.has(digits(f)));
}

const ZERO: ModelUsage = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };

export async function runTurn(input: TurnInput, ports: TurnPorts, emit: (e: AiStreamEvent) => void, signal: AbortSignal, limits: TurnLimits = TURN_LIMITS): Promise<TurnOutcome> {
  const tools = assistantTools();
  const allowed = new Set<string>(AI_TOOL_NAMES);
  const messages: ModelMessage[] = [
    ...input.history.slice(-limits.historyMessages).map((m): ModelMessage => (m.role === 'visitor' ? { role: 'user', text: m.text } : { role: 'assistant', text: m.text })),
    { role: 'user', text: input.message },
  ];
  const out: TurnOutcome = { fallback: false, text: '', criteria: input.criteria, references: [], handoff: null, steps: 0, usage: { ...ZERO }, costMicros: 0, flags: [], failure: null };
  const sources: AiSource[] = [];
  let invalid = 0;
  let shownSomething = false; // results, sources or handoff already on screen

  const turn = new AbortController();
  const onAbort = () => turn.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  const turnTimer = setTimeout(() => turn.abort(new TurnTimeout()), limits.turnMs);

  const fail = (failure: NonNullable<TurnOutcome['failure']>): TurnOutcome => {
    out.fallback = true;
    out.failure = failure;
    return out;
  };

  try {
    for (let step = 0; step < limits.maxSteps; step++) {
      const context = turnContext({ ...ports.vocabulary, currency: ports.currency, monthlySearch: ports.monthlySearch, years: [0, 1, 2].map((i) => String(ports.year + i)), criteria: out.criteria });
      const stepAbort = new AbortController();
      const relay = () => stepAbort.abort(turn.signal.reason);
      turn.signal.addEventListener('abort', relay, { once: true });
      let wrote = false;
      const watchdog = setTimeout(() => {
        if (!wrote) stepAbort.abort(new TurnTimeout());
      }, limits.firstOutputMs);
      let result;
      try {
        result = await ports.model.step(
          { instructions: ASSISTANT_INSTRUCTIONS, context, messages, tools, maxOutputTokens: limits.maxOutputTokens },
          (delta) => {
            if (!delta) return;
            wrote = true;
            out.text += delta;
            emit({ type: 'delta', text: delta });
          },
          stepAbort.signal,
        );
      } catch (err) {
        if (signal.aborted) return fail('PROVIDER'); // the visitor left: nothing more to show
        const timeout = err instanceof TurnTimeout || stepAbort.signal.reason instanceof TurnTimeout || turn.signal.reason instanceof TurnTimeout;
        return fail(timeout ? 'TIMEOUT' : 'PROVIDER');
      } finally {
        clearTimeout(watchdog);
        turn.signal.removeEventListener('abort', relay);
      }
      out.steps++;
      for (const k of Object.keys(ZERO) as (keyof ModelUsage)[]) out.usage[k] += result.usage[k];
      out.costMicros += costMicros(ports.model.model, result.usage);

      if (result.stop === 'refusal') {
        // IA-012 — « Je préfère vous mettre en relation avec un conseiller. »
        out.handoff = 'NO_RELIABLE_ANSWER';
        out.flags.push('REFUSAL');
        emit({ type: 'handoff', reason: 'NO_RELIABLE_ANSWER' });
        return out;
      }
      if (result.stop !== 'tool_use' || result.toolCalls.length === 0) break;
      if (step === limits.maxSteps - 1) {
        out.flags.push('STEP_LIMIT');
        break;
      }

      messages.push({ role: 'assistant_step', raw: result.raw });
      const results: ModelToolResult[] = [];
      for (const call of result.toolCalls) {
        const r = await runTool(call);
        if (r.isError) invalid++;
        results.push(r);
      }
      messages.push({ role: 'tool_results', results });
      if (invalid > limits.maxInvalidCalls) {
        out.flags.push('INVALID_OUTPUT');
        return fail('INVALID_OUTPUT');
      }
    }
  } finally {
    clearTimeout(turnTimer);
    signal.removeEventListener('abort', onAbort);
  }

  if (!out.text.trim() && !shownSomething) return fail('EMPTY');
  return out;

  async function runTool(call: ModelToolCall): Promise<ModelToolResult> {
    const error = (code: string, details?: unknown): ModelToolResult => ({ id: call.id, isError: true, content: JSON.stringify({ error: code, ...(details ? { details } : {}) }) });
    if (!allowed.has(call.name)) return error('UNKNOWN_TOOL');
    if (call.name === 'search_properties') {
      const parsed = aiSearchInputSchema.safeParse(call.input);
      if (!parsed.success) return error('INVALID_INPUT', parsed.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), problem: i.code })));
      const { criteria, dropped } = criteriaFromTool(parsed.data, ports.vocabulary, ports.year, ports.monthlySearch);
      const res = await ports.search(criteria);
      out.criteria = criteria;
      out.references = [...new Set([...out.references, ...res.references])].slice(0, 20);
      shownSomething = true;
      emit({ type: 'criteria', criteria, names: criteriaNames(criteria, ports.vocabulary) });
      emit({ type: 'results', results: res });
      // No price, monthly payment or date goes back to the model: it cannot repeat what it does not see (IA-012).
      return {
        id: call.id,
        content: JSON.stringify({
          criteriaApplied: criteria,
          ignoredValues: dropped,
          outcome: res.outcome,
          relaxed: res.outcome === 'RELAXED',
          total: res.total,
          shown: res.cards.map((c) => ({ reference: c.reference, title: c.title, type: c.type, rooms: c.rooms, city: c.city?.name ?? null, region: c.region.name })),
        }),
      };
    }
    if (call.name === 'search_help') {
      const parsed = aiHelpInputSchema.safeParse(call.input);
      if (!parsed.success) return error('INVALID_INPUT');
      const hits = await ports.help(parsed.data.query);
      const fresh = hits.map((h) => h.source).filter((s) => !sources.some((x) => x.href === s.href));
      if (fresh.length) {
        sources.push(...fresh);
        shownSomething = true;
        emit({ type: 'sources', sources: [...sources] });
      }
      return { id: call.id, content: JSON.stringify({ results: hits.map((h) => ({ title: h.source.title, text: h.excerpt })) }) };
    }
    const parsed = aiCallbackInputSchema.safeParse(call.input);
    if (!parsed.success) return error('INVALID_INPUT');
    if (!out.handoff) emit({ type: 'handoff', reason: parsed.data.reason });
    out.handoff = parsed.data.reason;
    shownSomething = true;
    return { id: call.id, content: JSON.stringify({ shown: true }) };
  }
}
