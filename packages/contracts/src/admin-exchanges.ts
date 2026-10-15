// Package 3.2 « Échanges et e-mail écrit à la main » — wire contracts of `/admin/communications` (CRM-030, CRM-031,
// COM-030, MOD-400) and `/admin/emails` (COM-020 … COM-022, NOT-043). One schema per request, used by the browser AND the
// API (ARC-030). Texts never travel: codes and values, translated by the screens (API-002).
import { z } from 'zod';

const blankToNull = (v: unknown) => (v === '' || v === null || v === undefined ? null : v);
const optionalId = z.preprocess(blankToNull, z.uuid({ error: 'INVALID_CHOICE' }).nullable()).default(null);

/** CRM-030, CRM-031 — what is noted by hand: a call, a WhatsApp exchange, a meeting. */
export const EXCHANGE_CHANNELS = ['CALL', 'WHATSAPP', 'MEETING'] as const;
export type ExchangeChannel = (typeof EXCHANGE_CHANNELS)[number];
export const EXCHANGE_DIRECTIONS = ['OUTBOUND', 'INBOUND'] as const;
export type ExchangeDirection = (typeof EXCHANGE_DIRECTIONS)[number];
export const CALL_OUTCOMES = ['REACHED', 'NO_ANSWER', 'VOICEMAIL', 'WRONG_NUMBER'] as const;
export type CallOutcomeValue = (typeof CALL_OUTCOMES)[number];

export const EXCHANGE_REPORT_MAX = 5000;
/** MOD-400 — a report is corrected or deleted by its author within 24 hours. */
export const EXCHANGE_EDIT_HOURS = 24;

/** The object an exchange or an e-mail is tied to: at least one of the three (the request, the client, the dossier). */
const targetShape = { leadId: optionalId, clientId: optionalId, dossierId: optionalId };
const requireTarget = (v: { leadId: string | null; clientId: string | null; dossierId: string | null }, ctx: z.RefinementCtx) => {
  if (!v.leadId && !v.clientId && !v.dossierId) ctx.addIssue({ code: 'custom', path: ['clientId'], message: 'REQUIRED' });
};

const reportSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : v),
  z.preprocess(blankToNull, z.string().max(EXCHANGE_REPORT_MAX, { error: 'TOO_LONG' }).nullable()),
).default(null);
const instantSchema = z.preprocess(blankToNull, z.iso.datetime({ offset: true, error: 'INVALID_DATE' }).nullable()).default(null);
const durationSchema = z.preprocess(blankToNull, z.coerce.number({ error: 'NOT_A_NUMBER' }).int({ error: 'NOT_A_NUMBER' }).min(0, { error: 'OUT_OF_RANGE' }).max(600, { error: 'OUT_OF_RANGE' }).nullable()).default(null);

const exchangeFacts = {
  channel: z.enum(EXCHANGE_CHANNELS, { error: 'REQUIRED' }),
  direction: z.enum(EXCHANGE_DIRECTIONS).default('OUTBOUND'),
  /** Required for a call; never for a WhatsApp exchange or a meeting. */
  callOutcome: z.preprocess(blankToNull, z.enum(CALL_OUTCOMES, { error: 'INVALID_CHOICE' }).nullable()).default(null),
  /** Now, by default; never in the future (the API checks against its own clock). */
  occurredAt: instantSchema,
  durationMinutes: durationSchema,
  body: reportSchema,
};
const checkFacts = (v: { channel: ExchangeChannel; callOutcome: CallOutcomeValue | null; body: string | null }, ctx: z.RefinementCtx) => {
  if (v.channel === 'CALL' && !v.callOutcome) ctx.addIssue({ code: 'custom', path: ['callOutcome'], message: 'REQUIRED' });
  // CRM-030 — the report is required when the person was reached; an exchange or a meeting without a word says nothing.
  if (!v.body && (v.channel !== 'CALL' || v.callOutcome === 'REACHED')) ctx.addIssue({ code: 'custom', path: ['body'], message: 'REQUIRED' });
};

/** CRM-030 « Suite » — « Me rappeler de… »: a call task for the author, with its due date. */
export const exchangeFollowUpSchema = z.strictObject({
  title: z
    .string({ error: 'REQUIRED' })
    .transform((s) => s.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(160, { error: 'TOO_LONG' })),
  dueDate: z.string({ error: 'REQUIRED' }).regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'INVALID_DATE' }),
  dueTime: z.preprocess(blankToNull, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'INVALID_DATE' }).nullable()).default(null),
});

/** `POST /admin/communications` (`communication.log`). */
export const exchangeCreateSchema = z
  .strictObject({ ...targetShape, ...exchangeFacts, followUp: exchangeFollowUpSchema.nullable().default(null) })
  .superRefine((v, ctx) => {
    requireTarget(v, ctx);
    checkFacts(v, ctx);
  });
export type ExchangeCreate = z.input<typeof exchangeCreateSchema>;

/** `PATCH /admin/communications/{id}` — text, outcome, date, duration, direction (MOD-400); the channel never changes. */
export const exchangeUpdateSchema = z.strictObject({
  direction: exchangeFacts.direction,
  callOutcome: exchangeFacts.callOutcome,
  occurredAt: instantSchema,
  durationMinutes: durationSchema,
  body: reportSchema,
});
export type ExchangeUpdate = z.input<typeof exchangeUpdateSchema>;

export const RECEIVED_EMAIL_BODY_MAX = 20_000;

/** COM-030 — `POST /admin/communications/received-email`: date, subject, pasted text. */
// ─── Files of an e-mail (COM-020 « Pièces jointes », COM-030 « fichiers éventuels »; MED-010) ─────────────────────

/** MED-010 — a hand-written e-mail's attachments: these formats, 10 MB in all, five at most. */
export const EMAIL_ATTACHMENT_FORMATS = ['pdf', 'jpg', 'png', 'docx', 'xlsx'] as const;
export const EMAIL_ATTACHMENTS_MAX = 5;
export const EMAIL_ATTACHMENTS_MAX_BYTES = 10_000_000;
/** A file sent through API-080 and checked (`POST /admin/emails/uploads/{id}/complete`), or one of an e-mail. */
export interface EmailAttachment {
  uploadId: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
}
const attachmentIdsSchema = z.array(z.uuid()).max(EMAIL_ATTACHMENTS_MAX, { error: 'TOO_LONG' }).default([]);

export const receivedEmailSchema = z
  .strictObject({
    ...targetShape,
    occurredAt: instantSchema,
    subject: z
      .string({ error: 'REQUIRED' })
      .transform((s) => s.trim().replace(/\s+/g, ' '))
      .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(200, { error: 'TOO_LONG' })),
    body: z
      .string({ error: 'REQUIRED' })
      .transform((s) => s.replace(/\r\n/g, '\n').trim())
      .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(RECEIVED_EMAIL_BODY_MAX, { error: 'TOO_LONG' })),
    /** COM-030 « fichiers éventuels » — uploads completed by the author (API-080). */
    attachmentIds: attachmentIdsSchema,
  })
  .superRefine(requireTarget);
export type ReceivedEmail = z.input<typeof receivedEmailSchema>;

/** What the API answers after an exchange is noted or corrected. */
export interface ExchangeResult {
  id: string;
  /** Requests whose first contact appeared with this exchange (CYC-004), and those it closed (CYC-005). */
  firstContact: { leadIds: string[]; closedLeadIds: string[] };
  /** The follow-up task created (« Me rappeler de… »), when one was asked. */
  taskId: string | null;
}

// ─── Hand-written e-mail (COM-020) ──────────────────────────────────────────

export const MANUAL_EMAIL_BODY_MAX = 20_000;

/** Warnings shown before the sending (COM-020). `DO_NOT_CONTACT` and `RESTRICTED` ask for an explicit confirmation. */
export type EmailWarning =
  | { code: 'ADDRESS_BOUNCED'; date: string }
  | { code: 'DO_NOT_CONTACT'; reason: string | null; date: string | null }
  | { code: 'RESTRICTED'; date: string }
  | { code: 'EMAIL_DOUBTFUL' };
export const EMAIL_CONFIRMABLE_WARNINGS = ['DO_NOT_CONTACT', 'RESTRICTED'] as const;
export type EmailConfirmableWarning = (typeof EMAIL_CONFIRMABLE_WARNINGS)[number];

/** A template of the window: its texts with the dynamic fields ALREADY replaced by their values (COM-020). */
export interface EmailTemplateOption {
  code: string;
  name: string;
  subject: string;
  /** Restricted Markdown (NOT-061), without the button. */
  body: string;
  /** The template's button, with its destination resolved; the writer may keep it or leave it out. */
  button: { label: string; href: string } | null;
}

/** `GET /admin/emails/compose?leadId=&clientId=&dossierId=` (`email.send`). */
export interface EmailComposeContext {
  /** Why the window cannot open: no address (MOD-302), or a person whose data were erased. Null: it opens. */
  blocked: 'NO_ADDRESS' | 'ERASED' | null;
  /** The recipient, never editable: the client, the applicant of a partner request, or the promoter's contact chosen. */
  recipient: { address: string; name: string | null; firstName: string | null; kind: 'CLIENT' | 'APPLICANT' | 'PARTNER' } | null;
  /** CTL-006 — a promoter's contacts that have an address (the recipient is one; another may be put in copy); else null. */
  contacts: { id: string; name: string; email: string; isPrimary: boolean }[] | null;
  /** The contact the recipient is (CTL-006). */
  contactId: string | null;
  warnings: EmailWarning[];
  templates: EmailTemplateOption[];
  /** COM-021 — « {Prénom N.} — {fonction} », then the lines of the adviser's signature (BO-070). */
  signature: { line: string; text: string | null };
  /** `mail.fromName` and the address the answers go to (COM-021). */
  sender: { fromName: string; replyTo: string | null };
  /** The staff member's time zone, for « Envoyer plus tard ». */
  timeZone: string;
}

const subjectSchema = z
  .string({ error: 'REQUIRED' })
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(200, { error: 'TOO_LONG' }));
const bodySchema = z
  .string({ error: 'REQUIRED' })
  .transform((s) => s.replace(/\r\n/g, '\n').trim())
  .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(MANUAL_EMAIL_BODY_MAX, { error: 'TOO_LONG' }));
const templateCodeSchema = z.string({ error: 'REQUIRED' }).regex(/^[A-Z][A-Z0-9_]{2,59}$/, { error: 'INVALID_CHOICE' });

/**
 * COM-020, CTL-006 — an e-mail may also go to a promoter's contact: `promoterId` (from his record, or from a dossier of
 * his: `dossierId` too), the contact chosen (`contactId`, else his main contact) and a second contact in copy.
 */
const emailTargetShape = { ...targetShape, promoterId: optionalId, contactId: optionalId, ccContactId: optionalId };
const requireEmailTarget = (v: { leadId: string | null; clientId: string | null; dossierId: string | null; promoterId: string | null }, ctx: z.RefinementCtx) => {
  if (!v.leadId && !v.clientId && !v.dossierId && !v.promoterId) ctx.addIssue({ code: 'custom', path: ['clientId'], message: 'REQUIRED' });
};

const emailContent = {
  ...emailTargetShape,
  templateCode: templateCodeSchema,
  /** Empty while typing a preview; required to send. */
  subject: z.string().max(400).default(''),
  body: z.string().max(MANUAL_EMAIL_BODY_MAX + 2000).default(''),
  /** Keeps the button of the template under the text. */
  includeButton: z.boolean().default(false),
};

/** `POST /admin/emails/preview` — the e-mail in its real layout (COM-020 « aperçu »). */
export const emailPreviewSchema = z.strictObject(emailContent).superRefine(requireEmailTarget);
export interface EmailPreview {
  subject: string;
  html: string;
}

/** `POST /admin/emails/send` — now, or later with `scheduledFor`. */
export const emailSendSchema = z
  .strictObject({
    ...emailContent,
    subject: subjectSchema,
    body: bodySchema,
    scheduledFor: instantSchema,
    /** The warnings the writer confirmed (« Envoyer quand même ? », CRM-060). */
    confirmed: z.array(z.enum(EMAIL_CONFIRMABLE_WARNINGS)).max(2).default([]),
    /** COM-020 « Pièces jointes » — uploads completed by the author (API-080); never a file of a dossier (NOT-008). */
    attachmentIds: attachmentIdsSchema,
  })
  .superRefine(requireEmailTarget);
export type EmailSend = z.input<typeof emailSendSchema>;

export interface EmailSendResult {
  id: string;
  /** `SENT`: it left · `QUEUED`: scheduled, or waiting for a new try · `FAILED`: refused by the mail service. */
  state: 'SENT' | 'QUEUED' | 'FAILED';
  scheduledFor: string | null;
}
