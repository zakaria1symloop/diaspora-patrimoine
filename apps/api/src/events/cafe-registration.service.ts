// API-100 Cafés — `POST /public/events/{slug}/registrations` (CAF-020 … CAF-026) and the « Gérer mon inscription » routes
// by token (CAF-030 … CAF-032, CYC-185 … CYC-187). Every write takes the Café's row lock first (MOD-410). E-mails leave
// from the outbox after the commit (registration-mail.handler.ts).
import { Inject, Injectable } from '@nestjs/common';
import {
  CAFE_REGISTRATION_FORM,
  CAFE_TOPIC_TO_EVENT_TOPIC,
  EVENT_TOPIC_TO_CAFE_TOPIC,
  ErrorCode,
  FORM_TOKEN_HEADER,
  LEAD_HONEYPOT_FIELD,
  cafeRegistrationCancelSchema,
  cafeRegistrationSchema,
  cafeRegistrationUpdateSchema,
  type CafeRegistrationRequest,
  type CafeRegistrationResponse,
  type CafeRegistrationView,
} from '@dp/contracts';
import type { Request } from 'express';
import { ENV, type Env } from '../config/env.js';
import { verifyFormToken } from '../leads/form-token.js';
import { privacyPolicyVersion, refreshClientCaches, upsertClientForLead, writeConsents } from '../leads/lead-records.js';
import { checkMx, emailDomain, IP_BURST_WINDOW_MS, spamScore, spamSignals, spamVerdict, type MxStatus } from '../leads/spam.js';
import { DUPLICATE_WINDOW_MS } from '../leads/duplicate.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp, RateLimiter, type RateRule } from '../platform/rate-limit.js';
import { log } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { EventsPublicService } from './events-public.service.js';
import { RegistrationDocuments } from './registration-documents.js';
import {
  anonymousAlreadyRegistered,
  icsUrlPath,
  manageUrlPath,
  registrationDecision,
  registrationRefusal,
  seatChange,
  seatsLeft,
  tokenHash,
  TOKEN_RE,
  uniqueAccessCode,
} from './registration-rules.js';
import { lockEvent, promoteWaitlist } from './waitlist.js';

/** SEC-070 — Café registrations: 10 per IP per hour; DEM-032 (CAF-026 « comme pour les demandes »): 5 per address per day. */
export const CAFE_RATE_RULES = {
  ipHour: { limit: 10, windowSeconds: 3600 },
  emailDay: { limit: 5, windowSeconds: 86_400 },
} as const satisfies Record<string, RateRule>;

/** CAF-026 — reason of the refusal of a registration whose spam score reaches the threshold (or honeypot filled). */
export const SPAM_REFUSAL_REASON = 'REGISTRATION_REFUSED';

interface Prepared {
  slug: string;
  input: CafeRegistrationRequest;
  ipHash: string;
  userAgent: string | null;
  mx: MxStatus;
  /** The client record of the signed-in client (CAF-024 « client connecté », CYC-186), else null. */
  sessionClientId: string | null;
}

const REGISTRATION_EVENT_SELECT = {
  id: true, reference: true, slug: true, title: true, locationLabel: true, cityName: true, venueName: true, venueAddress: true,
  venueNotes: true, startsAt: true, endsAt: true, timezone: true, capacity: true, maxSeatsPerRegistration: true,
  registrationOpensAt: true, registrationClosesAt: true, status: true, cancelReason: true, seatsTaken: true, version: true, deletedAt: true,
} as const;

type RegistrationWithEvent = NonNullable<Awaited<ReturnType<CafeRegistrationService['findByToken']>>>;

@Injectable()
export class CafeRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly outbox: OutboxWriter,
    private readonly idempotency: IdempotencyService,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
    private readonly docs: RegistrationDocuments,
    private readonly events: EventsPublicService,
    @Inject(ENV) private readonly env: Env,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  private async enabled(): Promise<void> {
    if (!(await this.settings.get('features.cafe'))) throw AppError.notFound(); // NAV-003
  }

  // ─── Registration (CAF-021) ─────────────────────────────────────────────

  async register(req: Request, slug: string, body: unknown, sessionClientId: string | null = null): Promise<{ status: number; body: CafeRegistrationResponse }> {
    await this.enabled();
    let email: string | null = null;
    const result = await this.idempotency.run(req, { route: 'public.cafe.registrations' }, {
      prepare: async () => {
        const p = { ...(await this.prepare(req, slug, body)), sessionClientId };
        email = p.input.email;
        return p;
      },
      execute: (tx, p: Prepared) => this.execute(tx, p),
    });
    if (!result.replayed) {
      // Only accepted registrations are counted (DEM-032): a refused one does not consume the visitor's allowance.
      this.limiter.record(`cafe:ip:h:${this.ip.hash(req)}`, CAFE_RATE_RULES.ipHour);
      if (email) this.limiter.record(`cafe:email:d:${this.ip.keyHash(email)}`, CAFE_RATE_RULES.emailDay);
      this.dispatcher.wake();
    }
    return { status: result.status, body: result.body };
  }

  private checkRate(req: Request, email: string): void {
    const wait = Math.max(
      this.limiter.retryAfter(`cafe:ip:h:${this.ip.hash(req)}`, CAFE_RATE_RULES.ipHour),
      this.limiter.retryAfter(`cafe:email:d:${this.ip.keyHash(email)}`, CAFE_RATE_RULES.emailDay),
    );
    if (wait > 0) throw AppError.rateLimited(wait);
  }

  /** CAF-026 — form token, limits, spam score (DEM-030 … DEM-032), before and outside the transaction. */
  private async prepare(req: Request, slug: string, body: unknown): Promise<Prepared> {
    const now = this.clock.now();
    const header = req.headers[FORM_TOKEN_HEADER.toLowerCase()];
    const token = verifyFormToken(this.env.LINK_SIGNING_KEY, Array.isArray(header) ? header[0] : header, now);
    if (!token.ok) throw new AppError(token.reason === 'EXPIRED' ? ErrorCode.GONE : ErrorCode.BAD_REQUEST);
    if (token.claims.form !== CAFE_REGISTRATION_FORM) throw new AppError(ErrorCode.BAD_REQUEST);

    const input = parseOrThrow(cafeRegistrationSchema, body);
    if (input.topics.includes('ISLAMIC_FINANCING') && !(await this.settings.get('features.islamicFinance'))) {
      throw AppError.validation([{ field: 'topics', code: 'INVALID_CHOICE' }]);
    }
    this.checkRate(req, input.email);

    const ipHash = this.ip.fingerprint(req);
    const questions = input.questions ?? null;
    const [threshold, recentFromIp, duplicateMessage, mx] = await Promise.all([
      this.settings.get('leads.spamThreshold'),
      this.prisma.consent.count({ where: { ipHash, source: 'cafe:registration', type: 'CONTACT_REQUEST', createdAt: { gte: new Date(now.getTime() - IP_BURST_WINDOW_MS) } } }),
      questions
        ? this.prisma.eventRegistration
            .count({ where: { questions, email: { not: input.email }, createdAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) } } })
            .then((n) => n > 0)
        : Promise.resolve(false),
      checkMx(emailDomain(input.email), 500),
    ]);
    const honeypot = (body as Record<string, unknown> | null)?.[LEAD_HONEYPOT_FIELD];
    const signals = spamSignals({
      honeypotFilled: typeof honeypot === 'string' ? honeypot.trim() !== '' : honeypot !== undefined && honeypot !== null,
      elapsedMs: now.getTime() - token.claims.openedAt,
      message: questions,
      email: input.email,
      recentFromIp,
      duplicateMessage,
      mx,
      phone: input.phone ?? null,
      countryOfResidence: null,
    });
    const verdict = spamVerdict(signals, threshold);
    // CAF-026 — at or over the threshold the registration is NOT created (it would hold a real seat). The challenge
    // zone of DEM-030 point 4 is not applied: the Café rule names the threshold only.
    if (verdict === 'SPAM' || verdict === 'SPAM_REVIEW') {
      log('info', 'cafe.registration_refused', { verdict, score: spamScore(signals), signals: signals.map((s) => s.code) });
      throw AppError.conflictState(SPAM_REFUSAL_REASON);
    }
    const userAgent = (req.headers['user-agent'] ?? '').slice(0, 400) || null;
    return { slug, input, ipHash, userAgent, mx, sessionClientId: null };
  }

  private async execute(tx: Tx, p: Prepared): Promise<CafeRegistrationResponse> {
    const now = this.clock.now();
    const { input } = p;
    const eventId = await lockEvent(tx, { slug: p.slug }); // MOD-410
    if (!eventId) throw AppError.notFound();
    const e = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: REGISTRATION_EVENT_SELECT });
    if (e.status === 'DRAFT') throw AppError.notFound();

    // CAF-025 — closed, cancelled or started during the input: nothing is created.
    const refusal = registrationRefusal(e, now);
    if (refusal) throw AppError.conflictState(refusal);
    if (input.seats > e.maxSeatsPerRegistration) {
      throw AppError.validation([{ field: 'seats', code: 'OUT_OF_RANGE', params: { n: e.maxSeatsPerRegistration, max: e.maxSeatsPerRegistration } }]);
    }
    // CAF-022 — not enough seats and no waiting list asked: nothing is created (the key is freed: 4xx, API-040).
    const decision = registrationDecision(seatsLeft(e), input.seats, input.waitlist);
    if (!decision.ok) throw AppError.conflictState(decision.reason, decision.reason === 'NOT_ENOUGH_SEATS' ? { n: decision.n } : null);

    // CAF-024 — already registered (same address, not cancelled). Decided AFTER the seat check, so that the answer of
    // a refusal never depends on the address either (TRV-112).
    const existing = await tx.eventRegistration.findFirst({
      where: { eventId, email: input.email, status: { not: 'CANCELLED' } },
      select: { id: true, clientId: true, status: true, seats: true, checkInCode: true },
    });
    if (existing && p.sessionClientId && existing.clientId === p.sessionClientId && (existing.status === 'REGISTERED' || existing.status === 'WAITLISTED')) {
      // CYC-186 — signed in: his registration is UPDATED (seats within the free seats, questions, topics), and the
      // confirmation goes out again.
      let freed = false;
      if (input.seats !== existing.seats) {
        const change = seatChange({ status: existing.status, current: existing.seats, requested: input.seats, left: seatsLeft(e), maxPerRegistration: e.maxSeatsPerRegistration });
        if (!change.ok && change.reason === 'NOT_ENOUGH_SEATS') throw AppError.conflictState('NOT_ENOUGH_SEATS', { n: change.n });
        if (!change.ok) throw AppError.validation([{ field: 'seats', code: 'OUT_OF_RANGE', params: { n: change.max, max: change.max } }]);
        freed = change.freed;
        await tx.event.update({ where: { id: eventId }, data: { seatsTaken: { increment: change.seatsTakenDelta }, waitlistSeats: { increment: change.waitlistDelta } } });
      }
      await tx.eventRegistration.update({
        where: { id: existing.id },
        data: {
          seats: input.seats,
          questions: input.questions || null,
          topics: (input.topics ?? []).map((t) => CAFE_TOPIC_TO_EVENT_TOPIC[t]),
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      if (freed) await promoteWaitlist(tx, this.outbox, eventId, now);
      await this.outbox.add(tx, { type: 'registration.confirmation_requested', aggregateType: 'EventRegistration', aggregateId: existing.id, payload: { eventId } }, now);
      const token = this.docs.token(existing.id);
      const registered = existing.status === 'REGISTERED';
      return {
        status: existing.status,
        outcome: 'UPDATED',
        firstName: input.firstName,
        seats: input.seats,
        accessCode: registered ? existing.checkInCode : null,
        manageUrl: manageUrlPath(token),
        icsUrl: registered ? icsUrlPath(token) : null,
        venue: registered && e.venueAddress ? { name: e.venueName ?? e.locationLabel, address: e.venueAddress, notes: e.venueNotes } : null,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        timezone: e.timezone,
      };
    }
    if (existing) {
      // Anonymous (or another person's record): nothing is modified; the confirmation of the existing registration is
      // sent again to the address, with its manage link (registration-mail.handler.ts).
      await this.outbox.add(tx, { type: 'registration.confirmation_requested', aggregateType: 'EventRegistration', aggregateId: existing.id, payload: { eventId } }, now);
      return anonymousAlreadyRegistered(input, decision.status, e);
    }

    // 1. client record found or created, origin CAFE (MOD-300: empty fields only).
    const client = await upsertClientForLead(tx, this.outbox, {
      email: input.email,
      facts: { firstName: input.firstName, lastName: input.lastName, phone: input.phone ?? null, whatsappOptIn: input.whatsappOptIn },
      locale: 'fr',
      utm: null,
      emailDoubtful: p.mx === 'NONE',
      leadReference: e.reference,
      now,
      source: 'CAFE',
      auditReason: `cafe:${e.reference}`,
    });
    // 3–4. the registration, its access code (CAF-051, unique per Café: checked under the lock) and its manage link.
    const id = newId();
    const checkInCode = await uniqueAccessCode(async (code) => Boolean(await tx.eventRegistration.findFirst({ where: { eventId, checkInCode: code }, select: { id: true } })));
    const token = this.docs.token(id);
    await tx.eventRegistration.create({
      data: {
        id,
        eventId,
        clientId: client.client.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        seats: input.seats,
        status: decision.status,
        questions: input.questions ?? null,
        topics: input.topics.map((t) => CAFE_TOPIC_TO_EVENT_TOPIC[t]),
        source: 'WEB_FORM',
        manageTokenHash: tokenHash(token),
        checkInCode,
        registeredAt: now,
        locale: 'fr',
        createdAt: now,
        updatedAt: now,
      },
    });
    // 2. consents, source cafe:registration (DEM-020, MOD-106).
    await writeConsents(tx, this.outbox, {
      leadId: null,
      registrationId: id,
      clientId: client.client.id,
      kind: 'CAFE',
      source: 'cafe:registration',
      contactKey: input.consentKey,
      marketing: input.marketingOptIn ? { key: input.marketingKey } : null,
      privacyVersion: await privacyPolicyVersion(tx, now),
      ipHash: p.ipHash,
      userAgent: p.userAgent,
      givenAt: now,
      now,
    });
    // MOD-410 — the seat caches move in the same transaction.
    await tx.event.update({
      where: { id: eventId },
      data: decision.status === 'REGISTERED' ? { seatsTaken: { increment: input.seats } } : { waitlistSeats: { increment: input.seats } },
    });
    await refreshClientCaches(tx, client.client.id, now, await this.settings.get('clients.inactiveAfterDays'));
    // 5. registration.created / registration.waitlisted (AUT-010) → C_CAFE_REGISTERED / C_CAFE_WAITLISTED.
    await this.outbox.add(
      tx,
      {
        type: decision.status === 'REGISTERED' ? 'registration.created' : 'registration.waitlisted',
        aggregateType: 'EventRegistration',
        aggregateId: id,
        payload: { eventId, seats: input.seats },
      },
      now,
    );

    const registered = decision.status === 'REGISTERED';
    return {
      status: decision.status,
      outcome: 'NEW',
      firstName: input.firstName,
      seats: input.seats,
      accessCode: registered ? checkInCode : null,
      manageUrl: manageUrlPath(token),
      icsUrl: registered ? icsUrlPath(token) : null,
      venue: registered && e.venueAddress ? { name: e.venueName ?? e.locationLabel, address: e.venueAddress, notes: e.venueNotes } : null,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      timezone: e.timezone,
    };
  }

  // ─── « Gérer mon inscription » (CAF-030 … CAF-032) ──────────────────────

  async findByToken(db: Tx | PrismaService, token: string) {
    if (!TOKEN_RE.test(token)) return null;
    const reg = await db.eventRegistration.findUnique({ where: { manageTokenHash: tokenHash(token) }, include: { event: { select: REGISTRATION_EVENT_SELECT } } });
    if (!reg || reg.event.deletedAt) return null;
    return reg;
  }

  /** Unknown token: 410 « Ce lien a expiré ou a déjà été utilisé. » (CAF-032). */
  private async load(db: Tx | PrismaService, token: string): Promise<RegistrationWithEvent> {
    await this.enabled();
    const reg = await this.findByToken(db, token);
    if (!reg) throw new AppError(ErrorCode.GONE);
    return reg;
  }

  async view(token: string): Promise<CafeRegistrationView> {
    const reg = await this.load(this.prisma, token);
    return this.toView(reg, token);
  }

  private async toView(reg: RegistrationWithEvent, token: string): Promise<CafeRegistrationView> {
    const now = this.clock.now();
    const e = reg.event;
    const phase: CafeRegistrationView['phase'] =
      e.status === 'CANCELLED' ? 'EVENT_CANCELLED' : e.status === 'DONE' || e.endsAt <= now || reg.status === 'ATTENDED' || reg.status === 'NO_SHOW' ? 'PAST' : 'UPCOMING';
    const active = reg.status === 'REGISTERED' || reg.status === 'WAITLISTED';
    const editable = phase === 'UPCOMING' && active && e.startsAt > now && (e.status === 'PUBLISHED' || e.status === 'CLOSED');
    const holdsSeat = (reg.status === 'REGISTERED' || reg.status === 'ATTENDED') && phase !== 'EVENT_CANCELLED';
    const maxSeats = reg.status === 'REGISTERED' ? Math.min(e.maxSeatsPerRegistration, reg.seats + seatsLeft(e)) : e.maxSeatsPerRegistration;
    const upcoming =
      phase !== 'UPCOMING' || reg.status === 'CANCELLED' ? (await this.events.upcoming(4)).filter((c) => c.slug !== e.slug && c.state.kind !== 'CANCELLED').slice(0, 3) : [];
    return {
      status: reg.status,
      firstName: reg.firstName,
      seats: reg.seats,
      topics: reg.topics.map((t) => EVENT_TOPIC_TO_CAFE_TOPIC[t]),
      questions: reg.questions,
      registeredAt: reg.registeredAt.toISOString(),
      cancelledAt: reg.cancelledAt?.toISOString() ?? null,
      accessCode: holdsSeat ? reg.checkInCode : null,
      qrCode: holdsSeat ? await this.docs.qrDataUrl(e.reference, reg.checkInCode) : null,
      icsUrl: holdsSeat && reg.status === 'REGISTERED' && e.startsAt > now ? icsUrlPath(token) : null,
      cafe: {
        slug: e.slug,
        title: e.title,
        locationLabel: e.locationLabel,
        cityName: e.cityName,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        timezone: e.timezone,
        venue: holdsSeat && e.venueAddress ? { name: e.venueName ?? e.locationLabel, address: e.venueAddress, notes: e.venueNotes } : null,
        cancelReason: e.status === 'CANCELLED' ? e.cancelReason : null,
        maxSeatsPerRegistration: e.maxSeatsPerRegistration,
      },
      phase,
      actions: {
        changeSeats: editable,
        maxSeats: Math.max(maxSeats, reg.seats),
        editAnswers: editable && reg.status === 'REGISTERED', // CAF-032: a WAITLISTED one changes its seats or cancels
        cancel: editable,
        addToCalendar: editable && reg.status === 'REGISTERED',
        reRegister: reg.status === 'CANCELLED' && registrationRefusal(e, now) === null,
        feedback: false, // SFA-040: the survey module does not exist yet.
      },
      upcoming,
    };
  }

  /** CAF-031 — the registration must still be changeable: REGISTERED or WAITLISTED, until the start of the Café. */
  private assertChangeable(reg: RegistrationWithEvent, now: Date): void {
    if (reg.event.status === 'CANCELLED') throw AppError.conflictState('EVENT_CANCELLED');
    if (reg.status !== 'REGISTERED' && reg.status !== 'WAITLISTED') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (reg.event.startsAt <= now || reg.event.status === 'DONE') throw AppError.conflictState('REGISTRATION_CLOSED');
  }

  /** `PATCH` — seats (CYC-187), topics and questions (CAF-031 « Enregistré. »). */
  async update(token: string, body: unknown): Promise<CafeRegistrationView> {
    await this.enabled();
    const input = parseOrThrow(cafeRegistrationUpdateSchema, body);
    if (input.topics?.includes('ISLAMIC_FINANCING') && !(await this.settings.get('features.islamicFinance'))) {
      throw AppError.validation([{ field: 'topics', code: 'INVALID_CHOICE' }]);
    }
    const after = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const first = await this.load(tx, token);
      await lockEvent(tx, { id: first.eventId }); // MOD-410
      const reg = await this.load(tx, token); // read again under the lock
      this.assertChangeable(reg, now);
      const data: Record<string, unknown> = {};
      let freed = false;
      if (input.seats !== undefined && input.seats !== reg.seats) {
        const change = seatChange({ status: reg.status as 'REGISTERED' | 'WAITLISTED', current: reg.seats, requested: input.seats, left: seatsLeft(reg.event), maxPerRegistration: reg.event.maxSeatsPerRegistration });
        if (!change.ok && change.reason === 'NOT_ENOUGH_SEATS') throw AppError.conflictState('NOT_ENOUGH_SEATS', { n: change.n });
        if (!change.ok) throw AppError.validation([{ field: 'seats', code: 'OUT_OF_RANGE', params: { n: change.max, max: change.max } }]);
        data.seats = input.seats;
        freed = change.freed;
        await tx.event.update({ where: { id: reg.eventId }, data: { seatsTaken: { increment: change.seatsTakenDelta }, waitlistSeats: { increment: change.waitlistDelta } } });
      }
      if (input.topics !== undefined) data.topics = input.topics.map((t) => CAFE_TOPIC_TO_EVENT_TOPIC[t]);
      if (input.questions !== undefined) data.questions = input.questions || null;
      await tx.eventRegistration.update({ where: { id: reg.id }, data: { ...data, version: { increment: 1 }, updatedAt: now } });
      // CYC-185 — seats given back (or a waiting registration made smaller): the waiting list is served.
      if (freed) await promoteWaitlist(tx, this.outbox, reg.eventId, now);
      return (await this.findByToken(tx, token))!;
    });
    this.dispatcher.wake();
    return this.toView(after, token);
  }

  /** `DELETE` — cancellation by the holder of the link, optional reason (CAF-031, CYC-185). */
  async cancel(token: string, body: unknown): Promise<CafeRegistrationView> {
    await this.enabled();
    const input = parseOrThrow(cafeRegistrationCancelSchema, body ?? {});
    const after = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const first = await this.load(tx, token);
      await lockEvent(tx, { id: first.eventId }); // MOD-410
      const reg = await this.load(tx, token);
      this.assertChangeable(reg, now);
      const wasRegistered = reg.status === 'REGISTERED';
      await tx.eventRegistration.update({
        where: { id: reg.id },
        data: { status: 'CANCELLED', cancelledAt: now, cancelledBy: 'CLIENT', cancelReason: input.reason || null, version: { increment: 1 }, updatedAt: now },
      });
      await tx.event.update({
        where: { id: reg.eventId },
        data: wasRegistered ? { seatsTaken: { decrement: reg.seats } } : { waitlistSeats: { decrement: reg.seats } },
      });
      await this.outbox.add(
        tx,
        { type: 'registration.cancelled', aggregateType: 'EventRegistration', aggregateId: reg.id, payload: { eventId: reg.eventId, seats: reg.seats, cancelledBy: 'CLIENT' } },
        now,
      );
      // CYC-185 — « Libère les places, déclenche la promotion ».
      if (wasRegistered) await promoteWaitlist(tx, this.outbox, reg.eventId, now);
      await refreshClientCaches(tx, reg.clientId, now, await this.settings.get('clients.inactiveAfterDays'));
      return (await this.findByToken(tx, token))!;
    });
    this.dispatcher.wake();
    return this.toView(after, token);
  }

  /** `GET …/ics` — CAF-050, for a registration that holds its seats. */
  async ics(token: string): Promise<{ filename: string; body: string }> {
    const reg = await this.load(this.prisma, token);
    if (reg.status !== 'REGISTERED' && reg.status !== 'ATTENDED') throw AppError.notFound();
    return { filename: `le-cafe-${reg.event.slug}.ics`, body: await this.docs.ics(reg, reg.event) };
  }
}
