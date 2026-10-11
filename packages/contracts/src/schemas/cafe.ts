// 02-site-public/07 — Café registration (CAF-020 … CAF-025) and « Gérer mon inscription » (EP-15, CAF-030 … CAF-032).
// One schema used by the browser AND the API (ARC-030, TRV-060); error messages are TRV-064 codes.
import { z } from 'zod';
import type { EventTopic, RegistrationStatus } from '../enums.js';
import type { PublicEventCard } from '../events.js';
import { emailSchema, LEAD_HONEYPOT_FIELD, LeadConsentWording, personNameSchema, phoneSchema, type LeadConsentKey } from './leads.js';

/** DEM-030 — name of the form in the signed form token. */
export const CAFE_REGISTRATION_FORM = 'CAFE_REGISTRATION';
/** CAF-020 — « Vos questions pour le promoteur et le banquier ». */
export const CAFE_QUESTIONS_MAX = 1000;
/** Technical bound of `seats`; the real one is `Event.maxSeatsPerRegistration` (setting `events.maxSeatsPerRegistration` ≤ 10). */
export const CAFE_SEATS_BOUND = 10;
/** CAF-031 — optional reason of a cancellation (`EventRegistration.cancelReason`). */
export const CAFE_CANCEL_REASON_MAX = 300;

/** CAF-020 « Ce qui vous intéresse » — wire values; `ISLAMIC_FINANCING` only when `features.islamicFinance`. */
export const CAFE_TOPICS = ['PROGRAMS', 'FINANCING', 'ISLAMIC_FINANCING', 'PROCEDURES'] as const;
export type CafeTopic = (typeof CAFE_TOPICS)[number];
/** The stored value (`EventRegistration.topics`, enum `EventTopic` of 01-domaine/05) of each wire value. */
export const CAFE_TOPIC_TO_EVENT_TOPIC: Readonly<Record<CafeTopic, EventTopic>> = {
  PROGRAMS: 'PROGRAMMES',
  FINANCING: 'FINANCING',
  ISLAMIC_FINANCING: 'ISLAMIC_FINANCE',
  PROCEDURES: 'PROCEDURE',
};
export const EVENT_TOPIC_TO_CAFE_TOPIC: Readonly<Record<EventTopic, CafeTopic>> = {
  PROGRAMMES: 'PROGRAMS',
  FINANCING: 'FINANCING',
  ISLAMIC_FINANCE: 'ISLAMIC_FINANCING',
  PROCEDURE: 'PROCEDURES',
};

/** MOD-106 — proof sentences of the Café form: its own contact sentence, the shared marketing sentence. */
export const CURRENT_CAFE_CONTACT_CONSENT_KEY = 'cafe.contact.v1' satisfies LeadConsentKey;
const keysOf = (prefix: string, type: string) =>
  Object.entries(LeadConsentWording)
    .filter(([k, v]) => k.startsWith(prefix) && v.type === type)
    .map(([k]) => k) as [LeadConsentKey, ...LeadConsentKey[]];
const cafeContactKey = z.enum(keysOf('cafe.', 'CONTACT_REQUEST'), { error: 'INVALID_CHOICE' });
const marketingKey = z.enum(keysOf('lead.', 'MARKETING_EMAIL'), { error: 'INVALID_CHOICE' });

const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

const questionsSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().max(CAFE_QUESTIONS_MAX, { error: 'TOO_LONG' }));
const topicsSchema = z
  .array(z.enum(CAFE_TOPICS, { error: 'INVALID_CHOICE' }))
  .max(CAFE_TOPICS.length, { error: 'INVALID_CHOICE' })
  .transform((list) => [...new Set(list)]);
const seatsSchema = z.number({ error: 'REQUIRED' }).int({ error: 'NOT_A_NUMBER' }).min(1, { error: 'OUT_OF_RANGE' }).max(CAFE_SEATS_BOUND, { error: 'OUT_OF_RANGE' });

/** `POST /public/events/{slug}/registrations` — CAF-020. `seats` above `Event.maxSeatsPerRegistration`: 422 OUT_OF_RANGE. */
export const cafeRegistrationSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: emailSchema,
  phone: optional(phoneSchema),
  whatsappOptIn: z.boolean().default(false),
  seats: seatsSchema.default(1),
  topics: topicsSchema.default([]),
  questions: optional(questionsSchema).transform((v) => (v ? v : undefined)),
  consentContact: z.literal(true, { error: 'MUST_ACCEPT' }),
  consentKey: cafeContactKey.default(CURRENT_CAFE_CONTACT_CONSENT_KEY),
  marketingOptIn: z.boolean().default(false),
  marketingKey: marketingKey.default('lead.marketing.v1'),
  /** CAF-022 — the visitor asked for the waiting list (never decided by the server alone). */
  waitlist: z.boolean().default(false),
  /** DEM-030 point 1 — must stay empty. */
  [LEAD_HONEYPOT_FIELD]: z.string().max(2000).optional(),
});
export type CafeRegistrationRequest = z.infer<typeof cafeRegistrationSchema>;
export type CafeRegistrationInput = z.input<typeof cafeRegistrationSchema>;

/**
 * 201 of the registration. `outcome`: `NEW` (created), `UPDATED` (signed-in client, CYC-186), `SENT` (anonymous and
 * already registered, CAF-024: nothing but the echo of the input — no code, venue nor link, TRV-112).
 */
export interface CafeRegistrationResponse {
  status: 'REGISTERED' | 'WAITLISTED';
  outcome: 'NEW' | 'UPDATED' | 'SENT';
  firstName: string;
  seats: number;
  /** CAF-051 — REGISTERED only. */
  accessCode: string | null;
  /** CAF-030 — `/le-cafe/inscription/{token}`; never for `SENT`. */
  manageUrl: string | null;
  /** CAF-050 — REGISTERED only. */
  icsUrl: string | null;
  /** TRV-045 — REGISTERED only. */
  venue: CafeVenue | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
}

export interface CafeVenue {
  name: string;
  address: string;
  notes: string | null;
}

/** `PATCH /public/registrations/{token}` — CAF-031 (seats per CYC-187, the same answers as CAF-020). */
export const cafeRegistrationUpdateSchema = z
  .object({
    seats: seatsSchema.optional(),
    topics: topicsSchema.optional(),
    questions: z.preprocess((v) => (v === '' ? null : v), questionsSchema.nullable().optional()),
  })
  .refine((v) => v.seats !== undefined || v.topics !== undefined || v.questions !== undefined, { error: 'REQUIRED', path: ['seats'] });
export type CafeRegistrationUpdate = z.infer<typeof cafeRegistrationUpdateSchema>;

/** `DELETE /public/registrations/{token}` — CAF-031, optional reason. */
export const cafeRegistrationCancelSchema = z
  .object({
    reason: z.preprocess(
      (v) => (v === '' ? null : v),
      z
        .string()
        .transform((s) => s.trim())
        .pipe(z.string().max(CAFE_CANCEL_REASON_MAX, { error: 'TOO_LONG' }))
        .nullable()
        .optional(),
    ),
  })
  .default({});
export type CafeRegistrationCancel = z.infer<typeof cafeRegistrationCancelSchema>;

/** EP-15 — what the page shows (CAF-030 … CAF-032). */
export interface CafeRegistrationView {
  status: RegistrationStatus;
  firstName: string;
  seats: number;
  topics: CafeTopic[];
  questions: string | null;
  registeredAt: string;
  cancelledAt: string | null;
  /** CAF-051 — REGISTERED and ATTENDED only, with the QR code (PNG data URL) of the check-in address. */
  accessCode: string | null;
  qrCode: string | null;
  /** CAF-050 — REGISTERED only, while the Café is to come. */
  icsUrl: string | null;
  cafe: {
    slug: string;
    title: string;
    locationLabel: string;
    cityName: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    /** Exact venue — REGISTERED and ATTENDED only (TRV-045). */
    venue: CafeVenue | null;
    cancelReason: string | null;
    maxSeatsPerRegistration: number;
  };
  /**
   * CAF-032 — `UPCOMING` (the Café is to come), `PAST` (it took place, or the registration is ATTENDED),
   * `EVENT_CANCELLED` (the Café is cancelled).
   */
  phase: 'UPCOMING' | 'PAST' | 'EVENT_CANCELLED';
  actions: {
    /** CAF-031 — until the start, REGISTERED or WAITLISTED. */
    changeSeats: boolean;
    /** Highest choosable number of seats (CYC-187: free seats for a REGISTERED one). */
    maxSeats: number;
    editAnswers: boolean;
    cancel: boolean;
    addToCalendar: boolean;
    /** CAF-032 — CANCELLED registration of a Café still open: « Me réinscrire ». */
    reRegister: boolean;
    /** CAF-032 « Donner mon avis » — the survey module does not exist yet: always false. */
    feedback: boolean;
  };
  /** CAF-032 — next Cafés, for a past or cancelled Café or a cancelled registration. */
  upcoming: PublicEventCard[];
}
