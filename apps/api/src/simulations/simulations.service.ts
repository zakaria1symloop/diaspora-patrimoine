// 02-site-public/06 — the simulators on the server: calculation (SIM-001), anonymous writing under `dp_anon` (SIM-015,
// CAL-112, NAV-051), « Enregistrer », « Recevoir par e-mail » (C_SIMULATION_RESULT with the PDF, no record created,
// SIM-032), « Télécharger (PDF) » (nothing written), the estimated budget of the catalogue (CAT-035) and the SIM-030
// property reminder. Limits of SEC-070: 60 calculations per IP per minute, 10 PDF per hour, 3 e-mails per address per day.
import { refreshClientCaches } from '../leads/lead-records.js';
import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ANON_COOKIE_DAYS,
  Cookies,
  ErrorCode,
  creditRequestSchema,
  creditSaveSchema,
  eligibilityInputSchemaFor,
  parseCatalogueCriteria,
  simulationEmailSchema,
  simulationPdfSchemaFor,
  type CreditInput,
  type CreditRequest,
  type CreditResponse,
  type EligibilityInput,
  type EligibilityResponse,
  type EstimatedBudget,
  type SimulationCreatedResponse,
  type SimulatorOptions,
  type SimulatorProperty,
} from '@dp/contracts';
import { convert, roundDisplayedBudget, roundReferenceDownPayment, type EligibilityOutputs } from '@dp/domain';
import type { Request, Response } from 'express';
import { ENV, type Env } from '../config/env.js';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import { MailerService, recipientHash } from '../communication/mailer.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp, RateLimiter, type RateRule } from '../platform/rate-limit.js';
import { log } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import { parseOrThrow } from '../platform/validation.js';
import { computeCreditScenarios, computeEligibility, eligibilityDomainInputs, toEligibilityResult, type LinkedPrice } from './calc.js';
import { SimulationContextService, parametersSnapshot, publicProduct, type SimContext } from './context.js';
import { PDF_RENDERER, type PdfRenderer } from './pdf/pdf-renderer.js';
import { creditPdfModel, creditProductLabel, eligibilityPdfModel, type PdfCompany } from './pdf/simulation-pdf.js';

/** SEC-070. */
export const SIM_RATE_RULES = {
  calc: { limit: 60, windowSeconds: 60 },
  pdf: { limit: 10, windowSeconds: 3600 },
  emailPerAddress: { limit: 3, windowSeconds: 86_400 },
} as const satisfies Record<string, RateRule>;

/** CAT-035 — a simulation older than 90 days no longer gives an estimated budget. */
export const ESTIMATED_BUDGET_DAYS = 90;

const ANON_RE = /^[0-9a-f]{32}$/;

/** SIM-032, SFA-010 — the client of the session (public routes behind OptionalClientSession), else null. */
export function sessionClientId(req: Request): string | null {
  const auth = (req as Request & { auth?: { kind?: string; clientId?: string | null } | null }).auth;
  return auth?.kind === 'CLIENT' && auth.clientId ? auth.clientId : null;
}

/** SFA-012 — thirty saved simulations at most. */
export const SAVED_SIMULATIONS_LIMIT = 30;

/** What a stored eligibility simulation keeps in `inputs` (the request, plus the linked price actually used). */
interface StoredEligibilityInputs extends EligibilityInput {
  linkedPrice: LinkedPrice | null;
}
interface StoredCreditInputs {
  scenarios: CreditInput[];
  activeIndex: number;
  linkedPrices: (LinkedPrice | null)[];
}

@Injectable()
export class SimulationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly context: SimulationContextService,
    private readonly idempotency: IdempotencyService,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
    private readonly mailer: MailerService,
    private readonly catalogue: CatalogueService,
    private readonly index: CatalogueIndex,
    @Inject(PDF_RENDERER) private readonly pdfRenderer: PdfRenderer,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ─── dp_anon (NAV-051) ────────────────────────────────────────────────────

  readAnon(req: Request): string | null {
    const v = (req.cookies as Record<string, unknown> | undefined)?.[Cookies.anon];
    return typeof v === 'string' && ANON_RE.test(v) ? v : null;
  }

  /** NAV-051 — set only when a simulation is launched; 30 days, renewed with each simulation written. */
  ensureAnon(req: Request, res: Response): string {
    const id = this.readAnon(req) ?? randomBytes(16).toString('hex');
    res.cookie(Cookies.anon, id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.APP_ENV !== 'local',
      path: '/',
      expires: new Date(this.clock.now().getTime() + ANON_COOKIE_DAYS * 86_400_000),
    });
    return id;
  }

  private limit(req: Request, kind: 'calc' | 'pdf'): void {
    const wait = this.limiter.hit(`simulation.${kind}:${this.ip.hash(req)}`, SIM_RATE_RULES[kind]);
    if (wait) throw AppError.rateLimited(wait);
  }

  private year(): number {
    return this.clock.now().getUTCFullYear();
  }

  // ─── Reading ──────────────────────────────────────────────────────────────

  async options(): Promise<SimulatorOptions> {
    const ctx = await this.context.load(this.clock.now(), null);
    const countries = await this.context.propertyCountries();
    const currencies = this.context.currencies(ctx.conversion);
    const fees: Record<string, string> = {};
    for (const c of countries) fees[c.code] = Number(await this.context.acquisitionFeesPct(c.code)).toFixed(2);
    return {
      referenceCurrency: ctx.referenceCurrency,
      currencies,
      currencyByCountry: await this.context.currencyByCountry(currencies),
      propertyCountries: countries,
      islamicFinance: ctx.islamicFinance,
      indicative: {
        annualRateBps: ctx.scale.annualRateBps,
        minDurationMonths: ctx.scale.minDurationMonths,
        maxDurationMonths: ctx.scale.maxDurationMonths,
        pricingMethod: ctx.scale.pricingMethod,
        minDownPaymentPct: Number(ctx.scale.minDownPaymentPct).toFixed(2),
      },
      reference: ctx.reference,
      acquisitionFeesPct: fees,
      products: ctx.products.map(publicProduct),
    };
  }

  /** SIM-030 — the property in reminder: displayed price, original price, reference financing of its country. 404 if gone. */
  async property(reference: string): Promise<SimulatorProperty> {
    const row = (await this.index.rows()).find((r) => r.reference === reference.toUpperCase() || r.slug === reference);
    if (!row) throw AppError.notFound();
    const [card] = await this.catalogue.toCards([row]);
    const p = await this.prisma.property.findUnique({ where: { id: row.id }, select: { priceFrom: true, priceCurrency: true, countryCode: true } });
    if (!card || !p) throw AppError.notFound();
    const ref = await this.context.referenceFinancing(p.countryCode);
    const refCurrency = await this.settings.get('display.referenceCurrency');
    const down = card.downPaymentRef
      ? card.downPaymentRef
      : card.priceFromRef
        ? { amount: roundReferenceDownPayment(Number(card.priceFromRef.amount) * (ref.downPaymentPct / 100)).toFixed(2), currency: refCurrency }
        : null;
    return {
      id: row.id,
      reference: row.reference,
      slug: row.slug,
      title: row.title,
      cityRegion: row.city ? `${row.city.name}, ${row.region.name}` : row.region.name,
      countryCode: p.countryCode,
      priceRef: card.priceFromRef,
      price: p.priceFrom ? { amount: p.priceFrom.toFixed(2), currency: p.priceCurrency } : null,
      cover: card.cover,
      financing: { downPayment: down, downPaymentPct: ref.downPaymentPct, durationMonths: ref.durationMonths, annualRateBps: ref.annualRateBps, pricingMethod: ref.pricingMethod },
      monthlyFromRef: card.monthlyFromRef,
    };
  }

  /** CAL-100 « prix lié à un bien » — the original price of the lot (if given) or of the property, in its currency. */
  private async linkedPrice(propertyId: string | undefined, lotId: string | undefined): Promise<LinkedPrice | null> {
    if (!propertyId) return null;
    const p = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { priceFrom: true, priceCurrency: true, lots: lotId ? { where: { id: lotId }, select: { price: true } } : false },
    });
    if (!p) return null;
    const lot = lotId && Array.isArray(p.lots) ? p.lots[0] : undefined;
    const amount = lot?.price ?? p.priceFrom;
    return amount ? { amount: amount.toString(), currency: p.priceCurrency } : null;
  }

  /** CAT-035 / API-100 `estimatedBudget`: the latest eligibility simulation of this browser, less than 90 days old. */
  async estimatedBudget(req: Request, query: Record<string, string>): Promise<EstimatedBudget> {
    const anon = this.readAnon(req);
    const clientId = sessionClientId(req);
    if (!anon && !clientId) return null;
    const now = this.clock.now();
    const sims = await this.prisma.simulation.findMany({
      // CAT-035 — on the account when signed in, else on the browser's dp_anon.
      where: { type: 'ELIGIBILITY', ...(clientId ? { clientId } : { anonymousId: anon }), createdAt: { gte: new Date(now.getTime() - ESTIMATED_BUDGET_DAYS * 86_400_000) } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, outputs: true },
    });
    const sim = sims.find((s) => (s.outputs as Partial<EligibilityOutputs> | null)?.maxBudgetRef);
    if (!sim) return null;
    const out = sim.outputs as unknown as EligibilityOutputs;
    const ctx = await this.context.conversion();
    let budget = roundDisplayedBudget(out.maxBudgetRef!);
    if (out.refCurrency !== ctx.referenceCurrency) {
      // CAT-035 — the reference currency changed since the simulation: converted at today's rate.
      const c = convert(out.maxBudgetRef!, out.refCurrency, ctx.referenceCurrency, ctx);
      if (!c) return null;
      budget = roundDisplayedBudget(c.amount);
    }
    const { monthlyMax: _ignored, priceMax: _old, ...rest } = query;
    const criteria = parseCatalogueCriteria({ ...rest, priceMax: budget.toFixed(0) }, Number((await this.index.today()).slice(0, 4)));
    const list = await this.catalogue.list(criteria, false);
    return { amount: budget.toFixed(2), currency: ctx.referenceCurrency, simulationId: sim.id, matchingCount: list.meta.total };
  }

  // ─── EP-11 ────────────────────────────────────────────────────────────────

  /** SIM-015 — computes AND writes the simulation anonymously, sets `dp_anon`; the same Idempotency-Key replays the same id. */
  async eligibility(req: Request, res: Response, body: unknown): Promise<{ status: number; body: EligibilityResponse }> {
    const anon = this.ensureAnon(req, res);
    const result = await this.idempotency.run(
      req,
      { route: 'public.simulations.eligibility', required: false },
      {
        prepare: async () => {
          this.limit(req, 'calc');
          const input = parseOrThrow(eligibilityInputSchemaFor(this.year()), body ?? {});
          const ctx = await this.context.load(this.clock.now(), input.propertyCountry);
          const linked = input.targetPriceLinked ? await this.linkedPrice(input.propertyId, input.lotId) : null;
          const { inputs, outputs } = computeEligibility(input, ctx, linked);
          return { input, ctx, linked, inputs, outputs };
        },
        execute: async (tx, p) => {
          const id = newId();
          const now = this.clock.now();
          const stored: StoredEligibilityInputs = { ...p.input, linkedPrice: p.linked };
          await tx.simulation.create({
            data: {
              id,
              type: 'ELIGIBILITY',
              anonymousId: anon,
              // SIM-033 — a signed-in client's simulation belongs to his record from the start (not saved until « Enregistrer »).
              clientId: sessionClientId(req),
              propertyId: p.input.propertyId ?? null,
              lotId: p.input.lotId ?? null,
              bankProductId: p.outputs.bestProductId,
              inputs: stored as never,
              outputs: p.outputs as never,
              parametersSnapshot: parametersSnapshot(p.ctx, p.outputs.products.map((x) => x.productId), p.outputs.rateDates) as never,
              isSaved: false,
              locale: 'fr',
              createdAt: now,
              updatedAt: now,
            },
          });
          // CAL-070 — a signed-in client's eligibility simulation changes his score (« Financement »)
          const owner = sessionClientId(req);
          if (owner) await refreshClientCaches(tx, owner, now, await this.settings.get('clients.inactiveAfterDays'));
          return { id, result: toEligibilityResult(p.outputs, p.inputs) };
        },
      },
    );
    return { status: result.status, body: result.body };
  }

  // ─── EP-12 ────────────────────────────────────────────────────────────────

  private async creditCompute(req: CreditRequest): Promise<{ ctx: SimContext; linked: (LinkedPrice | null)[]; response: CreditResponse }> {
    const ctx = await this.context.load(this.clock.now(), null);
    const linked = await Promise.all(req.scenarios.map((s) => (s.priceLinked && s.mode === 'FROM_PRICE' ? this.linkedPrice(s.propertyId, s.lotId) : Promise.resolve(null))));
    return { ctx, linked, response: computeCreditScenarios(req, ctx, (i) => linked[i] ?? null) };
  }

  /** `POST /public/simulations/credit` — computed, nothing written (CAL-112). */
  async credit(req: Request, body: unknown): Promise<CreditResponse> {
    this.limit(req, 'calc');
    const input = parseOrThrow(creditRequestSchema, body ?? {});
    return (await this.creditCompute(input)).response;
  }

  /** `POST /public/simulations` — writes a credit simulation, scenarios included; Idempotency-Key required (API-040). */
  async saveCredit(req: Request, res: Response, body: unknown): Promise<{ status: number; body: SimulationCreatedResponse }> {
    const anon = this.ensureAnon(req, res);
    const result = await this.idempotency.run(
      req,
      { route: 'public.simulations' },
      {
        prepare: async () => {
          this.limit(req, 'calc');
          const input = parseOrThrow(creditSaveSchema, body ?? {});
          const activeIndex = Math.min(input.activeIndex, input.scenarios.length - 1);
          const clientId = sessionClientId(req);
          if (clientId && input.isSaved) await this.assertSavedRoom(clientId);
          return { input, activeIndex, clientId, dossierId: clientId && input.isSaved ? await this.openDossierOf(clientId) : null, ...(await this.creditCompute({ scenarios: input.scenarios, activeIndex })) };
        },
        execute: async (tx, p) => {
          const id = newId();
          const now = this.clock.now();
          const active = p.input.scenarios[p.activeIndex]!;
          const stored: StoredCreditInputs = { scenarios: p.input.scenarios, activeIndex: p.activeIndex, linkedPrices: p.linked };
          // The monthly detail is recomputed from the inputs when needed; the stored outputs keep the years.
          const outputs = { ...p.response, scenarios: p.response.scenarios.map((s) => ({ ...s, schedule: s.schedule.map((y) => ({ ...y, months: [] })) })) };
          await tx.simulation.create({
            data: {
              id,
              type: 'CREDIT',
              anonymousId: anon,
              clientId: p.clientId,
              dossierId: p.dossierId,
              propertyId: active.propertyId ?? null,
              lotId: active.lotId ?? null,
              bankProductId: active.bankProductId ?? null,
              inputs: stored as never,
              outputs: outputs as never,
              parametersSnapshot: parametersSnapshot(
                p.ctx,
                p.input.scenarios.map((s) => s.bankProductId ?? null),
                // A converted scenario keeps the rates in force (CAL-013); the domain reports dates, not pairs, for credit.
                p.response.scenarios.some((s) => s.rateDate) ? Object.fromEntries(p.ctx.conversion.rates.map((r) => [`${r.base}/${r.quote}`, r.asOf])) : {},
              ) as never,
              isSaved: p.input.isSaved,
              locale: 'fr',
              createdAt: now,
              updatedAt: now,
            },
          });
          return { id };
        },
      },
    );
    return { status: result.status, body: result.body };
  }

  // ─── Actions on a written simulation (same dp_anon only, API-100) ─────────

  private async own(req: Request, id: string) {
    const anon = this.readAnon(req);
    const clientId = sessionClientId(req);
    if ((!anon && !clientId) || !/^[0-9a-f-]{36}$/i.test(id)) throw AppError.notFound();
    const owners = [...(anon ? [{ anonymousId: anon }] : []), ...(clientId ? [{ clientId }] : [])];
    const sim = await this.prisma.simulation.findFirst({ where: { id, OR: owners, type: { in: ['ELIGIBILITY', 'CREDIT'] } } });
    if (!sim) throw AppError.notFound();
    return sim;
  }

  /** « Enregistrer » a simulation already written: `isSaved = true` (SIM-032). */
  async markSaved(req: Request, id: string): Promise<SimulationCreatedResponse> {
    const sim = await this.own(req, id);
    const clientId = sessionClientId(req);
    if (!sim.isSaved) {
      // SIM-032 — signed in: saved in « Mes simulations » (30 at most, SFA-012) and attached to his open dossier.
      if (clientId) await this.assertSavedRoom(clientId);
      const dossierId = clientId && !sim.dossierId ? await this.openDossierOf(clientId) : null;
      await this.prisma.simulation.update({
        where: { id },
        data: { isSaved: true, ...(clientId ? { clientId } : {}), ...(dossierId ? { dossierId } : {}), updatedAt: this.clock.now() },
      });
    }
    return { id };
  }

  /** SFA-012 — 409 SIMULATIONS_LIMIT at thirty saved simulations. */
  async assertSavedRoom(clientId: string): Promise<void> {
    const n = await this.prisma.simulation.count({ where: { clientId, isSaved: true, type: { in: ['ELIGIBILITY', 'CREDIT'] } } });
    if (n >= SAVED_SIMULATIONS_LIMIT) throw AppError.conflictState('SIMULATIONS_LIMIT', { n: SAVED_SIMULATIONS_LIMIT });
  }

  /** SIM-032 — the client's open dossier (most recently active), to which a saved simulation is attached. */
  async openDossierOf(clientId: string): Promise<string | null> {
    const d = await this.prisma.dossier.findFirst({ where: { clientId, status: { in: ['OPEN', 'ON_HOLD'] }, deletedAt: null }, orderBy: { lastActivityAt: 'desc' }, select: { id: true } });
    return d?.id ?? null;
  }

  /**
   * « Recevoir par e-mail » — C_SIMULATION_RESULT with the PDF. The address is kept only in the row of this e-mail
   * (`Communication.toAddress`), never on the simulation; no client record is created (SIM-032). 3 per address per day.
   */
  async email(req: Request, id: string, body: unknown): Promise<void> {
    const { email } = parseOrThrow(simulationEmailSchema, body ?? {});
    const sim = await this.own(req, id);
    const key = `simulation.email:${this.ip.keyHash(email)}`;
    const wait = this.limiter.retryAfter(key, SIM_RATE_RULES.emailPerAddress);
    if (wait) throw AppError.rateLimited(wait);
    const pdf = await this.storedPdf(sim);
    const outcome = await this.mailer.sendTemplate({
      templateCode: 'C_SIMULATION_RESULT',
      to: email,
      dedupeKey: `C_SIMULATION_RESULT:${sim.id}:${recipientHash(email)}:${randomBytes(4).toString('hex')}`,
      triggeredBy: 'EVENT',
      links: { simulationId: sim.id },
      vars: { simulation: { id: sim.id, callbackPath: `/contact?objet=rappel&simulation=${sim.id}` } },
      greetingName: null,
      render: { simulationId: sim.id },
      attachments: [{ filename: pdf.filename, contentType: 'application/pdf', content: pdf.content }],
    });
    if (outcome === 'FAILED' || outcome === 'SUPPRESSED') {
      log('warn', 'simulation.email_not_sent', { outcome });
      throw new AppError(ErrorCode.INTERNAL_ERROR);
    }
    this.limiter.record(key, SIM_RATE_RULES.emailPerAddress);
  }

  // ─── PDF ──────────────────────────────────────────────────────────────────

  /** « Télécharger (PDF) » — inputs in the body, nothing written (SIM-032); 10 per IP per hour (SEC-070). */
  async pdf(req: Request, body: unknown): Promise<{ filename: string; content: Buffer }> {
    this.limit(req, 'pdf');
    const input = parseOrThrow(simulationPdfSchemaFor(this.year()), body ?? {});
    if (input.type === 'ELIGIBILITY') {
      const ctx = await this.context.load(this.clock.now(), input.inputs.propertyCountry);
      const linked = input.inputs.targetPriceLinked ? await this.linkedPrice(input.inputs.propertyId, input.inputs.lotId) : null;
      const { outputs } = computeEligibility(input.inputs, ctx, linked);
      return this.eligibilityPdf(input.inputs, linked, outputs, null);
    }
    const activeIndex = Math.min(input.activeIndex, input.scenarios.length - 1);
    const { ctx, response } = await this.creditCompute({ scenarios: input.scenarios, activeIndex });
    return this.creditPdf(input.scenarios, activeIndex, response, ctx, null);
  }

  /** The PDF of a stored simulation (also « Télécharger (PDF) » of EC-40). */
  async storedPdf(sim: { id: string; type: string; inputs: unknown; outputs: unknown }): Promise<{ filename: string; content: Buffer }> {
    if (sim.type === 'ELIGIBILITY') {
      const inputs = sim.inputs as StoredEligibilityInputs;
      return this.eligibilityPdf(inputs, inputs.linkedPrice ?? null, sim.outputs as EligibilityOutputs, sim.id);
    }
    const inputs = sim.inputs as StoredCreditInputs;
    const ctx = await this.context.load(this.clock.now(), null);
    return this.creditPdf(inputs.scenarios, inputs.activeIndex, sim.outputs as CreditResponse, ctx, sim.id);
  }

  private async company(): Promise<{ company: PdfCompany; timeZone: string }> {
    const s = await this.settings.all();
    return {
      company: {
        companyName: s['contact.companyName'],
        legalName: s['contact.legalName'],
        address: s['contact.address'],
        phone: s['contact.phone'],
        email: s['contact.email'],
        monthlyFootnote: s['legal.monthlyFootnote'],
        simulatorDisclaimer: s['legal.simulatorDisclaimer'],
        feesExcludedNote: s['legal.feesExcludedNote'],
      },
      timeZone: s['business.calendar.timezone'],
    };
  }

  private async propertyOf(propertyId: string | undefined | null) {
    if (!propertyId) return null;
    const row = (await this.index.rows()).find((r) => r.id === propertyId);
    return row ? this.property(row.reference).catch(() => null) : null;
  }

  private filename(kind: 'eligibilite' | 'credit'): string {
    return `simulation-${kind}-${this.clock.now().toISOString().slice(0, 10)}.pdf`;
  }

  private async eligibilityPdf(input: EligibilityInput, linked: LinkedPrice | null, outputs: EligibilityOutputs, reference: string | null) {
    const { company, timeZone } = await this.company();
    const countries = await this.prisma.country.findMany({ where: { code: { in: [input.countryOfResidence, input.propertyCountry] } }, select: { code: true, nameFr: true } });
    const names = new Map(countries.map((c) => [c.code, c.nameFr]));
    const model = eligibilityPdfModel({
      company,
      input,
      result: toEligibilityResult(outputs, eligibilityDomainInputs(input, linked)),
      reference,
      now: this.clock.now(),
      timeZone,
      countryName: (c) => names.get(c) ?? c,
      property: await this.propertyOf(input.propertyId),
    });
    return { filename: this.filename('eligibilite'), content: await this.pdfRenderer.render(model) };
  }

  private async creditPdf(scenarios: CreditInput[], activeIndex: number, response: CreditResponse, ctx: SimContext, reference: string | null) {
    const { company, timeZone } = await this.company();
    const model = creditPdfModel({
      company,
      scenarios,
      activeIndex,
      response,
      reference,
      now: this.clock.now(),
      timeZone,
      productLabel: (id) => {
        const p = id ? ctx.products.find((x) => x.id === id) : null;
        return creditProductLabel(p ? publicProduct(p) : null);
      },
      property: await this.propertyOf(scenarios[activeIndex]?.propertyId),
    });
    return { filename: this.filename('credit'), content: await this.pdfRenderer.render(model) };
  }
}
