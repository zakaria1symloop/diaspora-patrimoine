// 02-site-public/05 — public request forms (DEM-010…DEM-027). One schema per form, used by the browser AND the API
// (ARC-030, TRV-060). Field keys are those of DEM-011…DEM-019; error messages are TRV-064 codes (the screen translates).
import { isValidPhoneNumber } from 'libphonenumber-js';
import { z } from 'zod';
import { ContactChannel, ContactSubject, ContactTimeSlot, FinancingPreference, LeadKind, PurchaseTimeframe, ResidencyStatus } from '../enums.js';
import { guidedAnswersSchema } from '../assistant.js';

// ─── Wire constants ─────────────────────────────────────────────────────────

/** API-040 — header carried by every creating public form. */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
/** DEM-030 — signed form token, received from `POST /public/form-token` when the form opens. */
export const FORM_TOKEN_HEADER = 'X-Form-Token';
/**
 * DEM-030 point 1 — the hidden trap field. Its name is fixed by the code, not by the spec: a body key that no browser
 * autofills. The form renders it off-screen (`tabindex=-1`, `autocomplete="off"`, `aria-hidden`) and sends it empty.
 */
export const LEAD_HONEYPOT_FIELD = 'homepageUrl';
/** DEM-030 — validity of a form token. */
export const FORM_TOKEN_HOURS = 24;
/** DEM-013 — the second screen of a projection completes the same request within 30 minutes, once. */
export const LEAD_COMPLETION_MINUTES = 30;
/** DEM-032 — a 429 whose `retryAfterSeconds` exceeds this shows the « long limit » sentence. */
export const LEAD_SHORT_LIMIT_SECONDS = 300;

/** DEM-025 — `formVersion` grows when the field list of a form changes. */
export const LeadFormVersion = {
  PROPERTY_INTEREST: 1,
  PROJECTION_REQUEST: 1,
  CALLBACK_REQUEST: 1,
  CONTACT_MESSAGE: 1,
  GUIDED_SEARCH: 1,
  PARTNER_REQUEST: 1,
  SIMULATION_FOLLOWUP: 1,
} as const;

/**
 * DEM-020, TRV-143, MOD-106 — the exact sentences shown next to the consent boxes. They are PROOF data: the server stores
 * the text of the key the form sends (`consentKey`, `marketingKey`), never a text received from the browser, and the
 * form displays this very text so that what is stored is what was read. A new wording = a new key; old keys stay
 * listed so that the proof of past consents keeps its sentence. `[Politique de confidentialité]` marks the link.
 */
export const LeadConsentWording = {
  'lead.contact.v1': {
    type: 'CONTACT_REQUEST',
    text: 'J’accepte que Diaspora Patrimoine me contacte au sujet de ma demande et traite mes données à cette fin. [Politique de confidentialité]',
  },
  'lead.marketing.v1': {
    type: 'MARKETING_EMAIL',
    text: 'Je souhaite recevoir les actualités et les nouveaux programmes par e-mail.',
  },
  /** CAF-020 — the consent of a Café registration (the marketing box reuses `lead.marketing.v1`). */
  'cafe.contact.v1': {
    type: 'CONTACT_REQUEST',
    text: 'J’accepte que Diaspora Patrimoine m’envoie les informations pratiques de ce Café et me recontacte au sujet de mon projet. [Politique de confidentialité]',
  },
} as const;
export type LeadConsentKey = keyof typeof LeadConsentWording;
export const CURRENT_CONTACT_CONSENT_KEY = 'lead.contact.v1' satisfies LeadConsentKey;
export const CURRENT_MARKETING_CONSENT_KEY = 'lead.marketing.v1' satisfies LeadConsentKey;

// ─── Field primitives ───────────────────────────────────────────────────────

const collapse = (s: string) => s.trim().replace(/\s+/g, ' ');
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u;

/** TRV-042 — 1 to 80 characters; letters of any alphabet, spaces, hyphens, apostrophes, dots; spaces trimmed/collapsed. */
export const personNameSchema = z
  .string({ error: 'REQUIRED' })
  .transform(collapse)
  .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(80, { error: 'TOO_LONG', abort: true }).regex(NAME_RE, { error: 'INVALID_NAME' }));

/** TRV-043 — trimmed, lower-cased, 254 characters at most. */
export const emailSchema = z
  .string({ error: 'REQUIRED' })
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(254, { error: 'TOO_LONG' }).pipe(z.email({ error: 'INVALID_EMAIL' })));

/** TRV-040 — E.164, validated with libphonenumber (the phone input converts what the visitor types). */
export const phoneSchema = z
  .string({ error: 'REQUIRED' })
  .transform((s) => s.replace(/[\s.()-]/g, ''))
  .pipe(
    z
      .string()
      .min(1, { error: 'REQUIRED', abort: true })
      .regex(/^\+[1-9]\d{6,14}$/, { error: 'INVALID_PHONE', abort: true })
      .refine((v) => isValidPhoneNumber(v), { error: 'INVALID_PHONE' }),
  );

/** TRV-044 — ISO 3166-1 alpha-2. */
export const countryCodeSchema = z
  .string({ error: 'REQUIRED' })
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}$/, { error: 'INVALID_CHOICE' }));

/** CAL-027 — technical upper bounds (any currency). */
const AMOUNT_BOUND = { CAPITAL: 100_000_000_000, MONTHLY: 1_000_000_000 } as const;

/**
 * DEM-007, API-002 — an amount entered in the reference currency, sent as a decimal string ("150000" or "150000.50").
 * TRV-026 reading happens in the form; the wire value is normalised. `positive`: strictly more than 0.
 */
export function amountSchema(kind: keyof typeof AMOUNT_BOUND, positive = false) {
  return z
    .string({ error: 'REQUIRED' })
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(1, { error: 'REQUIRED', abort: true })
        .regex(/^\d{1,12}(\.\d{1,2})?$/, { error: 'INVALID_AMOUNT', abort: true })
        .refine((v) => Number(v) <= AMOUNT_BOUND[kind], { error: 'AMOUNT_TOO_HIGH' })
        .refine((v) => !positive || Number(v) > 0, { error: 'OUT_OF_RANGE' }),
    );
}

/** API-002 — a date without time, `YYYY-MM-DD`, that exists in the calendar. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'INVALID_DATE', abort: true })
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, { error: 'INVALID_DATE' });

/** TRV-063 — message of a public form: 2 000 characters at most. */
const messageSchema = z.string().transform((s) => s.trim()).pipe(z.string().max(2000, { error: 'TOO_LONG' }));
/** Empty, null or absent: no message (the forms send null for an empty field, like the other optional fields). */
const optionalMessage = z.preprocess((v) => (v === null ? undefined : v), messageSchema.optional()).transform((v) => (v ? v : undefined));

/** DEM-020 — never pre-checked; must be checked. */
const consentSchema = z.literal(true, { error: 'MUST_ACCEPT' });
// The request forms accept the `lead.*` sentences only (a Café key belongs to the Café form, schemas/cafe.ts).
const consentKeySchema = z.enum(Object.keys(LeadConsentWording).filter((k) => k.startsWith('lead.')) as [LeadConsentKey, ...LeadConsentKey[]], { error: 'INVALID_CHOICE' });

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

/** DEM-008 — « Quand vous appeler ? » (both optional; « Dès que possible » / « Peu importe » are sent as null). */
const callbackFields = {
  preferredCallbackDate: optional(isoDateSchema),
  preferredSlot: optional(z.enum(ContactTimeSlot, { error: 'INVALID_CHOICE' })),
};

/** DEM-020, DEM-021 — the consent block shared by the anonymous forms. */
const consentFields = {
  consentContact: consentSchema,
  consentKey: consentKeySchema.default(CURRENT_CONTACT_CONSENT_KEY),
  marketingOptIn: z.boolean().default(false),
  marketingKey: consentKeySchema.default(CURRENT_MARKETING_CONSENT_KEY),
};

// ─── Context and tracking (DEM-003, DEM-025) ────────────────────────────────

/**
 * DEM-025 `context` — what the visitor SAW when sending (frozen with the request, FIA-071), and which object it was
 * about. The server resolves the object from `propertyReference`, `lotReference` or `programSlug`.
 */
export const leadContextSchema = z
  .object({
    propertyReference: optional(z.string().trim().max(20)),
    propertyTitle: optional(z.string().trim().max(120)),
    lotReference: optional(z.string().trim().max(40)),
    programSlug: optional(z.string().trim().max(80)),
    programName: optional(z.string().trim().max(120)),
    priceShown: optional(z.string().regex(/^\d{1,12}(\.\d{1,2})?$/)),
    monthlyShown: optional(z.string().regex(/^\d{1,12}(\.\d{1,2})?$/)),
    currencyShown: optional(z.string().regex(/^[A-Z]{3}$/)),
  })
  .default({});
export type LeadContext = z.infer<typeof leadContextSchema>;

/** DEM-003, NAV-053 — joined without being typed by the visitor. */
export const leadTrackingSchema = z
  .object({
    locale: z.enum(['fr', 'ar', 'en']).default('fr'),
    callerTimezone: optional(z.string().max(64).regex(/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/)),
    landingPath: optional(z.string().max(400)),
    submittedFromPath: optional(z.string().max(400)),
    /** NAV-053: the DOMAIN of the referring site (a full URL is reduced to its host by the server). */
    referrer: optional(z.string().max(400)),
    utm: optional(
      z.object({
        source: optional(z.string().max(200)),
        medium: optional(z.string().max(200)),
        campaign: optional(z.string().max(200)),
        term: optional(z.string().max(200)),
        content: optional(z.string().max(200)),
      }),
    ),
  })
  .default({ locale: 'fr' });
export type LeadTracking = z.infer<typeof leadTrackingSchema>;

// ─── The forms ──────────────────────────────────────────────────────────────

/** DEM-011 / DEM-012 — interest for a property or a program. */
export const propertyInterestFieldsSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  whatsappOptIn: z.boolean().default(false),
  countryOfResidence: countryCodeSchema,
  preferredChannel: optional(z.enum(['CALL', 'WHATSAPP', 'EMAIL'], { error: 'INVALID_CHOICE' })),
  residencyStatus: optional(z.enum(ResidencyStatus, { error: 'INVALID_CHOICE' })),
  purchaseTimeframe: optional(z.enum(PurchaseTimeframe, { error: 'INVALID_CHOICE' })),
  budget: optional(amountSchema('CAPITAL', true)),
  budgetKind: z.enum(['TOTAL', 'MONTHLY'], { error: 'INVALID_CHOICE' }).default('TOTAL'),
  financingPreference: optional(z.enum(FinancingPreference, { error: 'INVALID_CHOICE' })),
  ...callbackFields,
  wantsVideoVisit: z.boolean().default(false),
  message: optionalMessage,
  ...consentFields,
  createAccount: z.boolean().default(false),
});

/** DEM-013 — projection, first screen (four fields of the mock-up). */
export const projectionFieldsSchema = z.object({
  regionSlug: optional(z.string().trim().max(80)),
  downPayment: amountSchema('CAPITAL'),
  monthlyBudget: amountSchema('MONTHLY', true),
  email: emailSchema,
  ...consentFields,
  createAccount: z.boolean().default(false),
});

/** DEM-014 — « Être rappelé » window. Subject without CALLBACK nor DOSSIER. */
export const callbackFieldsSchema = z.object({
  firstName: personNameSchema,
  lastName: optional(personNameSchema),
  phone: phoneSchema,
  whatsappOptIn: z.boolean().default(false),
  email: emailSchema,
  ...callbackFields,
  subject: optional(z.enum(['PROPERTY', 'FINANCING', 'CAFE', 'OTHER'], { error: 'INVALID_CHOICE' })),
  message: optionalMessage,
  ...consentFields,
  createAccount: z.boolean().default(false),
});

/**
 * DEM-015 — contact page. Subject `CALLBACK` makes it a real callback request (kind `CALLBACK_REQUEST`): phone becomes
 * required, the message optional. `DOSSIER` is only offered to a signed-in client (DEM-022): refused here.
 */
export const contactFieldsSchema = z
  .object({
    firstName: personNameSchema,
    lastName: personNameSchema,
    email: emailSchema,
    phone: optional(phoneSchema),
    whatsappOptIn: z.boolean().default(false),
    subject: z.enum(['PROPERTY', 'FINANCING', 'CAFE', 'CALLBACK', 'OTHER'], { error: 'INVALID_CHOICE' }),
    ...callbackFields,
    message: optionalMessage,
    ...consentFields,
    createAccount: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.subject === ContactSubject.CALLBACK) {
      if (!v.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'REQUIRED' });
      return;
    }
    if (!v.message) ctx.addIssue({ code: 'custom', path: ['message'], message: 'REQUIRED' });
    else if (v.message.length < 10) {
      ctx.addIssue({ code: 'too_small', origin: 'string', minimum: 10, inclusive: true, path: ['message'], input: v.message });
    }
  });

/** DEM-017, ASS-030 — end of the guided search: contact details + raw answers, criteria, displayed properties, free text. */
export const guidedSearchFieldsSchema = z.object({
  firstName: personNameSchema,
  email: emailSchema,
  phone: optional(phoneSchema),
  whatsappOptIn: z.boolean().default(false),
  /** ASS-030 — the raw answers, in the shape of the questionnaire (validated: they complete the client record, ASS-031). */
  answers: guidedAnswersSchema.default({}),
  /** ASS-030 — the criteria produced; the server recomputes them from `answers` (what is stored is what was asked). */
  criteria: z.record(z.string().max(60), z.unknown()).default({}),
  propertyReferences: z.array(z.string().max(20)).max(20, { error: 'TOO_LONG' }).default([]),
  freeText: optional(z.string().trim().max(500, { error: 'TOO_LONG' })),
  /**
   * ASS-052, IA-013 — set when the request ends a conversation with the assistant (mode AI): the server then takes the
   * criteria, the properties shown and the summary from the conversation it keeps (the browser's values are ignored).
   */
  assistantConversationId: z.uuid({ error: 'INVALID_CHOICE' }).optional(),
  ...consentFields,
  createAccount: z.boolean().default(false),
});

/** DEM-019 — « Devenir partenaire » (EP-23). Promoters and banks are sent to the partner signup instead (EP-32). */
export const PartnerRequesterKind = ['NOTARY', 'INSURER', 'INSTITUTION', 'MEDIA', 'OTHER'] as const;
export const partnerRequestFieldsSchema = z.object({
  company: z.string({ error: 'REQUIRED' }).transform(collapse).pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(120, { error: 'TOO_LONG' })),
  requesterKind: z.enum(PartnerRequesterKind, { error: 'INVALID_CHOICE' }),
  firstName: personNameSchema,
  lastName: personNameSchema,
  jobTitle: optional(z.string().transform(collapse).pipe(z.string().max(80, { error: 'TOO_LONG' }))),
  email: emailSchema,
  phone: phoneSchema,
  country: countryCodeSchema,
  websiteUrl: optional(z.string().trim().max(200, { error: 'TOO_LONG' }).pipe(z.url({ error: 'INVALID_CHOICE' }))),
  message: messageSchema.pipe(z.string().min(1, { error: 'REQUIRED', abort: true })),
  consentContact: consentSchema,
  consentKey: consentKeySchema.default(CURRENT_CONTACT_CONSENT_KEY),
});

/**
 * DEM-016 — « Être rappelé par un conseiller » unfolded under a simulator result: Prénom · Nom · E-mail · Téléphone
 * (case WhatsApp) · Quand vous appeler ? · Consentement. The simulation (written first, SIM-032 « Routes ») travels as
 * `simulationId` next to the fields.
 */
export const simulationFollowupFieldsSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  whatsappOptIn: z.boolean().default(false),
  ...callbackFields,
  ...consentFields,
  createAccount: z.boolean().default(false),
});

const envelope = {
  context: leadContextSchema,
  tracking: leadTrackingSchema,
  /** DEM-030 point 1 — must stay empty. Any other value marks the request as spam (score 100). */
  [LEAD_HONEYPOT_FIELD]: z.string().max(2000).optional(),
  /** DEM-030 point 4 — proof of the challenge, after a 403 CHALLENGE_REQUIRED. */
  challengeToken: z.string().max(4000).optional(),
};

/** `POST /public/leads` — discriminated by `form` (DEM-025: `form` is the kind of the submitted form). */
export const leadSubmitSchema = z.discriminatedUnion(
  'form',
  [
    z.object({ form: z.literal('PROPERTY_INTEREST'), formVersion: z.number().int().positive().default(1), fields: propertyInterestFieldsSchema, ...envelope }),
    z.object({ form: z.literal('PROJECTION_REQUEST'), formVersion: z.number().int().positive().default(1), fields: projectionFieldsSchema, ...envelope }),
    z.object({ form: z.literal('CALLBACK_REQUEST'), formVersion: z.number().int().positive().default(1), fields: callbackFieldsSchema, ...envelope }),
    z.object({ form: z.literal('CONTACT_MESSAGE'), formVersion: z.number().int().positive().default(1), fields: contactFieldsSchema, ...envelope }),
    z.object({ form: z.literal('GUIDED_SEARCH'), formVersion: z.number().int().positive().default(1), fields: guidedSearchFieldsSchema, ...envelope }),
    z.object({ form: z.literal('PARTNER_REQUEST'), formVersion: z.number().int().positive().default(1), fields: partnerRequestFieldsSchema, ...envelope }),
    z.object({
      form: z.literal('SIMULATION_FOLLOWUP'),
      formVersion: z.number().int().positive().default(1),
      fields: simulationFollowupFieldsSchema,
      /** DEM-016 — the simulation joined to the request (`Lead.simulationId`): same `dp_anon` browser. */
      simulationId: z.uuid({ error: 'INVALID_CHOICE' }),
      ...envelope,
    }),
  ],
  { error: 'INVALID_CHOICE' },
);
export type LeadSubmitRequest = z.infer<typeof leadSubmitSchema>;
export type LeadSubmitInput = z.input<typeof leadSubmitSchema>;
export type LeadForm = LeadSubmitRequest['form'];

/** The public forms (DEM-010). */
export const PUBLIC_LEAD_FORMS = ['PROPERTY_INTEREST', 'PROJECTION_REQUEST', 'CALLBACK_REQUEST', 'CONTACT_MESSAGE', 'GUIDED_SEARCH', 'PARTNER_REQUEST', 'SIMULATION_FOLLOWUP'] as const;

// ─── Form token (DEM-030) ───────────────────────────────────────────────────

/** Forms that ask for a token: the request kinds, and the Café registration (CAF-026 reuses DEM-030). */
export const FORM_TOKEN_FORMS = [...Object.values(LeadKind), 'CAFE_REGISTRATION', 'SIGNUP', 'PARTNER_SIGNUP'] as const; // AUTH-005, ACP-081 reuse DEM-030
export const formTokenRequestSchema = z.object({
  form: z.enum(FORM_TOKEN_FORMS, { error: 'INVALID_CHOICE' }),
});
export type FormTokenRequest = z.infer<typeof formTokenRequestSchema>;
export interface FormTokenResponse {
  token: string;
  /** API-002 instant. */
  expiresAt: string;
}

// ─── Projection second screen (DEM-013) ─────────────────────────────────────

/**
 * `POST /public/leads/complete`. With only `email`: the address is corrected (D-095) and the token stays usable for the
 * completion. With any other field: the request is completed — once, within 30 minutes.
 */
export const leadCompleteSchema = z.object({
  completionToken: z.string().min(20).max(200),
  fields: z
    .object({
      email: optional(emailSchema),
      firstName: optional(personNameSchema),
      lastName: optional(personNameSchema),
      phone: optional(phoneSchema),
      whatsappOptIn: optional(z.boolean()),
      countryOfResidence: optional(countryCodeSchema),
      ...callbackFields,
    })
    .refine((f) => Object.values(f).some((v) => v !== undefined), { error: 'REQUIRED' }),
});
export type LeadCompleteRequest = z.infer<typeof leadCompleteSchema>;

// ─── Responses (DEM-027) ────────────────────────────────────────────────────

/** DEM-026 — what happened to the property during the input. */
export type LeadPropertyOutcome = 'RESERVED' | 'UNAVAILABLE' | null;

/**
 * DEM-027 — `POST /public/leads` → always 201 and exactly this shape for an anonymous visitor, whether the request was
 * created, merged into an earlier one (DEM-024) or classed as spam (DEM-031). No id, no reference, no date. The screen
 * composes `{quand}` from `preferredCallbackDate` and `preferredSlot` (NOT-053; API-002: no screen text).
 */
export interface LeadSubmitResponse {
  kind: LeadKind;
  firstName: string | null;
  email: string;
  preferredCallbackDate: string | null;
  preferredSlot: ContactTimeSlot | null;
  /** DEM-021 — true when « Créer mon espace client » was checked, never telling whether an account existed. */
  accountHint: boolean;
  propertyOutcome: LeadPropertyOutcome;
  /** DEM-013 — projections only: the second-screen token (30 minutes). */
  completionToken?: string;
  /** DEM-023 — signed-in client only. */
  reference?: string;
}

/** `POST /public/leads/complete` → 200, the confirmation data of DEM-023 (same fields, without the token). */
export type LeadCompleteResponse = Omit<LeadSubmitResponse, 'completionToken'>;

/** Preferred channel of DEM-011 → `ContactChannel` of the client record. */
export const preferredChannelToContactChannel = {
  CALL: ContactChannel.PHONE,
  WHATSAPP: ContactChannel.WHATSAPP,
  EMAIL: ContactChannel.EMAIL,
} as const;
