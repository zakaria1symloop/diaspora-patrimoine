// ASS-050 to ASS-052, IA-003, IA-005, IA-013 — the conversational assistant (mode AI) around one turn: availability
// (setting, provider, monthly budget), limits (rate, conversation length), personal data masked before anything is
// stored or sent, the conversation kept 30 days without identity, the spend counted per month.
import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  aiCriteria,
  assistantMessageRequestSchema,
  AI_CONVERSATION_RETENTION_DAYS,
  AI_VISITOR_TURNS_MAX,
  parseCatalogueCriteria,
  type AiHandoffReason,
  type AiStreamEvent,
  type AssistantMessageRequest,
  type CatalogueCriteria,
} from '@dp/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { CatalogueIndex } from '../../catalogue/catalogue-index.js';
import { AppError } from '../../platform/errors.js';
import { Clock } from '../../platform/clock.js';
import { newId } from '../../platform/ids.js';
import { PrismaService } from '../../platform/prisma.service.js';
import { ClientIp, RateLimiter, type RateRule } from '../../platform/rate-limit.js';
import { log } from '../../platform/request-context.js';
import { SettingsService } from '../../platform/settings.service.js';
import { parseOrThrow } from '../../platform/validation.js';
import { GuidedSearchService } from '../guided-search.service.js';
import { ASSISTANT_MODEL, type AssistantModel } from './assistant-model.js';
import { plainText, searchHelp, type HelpDocument } from './help-search.js';
import { budgetMicros } from './pricing.js';
import { redactPersonalData } from './redact.js';
import { criteriaFromTool, criteriaNames, figuresNotFromData, runTurn, type Vocabulary } from './turn.js';

/** Rate limits of the model turns per visitor address (SEC-070); the pill edits cost nothing and have their own. */
export const AI_RATE_RULES = {
  messagesMinute: { limit: 6, windowSeconds: 60 },
  messagesHour: { limit: 40, windowSeconds: 3600 },
  editsMinute: { limit: 30, windowSeconds: 60 },
} satisfies Record<string, RateRule>;

const USAGE = 'assistant';
const DAY_MS = 86_400_000;
const HELP_CACHE_MS = 60_000;

export interface StoredMessage {
  role: 'visitor' | 'assistant';
  text: string;
  at: string;
}

interface ConversationRow {
  id: string;
  messages: StoredMessage[];
  criteria: CatalogueCriteria;
  propertyReferences: string[];
  handoffReason: string | null;
  visitorTurns: number;
}

export interface PreparedTurn {
  input: AssistantMessageRequest;
  conversation: ConversationRow | null;
}

@Injectable()
export class ConversationService {
  private help: { at: number; docs: HelpDocument[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
    private readonly index: CatalogueIndex,
    private readonly guided: GuidedSearchService,
    @Inject(ASSISTANT_MODEL) private readonly model: AssistantModel | null,
  ) {}

  /** `features.assistant.mode` — OFF: 404 (NAV-003). */
  private async setting(): Promise<'GUIDED' | 'AI'> {
    const mode = await this.settings.get('features.assistant.mode');
    if (mode === 'OFF') throw AppError.notFound();
    return mode;
  }

  private async month(): Promise<string> {
    return (await this.index.today()).slice(0, 7);
  }

  /** ASS-052 — the cap of the month reached? (0 € = never available). */
  private async overBudget(): Promise<boolean> {
    const cap = budgetMicros(Number(await this.settings.get('ai.assistant.monthlyBudget')));
    if (cap <= 0) return true;
    const row = await this.prisma.aiUsageMonth.findUnique({ where: { usage_month: { usage: USAGE, month: await this.month() } }, select: { costMicros: true } });
    return (row?.costMicros ?? 0n) >= BigInt(cap);
  }

  /** `GET /public/assistant/status` — AI only when the setting asks for it AND the model can answer now. */
  async status(): Promise<'GUIDED' | 'AI'> {
    const mode = await this.setting();
    if (mode !== 'AI' || !this.model) return 'GUIDED';
    return (await this.overBudget()) ? 'GUIDED' : 'AI';
  }

  /** Everything that answers with an HTTP error, before the stream starts: OFF, invalid body, rate limits. */
  async prepare(req: Request, body: unknown): Promise<PreparedTurn> {
    await this.setting();
    const input = parseOrThrow(assistantMessageRequestSchema, body);
    const ipKey = this.ip.hash(req);
    const waits =
      input.message !== undefined
        ? [this.limiter.hit(`ai:m:${ipKey}`, AI_RATE_RULES.messagesMinute), this.limiter.hit(`ai:h:${ipKey}`, AI_RATE_RULES.messagesHour)]
        : [this.limiter.hit(`ai:e:${ipKey}`, AI_RATE_RULES.editsMinute)];
    const wait = Math.max(...waits);
    if (wait > 0) throw AppError.rateLimited(wait);
    const conversation = input.conversationId ? await this.load(input.conversationId) : null;
    return { input, conversation };
  }

  private async load(id: string): Promise<ConversationRow | null> {
    const row = await this.prisma.assistantConversation.findFirst({
      where: { id, expiresAt: { gt: this.clock.now() } },
      select: { id: true, messages: true, criteria: true, propertyReferences: true, handoffReason: true, visitorTurns: true },
    });
    if (!row) return null; // purged or unknown: a new conversation starts
    return { ...row, messages: row.messages as unknown as StoredMessage[], criteria: row.criteria as CatalogueCriteria };
  }

  private async vocabulary(): Promise<Vocabulary> {
    const rows = (await this.index.rows()).filter((p) => p.availability === 'AVAILABLE');
    const regions = new Map<string, { slug: string; name: string }>();
    const cities = new Map<string, { slug: string; name: string; region: string }>();
    for (const p of rows) {
      regions.set(p.region.slug, { slug: p.region.slug, name: p.region.name });
      if (p.city) cities.set(p.city.slug, { slug: p.city.slug, name: p.city.name, region: p.region.slug });
    }
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'fr');
    return { regions: [...regions.values()].sort(byName), cities: [...cities.values()].sort(byName) };
  }

  /** IA-010 point 2 — published questions (their feature on, EDI-040) and published pages, cached one minute. */
  private async helpDocs(): Promise<HelpDocument[]> {
    if (this.help && Date.now() - this.help.at < HELP_CACHE_MS) return this.help.docs;
    const [faq, pages, all] = await Promise.all([
      this.prisma.faqItem.findMany({ where: { locale: 'fr', isPublished: true, deletedAt: null }, select: { slug: true, question: true, answer: true, requiredFeature: true } }),
      this.prisma.page.findMany({ where: { locale: 'fr', kind: 'EDITORIAL', status: 'PUBLISHED' }, select: { slug: true, title: true, body: true } }),
      this.settings.all() as Promise<unknown> as Promise<Record<string, unknown>>,
    ]);
    const docs: HelpDocument[] = [
      ...faq.filter((f) => !f.requiredFeature || all[f.requiredFeature] === true).map((f) => ({ kind: 'FAQ' as const, slug: f.slug, title: f.question, body: plainText(f.answer) })),
      ...pages.map((p) => ({ kind: 'PAGE' as const, slug: p.slug, title: p.title, body: plainText(p.body) })),
    ];
    this.help = { at: Date.now(), docs };
    return docs;
  }

  /** The stream of one request (headers already sent): never throws, every failure ends in `fallback`. */
  async run(prepared: PreparedTurn, emit: (e: AiStreamEvent) => void, signal: AbortSignal): Promise<void> {
    try {
      await this.runUnsafe(prepared, emit, signal);
    } catch (err) {
      log('error', 'assistant.ai.failed', { message: err instanceof Error ? err.message.slice(0, 200) : 'unknown' });
      emit({ type: 'fallback' });
    }
  }

  private async runUnsafe({ input, conversation }: PreparedTurn, emit: (e: AiStreamEvent) => void, signal: AbortSignal): Promise<void> {
    // ASS-052 — not configured, setting GUIDED, cap reached: the questionnaire, without an error message.
    if ((await this.status()) !== 'AI' || !this.model) {
      emit({ type: 'fallback' });
      return;
    }
    const model = this.model;
    const now = this.clock.now();
    const conv: ConversationRow = conversation ?? { id: newId(), messages: [], criteria: {}, propertyReferences: [], handoffReason: null, visitorTurns: 0 };
    const isNew = conversation === null;
    const [year, currency, monthlySearch, vocabulary] = await Promise.all([
      this.index.today().then((d) => Number(d.slice(0, 4))),
      this.settings.get('display.referenceCurrency'),
      this.settings.get('features.monthlyBudgetSearch'),
      this.vocabulary(),
    ]);

    // IA-011 — an edit of the pills: the catalogue search again, no model call.
    if (input.criteria !== undefined) {
      emit({ type: 'start', conversationId: conv.id, turn: conv.visitorTurns });
      const parsed = aiCriteria(parseCatalogueCriteria(new URLSearchParams(input.criteria.replace(/^\?/, '')), year));
      const { criteria } = criteriaFromTool(parsed, vocabulary, year, monthlySearch);
      const results = await this.guided.search(criteria);
      emit({ type: 'criteria', criteria, names: criteriaNames(criteria, vocabulary) });
      emit({ type: 'results', results });
      await this.save(conv, isNew, model, { criteria, references: results.references, messages: [], visitorTurn: false, usage: null, handoff: null, flags: [] }, now);
      emit({ type: 'end', generated: false });
      return;
    }

    // Conversation length: beyond, an advisor takes over (DEM-017).
    if (conv.visitorTurns >= AI_VISITOR_TURNS_MAX) {
      emit({ type: 'start', conversationId: conv.id, turn: conv.visitorTurns });
      emit({ type: 'limit' });
      emit({ type: 'end', generated: false });
      return;
    }

    const message = redactPersonalData(input.message!);
    const started = Date.now();
    // `start` goes out with the first output of the model: a failure before it falls back without a trace.
    let live = false;
    const relay = (e: AiStreamEvent) => {
      if (!live) {
        live = true;
        emit({ type: 'start', conversationId: conv.id, turn: conv.visitorTurns + 1 });
      }
      emit(e);
    };
    const outcome = await runTurn(
      { history: conv.messages.map((m) => ({ role: m.role, text: m.text })), message, criteria: conv.criteria },
      {
        model,
        search: (c) => this.guided.search(c),
        help: async (q) => searchHelp(await this.helpDocs(), q),
        vocabulary,
        currency,
        monthlySearch,
        year,
      },
      relay,
      signal,
    );

    const flags = [...outcome.flags];
    if (!outcome.fallback) {
      const figures = figuresNotFromData(outcome.text, [...conv.messages.filter((m) => m.role === 'visitor').map((m) => m.text), message]);
      if (figures.length) flags.push('FIGURE_NOT_FROM_DATA');
    }
    const at = now.toISOString();
    const stored: StoredMessage[] = [{ role: 'visitor', text: message, at }];
    if (outcome.text.trim()) stored.push({ role: 'assistant', text: outcome.text.trim().slice(0, 4000), at: this.clock.now().toISOString() });
    if (outcome.steps > 0 || !outcome.fallback) {
      await this.save(conv, isNew, model, { criteria: outcome.criteria, references: outcome.references, messages: stored, visitorTurn: true, usage: outcome, handoff: outcome.handoff, flags }, now);
    }
    // IA-005 — logged without any text of the conversation.
    log(outcome.fallback ? 'warn' : 'info', 'assistant.ai.turn', {
      conversationId: conv.id,
      steps: outcome.steps,
      inputTokens: outcome.usage.inputTokens + outcome.usage.cacheReadTokens + outcome.usage.cacheWriteTokens,
      outputTokens: outcome.usage.outputTokens,
      costMicros: outcome.costMicros,
      fallback: outcome.fallback,
      failure: outcome.failure,
      flags,
      ms: Date.now() - started,
    });
    if (outcome.fallback) {
      emit({ type: 'fallback' });
      return;
    }
    relay({ type: 'end', generated: true });
  }

  private async save(
    conv: ConversationRow,
    isNew: boolean,
    model: AssistantModel,
    t: {
      criteria: CatalogueCriteria;
      references: string[];
      messages: StoredMessage[];
      visitorTurn: boolean;
      usage: { usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }; costMicros: number } | null;
      handoff: AiHandoffReason | null;
      flags: string[];
    },
    now: Date,
  ): Promise<void> {
    const at = this.clock.now();
    const input = t.usage ? t.usage.usage.inputTokens + t.usage.usage.cacheReadTokens + t.usage.usage.cacheWriteTokens : 0;
    const output = t.usage?.usage.outputTokens ?? 0;
    const cost = t.usage?.costMicros ?? 0;
    const references = [...new Set([...t.references, ...conv.propertyReferences])].slice(0, 20);
    const messages = [...conv.messages, ...t.messages] as unknown as Prisma.InputJsonValue;
    const handoffReason = t.handoff ?? conv.handoffReason;
    await this.prisma.$transaction(async (tx) => {
      if (isNew) {
        await tx.assistantConversation.create({
          data: {
            id: conv.id,
            provider: model.provider,
            model: model.model,
            messages,
            criteria: t.criteria as Prisma.InputJsonValue,
            propertyReferences: references,
            handoffReason,
            visitorTurns: t.visitorTurn ? 1 : 0,
            inputTokens: input,
            outputTokens: output,
            costMicros: BigInt(cost),
            flags: t.flags,
            expiresAt: new Date(now.getTime() + AI_CONVERSATION_RETENTION_DAYS * DAY_MS),
            createdAt: now,
            updatedAt: at,
          },
        });
      } else {
        await tx.assistantConversation.update({
          where: { id: conv.id },
          data: {
            messages,
            criteria: t.criteria as Prisma.InputJsonValue,
            propertyReferences: references,
            handoffReason,
            visitorTurns: { increment: t.visitorTurn ? 1 : 0 },
            inputTokens: { increment: input },
            outputTokens: { increment: output },
            costMicros: { increment: BigInt(cost) },
            ...(t.flags.length ? { flags: { push: t.flags } } : {}),
            updatedAt: at,
          },
        });
      }
      if (t.usage) {
        const month = await this.month();
        await tx.aiUsageMonth.upsert({
          where: { usage_month: { usage: USAGE, month } },
          create: { usage: USAGE, month, calls: 1, inputTokens: BigInt(input), outputTokens: BigInt(output), costMicros: BigInt(cost), updatedAt: at },
          update: { calls: { increment: 1 }, inputTokens: { increment: BigInt(input) }, outputTokens: { increment: BigInt(output) }, costMicros: { increment: BigInt(cost) }, updatedAt: at },
        });
      }
    });
    if (t.usage) await this.alertWhenCapped(at);
  }

  /** AUT-076 — the cap reached: one technical alert a month (the alert e-mail S_TECH_ALERT comes with AUT-076). */
  private async alertWhenCapped(at: Date): Promise<void> {
    if (!(await this.overBudget())) return;
    const month = await this.month();
    const first = await this.prisma.aiUsageMonth.updateMany({ where: { usage: USAGE, month, alertedAt: null }, data: { alertedAt: at } });
    if (first.count === 1) log('error', 'assistant.ai.budget_reached', { usage: USAGE, month });
  }
}
