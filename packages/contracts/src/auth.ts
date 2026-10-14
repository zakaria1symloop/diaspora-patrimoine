// Package 1.6 « Identité », 2.10 « Compte client », A.14 « Inscription des partenaires » — wire contracts of the `/auth`,
// `/client/me`, `/admin/me` and `/partner` routes (03-espace-client/01, 06-technique/02 API-003, 06-technique/03 § 1 à 6,
// 00-cadre/06 ACP-080…087). One schema per request, used by the browser AND the API (ARC-030). Error messages are
// TRV-064 codes; the screens translate them (API-002).
import { z } from 'zod';
import { countryCodeSchema, emailSchema, LEAD_HONEYPOT_FIELD, personNameSchema, phoneSchema } from './schemas/leads.js';

// ─── Audiences, headers, cookies (API-003, SEC-022, SEC-027) ────────────────

/** API-003 — who a request speaks for. `PARTNER` is the partner space of the site (EP-33, ROL-004). */
export const Audience = { WEB: 'WEB', ADMIN: 'ADMIN', PARTNER: 'PARTNER', MOBILE: 'MOBILE' } as const;
export type Audience = (typeof Audience)[keyof typeof Audience];
export type BrowserAudience = 'WEB' | 'ADMIN' | 'PARTNER';

/**
 * API-003 — the audience comes from `Origin` (WEB_URL → WEB, ADMIN_URL → ADMIN). The partner space lives on the site's
 * own host (EP-33): its pages add `X-Audience: PARTNER`, accepted only from the site's origin. `[MOB]` `X-Audience: MOBILE`.
 */
export const AUDIENCE_HEADER = 'X-Audience';
/** SEC-027 — the anti-forgery token, read from the readable cookie and sent back in this header on every write. */
export const CSRF_HEADER = 'X-CSRF-Token';

const COOKIE_BASE: Record<BrowserAudience, string> = { WEB: 'dp_web', ADMIN: 'dp_admin', PARTNER: 'dp_partner' };

/**
 * SEC-022 — names of the session cookies, one set per application. Outside `local`, they carry the `__Host-` prefix
 * (Secure, Path=/, no Domain). In `local` (plain http) the prefix — which requires Secure — is dropped, like the
 * other cookies of the local environment; nothing else changes.
 */
export function authCookieName(audience: BrowserAudience, kind: 'access' | 'refresh' | 'step' | 'device', hostPrefix: boolean): string {
  // AUTH-033 — the partner space is a page of the site: one device cookie for the site's two doors.
  const base = kind === 'device' && audience === 'PARTNER' ? COOKIE_BASE.WEB : COOKIE_BASE[audience];
  return `${hostPrefix ? '__Host-' : ''}${base}_${kind}`;
}

/** SEC-022, SEC-027 — the anti-forgery cookie, readable by the page (never a session token). */
export function csrfCookieName(audience: BrowserAudience): string {
  return `${COOKIE_BASE[audience]}_csrf`;
}

/** `__Host-` prefix everywhere except the local environment (http). */
export function usesHostPrefix(appEnv: string): boolean {
  return appEnv !== 'local';
}

// ─── Steps (AUTH-022, AUTH-026, BO-003) ─────────────────────────────────────

export const NextStep = {
  TWO_FACTOR: 'TWO_FACTOR',
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  TERMS: 'TERMS',
  STAFF_SETUP: 'STAFF_SETUP',
} as const;
export type NextStep = (typeof NextStep)[keyof typeof NextStep];

export const StaffSetupStep = { PASSWORD: 'PASSWORD', TWO_FACTOR: 'TWO_FACTOR', CHARTER: 'CHARTER' } as const;
export type StaffSetupStep = (typeof StaffSetupStep)[keyof typeof StaffSetupStep];

/** AUTH-086 — the action a confirmation code is issued for, kept in the token and checked with it. */
export const SensitiveAction = {
  EMAIL_CHANGE: 'EMAIL_CHANGE',
  TWO_FACTOR: 'TWO_FACTOR',
  DATA_EXPORT: 'DATA_EXPORT',
  ACCOUNT_DELETION: 'ACCOUNT_DELETION',
  PASSWORD_SET: 'PASSWORD_SET',
} as const;
export type SensitiveAction = (typeof SensitiveAction)[keyof typeof SensitiveAction];

// ─── Constants (01-domaine/02 § 1.5, SEC-011, SEC-023) ──────────────────────

export const AUTH_LIMITS = {
  /** AUTH-002 — upper bound; the lower bound is the setting `security.password.minLength` (10). */
  passwordMaxLength: 128,
  passwordMinLengthDefault: 10,
  /** SEC-011 — ten recovery codes of 10 characters, shown in groups of 5. */
  recoveryCodeCount: 10,
  /** AUTH-050 — wrong codes allowed on a login challenge (the 5th locks the account). */
  maxCodeAttempts: 5,
} as const;

/** File offered by « Télécharger » for the recovery codes (SEC-011). */
export const RECOVERY_CODES_FILENAME = 'codes-de-secours-diaspora-patrimoine.txt';

/**
 * AUTH-001, MOD-106 — the sentences next to the boxes of the account forms (proof data: the server stores the text of
 * the key, never a text received from the browser). The marketing box reuses `lead.marketing.v1` (same sentence).
 */
export const AuthConsentWording = {
  'auth.terms.v1': 'J’accepte les conditions générales et la politique de confidentialité.',
  'auth.legalAccept.v1': 'J’ai lu et j’accepte.',
  'partner.charter.v1': 'J’ai lu et j’accepte la charte des partenaires.',
} as const;

// ─── AUTH-023 — internal return path ────────────────────────────────────────

/** AUTH-023, SEC-062 — only an internal path is accepted: `/…`, never `//host`, `/\host`, a scheme or control characters. */
export function isSafeNextPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return false;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return false;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  return true;
}

/** An optional return path: anything unsafe is dropped (AUTH-023: « toute autre valeur est ignorée »). */
const nextPathSchema = z
  .unknown()
  .optional()
  .transform((v) => (isSafeNextPath(v) ? v : undefined));

// ─── Field primitives ───────────────────────────────────────────────────────

/** A password as typed: never trimmed, 128 characters at most (AUTH-002). Length and content rules are server-side. */
export const passwordInputSchema = z
  .string({ error: 'REQUIRED' })
  .min(1, { error: 'REQUIRED', abort: true })
  .max(AUTH_LIMITS.passwordMaxLength, { error: 'TOO_LONG' });

/** SEC-040 — an opaque link token (base64url). A malformed one is answered like an unknown one (410), never 422. */
export const linkTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,200}$/);

/** SEC-011 — a 6-digit code (spaces typed by the person are removed). */
export const otpCodeSchema = z
  .string({ error: 'REQUIRED' })
  .transform((s) => s.replace(/\s+/g, ''))
  .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).regex(/^\d{6}$/, { error: 'INVALID_CHOICE' }));

/** SEC-011 — a recovery code `k7m2p-x9q4t` (case, spaces and the hyphen are tolerated). */
export const recoveryCodeSchema = z
  .string({ error: 'REQUIRED' })
  .transform((s) => s.toLowerCase().replace(/[\s-]+/g, ''))
  .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).regex(/^[a-z0-9]{10}$/, { error: 'INVALID_CHOICE' }));

const timezoneSchema = z
  .string()
  .max(64)
  .regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/)
  .optional()
  .catch(undefined);
const localeSchema = z.enum(['fr', 'ar', 'en']).default('fr').catch('fr');
const utmSchema = z.record(z.string().max(40), z.string().max(200)).optional().catch(undefined);
const honeypot = { [LEAD_HONEYPOT_FIELD]: z.string().max(500).optional() };

/** AUTH-086 — the proof travelling in the request of a sensitive action: `password`, or `actionCode` without a password. */
const proofFields = {
  password: passwordInputSchema.optional(),
  actionCode: otpCodeSchema.optional(),
};

// ─── /auth requests ─────────────────────────────────────────────────────────

/** AUTH-020 — `POST /auth/login`. */
export const loginRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordInputSchema,
  rememberMe: z.boolean().default(false),
  simulationId: z.uuid().optional().catch(undefined),
  next: nextPathSchema,
});
export type LoginRequest = z.input<typeof loginRequestSchema>;

/** AUTH-050 — `POST /auth/login/two-factor`: a code of the application, or a recovery code. */
export const twoFactorLoginRequestSchema = z.union([
  z.strictObject({ code: otpCodeSchema }),
  z.strictObject({ recoveryCode: recoveryCodeSchema }),
]);
export type TwoFactorLoginRequest = z.input<typeof twoFactorLoginRequestSchema>;

/** AUTH-001 — `POST /auth/signup`. The anonymous id is read from the `dp_anon` cookie, never from the body. */
export const signupRequestSchema = z.strictObject({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordInputSchema,
  acceptTerms: z.literal(true, { error: 'MUST_ACCEPT' }),
  marketingOptIn: z.boolean().default(false),
  timezone: timezoneSchema,
  locale: localeSchema,
  next: nextPathSchema,
  simulationId: z.uuid().optional().catch(undefined),
  utm: utmSchema,
  ...honeypot,
});
export type SignupRequest = z.input<typeof signupRequestSchema>;

/** AUTH-012 — `PATCH /auth/signup/email` (step EMAIL_VERIFICATION): an empty account changes its address. */
export const signupEmailRequestSchema = z.strictObject({ email: emailSchema, password: passwordInputSchema });

/** AUTH-013 — `POST /auth/verify-email`. Without `password`, opened elsewhere than in the browser of the sign-up: the
 *  answer asks for it (`PASSWORD_REQUIRED`) without consuming the link. */
export const verifyEmailRequestSchema = z.strictObject({ token: linkTokenSchema, password: passwordInputSchema.optional() });

/** AUTH-012, AUTH-013 — `POST /auth/verify-email/resend`: from the waiting step (no body), or « Recevoir un nouveau lien ». */
export const resendVerificationRequestSchema = z.strictObject({ email: emailSchema.optional() });

export const tokenRequestSchema = z.strictObject({ token: linkTokenSchema });

/** AUTH-040 — `POST /auth/activate`. */
export const activateRequestSchema = z.strictObject({
  token: linkTokenSchema,
  password: passwordInputSchema,
  acceptTerms: z.literal(true, { error: 'MUST_ACCEPT' }),
  marketingOptIn: z.boolean().default(false),
});
export type ActivateRequest = z.input<typeof activateRequestSchema>;

/** AUTH-041, AUTH-045, AUTH-040 — a single e-mail field (`magic-link`, `password/forgot`, « Recevoir un nouveau lien »). */
export const emailOnlyRequestSchema = z.strictObject({ email: emailSchema, next: nextPathSchema });

/** AUTH-045 — `POST /auth/password/reset`. */
export const passwordResetRequestSchema = z.strictObject({ token: linkTokenSchema, password: passwordInputSchema });

/** AUTH-090 — `POST /auth/legal/accept` (step TERMS). */
export const legalAcceptRequestSchema = z.strictObject({ accept: z.literal(true, { error: 'MUST_ACCEPT' }) });

/** AUTH-086 — `POST /auth/action-code`. */
export const actionCodeRequestSchema = z.strictObject({ action: z.enum(SensitiveAction, { error: 'INVALID_CHOICE' }) });

/** API-003 — `POST /auth/refresh`: `userActive` true when the person made a gesture since the previous renewal. */
export const refreshRequestSchema = z.strictObject({ userActive: z.boolean().default(false) });

/** BO-005 — `POST /auth/confirm-password`. */
export const confirmPasswordRequestSchema = z.strictObject({ password: passwordInputSchema });

/** BO-003 — first sign-in of an invited staff member. */
export const staffSetupPasswordRequestSchema = z.strictObject({ password: passwordInputSchema });
export const staffSetupTwoFactorRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('SETUP') }),
  z.strictObject({ action: z.literal('CONFIRM'), code: otpCodeSchema }),
  z.strictObject({ action: z.literal('ENABLE'), saved: z.literal(true, { error: 'MUST_ACCEPT' }) }),
]);
export const staffSetupCharterRequestSchema = z.strictObject({ accept: z.literal(true, { error: 'MUST_ACCEPT' }) });

// ─── /client/me, /admin/me (AUTH-080, AUTH-081, AUTH-086, PRO-020, PRO-021, BO-070) ──

export const twoFactorSetupRequestSchema = z.strictObject({ ...proofFields });
export const twoFactorConfirmRequestSchema = z.strictObject({ code: otpCodeSchema });
export const twoFactorEnableRequestSchema = z.strictObject({ saved: z.literal(true, { error: 'MUST_ACCEPT' }) });
export const twoFactorDisableRequestSchema = z.strictObject({ ...proofFields, code: otpCodeSchema });
export const recoveryCodesRequestSchema = z.strictObject({ ...proofFields });
export const changeEmailRequestSchema = z.strictObject({ email: emailSchema, ...proofFields });
export const changePasswordRequestSchema = z.strictObject({
  currentPassword: passwordInputSchema.optional(),
  actionCode: otpCodeSchema.optional(),
  newPassword: passwordInputSchema,
});
/** BO-070 — staff reconfiguration of the second factor: password and a current code. */
export const staffTwoFactorReconfigureRequestSchema = z.strictObject({ password: passwordInputSchema, code: otpCodeSchema });

// ─── Partners (ACP-081, ACP-087) ────────────────────────────────────────────

export const PartnerKind = { PROMOTER: 'PROMOTER', BANK: 'BANK' } as const;
export type PartnerKind = (typeof PartnerKind)[keyof typeof PartnerKind];

const companyText = (max: number) =>
  z
    .string({ error: 'REQUIRED' })
    .transform((s) => s.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(max, { error: 'TOO_LONG' }));

/** ACP-081 — `POST /auth/partner-signup` (steps 1 and 2, no file). */
export const partnerSignupRequestSchema = z.strictObject({
  partnerKind: z.enum(PartnerKind, { error: 'REQUIRED' }),
  companyName: companyText(160),
  country: countryCodeSchema,
  city: companyText(80),
  firstName: personNameSchema,
  lastName: personNameSchema,
  jobTitle: companyText(80),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordInputSchema,
  acceptCharter: z.literal(true, { error: 'MUST_ACCEPT' }),
  consent: z.literal(true, { error: 'MUST_ACCEPT' }),
  timezone: timezoneSchema,
  locale: localeSchema,
  ...honeypot,
});
export type PartnerSignupRequest = z.input<typeof partnerSignupRequestSchema>;

const optionalText = (max: number) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), z.string().trim().max(max, { error: 'TOO_LONG' }).optional());
const websiteSchema = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z
    .string()
    .trim()
    .max(200, { error: 'TOO_LONG' })
    .regex(/^https?:\/\/[^\s/$.?#].[^\s]*$/i, { error: 'INVALID_CHOICE' })
    .optional(),
);

/** ACP-087 « Votre activité » — promoter. */
export const promoterActivitySchema = z.strictObject({
  registrationNumber: companyText(60),
  foundedYear: z.number({ error: 'REQUIRED' }).int({ error: 'NOT_A_NUMBER' }).min(1900, { error: 'OUT_OF_RANGE' }).max(2100, { error: 'OUT_OF_RANGE' }),
  ongoingPrograms: z.number({ error: 'REQUIRED' }).int({ error: 'NOT_A_NUMBER' }).min(0, { error: 'OUT_OF_RANGE' }).max(500, { error: 'OUT_OF_RANGE' }),
  regionIds: z.array(z.uuid()).min(1, { error: 'REQUIRED' }).max(60),
  website: websiteSchema,
});
/** ACP-087 « Votre activité » — bank. */
export const bankActivitySchema = z.strictObject({
  licenseNumber: companyText(60),
  financingTypes: z.array(z.enum(['CLASSIC', 'ISLAMIC'])).min(1, { error: 'REQUIRED' }).max(2),
  clientCountries: z.array(countryCodeSchema).min(1, { error: 'REQUIRED' }).max(250),
  agency: optionalText(120),
  website: websiteSchema,
});
/** ACP-087 « Votre image » (optional section). */
export const partnerImageSchema = z.strictObject({
  presentation: optionalText(200),
  message: optionalText(2000),
});

export const PartnerApplicationSection = { activity: 'activity', documents: 'documents', image: 'image' } as const;
export type PartnerApplicationSection = keyof typeof PartnerApplicationSection;

/** ACP-087 — files of the application: section and slot. */
export const PartnerFileSlot = {
  /** Extract of registration (promoter) or licence (bank) — required. */
  REGISTRATION: 'REGISTRATION',
  /** Company presentation, PDF — optional. */
  PRESENTATION: 'PRESENTATION',
  /** Logo, image — optional (section « Votre image »). */
  LOGO: 'LOGO',
} as const;
export type PartnerFileSlot = (typeof PartnerFileSlot)[keyof typeof PartnerFileSlot];

/** MED-011, ACP-087 — 10 MB at most, PDF or image; the presentation is a PDF; the logo an image. */
export const PARTNER_FILE_RULES: Record<PartnerFileSlot, { maxMb: number; types: readonly string[] }> = {
  REGISTRATION: { maxMb: 10, types: ['application/pdf', 'image/jpeg', 'image/png'] },
  PRESENTATION: { maxMb: 10, types: ['application/pdf'] },
  LOGO: { maxMb: 10, types: ['image/jpeg', 'image/png', 'image/webp'] },
};

/** API-080 — announcement of one file. */
export const partnerUploadRequestSchema = z.strictObject({
  slot: z.enum(PartnerFileSlot, { error: 'INVALID_CHOICE' }),
  fileName: z.string().trim().min(1, { error: 'REQUIRED' }).max(200, { error: 'TOO_LONG' }),
  contentType: z.string().min(1).max(100),
  size: z.number().int().min(1, { error: 'FILE_UNREADABLE' }),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, { error: 'CHECKSUM_MISMATCH' }),
});

// ─── Responses ──────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  kind: 'CLIENT' | 'STAFF' | 'PARTNER';
  firstName: string | null;
  lastName: string | null;
  /** Effective role of a staff member (MOD-104); `null` otherwise. */
  role: string | null;
}

/** API-003 — the answer of every route that opens a session. */
export interface SessionResponse {
  status: 'SESSION';
  csrfToken: string;
  accessExpiresAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  user: SessionUser;
  /** AUTH-023 — internal path to go to now (page asked for, or the space's home). */
  redirectTo: string;
}

/** AUTH-026 — a step remains: no session, a step cookie. */
export interface StepResponse {
  status: 'STEP';
  nextStep: NextStep;
  /** STAFF_SETUP — the steps left, deduced from the account (BO-003). */
  remainingSteps?: StaffSetupStep[];
  /** EMAIL_VERIFICATION — the address written to (the person just typed it). */
  email?: string;
  /** TERMS — never accepted before (AUTH-041 « Avant de continuer, merci d'accepter nos conditions. »). */
  firstAcceptance?: boolean;
  /** TWO_FACTOR — codes still allowed. */
  remainingAttempts?: number;
}

export type LoginResponse = SessionResponse | StepResponse;

/** TRV-112 — the same answer whatever the address: `{ status: 'SENT' }`. */
export interface SentResponse {
  status: 'SENT';
}

/** AUTH-013 — what opening a verification link did. */
export type VerifyEmailResponse =
  | SessionResponse
  | StepResponse
  | { status: 'PASSWORD_REQUIRED' }
  | { status: 'ALREADY_VERIFIED'; redirectTo: string };

/** AUTH-040 — what an activation link is, before the form is shown. */
export type ActivationCheckResponse =
  | { status: 'VALID'; firstName: string | null; fromSignup: boolean }
  /** The space is already active: sign in, then the page aimed at (MOD-105). */
  | { status: 'ACTIVE'; next: string };

/** AUTH-080 — confirmation of a new address. */
export interface EmailChangeConfirmResponse {
  status: 'CHANGED' | 'MERGE_PENDING';
  /** True when the browser holds a session of this account (the page leads to the profile). */
  signedIn: boolean;
}

/** AUTH-090 — the texts to accept (step TERMS). */
export interface LegalStepResponse {
  firstAcceptance: boolean;
  documents: { type: 'TERMS_OF_USE' | 'PRIVACY_POLICY'; version: string; title: string; effectiveAt: string; changeSummary: string | null; url: string }[];
}

/** NAV-013 — `GET /client/me`: who is signed in, and what the header shows. */
export interface ClientMe {
  id: string;
  clientId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  /** DEM-022 — the request forms ask only for what the record lacks (the phone, the country of residence). */
  countryOfResidence: string | null;
  unreadNotifications: number;
  hasDossier: boolean;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  pendingEmail: string | null;
}

/** PRO-021, BO-070 — one open session. */
export interface SessionItem {
  id: string;
  deviceLabel: string | null;
  lastUsedAt: string;
  createdAt: string;
  current: boolean;
}

/** PRO-020 — enrolment of an authenticator application. */
export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
  /** QR code of `otpauthUrl`, as an SVG document. */
  qrSvg: string;
}

export interface RecoveryCodesResponse {
  /** Ten codes `k7m2p-x9q4t`, shown once (SEC-011). */
  recoveryCodes: string[];
}

/** BO-003 — state of a first sign-in. */
export interface StaffSetupStateResponse {
  remainingSteps: StaffSetupStep[];
  firstName: string | null;
  role: string | null;
  /** Text of the charter (`admin.charter` block), when that step remains. */
  charter: string | null;
}

/** ACP-083 — the partner space. */
export interface PartnerApplicationResponse {
  partnerKind: PartnerKind;
  status: 'EMAIL_UNVERIFIED' | 'DRAFT' | 'SUBMITTED' | 'INFO_REQUESTED' | 'APPROVED' | 'DECLINED';
  firstName: string | null;
  companyName: string;
  sections: {
    activity: { complete: boolean; values: Record<string, unknown> | null };
    documents: { complete: boolean; files: { id: string; slot: PartnerFileSlot; fileName: string; sizeBytes: number; scanStatus: string }[] };
    image: { complete: boolean; values: Record<string, unknown> | null };
  };
  requiredDone: number;
  canSubmit: boolean;
  submittedAt: string | null;
  /** INFO_REQUESTED — the team's message, word for word; DECLINED — the sentence written for the person, if any. */
  teamMessage: string | null;
  reviewDays: number;
}

export interface PartnerUploadResponse {
  id: string;
  /** API-080 — where to send the bytes (`PUT`, 15 minutes). */
  uploadUrl: string;
  expiresAt: string;
}
