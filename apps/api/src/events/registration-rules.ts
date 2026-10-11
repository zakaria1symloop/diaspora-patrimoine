// Café registration rules, pure (no I/O): access code (CAF-051), manage token (CAF-030, SEC: stored hashed), state and
// seat decisions (CAF-022, CAF-025, CYC-185, CYC-187), waiting-list promotion (CYC-185), anonymous answer (CAF-024),
// labels in the venue's time zone (CAF-011, NOT-051).
import { createHash, createHmac, randomInt } from 'node:crypto';
import type { CafeRegistrationResponse } from '@dp/contracts';

/** CAF-051 — capital letters and digits without 0, O, 1, I, L. */
export const ACCESS_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const ACCESS_CODE_LENGTH = 6;
/** Collisions are rare (31^6 ≈ 887 million codes per Café); after this many tries something else is wrong. */
export const ACCESS_CODE_MAX_TRIES = 20;

export function generateAccessCode(pick: (max: number) => number = randomInt): string {
  let code = '';
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) code += ACCESS_CODE_ALPHABET[pick(ACCESS_CODE_ALPHABET.length)];
  return code;
}

/** CAF-051 — unique per Café: a new code while `taken` says it exists (checked under the Café lock, MOD-410). */
export async function uniqueAccessCode(taken: (code: string) => Promise<boolean>, generate: () => string = () => generateAccessCode()): Promise<string> {
  for (let i = 0; i < ACCESS_CODE_MAX_TRIES; i++) {
    const code = generate();
    if (!(await taken(code))) return code;
  }
  throw new Error('access code space exhausted');
}

/**
 * CAF-030 — the manage token: unpredictable without LINK_SIGNING_KEY (HMAC of the registration id), stored only as
 * its SHA-256 (`manageTokenHash`). Derived rather than drawn so that every later e-mail (CAF-024 resend, reminders,
 * C_CAFE_UPDATED) can carry the link without the token ever being stored readable.
 */
export function manageToken(signingKey: string, registrationId: string): string {
  // Lower-case hex: site addresses are lower case (NAV-002 redirects any capital), so the token must survive that.
  return createHmac('sha256', signingKey).update(`dp_cafe_manage:${registrationId}`).digest('hex');
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
/** A token is 64 lower-case hex characters; anything else cannot exist (410 without a lookup). */
export const TOKEN_RE = /^[0-9a-f]{64}$/;

export const manageUrlPath = (token: string) => `/le-cafe/inscription/${token}`;
export const icsUrlPath = (token: string) => `/api/v1/public/registrations/${token}/ics`;

/**
 * CAF-051 — the back-office check-in address carried by the QR code. PLACEHOLDER path until the back-office check-in
 * screen exists (EVT-050): `{ADMIN_URL or WEB_URL}/back-office/cafes/pointage?cafe={reference}&code={code}` — the
 * Café reference is added because a code is unique per Café only.
 */
export function checkInUrl(base: string, eventReference: string, code: string): string {
  const u = new URL('/back-office/cafes/pointage', base);
  u.searchParams.set('cafe', eventReference);
  u.searchParams.set('code', code);
  return u.toString();
}

export interface EventFacts {
  status: string;
  startsAt: Date;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date;
  capacity: number;
  seatsTaken: number;
  deletedAt?: Date | null;
}

/** CAF-025, CYC-180 — why a public registration is impossible now (null: registrations are open). */
export function registrationRefusal(e: EventFacts, now: Date): 'EVENT_CANCELLED' | 'REGISTRATION_CLOSED' | 'EVENT_NOT_OPEN' | null {
  if (e.status === 'CANCELLED') return 'EVENT_CANCELLED';
  if (e.status !== 'PUBLISHED' || e.startsAt <= now || e.registrationClosesAt <= now) return 'REGISTRATION_CLOSED';
  if (e.registrationOpensAt && e.registrationOpensAt > now) return 'EVENT_NOT_OPEN';
  return null;
}

export const seatsLeft = (e: Pick<EventFacts, 'capacity' | 'seatsTaken'>) => Math.max(0, e.capacity - e.seatsTaken);

export type SeatDecision =
  | { ok: true; status: 'REGISTERED' | 'WAITLISTED' }
  | { ok: false; reason: 'EVENT_FULL' } // CAF-022: « Ce Café vient d'afficher complet. »
  | { ok: false; reason: 'NOT_ENOUGH_SEATS'; n: number }; // CAF-022: « Il ne reste que {n} places. »

/** CYC-185 creation, CAF-022 — REGISTERED when the seats fit; WAITLISTED only when the visitor asked for it. */
export function registrationDecision(left: number, seats: number, waitlist: boolean): SeatDecision {
  if (seats <= left) return { ok: true, status: 'REGISTERED' };
  if (waitlist) return { ok: true, status: 'WAITLISTED' };
  return left === 0 ? { ok: false, reason: 'EVENT_FULL' } : { ok: false, reason: 'NOT_ENOUGH_SEATS', n: left };
}

export type SeatChange =
  | { ok: true; seatsTakenDelta: number; waitlistDelta: number; freed: boolean }
  | { ok: false; reason: 'NOT_ENOUGH_SEATS'; n: number }
  | { ok: false; reason: 'OUT_OF_RANGE'; max: number };

/**
 * CYC-187 — a REGISTERED one: down always, up within the free seats (else « Il ne reste que {n} places. », n = free
 * seats). A WAITLISTED one (CAF-032): any number up to the maximum; it moves the waiting-list cache only.
 */
export function seatChange(a: { status: 'REGISTERED' | 'WAITLISTED'; current: number; requested: number; left: number; maxPerRegistration: number }): SeatChange {
  if (a.requested < 1 || a.requested > a.maxPerRegistration) return { ok: false, reason: 'OUT_OF_RANGE', max: a.maxPerRegistration };
  const delta = a.requested - a.current;
  if (a.status === 'WAITLISTED') return { ok: true, seatsTakenDelta: 0, waitlistDelta: delta, freed: delta < 0 };
  if (delta > a.left) return { ok: false, reason: 'NOT_ENOUGH_SEATS', n: a.left };
  return { ok: true, seatsTakenDelta: delta, waitlistDelta: 0, freed: delta < 0 };
}

/** CYC-185 — no automatic promotion in the 12 hours before the start: the staff promotes by hand. */
export const NO_AUTO_PROMOTION_HOURS = 12;

export function autoPromotionAllowed(e: Pick<EventFacts, 'status' | 'startsAt'>, now: Date): boolean {
  if (e.status !== 'PUBLISHED' && e.status !== 'CLOSED') return false;
  return e.startsAt.getTime() - now.getTime() > NO_AUTO_PROMOTION_HOURS * 3_600_000;
}

/**
 * CYC-185 — waiting registrations served in arrival order, each only if ALL its seats fit in what is free (a
 * registration of 3 is never split; the next one that fits is served).
 */
export function pickPromotions(waiting: readonly { id: string; seats: number }[], free: number): string[] {
  const out: string[] = [];
  let left = free;
  for (const w of waiting) {
    if (left <= 0) break;
    if (w.seats <= left) {
      out.push(w.id);
      left -= w.seats;
    }
  }
  return out;
}

/**
 * CAF-024 (TRV-112) — the anonymous answer when the address is already registered: the status a NEW registration
 * would have had, the echo of what was typed, and nothing that belongs to the existing registration.
 */
export function anonymousAlreadyRegistered(
  input: { firstName: string; seats: number },
  status: 'REGISTERED' | 'WAITLISTED',
  e: { startsAt: Date; endsAt: Date; timezone: string },
): CafeRegistrationResponse {
  return {
    status,
    outcome: 'SENT',
    firstName: input.firstName,
    seats: input.seats,
    accessCode: null,
    manageUrl: null,
    icsUrl: null,
    venue: null,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    timezone: e.timezone,
  };
}

/** NOT-051, TRV-020 — « samedi 17 octobre » and « de 10 h à 12 h 30 », in the venue's time zone (CAF-011). */
export function cafeDateLabel(startsAt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(startsAt).replace(/^(\D+ )1 /, '$11er ');
}

export function hourLabel(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone })
    .format(d)
    .replace(/^(\d{1,2}):00$/, '$1 h')
    .replace(/^(\d{1,2}):(\d{2})$/, '$1 h $2');
}

export function cafeTimeLabel(startsAt: Date, endsAt: Date, timeZone: string): string {
  return `de ${hourLabel(startsAt, timeZone)} à ${hourLabel(endsAt, timeZone)}`;
}
