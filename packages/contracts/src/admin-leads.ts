// Package 2.11 « Demandes reçues, en lecture » (EA-10, EA-11; 04-back-office/03 § 1 and § 2: CRM-001 … CRM-003, CRM-010,
// CRM-012; MSG-021) — wire contracts of `GET /admin/leads` and `GET /admin/leads/{référence}`. Read only: the actions
// of CRM-004 and CRM-011 arrive with package 3.2.
import { z } from 'zod';
import { countryCodeSchema, emailSchema, personNameSchema, phoneSchema } from './schemas/leads.js';

export const LEAD_KINDS = ['PROPERTY_INTEREST', 'PROJECTION_REQUEST', 'CALLBACK_REQUEST', 'GUIDED_SEARCH', 'SIMULATION_FOLLOWUP', 'CONTACT_MESSAGE', 'PARTNER_REQUEST'] as const;
export const LEAD_STATUSES = ['NEW', 'IN_PROGRESS', 'CLOSED', 'SPAM'] as const;
export const LEAD_SOURCES = ['WEB_FORM', 'MOBILE_APP', 'ADMIN', 'PHONE', 'WHATSAPP', 'EMAIL', 'CAFE', 'IMPORT', 'PARTNER', 'SIGNUP'] as const;
export type AdminLeadKind = (typeof LEAD_KINDS)[number];
export type AdminLeadStatus = (typeof LEAD_STATUSES)[number];
export type AdminLeadSource = (typeof LEAD_SOURCES)[number];

/** CRM-003 — origin views of the list (not deletable; a preset of filters). */
export const LEAD_VIEWS = ['to-take', 'mine', 'late', 'to-review', 'partner-applications', 'all', 'spam'] as const;
export type LeadView = (typeof LEAD_VIEWS)[number];

/** CRM-001 — sortable fields: `createdAt` (default, most recent first), `slaDueAt` (column « Premier contact »), `kind`, `status`. */
export const LEAD_SORTS = ['createdAt', '-createdAt', 'slaDueAt', '-slaDueAt', 'kind', '-kind', 'status', '-status'] as const;
export const LEAD_PAGE_SIZES = [25, 50, 100] as const;

/**
 * CRM-002 — the column « Premier contact », computed by the server in business time (CAL-060):
 * `DUE` time left · `LATE` overdue · `DONE` « Contacté en 6 h » · `CALLBACK` the person chose a later day ·
 * `NONE` « — » (closed without contact, spam, partner application).
 */
export type LeadFirstContact =
  | { state: 'NONE' }
  | { state: 'DUE'; dueAt: string; businessMinutes: number; /** less than one business day left */ soon: boolean }
  | { state: 'LATE'; dueAt: string; businessMinutes: number }
  | { state: 'DONE'; businessMinutes: number }
  | { state: 'CALLBACK'; day: string };

export interface LeadListItem {
  id: string;
  reference: string;
  createdAt: string;
  kind: AdminLeadKind;
  status: AdminLeadStatus;
  source: AdminLeadSource;
  /** « NOM Prénom » — masked for the SUPPORT role (ROL-015). */
  clientName: string | null;
  /** The property or the programme the request is about. */
  object: { type: 'PROPERTY' | 'PROGRAM'; title: string; reference: string | null } | null;
  agentName: string | null;
  /** True when the request is assigned to the caller. */
  mine: boolean;
  firstContact: LeadFirstContact;
  needsReview: boolean;
  /** Partner sign-up (EP-32): state of the application. */
  applicationStatus: string | null;
  outcome: string | null;
  hasDossier: boolean;
  /** CRM-011 — the caller may take this request in charge now (the quick action of the row). */
  canTake: boolean;
}

export interface LeadList {
  data: LeadListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  /** TRV-106 — the number of requests of each origin view, within the caller's perimeter (ROL-018). */
  views: Record<LeadView, number>;
  /** Counts of each filter value on the list without that filter. */
  facets: { status: Record<string, number>; kind: Record<string, number>; source: Record<string, number>; countryOfResidence: Record<string, number> };
  /** The property or the programme the list is filtered on (`propertyId`, `programId`): its label, for the chip. */
  objects: { id: string; type: 'PROPERTY' | 'PROGRAM'; label: string }[];
  /** CRM-004 — bulk actions the caller's role holds (BO-047: the others are absent). */
  bulk: { assign: boolean; process: boolean };
  /** The advisers a request may be filtered on (active accounts that hold `lead.process`). */
  agents: { id: string; name: string }[];
}

const csv = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(values as unknown as [T, ...T[]])).max(values.length));
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

/** `GET /admin/leads` — CRM-001 parameters (API-010 … API-012). An unknown parameter is refused (400). */
export const leadListQuerySchema = z.strictObject({
  view: z.enum(LEAD_VIEWS).optional(),
  q: z.string().trim().max(120).optional(),
  status: csv(LEAD_STATUSES),
  kind: csv(LEAD_KINDS),
  source: csv(LEAD_SOURCES),
  /** One or several adviser ids, or `none` for unassigned requests. */
  assignedAgentId: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.union([z.uuid(), z.literal('none')])).max(50)),
  createdFrom: day,
  createdTo: day,
  propertyId: z.uuid().optional(),
  programId: z.uuid().optional(),
  /** One or several ISO codes (the country of the client record). */
  countryOfResidence: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.string().regex(/^[A-Z]{2}$/)).max(60)),
  hasDossier: z.enum(['true', 'false']).optional(),
  sort: z.enum(LEAD_SORTS).default('-createdAt'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .refine((n) => (LEAD_PAGE_SIZES as readonly number[]).includes(n))
    .default(25),
});

/** One value of the form, as sent (DEM-025). */
export interface LeadFieldValue {
  key: string;
  value: string | number | boolean | string[] | null;
}

export interface LeadDetail {
  id: string;
  reference: string;
  kind: AdminLeadKind;
  status: AdminLeadStatus;
  source: AdminLeadSource;
  createdAt: string;
  firstContact: LeadFirstContact;
  agentName: string | null;
  agentId: string | null;
  mine: boolean;
  outcome: string | null;
  closedAt: string | null;
  /** The note typed at the closure (CYC-005); null for a reader who may not read free text (ROL-015). */
  closeNote: string | null;
  needsReview: boolean;
  applicationStatus: string | null;
  /** CRM-011, BO-047 — what THIS caller may do on THIS request now. An action absent from the map is forbidden by the role. */
  can: LeadCan;

  /** CRM-010 « Ce que la personne a envoyé » — nothing of it can be changed. */
  sent: {
    form: string | null;
    person: { firstName: string | null; lastName: string | null; email: string | null; phone: string | null };
    /** The other fields of the form, in the order they were sent. */
    fields: LeadFieldValue[];
    /** ROL-019 — names of the sensitive fields left out for this reader (« Réservé »). */
    withheld: string[];
    message: string | null;
    subject: string | null;
    /** What the person SAW then (frozen with the request). */
    seen: {
      propertyTitle: string | null;
      propertyReference: string | null;
      lotReference: string | null;
      programName: string | null;
      price: { amount: string; currency: string } | null;
      monthly: { amount: string; currency: string } | null;
    } | null;
    /** The wished moment: the day, the slot, the visitor's time zone (the screen converts to the reader's). */
    callback: { day: string | null; slot: string | null; callerTimezone: string | null } | null;
    /** DEM-027 — what the person added afterwards (second screen, later sendings), most recent last. */
    supplements: { at: string; fields: LeadFieldValue[]; message: string | null }[];
    /** ROL-015 — true when the personal data and the free text of this block are masked. */
    masked: boolean;
  };

  /** CRM-010 « Contexte ». */
  context: {
    /** The public page of the property or the programme (null when it is not published any more). */
    property: { title: string; reference: string; publicPath: string | null; availability: string | null; status: string } | null;
    program: { name: string; publicPath: string | null; status: string } | null;
    /** A simulation is joined to the request (its figures are sensitive: shown with the client record, package 3.3). */
    hasSimulation: boolean;
    submittedFromPath: string | null;
    campaign: { source: string | null; medium: string | null; campaign: string | null } | null;
    referrer: string | null;
    locale: string;
    spamScore: number;
    spamSignals: string[];
  };

  /** CRM-010 « Client et suite » — in text in delivery 2 (no link, no score). */
  followUp: {
    client: {
      /** The record's id — null when the caller may not open it (masked reading, ROL-015). */
      id: string | null;
      name: string | null;
      status: string | null;
      /** CAL-070 — 0 to 100, and its level (CRM-047); null while not computed. */
      score: number | null;
      scoreLevel: 'HOT' | 'WARM' | 'COLD' | null;
      /** MOD-302 — « Sans e-mail ». */
      withoutEmail: boolean;
      doNotContact: boolean;
      /** CYC-009 — « Traitement limité : à confirmer avec la personne ». */
      restricted: boolean;
    } | null;
    alerts: ('DIFFERENT_INFO' | 'POSSIBLE_DUPLICATE' | 'EMAIL_DOUBTFUL' | 'EMAIL_BOUNCED')[];
    /** CRM-081 — the records that look like the client's (`name` null: outside the caller's perimeter). */
    duplicates: { id: string; name: string | null }[];
    /** The dossier opened or joined by the request. */
    dossier: { reference: string; stage: string; status: string } | null;
    /**
     * The client's live dossiers the request is NOT attached to: « Rattacher au dossier » offers them. `pendingDecision`
     * is the last case of CYC-002 — « Nouvelle demande pendant un dossier en cours ».
     */
    liveDossiers: { id: string; reference: string; stage: string; status: string }[];
    pendingDecision: boolean;
    /** MSG-021 — « Écrit depuis le dossier {référence} ». */
    writtenFromDossier: string | null;
    /** The other requests of the same client (links: EA-11 is delivered), most recent first, 20 at most. */
    otherLeads: { reference: string; kind: AdminLeadKind; status: AdminLeadStatus; createdAt: string }[];
  };
}

// ─── Package 3.2 — processing (CRM-004, CRM-011, CRM-025; CYC-003 … CYC-008) ────────────────────────────────────────

export const LEAD_ACTIONS = ['take', 'assign', 'release', 'close', 'reopen', 'spam', 'restore', 'review', 'openDossier', 'attach'] as const;
export type LeadAction = (typeof LEAD_ACTIONS)[number];
/** BO-047 — possible now, or impossible in this state with the code of its reason (`ui.admin-leads.blocked.{reason}`). */
export type LeadActionState = { allowed: true } | { allowed: false; reason: string };
export type LeadCan = Partial<Record<LeadAction, LeadActionState>>;

/** CYC-005 — outcomes chosen by hand; `DOSSIER_OPENED` and `ATTACHED_TO_DOSSIER` are set by the system. */
export const LEAD_MANUAL_OUTCOMES = ['ANSWERED', 'UNREACHABLE', 'NOT_INTERESTED', 'DUPLICATE', 'OUT_OF_SCOPE'] as const;
export type LeadManualOutcome = (typeof LEAD_MANUAL_OUTCOMES)[number];

/** CRM-025 — natures a member of the team may enter (a guided search, a simulation follow-up and a partner request only exist from their own forms). */
export const STAFF_LEAD_KINDS = ['CALLBACK_REQUEST', 'PROPERTY_INTEREST', 'PROJECTION_REQUEST', 'CONTACT_MESSAGE'] as const;
export type StaffLeadKind = (typeof STAFF_LEAD_KINDS)[number];
/** Origins entered by the team (the list of `STAFF_ENTRY_SOURCES` in `admin-crm`, repeated here to avoid an import cycle). */
export const STAFF_LEAD_SOURCES = ['PHONE', 'WHATSAPP', 'EMAIL', 'CAFE', 'PARTNER', 'ADMIN'] as const;

const blank = (v: unknown) => (v === '' || v === null || v === undefined ? null : v);
const optionalId = z.preprocess(blank, z.uuid({ error: 'INVALID_CHOICE' }).nullable()).default(null);
const noteSchema = (max: number) =>
  z
    .preprocess(
      blank,
      z
        .string()
        .transform((v) => v.replace(/\r\n/g, '\n').trim())
        .pipe(z.string().max(max, { error: 'TOO_LONG' }))
        .nullable(),
    )
    .default(null);

/** The new record of CRM-025 (« ou création : prénom, nom, e-mail, téléphone, pays »): the e-mail OR the phone (MOD-302). */
export const staffLeadClientSchema = z.strictObject({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: z.preprocess(blank, emailSchema.nullable()).default(null),
  phone: z.preprocess(blank, phoneSchema.nullable()).default(null),
  whatsappOptIn: z.boolean().default(false),
  countryOfResidence: z.preprocess(blank, countryCodeSchema.nullable()).default(null),
});

/** `POST /admin/leads` (`lead.create`) — CRM-025. */
export const staffLeadCreateSchema = z
  .strictObject({
    source: z.enum(STAFF_LEAD_SOURCES, { error: 'REQUIRED' }),
    kind: z.enum(STAFF_LEAD_KINDS, { error: 'REQUIRED' }),
    /** An existing record… */
    clientId: optionalId,
    /** …or a new one. */
    client: staffLeadClientSchema.nullable().default(null),
    propertyId: optionalId,
    programId: optionalId,
    message: noteSchema(2000),
    /** The adviser; null: the request stays « à prendre en charge ». */
    assignedAgentId: optionalId,
    /** « La personne a accepté d'être recontactée au sujet de sa demande » — required (`MUST_ACCEPT`). */
    consentContact: z.boolean().default(false),
    /** « La personne souhaite recevoir les actualités ». */
    marketingOptIn: z.boolean().default(false),
    /** « Envoyer un e-mail de confirmation au client » — ignored without an address. */
    sendConfirmation: z.boolean().default(false),
    /** « Échange déjà eu avec le client » — origin « Téléphone » only: the first contact is the creation (CYC-004). */
    alreadyContacted: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (!v.clientId && !v.client) ctx.addIssue({ code: 'custom', path: ['clientId'], message: 'REQUIRED' });
    if (v.clientId && v.client) ctx.addIssue({ code: 'custom', path: ['clientId'], message: 'INVALID_CHOICE' });
    if (v.client && !v.client.email && !v.client.phone) ctx.addIssue({ code: 'custom', path: ['client', 'email'], message: 'REQUIRED' });
    if (!v.consentContact) ctx.addIssue({ code: 'custom', path: ['consentContact'], message: 'MUST_ACCEPT' });
    if (v.kind === 'PROPERTY_INTEREST' && !v.propertyId && !v.programId) ctx.addIssue({ code: 'custom', path: ['propertyId'], message: 'REQUIRED' });
    if (v.propertyId && v.programId) ctx.addIssue({ code: 'custom', path: ['programId'], message: 'INVALID_CHOICE' });
  });
export type StaffLeadCreate = z.input<typeof staffLeadCreateSchema>;
export type StaffLeadCreateData = z.output<typeof staffLeadCreateSchema>;

export interface StaffLeadCreated {
  id: string;
  reference: string;
  clientId: string;
  status: AdminLeadStatus;
  dossierReference: string | null;
}

export const leadAssignSchema = z.strictObject({ agentId: z.uuid({ error: 'REQUIRED' }) });
export const leadCloseSchema = z.strictObject({ outcome: z.enum(LEAD_MANUAL_OUTCOMES, { error: 'REQUIRED' }), note: noteSchema(500) });
/** CRM-003 — « Demande légitime » / « Indésirable ». */
export const leadReviewSchema = z.strictObject({ verdict: z.enum(['LEGITIMATE', 'SPAM'], { error: 'REQUIRED' }) });
/** CRM-011 « Rattacher au dossier » — a live dossier of the same client. */
export const leadAttachSchema = z.strictObject({ dossierId: z.uuid({ error: 'REQUIRED' }) });

const bulkIds = z.array(z.uuid()).min(1).max(100);
/** CRM-004 — `POST /admin/leads/bulk`: each request is its own action; the answer says which ones could not be done. */
export const leadBulkSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('assign'), ids: bulkIds, agentId: z.uuid({ error: 'REQUIRED' }) }),
  z.strictObject({ action: z.literal('spam'), ids: bulkIds }),
  z.strictObject({ action: z.literal('close'), ids: bulkIds, outcome: z.enum(LEAD_MANUAL_OUTCOMES, { error: 'REQUIRED' }), note: noteSchema(500) }),
]);
export interface LeadBulkResult {
  done: number;
  /** Requests left as they were, with the reason (`ui.admin-leads.blocked.{reason}`, or an error code). */
  failed: { id: string; reference: string | null; reason: string }[];
}

/** `GET /admin/lead-objects?q=` — properties and programmes a request may be about (CRM-025 « bien ou programme »). */
export interface LeadObjectOption {
  type: 'PROPERTY' | 'PROGRAM';
  id: string;
  /** Reference of a property; null for a programme. */
  reference: string | null;
  title: string;
  /** City and region. */
  place: string | null;
  availability: string | null;
  published: boolean;
}
