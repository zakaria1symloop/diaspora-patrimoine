// DEM-002, CYC-001 — `POST /public/leads`: one transaction creates (or supplements, DEM-024) the request, with its
// client record, consents, dossier, first-contact deadline and `lead.created` event. E-mails leave afterwards from the
// outbox (AUT-003). Protection before the transaction (DEM-030…DEM-032): form token, rate limits, spam score.
import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode, FORM_TOKEN_HEADER, LEAD_COMPLETION_MINUTES, LEAD_HONEYPOT_FIELD, type LeadKind, type LeadSubmitRequest, type LeadSubmitResponse } from '@dp/contracts';
import { firstContactDueAt, localDate, type BusinessCalendar, type DossierStage } from '@dp/domain';
import type { Request } from 'express';
import { ENV, type Env } from '../config/env.js';
import { BusinessCalendarService, nextReference } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp, RateLimiter } from '../platform/rate-limit.js';
import { log } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { applyAssignment, lastTakenAt, loadAdvisors, pickAssignee } from './assignment.js';
import { CHALLENGE_MAX_FAILURES, EnvChallengeProvider } from './challenge.js';
import { buildSupplement, DUPLICATE_WINDOW_MS, type Supplement } from './duplicate.js';
import { verifyFormToken } from './form-token.js';
import { asDate, buildResponse, clientFacts, kindOf, LEAD_RATE_RULES, hashToken, parseLead, referrerDomain, validateCallbackDate } from './lead-input.js';
import { resolveObject } from './lead-objects.js';
import {
  OPENS_DOSSIER,
  openOrJoinDossier,
  privacyPolicyVersion,
  refreshClientCaches,
  upsertClientForLead,
  writeConsents,
  type DossierOutcome,
} from './lead-records.js';
import { checkMx, emailDomain, IP_BURST_WINDOW_MS, spamScore, spamSignals, spamVerdict, type MxStatus, type SpamSignalHit, type SpamVerdict } from './spam.js';
import { SimulationContextService, type Conversion } from '../simulations/context.js';
import { anonymousIdOf, attachSimulations, loadFollowupSimulation, mergeFacts, simulationFacts, type FollowupSimulation } from './simulation-followup.js';
import { findClientByEmail } from './lead-records.js';
import { ensureInvitedAccount } from '../identity/lead-account.js';
import type { ClientFacts } from './client-record.js';
import { guidedFacts, guidedLeadCriteria } from './guided-facts.js';
import { loadAssistantLead } from './assistant-lead.js';


type Fields = Record<string, unknown> & { email: string };

interface Prepared {
  input: LeadSubmitRequest;
  kind: LeadKind;
  fields: Fields;
  ipHash: string;
  userAgent: string | null;
  signals: SpamSignalHit[];
  score: number;
  verdict: SpamVerdict;
  needsReview: boolean;
  mx: MxStatus;
  cal: BusinessCalendar;
  referenceCurrency: string;
  /** ASS-010 — `features.monthlyBudgetSearch` at the time of the submission. */
  monthlyBudgetSearch: boolean;
  /** DEM-016 — SIMULATION_FOLLOWUP only: the simulation joined to the request, and the rates for MOD-303. */
  simulation: { sim: FollowupSimulation; conversion: Conversion } | null;
}


@Injectable()
export class SubmitLeadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly outbox: OutboxWriter,
    private readonly idempotency: IdempotencyService,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
    private readonly challenge: EnvChallengeProvider,
    private readonly simContext: SimulationContextService,
    @Inject(ENV) private readonly env: Env,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  async submit(req: Request, body: unknown): Promise<{ status: number; body: LeadSubmitResponse }> {
    let emailKey: string | null = null;
    const result = await this.idempotency.run(req, { route: 'public.leads' }, {
      prepare: async () => {
        const prepared = await this.prepare(req, body);
        emailKey = this.ip.keyHash(prepared.fields.email);
        return prepared;
      },
      execute: (tx, prepared: Prepared) => this.execute(tx, prepared),
    });
    if (!result.replayed) {
      // DEM-032 — only accepted submissions are counted (a refused one does not consume the visitor's allowance).
      const ipKey = this.ip.hash(req);
      this.limiter.record(`lead:ip:h:${ipKey}`, LEAD_RATE_RULES.ipHour);
      this.limiter.record(`lead:ip:d:${ipKey}`, LEAD_RATE_RULES.ipDay);
      if (emailKey) this.limiter.record(`lead:email:d:${emailKey}`, LEAD_RATE_RULES.emailDay);
      this.dispatcher.wake();
    }
    return { status: result.status, body: result.body };
  }

  /** Rate-limit check (no recording). Throws 429 with Retry-After (DEM-032: the web chooses the sentence from the delay). */
  checkRate(req: Request, email: string | null): void {
    const ipKey = this.ip.hash(req);
    const waits = [
      this.limiter.retryAfter(`lead:ip:h:${ipKey}`, LEAD_RATE_RULES.ipHour),
      this.limiter.retryAfter(`lead:ip:d:${ipKey}`, LEAD_RATE_RULES.ipDay),
      email ? this.limiter.retryAfter(`lead:email:d:${this.ip.keyHash(email)}`, LEAD_RATE_RULES.emailDay) : 0,
    ];
    const wait = Math.max(...waits);
    if (wait > 0) throw AppError.rateLimited(wait);
  }

  private async prepare(req: Request, body: unknown): Promise<Prepared> {
    const now = this.clock.now();
    // DEM-030 point 2 — the form token: missing or forged → 400; expired → 410 (the form renews it and replays once).
    const header = req.headers[FORM_TOKEN_HEADER.toLowerCase()];
    const token = verifyFormToken(this.env.LINK_SIGNING_KEY, Array.isArray(header) ? header[0] : header, now);
    if (!token.ok) throw new AppError(token.reason === 'EXPIRED' ? ErrorCode.GONE : ErrorCode.BAD_REQUEST);

    const input = parseLead(body);
    if (token.claims.form !== input.form) throw new AppError(ErrorCode.BAD_REQUEST);
    await this.checkFeatures(input);
    const kind = kindOf(input);
    const fields = { ...input.fields } as Fields;
    this.checkRate(req, fields.email);

    const [cal, threshold, referenceCurrency, monthlyBudgetSearch] = await Promise.all([
      this.calendar.load(),
      this.settings.get('leads.spamThreshold'),
      this.settings.get('display.referenceCurrency'),
      this.settings.get('features.monthlyBudgetSearch'),
    ]);
    if (input.form === 'PROPERTY_INTEREST' && !monthlyBudgetSearch) fields.budgetKind = 'TOTAL'; // DEM-011
    if ('budget' in fields || 'downPayment' in fields) fields.budgetCurrency = referenceCurrency; // DEM-007
    if (input.form === 'GUIDED_SEARCH' && input.fields.assistantConversationId) {
      // ASS-052, IA-013 — from the conversational assistant: criteria, properties shown and summary come from the
      // conversation the server keeps; its criteria, as answers, complete the client record (ASS-031).
      const ai = await loadAssistantLead(this.prisma, input.fields.assistantConversationId, now);
      input.fields.answers = ai.answers;
      fields.answers = ai.answers;
      fields.criteria = ai.criteria;
      fields.propertyReferences = ai.propertyReferences;
      fields.assistant = ai.summary;
      const budget = ai.answers.budget;
      if (budget && budget !== 'UNKNOWN') fields.budgetCurrency = referenceCurrency; // DEM-007
    } else if (input.form === 'GUIDED_SEARCH') {
      // ASS-030 — the criteria stored are those the answers produce (never the browser's word for it).
      fields.criteria = guidedLeadCriteria(input.fields.answers, Number(localDate(now, cal).slice(0, 4)), monthlyBudgetSearch);
      const budget = input.fields.answers.budget;
      if (budget && budget !== 'UNKNOWN') fields.budgetCurrency = referenceCurrency; // DEM-007
    }
    validateCallbackDate(fields.preferredCallbackDate as string | undefined, now, cal);
    await this.checkCountry(input);
    const simulation =
      input.form === 'SIMULATION_FOLLOWUP'
        ? { sim: await loadFollowupSimulation(this.prisma, input.simulationId, anonymousIdOf(req)), conversion: await this.simContext.conversion() }
        : null;

    const ipHash = this.ip.fingerprint(req);
    const message = (fields.message as string | undefined) ?? (fields.freeText as string | undefined) ?? null;
    const [recentFromIp, duplicateMessage, mx] = await Promise.all([
      this.prisma.lead.count({ where: { ipHash, createdAt: { gte: new Date(now.getTime() - IP_BURST_WINDOW_MS) } } }),
      message
        ? this.prisma.lead
            .count({ where: { message, email: { not: fields.email }, createdAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) } } })
            .then((n) => n > 0)
        : Promise.resolve(false),
      checkMx(emailDomain(fields.email), 500),
    ]);
    const honeypot = (body as Record<string, unknown> | null)?.[LEAD_HONEYPOT_FIELD];
    const signals = spamSignals({
      honeypotFilled: typeof honeypot === 'string' ? honeypot.trim() !== '' : honeypot !== undefined && honeypot !== null,
      elapsedMs: now.getTime() - token.claims.openedAt,
      message,
      email: fields.email,
      recentFromIp,
      duplicateMessage,
      mx,
      phone: fields.phone as string | undefined,
      countryOfResidence: (fields.countryOfResidence as string | undefined) ?? (fields.country as string | undefined),
    });
    const verdict = spamVerdict(signals, threshold);
    let needsReview = verdict === 'SPAM_REVIEW';
    if (verdict === 'CHALLENGE') {
      needsReview = true; // « marquée À vérifier » in every case of this zone
      await this.runChallenge(input.challengeToken, token.claims.nonce);
    }
    const userAgent = (req.headers['user-agent'] ?? '').slice(0, 400) || null;
    return { input, kind, fields, ipHash, userAgent, signals, score: spamScore(signals), verdict, needsReview, mx, cal, referenceCurrency, monthlyBudgetSearch, simulation };
  }

  /** DEM-030 point 4 — challenge only when a service is configured; three failures: accepted, to review. */
  private async runChallenge(proof: string | undefined, nonce: string): Promise<void> {
    if (!this.challenge.configured) return;
    const failuresKey = `lead:challenge:${nonce}`;
    const rule = { limit: CHALLENGE_MAX_FAILURES, windowSeconds: 86_400 };
    if (this.limiter.retryAfter(failuresKey, rule) > 0) return; // three failures already
    if (proof && (await this.challenge.verify(proof))) return;
    if (proof) this.limiter.record(failuresKey, rule);
    if (this.limiter.retryAfter(failuresKey, rule) > 0) return;
    throw new AppError(ErrorCode.CHALLENGE_REQUIRED);
  }

  private async checkFeatures(input: LeadSubmitRequest): Promise<void> {
    const off = (field: string) => AppError.validation([{ field, code: 'INVALID_CHOICE' }]);
    if (input.form === 'PROJECTION_REQUEST' && !(await this.settings.get('features.projectionRequest'))) throw off('form');
    if (input.form === 'CALLBACK_REQUEST' && !(await this.settings.get('features.callbackRequest'))) throw off('form');
    if (input.form === 'PARTNER_REQUEST' && !(await this.settings.get('features.partnerForm'))) throw off('form');
    if (input.form === 'GUIDED_SEARCH' && (await this.settings.get('features.assistant.mode')) === 'OFF') throw off('form');
    const subject = (input.fields as { subject?: string }).subject;
    if (subject === 'CAFE' && !(await this.settings.get('features.cafe'))) throw off('fields.subject');
  }

  /** TRV-044 — the country must be one of the reference list (foreign key of `Client.countryOfResidence`). */
  private async checkCountry(input: LeadSubmitRequest): Promise<void> {
    const f = input.fields as { countryOfResidence?: string; country?: string };
    const code = f.countryOfResidence ?? f.country;
    if (!code) return;
    const found = await this.prisma.country.findUnique({ where: { code }, select: { code: true } });
    if (!found) throw AppError.validation([{ field: f.countryOfResidence ? 'fields.countryOfResidence' : 'fields.country', code: 'INVALID_CHOICE' }]);
  }

  private async execute(tx: Tx, p: Prepared): Promise<LeadSubmitResponse> {
    const now = this.clock.now();
    const { input, kind, fields } = p;
    // FIA-020 spirit — one submission at a time per address: the record lookup, the duplicate check (DEM-024) and the
    // creation cannot interleave with a concurrent submission for the same e-mail.
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `lead:${fields.email}`);

    const object =
      kind === 'PROPERTY_INTEREST' || kind === 'CALLBACK_REQUEST' || input.form === 'CONTACT_MESSAGE' || kind === 'SIMULATION_FOLLOWUP'
        ? await resolveObject(tx, input.context, kind === 'PROPERTY_INTEREST')
        : { property: null, program: null, lotId: null, outcome: null, candidateStatus: 'INTERESTED' as const };
    const regionId = await this.regionOf(tx, fields.regionSlug as string | undefined);

    const completionToken = kind === 'PROJECTION_REQUEST' ? randomBytes(32).toString('base64url') : null;
    const completion = completionToken
      ? { completionTokenHash: hashToken(completionToken), completionExpiresAt: new Date(now.getTime() + LEAD_COMPLETION_MINUTES * 60_000) }
      : {};
    const response = buildResponse(kind, fields, object.outcome, completionToken);
    const propertyId = object.property?.id ?? null;
    const programId = object.property ? null : (object.program?.id ?? null);

    // DEM-031 — honeypot or score at the threshold: created directly as SPAM; no record, no dossier, no e-mail.
    if (p.verdict === 'SPAM' || p.verdict === 'SPAM_REVIEW') {
      await this.createLead(tx, p, { now, kind, clientId: null, propertyId, programId, lotId: object.lotId, status: 'SPAM', slaDueAt: null, completion });
      log('info', 'lead.spam', { verdict: p.verdict, score: p.score, signals: p.signals.map((s) => s.code) });
      return response;
    }

    // DEM-024 — a second identical request within 24 hours supplements the first one.
    const earlier = await tx.lead.findFirst({
      where: {
        email: fields.email,
        kind,
        status: { in: ['NEW', 'IN_PROGRESS'] },
        createdAt: { gt: new Date(now.getTime() - DUPLICATE_WINDOW_MS) },
        ...(propertyId ? { propertyId } : { propertyId: null, programId }),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (earlier) {
      await this.supplement(tx, p, earlier, now, completion);
      return response;
    }

    const cal = p.cal;
    const facts = await this.factsWithSimulation(tx, p, await this.withGuidedFacts(tx, p, clientFacts(input, fields, regionId, p.referenceCurrency)));
    const reference = await nextReference(tx, 'LEAD', now, cal.timeZone);
    let client: Awaited<ReturnType<typeof upsertClientForLead>> | null = null;
    if (kind !== 'PARTNER_REQUEST') {
      client = await upsertClientForLead(tx, this.outbox, {
        email: fields.email,
        facts,
        locale: input.tracking.locale,
        utm: (input.tracking.utm as Record<string, unknown> | undefined) ?? null,
        emailDoubtful: p.mx === 'NONE',
        leadReference: reference,
        now,
      });
      // DEM-021 — « Créer mon espace client en même temps »: an INVITED account for a record without one; the
      // acknowledgement carries its activation link (one e-mail). The screen says the same thing in every case.
      if (fields.createAccount === true) await ensureInvitedAccount(tx, client.client, now);
    }
    // CAL-061 — every request gets its first-contact deadline, except a partner application.
    const slaDays = await this.settings.get('sla.firstContactBusinessDays');
    const slaDueAt = kind === 'PARTNER_REQUEST' ? null : firstContactDueAt(now, cal, slaDays, (fields.preferredCallbackDate as string | undefined) ?? null).dueAt;
    const lead = await this.createLead(tx, p, {
      now,
      kind,
      reference,
      clientId: client?.client.id ?? null,
      propertyId,
      programId,
      lotId: object.lotId,
      status: 'NEW',
      slaDueAt,
      completion,
    });

    await writeConsents(tx, this.outbox, {
      leadId: lead.id,
      clientId: client?.client.id ?? null,
      kind,
      contactKey: fields.consentKey as never,
      marketing: fields.marketingOptIn === true ? { key: fields.marketingKey as never } : null,
      privacyVersion: await privacyPolicyVersion(tx, now),
      ipHash: p.ipHash,
      userAgent: p.userAgent,
      givenAt: now,
      now,
    });

    let dossier: DossierOutcome = { attachment: 'NONE', dossier: null, ongoingDossierId: null };
    if (client && OPENS_DOSSIER.has(kind)) {
      dossier = await openOrJoinDossier(tx, this.outbox, {
        lead: { id: lead.id, reference, kind },
        client: client.client,
        object,
        financingPreference: (fields.financingPreference as string | undefined) ?? null,
        now,
        cal,
        stageSlaDays: await this.stageSlaDays(),
      });
    }

    if (p.simulation) await attachSimulations(tx, p.simulation.sim, client?.client.id ?? null, now); // DEM-016, SIM-034
    if (client) {
      await this.autoAssign(tx, { leadId: lead.id, client: client.client, dossier, slaDueAt, now, cal });
      await refreshClientCaches(tx, client.client.id, now, await this.settings.get('clients.inactiveAfterDays'));
    }

    await this.outbox.add(
      tx,
      {
        type: 'lead.created',
        aggregateType: 'Lead',
        aggregateId: lead.id,
        payload: {
          kind,
          source: 'WEB_FORM',
          propertyId,
          attachment: dossier.attachment,
          ongoingDossierId: dossier.ongoingDossierId,
          // TRV-043 — no answer within 500 ms: the MX lookup is redone in the background.
          mxRecheck: p.mx === 'UNKNOWN',
        },
      },
      now,
    );
    return response;
  }

  private async createLead(
    tx: Tx,
    p: Prepared,
    a: {
      now: Date;
      kind: LeadKind;
      reference?: string;
      clientId: string | null;
      propertyId: string | null;
      programId: string | null;
      lotId: string | null;
      status: 'NEW' | 'SPAM';
      slaDueAt: Date | null;
      completion: { completionTokenHash?: string; completionExpiresAt?: Date };
    },
  ) {
    const { input, fields } = p;
    const t = input.tracking;
    const reference = a.reference ?? (await nextReference(tx, 'LEAD', a.now, p.cal.timeZone));
    return tx.lead.create({
      data: {
        id: newId(),
        reference,
        kind: a.kind,
        source: 'WEB_FORM',
        clientId: a.clientId,
        firstName: (fields.firstName as string | undefined) ?? null,
        lastName: (fields.lastName as string | undefined) ?? null,
        email: fields.email,
        phone: (fields.phone as string | undefined) ?? null,
        propertyId: a.propertyId,
        programId: a.programId,
        lotId: a.lotId,
        // DEM-025 — every field as entered, what the visitor saw, and the second screen to come.
        payload: { form: input.form, formVersion: input.formVersion, fields, context: input.context, step2: null } as never,
        message: (fields.message as string | undefined) ?? null,
        subject: ((fields.subject as string | undefined) ?? null) as never,
        preferredCallbackDate: asDate(fields.preferredCallbackDate as string | undefined),
        preferredSlot: ((fields.preferredSlot as string | undefined) ?? null) as never,
        callerTimezone: t.callerTimezone ?? null,
        locale: t.locale,
        utm: (t.utm ?? undefined) as never,
        referrer: referrerDomain(t.referrer),
        landingPath: t.landingPath ?? null,
        submittedFromPath: t.submittedFromPath?.split('?')[0] ?? null,
        // DEM-016 — the simulation joined to the request.
        simulationId: p.simulation?.sim.id ?? null,
        ipHash: p.ipHash,
        userAgent: p.userAgent,
        spamScore: p.score,
        spamSignals: p.signals as never,
        needsReview: p.needsReview,
        status: a.status,
        slaDueAt: a.slaDueAt,
        ...a.completion,
        createdAt: a.now,
        updatedAt: a.now,
      },
    });
  }

  /** DEM-024 — nothing new is created; what differs is kept on the first request, empty client fields are completed. */
  private async supplement(
    tx: Tx,
    p: Prepared,
    earlier: { id: string; reference: string; clientId: string | null; payload: unknown; message: string | null; supplements: unknown; kind: string },
    now: Date,
    completion: { completionTokenHash?: string; completionExpiresAt?: Date },
  ): Promise<void> {
    const { input, fields, kind } = p;
    await tx.$queryRawUnsafe(`SELECT id FROM leads WHERE id = $1::uuid FOR UPDATE`, earlier.id);
    const previousFields = ((earlier.payload as { fields?: Record<string, unknown> })?.fields ?? {}) as Record<string, unknown>;
    const entry: Supplement = buildSupplement(previousFields, earlier.message, fields, now, kind === 'PROJECTION_REQUEST');
    const supplements = [...((earlier.supplements as Supplement[] | null) ?? []), entry];
    await tx.lead.update({ where: { id: earlier.id }, data: { supplements: supplements as never, ...completion, updatedAt: now } });

    if (earlier.clientId) {
      const regionId = await this.regionOf(tx, fields.regionSlug as string | undefined);
      await upsertClientForLead(tx, this.outbox, {
        email: fields.email,
        facts: await this.factsWithSimulation(tx, p, await this.withGuidedFacts(tx, p, clientFacts(input, fields, regionId, p.referenceCurrency))),
        locale: input.tracking.locale,
        utm: null,
        emailDoubtful: p.mx === 'NONE',
        leadReference: earlier.reference,
        now,
      });
    }
    // The consent box was checked again: its proof is kept too (MOD-106), attached to the first request.
    await writeConsents(tx, this.outbox, {
      leadId: earlier.id,
      clientId: earlier.clientId,
      kind,
      contactKey: fields.consentKey as never,
      marketing: fields.marketingOptIn === true ? { key: fields.marketingKey as never } : null,
      privacyVersion: await privacyPolicyVersion(tx, now),
      ipHash: p.ipHash,
      userAgent: p.userAgent,
      givenAt: now,
      now,
    });
    if (p.simulation) {
      // DEM-016 — a supplemented follow-up still joins its simulation (to the first request when it had none).
      await tx.lead.updateMany({ where: { id: earlier.id, simulationId: null }, data: { simulationId: p.simulation.sim.id } });
      await attachSimulations(tx, p.simulation.sim, earlier.clientId, now);
    }
    if (earlier.clientId) await refreshClientCaches(tx, earlier.clientId, now, await this.settings.get('clients.inactiveAfterDays'));
    await this.outbox.add(
      tx,
      {
        type: 'lead.supplemented',
        aggregateType: 'Lead',
        aggregateId: earlier.id,
        payload: { changedFields: Object.keys(entry.fields).concat(entry.message ? ['message'] : []), supplementIndex: supplements.length - 1 },
      },
      now,
    );
  }

  /** ASS-031 — the answers of the guided assistant complete the empty preference fields of the record. */
  private async withGuidedFacts(tx: Tx, p: Prepared, facts: ClientFacts): Promise<ClientFacts> {
    if (p.input.form !== 'GUIDED_SEARCH') return facts;
    const answers = p.input.fields.answers;
    const slugs = Array.isArray(answers.region) ? answers.region : [];
    const regions = slugs.length ? await tx.region.findMany({ where: { slug: { in: slugs }, isActive: true }, select: { id: true, slug: true } }) : [];
    const ids = slugs.map((slug) => regions.find((r) => r.slug === slug)?.id).filter((id): id is string => Boolean(id));
    return { ...facts, ...guidedFacts(answers, ids, p.referenceCurrency, p.monthlyBudgetSearch) };
  }

  /** DEM-016, MOD-300, MOD-303 — the simulation completes what the form did not say, in the record's currencies. */
  private async factsWithSimulation(tx: Tx, p: Prepared, facts: ReturnType<typeof clientFacts>): Promise<ReturnType<typeof clientFacts>> {
    if (!p.simulation) return facts;
    const record = await findClientByEmail(tx, p.fields.email);
    return mergeFacts(facts, simulationFacts(p.simulation.sim, record, p.simulation.conversion));
  }

  /** CRM-020 — automatic assignment, then CYC-003 effects. */
  private async autoAssign(
    tx: Tx,
    a: { leadId: string; client: { id: string; assignedAgentId: string | null }; dossier: DossierOutcome; slaDueAt: Date | null; now: Date; cal: BusinessCalendar },
  ): Promise<void> {
    const advisors = await loadAdvisors(tx);
    if (advisors.length === 0) return;
    const mode = await this.settings.get('leads.assignmentMode');
    const joined = a.dossier.attachment === 'JOINED_DOSSIER' ? a.dossier.dossier : null;
    const agentId = pickAssignee({
      joinedDossierAgentId: joined?.assignedAgentId ?? null,
      referentId: a.client.assignedAgentId,
      advisors,
      mode,
      lastTakenAt: mode === 'ROUND_ROBIN' ? await lastTakenAt(tx, advisors.map((x) => x.userId)) : new Map(),
      deadline: a.slaDueAt,
      now: a.now,
      cal: a.cal,
    });
    if (!agentId) return;
    await applyAssignment(tx, this.outbox, {
      leadId: a.leadId,
      agentId,
      clientId: a.client.id,
      dossier: a.dossier.dossier,
      now: a.now,
      cal: a.cal,
      stageSlaDays: await this.stageSlaDays(),
    });
  }

  private async stageSlaDays(): Promise<Record<DossierStage, number>> {
    const stages: DossierStage[] = ['INTEREST', 'QUALIFICATION', 'MATCHING', 'DOCUMENTS', 'BANK_REVIEW', 'APPROVED', 'ACQUISITION'];
    const out = {} as Record<DossierStage, number>;
    for (const s of stages) out[s] = await this.settings.get(`sla.stage.${s}`);
    return out;
  }

  private async regionOf(tx: Tx, slug: string | undefined): Promise<string | null> {
    if (!slug) return null;
    const region = await tx.region.findFirst({ where: { slug, isActive: true }, select: { id: true } });
    if (!region) throw AppError.validation([{ field: 'fields.regionSlug', code: 'INVALID_CHOICE' }]);
    return region.id;
  }
}
