// Package 3.7 « Dossier » (EA-21, EA-22 — 04-back-office/06 § 2 à 4; 01-domaine/06 § 2 à 4) — wire contracts of the
// dossiers of the back office: the list, the creation (PIP-015), the record (header, « Ce qu'il manque », overview),
// the matching (candidates, proposals, selection), pause, resume, closing, reopening, stepping back, deletion and the
// change of adviser. One schema per request, used by the browser AND the API (ARC-030). Texts never travel: codes and
// values, translated by the screens (API-002).
//
// Delivery 3 covers the stages INTEREST, QUALIFICATION and MATCHING. A dossier at DOCUMENTS or beyond (the
// demonstration dossiers) is displayed, paused, closed and reassigned; its advances arrive with Lot 4 (Q-077).
import { z } from 'zod';
import type { AdminTimelineEntry } from './admin-shell.js';
import type {
  Availability,
  CandidateOrigin,
  CandidateStatus,
  ClientStatus,
  ContactChannel,
  ContactTimeSlot,
  DeclineReason,
  DossierStage,
  DossierStatus,
  FinancingPreference,
  HoldReason,
  LostReason,
  Priority,
  PropertyType,
  PublicationStatus,
  PurchaseTimeframe,
  ResidencyStatus,
} from './enums.js';
import type { PublicImage } from './catalogue.js';
import type { Money } from './http.js';

export const DOSSIER_STAGES = ['INTEREST', 'QUALIFICATION', 'MATCHING', 'DOCUMENTS', 'BANK_REVIEW', 'APPROVED', 'ACQUISITION'] as const;
export const DOSSIER_STATUSES = ['OPEN', 'ON_HOLD', 'WON', 'LOST'] as const;
export const DOSSIER_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const HOLD_REASONS = ['CLIENT_REQUEST', 'WAITING_CLIENT', 'WAITING_PROMOTER', 'WAITING_BANK', 'OTHER'] as const;
export const LOST_REASONS = ['UNREACHABLE', 'NOT_ELIGIBLE', 'NO_SUITABLE_PROPERTY', 'BOUGHT_ELSEWHERE', 'BUDGET', 'CLIENT_WITHDREW', 'BANK_REFUSAL', 'PROPERTY_UNAVAILABLE', 'DUPLICATE', 'OTHER'] as const;
export const DECLINE_REASONS = ['PRICE', 'LOCATION', 'SIZE', 'DELIVERY', 'OTHER'] as const;
/** Stages whose advances are delivered with package 3.7 (Q-077). */
export const DELIVERED_STAGES = ['INTEREST', 'QUALIFICATION', 'MATCHING'] as const satisfies readonly DossierStage[];

// ─── The list (EA-21, PIP-010) ──────────────────────────────────────────────

/**
 * PIP-010 — origin views. « Complets, à soumettre », « En étude bancaire », « Acomptes à suivre » and « Aboutis »
 * join the list with the stages that fill them (Lot 4, Q-077).
 */
export const DOSSIER_VIEWS = ['mine', 'late', 'on-hold', 'inactive', 'lost', 'all'] as const;
export type AdminDossierView = (typeof DOSSIER_VIEWS)[number];

export const DOSSIER_SORTS = [
  'reference', '-reference', 'createdAt', '-createdAt', 'lastActivityAt', '-lastActivityAt', 'slaDueAt', '-slaDueAt', 'stageEnteredAt', '-stageEnteredAt',
  'priority', '-priority', 'stage', '-stage',
] as const;
export const DOSSIER_PAGE_SIZES = [25, 50, 100] as const;

/**
 * CAL-062 — the deadline of the current stage, in business days. `PAUSED`: the dossier is on hold (the deadline is
 * frozen, CYC-031). `NONE`: a finished dossier.
 */
export type DossierSla =
  | { state: 'NONE' }
  | { state: 'PAUSED' }
  | { state: 'DUE'; dueAt: string; businessDaysLeft: number }
  | { state: 'LATE'; dueAt: string; businessDaysLate: number };

/**
 * What the dossier waits for — the next step and who must make it (the team, the client, nobody):
 *   TAKE (no adviser) · FIRST_CONTACT · QUALIFY · PROPOSE (nothing proposed yet) · SEND_PROPOSALS (drafts not sent) ·
 *   AWAIT_ANSWER (proposals without answer) · CONFIRM_SELECTION (« Je retiens ce bien » to confirm) · VISIT (a visit
 *   is planned) · SELECT (the client is interested: retain a property) · BUILD_FILE (a property is retained) ·
 *   FOLLOW (stages of Lot 4) · RESUME (on hold) · NONE (finished).
 */
export type DossierNextCode =
  | 'TAKE' | 'FIRST_CONTACT' | 'QUALIFY' | 'PROPOSE' | 'SEND_PROPOSALS' | 'AWAIT_ANSWER' | 'CONFIRM_SELECTION' | 'VISIT' | 'SELECT' | 'BUILD_FILE' | 'FOLLOW' | 'RESUME' | 'NONE';
export interface DossierNext {
  code: DossierNextCode;
  waitingOn: 'TEAM' | 'CLIENT' | 'NONE';
  /** The date that goes with it: a visit, the planned resumption (`YYYY-MM-DD` for a resumption, an instant otherwise). */
  at: string | null;
  /** A property title, when the step names one. */
  property: string | null;
}

export interface AdminDossierListItem {
  id: string;
  reference: string;
  /** « NOM Prénom » — masked for the SUPPORT role (ROL-015). */
  client: { id: string; name: string | null };
  /** The retained property; null: « Bien à définir ». */
  property: { reference: string; title: string } | null;
  promoterName: string | null;
  stage: DossierStage;
  status: DossierStatus;
  priority: Priority;
  agent: { id: string; name: string | null } | null;
  mine: boolean;
  financingRequested: boolean;
  /** CAL-055 — null while the dossier has no list of pieces. */
  completenessPct: number | null;
  stageEnteredAt: string;
  /** Calendar days in the current stage, pauses included (PIP-002). */
  daysInStage: number;
  sla: DossierSla;
  lastActivityAt: string;
  createdAt: string;
  next: DossierNext;
  signals: {
    overdueTasks: number;
    doNotContact: boolean;
    /** CYC-039 — no activity for `dossier.inactivityDays` days. */
    inactive: boolean;
  };
}

export interface AdminDossierList {
  data: AdminDossierListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  views: Record<AdminDossierView, number>;
  facets: { stage: Record<string, number>; status: Record<string, number>; priority: Record<string, number>; financing: { with: number; without: number } };
  agents: { id: string; name: string }[];
  promoters: { id: string; name: string }[];
}

const csv = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(values as unknown as [T, ...T[]])).max(values.length));
const ids = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').filter(Boolean) : []))
  .pipe(z.array(z.union([z.uuid(), z.literal('none')])).max(50));
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** `GET /admin/dossiers` — PIP-010 (API-010 … API-012). An unknown parameter is refused (400). */
export const dossierListQuerySchema = z.strictObject({
  view: z.enum(DOSSIER_VIEWS).optional(),
  q: z.string().trim().max(120).optional(),
  stage: csv(DOSSIER_STAGES),
  status: csv(DOSSIER_STATUSES),
  priority: csv(DOSSIER_PRIORITIES),
  /** One or several adviser ids, or `none`. */
  assignedAgentId: ids,
  promoterId: ids,
  financing: z.enum(['with', 'without']).optional(),
  late: z.enum(['true']).optional(),
  clientId: z.uuid().optional(),
  propertyId: z.uuid().optional(),
  sort: z.enum(DOSSIER_SORTS).default('-lastActivityAt'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .refine((n) => (DOSSIER_PAGE_SIZES as readonly number[]).includes(n))
    .default(25),
});

// ─── Pickers of the windows (creation, change of adviser) ───────────────────

/** `GET /admin/dossiers/pickers/clients?q=` (`dossier.create`) — within the reader's perimeter (ROL-018). */
export interface ClientPick {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  countryOfResidence: string | null;
  /** Dossiers OPEN or ON_HOLD of the client: reference and stage. */
  liveDossiers: { reference: string; stage: DossierStage; status: DossierStatus }[];
}
/** `GET /admin/dossiers/pickers/properties?q=` (`dossier.create`) — published properties. */
export interface PropertyPick {
  id: string;
  reference: string;
  title: string;
  city: string | null;
  availability: Availability;
  priceFrom: Money | null;
}
/** `GET /admin/dossiers/pickers/agents` — whom a dossier may be entrusted to (PIP-026: active, holds `dossier.update`). */
export interface AgentPick {
  id: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT';
  /** CRM-021 — ISO day of the last day of a declared absence in progress: not selectable. */
  absentUntil: string | null;
  me: boolean;
}

// ─── Creation (PIP-015) ─────────────────────────────────────────────────────

export const dossierCreateSchema = z.strictObject({
  clientId: z.uuid({ error: 'REQUIRED' }),
  /** A published property: it joins the dossier as a considered property (never retained). */
  propertyId: z.uuid().nullable().default(null),
  financingRequested: z.boolean(),
  /** The adviser; default: the caller. */
  assignedAgentId: z.uuid().nullable().default(null),
  /** « Créer quand même » when another live dossier of the client already considers the property. */
  confirmDuplicate: z.boolean().default(false),
});
export type DossierCreate = z.input<typeof dossierCreateSchema>;
export interface DossierCreated {
  id: string;
  reference: string;
}

// ─── The record (EA-22, PIP-020 … PIP-026) ──────────────────────────────────

/** API-102 — one condition of the next transition, « remplie » or « manquante ». */
export interface TransitionCondition {
  /** `ui.condition.{code}`. */
  code: string;
  met: boolean;
}

/** PIP-021 — the main action of the record. `null`: none in this state (finished dossier, stage of Lot 4). */
export type DossierMainAction = 'TAKE' | 'QUALIFY' | 'RESUME' | null;

/** PIP-025 — banners of the overview, in display order. */
export type DossierBannerCode =
  | 'ON_HOLD'
  | 'RESUME_DUE'
  | 'ACTIVITY_ON_HOLD'
  | 'SELECTION_REQUESTED'
  | 'PROPERTY_UNAVAILABLE'
  | 'PROPERTY_OFFLINE'
  | 'PROPERTY_RESERVED'
  | 'DO_NOT_CONTACT'
  | 'NO_EMAIL'
  | 'EMAIL_BOUNCED'
  | 'RESTRICTED'
  | 'INACTIVE'
  | 'LOST'
  | 'WON';
export interface DossierBannerItem {
  code: DossierBannerCode;
  params: Record<string, string | number | null>;
}

export interface DossierStep {
  stage: DossierStage;
  state: 'DONE' | 'CURRENT' | 'TODO' | 'SKIPPED';
  /** Date of entry in a stage the dossier went through. */
  enteredAt: string | null;
}

export interface DossierPropertyCard {
  id: string;
  reference: string;
  title: string;
  city: string | null;
  region: string | null;
  type: PropertyType;
  photo: PublicImage | null;
  publication: PublicationStatus;
  availability: Availability;
  /** Published and listed in the public catalogue. */
  online: boolean;
  /** Path of the public page (`/biens/{slug}`), null when not online. */
  publicPath: string | null;
  priceFrom: Money | null;
  lotsAvailable: number;
  promoterName: string | null;
}

export interface LotOption {
  id: string;
  reference: string;
  floor: number | null;
  surfaceM2: string;
  price: Money;
  status: 'AVAILABLE' | 'OPTIONED' | 'RESERVED' | 'SOLD' | 'WITHDRAWN';
}

export interface DossierTaskRow {
  id: string;
  title: string;
  priority: Priority;
  dueAt: string | null;
  dueHasTime: boolean;
  overdue: boolean;
  assigneeName: string | null;
  automatic: boolean;
}

export interface DossierAppointmentRow {
  id: string;
  type: 'CALL' | 'VISIO' | 'PROPERTY_VISIT' | 'OFFICE_MEETING';
  status: 'REQUESTED' | 'CONFIRMED' | 'DONE' | 'NO_SHOW' | 'CANCELLED';
  startsAt: string | null;
  propertyTitle: string | null;
  staffName: string | null;
}

/** What the reader may do on this dossier now. `false` = forbidden by the role (absent); a reason = impossible in this state (greyed, BO-047). */
export type Ability = boolean | { reason: string };

export interface DossierDetail {
  id: string;
  reference: string;
  /** MOD-007 — sent back with every change. */
  version: number;
  stage: DossierStage;
  status: DossierStatus;
  priority: Priority;
  createdAt: string;
  stageEnteredAt: string;
  daysInStage: number;
  lastActivityAt: string;
  sla: DossierSla;
  steps: DossierStep[];
  next: DossierNext;
  /** The request that opened the dossier, and the others attached to it. */
  leads: { reference: string; kind: string; status: string; createdAt: string; origin: boolean }[];
  client: {
    id: string;
    /** « NOM Prénom »; masked for SUPPORT. */
    name: string | null;
    email: string | null;
    phone: string | null;
    countryOfResidence: string | null;
    status: ClientStatus;
    score: number | null;
    preferredChannel: ContactChannel | null;
    preferredSlot: ContactTimeSlot | null;
    /** IANA zone, to show the client's local time. */
    timezone: string | null;
    doNotContact: boolean;
    hasAccount: boolean;
    masked: boolean;
  };
  agent: { id: string; name: string | null } | null;
  mine: boolean;
  /** The retained property and the intended lot (CYC-071, PIP-050). */
  property: DossierPropertyCard | null;
  lot: LotOption | null;
  /** The intended lot was taken by someone else (CYC-102): « Le lot visé n'est plus libre ». */
  lotLost: boolean;
  hold: { reason: HoldReason; note: string | null; until: string | null; clientNote: string | null; heldAt: string } | null;
  lost: { reason: LostReason; note: string | null; at: string } | null;
  /** PIP-025 « Plan de financement ». `sensitive: false` — the amounts are withheld (ROL-019): « Réservé ». */
  financing: {
    requested: boolean;
    type: FinancingPreference | null;
    purchasePrice: Money | null;
    /** The public price it is compared to (lot, else « à partir de »). */
    publicPrice: Money | null;
    downPayment: Money | null;
    loanAmount: Money | null;
    durationMonths: number | null;
    /** MOD-313 — « Le plan de financement ne couvre pas le prix : écart de {montant}. » */
    gap: Money | null;
    sensitive: boolean;
  };
  /** PIP-025 « Prochaine étape affichée au client »: the custom sentence, and the code of the default one (ECL-021). */
  clientNextStep: { custom: string | null; defaultCode: string; defaultParams: Record<string, string | number | null> };
  action: DossierMainAction;
  /** PIP-021 « Ce qu'il manque » — the conditions of the next transition; empty when there is none to make by hand. */
  conditions: TransitionCondition[];
  banners: DossierBannerItem[];
  todo: { tasks: DossierTaskRow[]; nextAppointment: DossierAppointmentRow | null };
  recent: AdminTimelineEntry[];
  counts: { candidates: number; proposalsWaiting: number; openTasks: number; overdueTasks: number };
  /** CYC-037 — where « Reculer d'une étape » leads; null when it leads nowhere. */
  moveBackTarget: DossierStage | null;
  can: {
    update: Ability;
    /** Change of adviser; an adviser may only take a dossier without adviser (ROL note 3). */
    assign: Ability;
    assignToOthers: boolean;
    hold: Ability;
    resume: Ability;
    close: Ability;
    reopen: Ability;
    moveBack: Ability;
    delete: Ability;
    manageCandidates: Ability;
    createTask: boolean;
    createAppointment: boolean;
    writeNote: boolean;
    readAudit: boolean;
  };
}

// ─── Qualification (CYC-021, CRM-050) ───────────────────────────────────────

/** `GET /admin/dossiers/{id}/qualification` — the conditions and the values the window lets the adviser complete. */
export interface QualificationState {
  conditions: TransitionCondition[];
  client: {
    version: number;
    firstName: string | null;
    lastName: string | null;
    countryOfResidence: string | null;
    residencyStatus: ResidencyStatus | null;
    budgetMax: string | null;
    budgetCurrency: string | null;
    budgetMonthly: string | null;
    budgetMonthlyCurrency: string | null;
    /** Withheld without `client.sensitive.read` (ROL-019): the field is not offered. */
    downPayment: string | null;
    downPaymentCurrency: string | null;
    downPaymentWithheld: boolean;
    financingPreference: FinancingPreference | null;
    purchaseTimeframe: PurchaseTimeframe | null;
    doNotContact: boolean;
  };
  firstContactAt: string | null;
  currencies: string[];
  countries: { code: string; name: string }[];
}

const amount = z
  .string()
  .trim()
  .regex(/^\d{1,12}([.,]\d{1,2})?$/, 'INVALID_AMOUNT')
  .transform((v) => v.replace(',', '.'));
const currency = z.string().regex(/^[A-Z]{3}$/, 'INVALID_CHOICE');
const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' || v === undefined ? null : v), schema.nullable()).optional();

/** `POST /admin/dossiers/{id}/qualify` — the values completed on the spot are written on the client record first. */
export const dossierQualifySchema = z.strictObject({
  version: z.number().int().min(1),
  client: z
    .strictObject({
      firstName: optional(z.string().trim().min(1).max(80)),
      lastName: optional(z.string().trim().min(1).max(80)),
      countryOfResidence: optional(z.string().regex(/^[A-Z]{2}$/, 'INVALID_CHOICE')),
      residencyStatus: optional(z.enum(['NON_RESIDENT', 'EXPATRIATE', 'RESIDENT', 'OTHER'])),
      budgetMax: optional(amount),
      budgetCurrency: optional(currency),
      budgetMonthly: optional(amount),
      budgetMonthlyCurrency: optional(currency),
      downPayment: optional(amount),
      downPaymentCurrency: optional(currency),
      financingPreference: optional(z.enum(['CONVENTIONAL', 'ISLAMIC', 'NO_PREFERENCE', 'CASH'])),
      purchaseTimeframe: optional(z.enum(['LT_6M', 'M6_12', 'GT_12M', 'UNDEFINED'])),
    })
    .default({}),
});
export type DossierQualify = z.input<typeof dossierQualifySchema>;

// ─── Changes ────────────────────────────────────────────────────────────────

/** `PATCH /admin/dossiers/{id}` (`dossier.update`) — one or several of these fields, with the version read. */
export const dossierUpdateSchema = z.strictObject({
  version: z.number().int().min(1),
  priority: z.enum(DOSSIER_PRIORITIES).optional(),
  /** 300 characters; null: « Rétablir le texte automatique ». */
  clientNextStep: z.string().trim().max(300).nullable().optional(),
  /** The intended lot (PIP-050 « Choisir le lot »); null: no intended lot. */
  lotId: z.uuid().nullable().optional(),
  financingType: z.enum(['CONVENTIONAL', 'ISLAMIC', 'NO_PREFERENCE']).nullable().optional(),
  purchasePrice: amount.nullable().optional(),
  downPayment: amount.nullable().optional(),
  downPaymentCurrency: currency.nullable().optional(),
  loanAmountRequested: amount.nullable().optional(),
  durationMonths: z.number().int().min(12).max(480).nullable().optional(),
});
export type DossierUpdate = z.input<typeof dossierUpdateSchema>;

/** PIP-026 — `POST /admin/dossiers/{id}/assign` (`dossier.assign`). */
export const dossierAssignSchema = z.strictObject({
  agentId: z.uuid({ error: 'REQUIRED' }),
  /** « Ne pas informer le client ». */
  silent: z.boolean().default(false),
});

/** PIP-080, CYC-031 — `POST /admin/dossiers/{id}/hold` (`dossier.transition`). */
export const dossierHoldSchema = z
  .strictObject({
    reason: z.enum(HOLD_REASONS, { error: 'REQUIRED' }),
    note: z.string().trim().max(500).nullable().default(null),
    /** Planned resumption (`YYYY-MM-DD`), not in the past. */
    until: day.nullable().default(null),
    /** « Informer le client par e-mail »; forced to true when the reason is WAITING_CLIENT. */
    notifyClient: z.boolean().default(false),
    /** « Ce que nous attendons du client (il le lira) » — WAITING_CLIENT only. */
    clientNote: z.string().trim().max(300).nullable().default(null),
  });
export type DossierHold = z.input<typeof dossierHoldSchema>;

/** PIP-081, CYC-035 — `POST /admin/dossiers/{id}/close` (`dossier.close`). */
export const dossierCloseSchema = z
  .strictObject({
    reason: z.enum(LOST_REASONS, { error: 'REQUIRED' }),
    note: z.string().trim().max(500).nullable().default(null),
    notifyClient: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.reason === 'OTHER' && !v.note) ctx.addIssue({ code: 'custom', path: ['note'], message: 'REQUIRED' });
  });
export type DossierClose = z.input<typeof dossierCloseSchema>;

/** PIP-082 — `reopen`, `move-back` (a reason is required), `DELETE` (a reason too: Q-078). */
export const dossierReasonSchema = z.strictObject({ reason: z.string().trim().min(1, 'REQUIRED').max(500) });

/**
 * `GET /admin/dossiers/{id}/effects` — what the pause and closing windows announce before confirmation (PIP-080,
 * PIP-081): what keeps running during a pause, what a closing cancels, with their numbers.
 */
export interface DossierEffects {
  upcomingAppointments: { id: string; startsAt: string; type: string; clientInformed: boolean }[];
  openTasks: number;
  openLeads: number;
  /** Delivery 4: an active option or reservation, unfinished submissions. Always empty before. */
  reservation: { lotReference: string; status: string; until: string | null } | null;
  submissions: number;
  client: { name: string | null; hasEmail: boolean };
}

// ─── Matching: the tab « Biens » (PIP-030 … PIP-033) ────────────────────────

export interface CandidateRow {
  id: string;
  version: number;
  origin: CandidateOrigin;
  status: CandidateStatus;
  statusChangedAt: string;
  createdAt: string;
  /** A proposal: its adviser, when it was sent (null: in preparation), when the client opened it. */
  proposedBy: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  message: string | null;
  property: DossierPropertyCard;
  /** The lot the client preferred (INT-030), with its state now. */
  preferredLot: LotOption | null;
  clientComment: string | null;
  declineReason: DeclineReason | null;
  declineNote: string | null;
  /** Internal note of the adviser. */
  advisorNote: string | null;
  /** INT-030 — « Je retiens ce bien » waiting for confirmation. */
  selectionRequestedAt: string | null;
  selectionDeclineNote: string | null;
  /** The next confirmed visit of this property. */
  visitAt: string | null;
  retained: boolean;
  can: {
    setInterested: Ability;
    decline: Ability;
    select: Ability;
    unselect: Ability;
    confirmSelection: Ability;
    declineSelection: Ability;
    deleteDraft: Ability;
    planVisit: Ability;
    chooseLot: Ability;
  };
}

export interface CandidateList {
  data: CandidateRow[];
  /** Proposals saved without sending: they leave together with the next sending (PIP-031). */
  drafts: number;
  /** Available lots of the retained property, for « Choisir le lot ». */
  lots: LotOption[];
  client: { name: string | null; hasEmail: boolean; hasAccount: boolean };
  canPropose: Ability;
}

/** PIP-031, PIP-032 — `GET /admin/dossiers/{id}/candidates/search`: the catalogue filters, prefilled from the client's project. */
export const candidateSearchQuerySchema = z.strictObject({
  q: z.string().trim().max(120).optional(),
  regionId: z.uuid().optional(),
  type: csv(['APARTMENT', 'STUDIO', 'DUPLEX', 'VILLA', 'LAND', 'COMMERCIAL']),
  minRooms: z.coerce.number().int().min(1).max(20).optional(),
  /** Maximum price, in the reference currency of the catalogue. */
  maxPrice: z.coerce.number().min(0).max(1e12).optional(),
  /** `1`: ignore the prefill and answer with these criteria only. */
  explicit: z.enum(['1']).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export interface CandidateSearchItem extends DossierPropertyCard {
  rooms: number | null;
  surfaceMin: string | null;
  /** Already considered in this dossier (with its status). */
  already: CandidateStatus | null;
}

export interface CandidateSearch {
  /** The criteria applied (the prefill of PIP-031 on the first call). */
  criteria: { regionId: string | null; type: string[]; minRooms: number | null; maxPrice: number | null; currency: string };
  regions: { id: string; name: string }[];
  /** PIP-032 — the five most relevant published and available properties for this project. */
  suggestions: CandidateSearchItem[];
  data: CandidateSearchItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  /** The proposals in preparation that will leave with the sending. */
  drafts: { id: string; title: string; reference: string }[];
}

/** PIP-031 — `POST …/candidates/propose`: `send` true = « Proposer et envoyer », false = « Enregistrer sans envoyer ». */
export const candidateProposeSchema = z.strictObject({
  propertyIds: z.array(z.uuid()).max(20).default([]),
  message: z.string().trim().max(1000).nullable().default(null),
  send: z.boolean(),
});
export type CandidatePropose = z.input<typeof candidateProposeSchema>;
export interface CandidateProposed {
  added: number;
  sent: number;
  /** NOT-025 — the client has no e-mail address: a task replaces the e-mail. */
  clientHasEmail: boolean;
}

/** PIP-033 — « Agir pour le client »: `POST …/candidates/{cid}/set-status`. */
export const candidateSetStatusSchema = z
  .strictObject({
    status: z.enum(['INTERESTED', 'DECLINED']),
    declineReason: z.enum(DECLINE_REASONS).nullable().default(null),
    declineNote: z.string().trim().max(500).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'DECLINED' && !v.declineReason) ctx.addIssue({ code: 'custom', path: ['declineReason'], message: 'REQUIRED' });
  });
export const candidateNoteSchema = z.strictObject({ advisorNote: z.string().trim().max(1000).nullable() });
/** CYC-071 — `select` and `confirm-selection`: the lot is optional. */
export const candidateSelectSchema = z.strictObject({ lotId: z.uuid().nullable().default(null) });
/** CYC-071 — refusing the choice asked by the client: the reason is shown to him. */
export const candidateDeclineSelectionSchema = z.strictObject({ reason: z.string().trim().min(1, 'REQUIRED').max(500) });
/** CYC-242 — the reason is optional and internal. */
export const candidateUnselectSchema = z.strictObject({ reason: z.string().trim().max(500).nullable().default(null) });

// ─── History (PIP-060 « Historique ») ───────────────────────────────────────

export interface StageHistoryRow {
  id: string;
  fromStage: DossierStage | null;
  toStage: DossierStage;
  fromStatus: DossierStatus | null;
  toStatus: DossierStatus;
  isBackward: boolean;
  /** A hold or lost reason code (`WAITING_CLIENT`…) followed by the note, or free text. */
  reasonCode: string | null;
  reasonText: string | null;
  author: { kind: 'STAFF' | 'SYSTEM'; name: string | null };
  at: string;
  /** Time spent in the stage left, pauses excluded: business minutes (CAL-063). */
  businessMinutesInPreviousStage: number | null;
}
export interface AuditRow {
  id: string;
  action: string;
  author: { kind: 'STAFF' | 'SYSTEM'; name: string | null };
  at: string;
  /** Names of the fields that changed. */
  fields: string[];
  reason: string | null;
}
export interface DossierHistory {
  stages: StageHistoryRow[];
  /** Only with `audit.read`; null otherwise. */
  audit: AuditRow[] | null;
}

// ─── The client's answers (EC-12, EC-13 — INT-020, INT-021, INT-030, INT-031) ──

/** `POST /client/candidates/{id}/interested` — « Ce bien m'intéresse » · « Finalement, il m'intéresse ». */
export const clientInterestedSchema = z.strictObject({ comment: z.string().trim().max(1000).nullable().default(null) });
/** `POST /client/candidates/{id}/decline` — the reason of INT-021; `cancelVisit` confirms the cancellation of a visit to come. */
export const clientDeclineSchema = z.strictObject({
  reason: z.enum(DECLINE_REASONS, { error: 'REQUIRED' }),
  note: z.string().trim().max(500).nullable().default(null),
  cancelVisit: z.boolean().default(false),
});
/** `POST /client/candidates/{id}/select-request` — « Je retiens ce bien »; `replace` confirms the replacement of a pending choice. */
export const clientSelectRequestSchema = z.strictObject({
  lotId: z.uuid().nullable().default(null),
  comment: z.string().trim().max(1000).nullable().default(null),
  replace: z.boolean().default(false),
});
export type ClientInterestedRequest = z.input<typeof clientInterestedSchema>;
export type ClientDeclineRequest = z.input<typeof clientDeclineSchema>;
export type ClientSelectRequest = z.input<typeof clientSelectRequestSchema>;

/** `GET /client/candidates/{id}/lots` — INT-030: the available lots of the property (reference, floor, surface, price). */
export interface ClientLotChoice {
  id: string;
  reference: string;
  floor: number | null;
  surfaceM2: string;
  price: Money;
}
/** What every answer returns: the new state of the card. */
export interface ClientCandidateAnswer {
  id: string;
  status: CandidateStatus;
  selectionRequestedAt: string | null;
}

/** ECL-032 — `GET /client/dossiers/{référence}/property`: « Mon bien » (the retained property and the intended lot). */
export interface ClientDossierProperty {
  /** Null: no retained property (the tab is absent). */
  property: import('./client-space.js').PropertySummary | null;
  photos: PublicImage[];
  /** The property is no longer available on a dossier in progress (CYC-073). */
  unavailable: boolean;
  lot: { reference: string; floor: number | null; surfaceM2: string; orientation: string | null; state: 'INTENDED' | 'OPTION' | 'RESERVED' } | null;
  /** CYC-102 — the intended lot was taken by someone else. */
  lotLost: boolean;
  /** MOD-313 — one price: « Prix », or « Prix convenu » once an option or a reservation exists. */
  price: { amount: Money; agreed: boolean; equivalent: Money | null } | null;
  advisorName: string | null;
}
