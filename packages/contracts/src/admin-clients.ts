// Package 3.3 « Clients » (EA-12, EA-13; 04-back-office/03 § 6 and § 7: CRM-040, CRM-041, CRM-045 … CRM-048, CRM-060,
// CRM-065) — wire contracts of `/admin/clients`. The account tab, « Voir comme le client », the simulations, the
// duplicates and the merge have their own contracts.
import { z } from 'zod';
import { LEAD_SOURCES, type AdminLeadKind, type AdminLeadSource, type AdminLeadStatus } from './admin-leads.js';
import type { AdminTimelinePage } from './admin-shell.js';
import type { ClientProfile, TrustedPerson } from './client-space.js';
import { profileSectionSchemas, trustedPersonSchema } from './client-space.js';
import { emailSchema } from './schemas/leads.js';

export const CLIENT_STATUSES = ['PROSPECT', 'QUALIFIED', 'ACTIVE', 'CUSTOMER', 'INACTIVE', 'ARCHIVED'] as const;
export type AdminClientStatus = (typeof CLIENT_STATUSES)[number];

/** CAL-070 — Chaud (70 and more) · Tiède (40 to 69) · Froid (less than 40). */
export const SCORE_LEVELS = ['HOT', 'WARM', 'COLD'] as const;
export type ScoreLevel = (typeof SCORE_LEVELS)[number];
export function scoreLevel(score: number | null): ScoreLevel | null {
  return score === null ? null : score >= 70 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD';
}

/** CRM-040 — origin views. */
export const CLIENT_VIEWS = ['mine', 'hot', 'active', 'customers', 'inactive', 'all', 'archived'] as const;
export type ClientView = (typeof CLIENT_VIEWS)[number];

export const CLIENT_SORTS = ['name', '-name', 'score', '-score', 'lastActivityAt', '-lastActivityAt', 'createdAt', '-createdAt', 'status', '-status'] as const;
export const CLIENT_PAGE_SIZES = [25, 50, 100] as const;

export type ClientAccountState = 'NONE' | 'INVITED' | 'ACTIVE' | 'SUSPENDED';

export interface ClientListItem {
  id: string;
  /** « NOM Prénom » — masked for the SUPPORT role (ROL-015). */
  name: string | null;
  email: string | null;
  phone: string | null;
  countryOfResidence: string | null;
  status: AdminClientStatus;
  score: number | null;
  scoreLevel: ScoreLevel | null;
  agentName: string | null;
  mine: boolean;
  lastActivityAt: string;
  createdAt: string;
  source: AdminLeadSource | null;
  /** MOD-302 — « Sans e-mail ». */
  noEmail: boolean;
  doNotContact: boolean;
  hasAccount: boolean;
}

export interface ClientList {
  data: ClientListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  views: Record<ClientView, number>;
  facets: { status: Record<string, number>; source: Record<string, number>; score: Record<string, number>; countryOfResidence: Record<string, number> };
  agents: { id: string; name: string }[];
  /** What the caller may do in bulk (BO-035): absent actions are not shown. */
  can: { assign: boolean; archive: boolean; create: boolean };
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

/** `GET /admin/clients` — an unknown parameter is refused (400, API-011). */
export const clientListQuerySchema = z.strictObject({
  view: z.enum(CLIENT_VIEWS).optional(),
  q: z.string().trim().max(120).optional(),
  status: csv(CLIENT_STATUSES),
  source: csv(LEAD_SOURCES),
  score: csv(SCORE_LEVELS),
  assignedAgentId: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.union([z.uuid(), z.literal('none')])).max(50)),
  countryOfResidence: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.string().regex(/^[A-Z]{2}$/)).max(60)),
  hasAccount: z.enum(['true', 'false']).optional(),
  marketingOptIn: z.enum(['true', 'false']).optional(),
  createdFrom: day,
  createdTo: day,
  activityFrom: day,
  activityTo: day,
  sort: z.enum(CLIENT_SORTS).default('-lastActivityAt'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .refine((n) => (CLIENT_PAGE_SIZES as readonly number[]).includes(n))
    .default(25),
});

// ─── The record (EA-13) ─────────────────────────────────────────────────────

/** CRM-047 — the note, its level and its detail in four lines; never shown to the client. */
export interface ClientScore {
  value: number;
  level: ScoreLevel;
  /** Joignable / 20 · Projet / 20 · Financement / 40 · Engagement / 20. */
  blocks: { reachable: number; project: number; financing: number; engagement: number };
}

export interface ClientDetail {
  id: string;
  /** MOD-007 — sent back with every change (TRV-094). */
  version: number;
  firstName: string | null;
  lastName: string | null;
  /** « Prénom Nom » as the windows name the person; masked for SUPPORT. */
  fullName: string | null;
  status: AdminClientStatus;
  score: ClientScore | null;
  agent: { id: string; name: string | null } | null;
  /** The referent adviser is the caller. */
  mine: boolean;
  account: ClientAccountState;
  source: AdminLeadSource | null;
  createdAt: string;
  lastActivityAt: string;
  /** ROL-015 — personal data and free text are masked for this reader. */
  masked: boolean;

  coordinates: {
    email: string | null;
    phone: string | null;
    whatsappOptIn: boolean;
    countryOfResidence: string | null;
    cityOfResidence: string | null;
    /** TRV-031 — IANA zone of the client, for « 14 h 05 à Montréal ». */
    timezone: string | null;
    preferredContactChannel: string | null;
    preferredContactSlot: string | null;
    preferredLanguage: string;
    marketingOptIn: boolean;
  };

  /** CRM-045 — the banners that apply, as data. */
  banners: {
    doNotContact: { reason: string | null; at: string | null } | null;
    restricted: { at: string; reason: string | null } | null;
    noEmail: boolean;
    emailBouncedAt: string | null;
    emailDoubtful: boolean;
    phoneCheckNeeded: boolean;
    deletionRequestedAt: string | null;
    archived: { at: string; reason: string | null } | null;
    /** CRM-081 — possible twins (`name` null: outside the reader's perimeter). */
    duplicates: { id: string; name: string | null }[];
  };

  overview: {
    currentDossier: { reference: string; stage: string; status: string } | null;
    lastLead: { reference: string; kind: AdminLeadKind; status: AdminLeadStatus; createdAt: string } | null;
    /** Absent (undefined) when the reader may not read tasks / appointments. */
    nextTask?: { id: string; title: string | null; dueAt: string | null } | null;
    nextAppointment?: { id: string; type: string; startsAt: string | null } | null;
  };

  counts: { leads: number; dossiers: number; contacts: number; favorites: number; registrations: number; feedback: number };

  /** BO-047 — what THIS caller may do on THIS record. */
  can: {
    update: boolean;
    /** CRM-048 — the address is edited here only for a client without account. */
    editEmail: boolean;
    assign: boolean;
    archive: boolean;
    unarchive: boolean;
    /** CYC-061 — why archiving is impossible now, else null. */
    archiveBlocked: 'HAS_OPEN_DOSSIER' | null;
    merge: boolean;
    sensitive: boolean;
  };
}

/** A record absorbed by a merge is only a pointer (CRM-080, point 7). */
export interface ClientMergedPointer {
  mergedIntoId: string;
}
export type ClientDetailResponse = ClientDetail | ClientMergedPointer;

/** Tab « Projet et finances » — the profile sections; what the reader may not read is `null` and named in `withheld`. */
export interface ClientProjectTab {
  version: number;
  identity: ClientProfile['identity'];
  contact: ClientProfile['contact'];
  situation: ClientProfile['situation'];
  project: ClientProfile['project'];
  finances: ClientProfile['finances'] | null;
  /** ROL-019 — names of the sensitive fields left out (« Réservé »). */
  withheld: string[];
  /** The last eligibility simulation and its result (sensitive figures left out without the permission). */
  lastEligibility: { id: string; createdAt: string; status: string | null } | null;
  options: ClientProfile['options'];
}

export interface ClientLeadRow {
  reference: string;
  kind: AdminLeadKind;
  status: AdminLeadStatus;
  outcome: string | null;
  createdAt: string;
  object: string | null;
  agentName: string | null;
}
export interface ClientDossierRow {
  reference: string;
  stage: string;
  status: string;
  createdAt: string;
  agentName: string | null;
  propertyTitle: string | null;
}
export interface ClientFavoritesTab {
  favorites: { reference: string; title: string; publicPath: string | null; addedAt: string }[];
  alerts: { id: string; label: string | null; frequency: string; isActive: boolean; criteria: Record<string, unknown>; createdAt: string }[];
}
export interface ClientRegistrationRow {
  id: string;
  eventTitle: string;
  locationLabel: string;
  startsAt: string;
  timezone: string;
  seats: number;
  status: string;
  attendedAt: string | null;
}
export interface ClientFeedbackRow {
  id: string;
  kind: string;
  npsScore: number | null;
  csatScore: number | null;
  /** Free text: null for the SUPPORT role. */
  comment: string | null;
  status: string;
  createdAt: string;
}
export interface ClientConsentRow {
  id: string;
  type: string;
  granted: boolean;
  givenAt: string;
  wording: string | null;
  documentVersion: string | null;
  source: string;
  recordedByName: string | null;
  proofNote: string | null;
}

export type ClientContactsTab = { data: TrustedPerson[]; max: number };
export type ClientTimelinePage = AdminTimelinePage;

// ─── Writes ─────────────────────────────────────────────────────────────────

const version = z.number().int().positive();

/** `PATCH /admin/clients/{id}` — one section at a time (BO-046), with the validations of the client's profile (CRM-048). */
export const clientUpdateSchema = z.discriminatedUnion('section', [
  z.strictObject({ section: z.literal('identity'), version, values: profileSectionSchemas.identity }),
  z.strictObject({ section: z.literal('contact'), version, values: profileSectionSchemas.contact }),
  z.strictObject({ section: z.literal('situation'), version, values: profileSectionSchemas.situation }),
  z.strictObject({ section: z.literal('project'), version, values: profileSectionSchemas.project }),
  z.strictObject({ section: z.literal('finances'), version, values: profileSectionSchemas.finances }),
  /** CRM-048 — the address of a client WITHOUT account (null: back to « Sans e-mail », only if a phone remains). */
  z.strictObject({ section: z.literal('email'), version, values: z.strictObject({ email: z.preprocess((v) => (v === '' ? null : v), emailSchema.nullable()) }) }),
]);
export type ClientUpdate = z.input<typeof clientUpdateSchema>;

const reason = z
  .string({ error: 'REQUIRED' })
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(300, { error: 'TOO_LONG' }));

/** CRM-060 — the reason is required when the switch is turned ON. */
export const clientDoNotContactSchema = z.discriminatedUnion('enabled', [
  z.strictObject({ enabled: z.literal(true), reason }),
  z.strictObject({ enabled: z.literal(false) }),
]);
export const clientArchiveSchema = z.strictObject({ reason: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().trim().max(300, { error: 'TOO_LONG' }).nullable()).default(null) });
export const clientAssignSchema = z.strictObject({ agentId: z.uuid({ error: 'REQUIRED' }).nullable() });

/** CRM-040 — bulk actions deliverable now: change the referent adviser, archive. */
export const clientBulkSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('assign'), ids: z.array(z.uuid()).min(1).max(100), agentId: z.uuid({ error: 'REQUIRED' }) }),
  z.strictObject({ action: z.literal('archive'), ids: z.array(z.uuid()).min(1).max(100) }),
]);
export interface ClientBulkResult {
  done: number;
  /** Records left untouched, with the reason code (`HAS_OPEN_DOSSIER`, `NOT_FOUND`, `ALREADY`). */
  skipped: { id: string; reason: string }[];
}

/** PRO-040 — a trusted person entered by the team: the client's own confirmation box does not apply. */
export const clientContactSchema = trustedPersonSchema;
