// Package 2.8 — the client space (« Espace client »): shell, dashboard (EC-10), dossier follow-up (EC-11), interests and
// proposals (EC-12, EC-13), profile (EC-50), security (EC-51, routes of identity), agreements (EC-53), « Écrire à mon
// conseiller » (MSG-021) and the notifications read in « Dernières nouvelles » (ECL-010, MSG-046).
// API-002: the API sends values, never screen sentences; the web composes them from `ui.client.*`.
import { z } from 'zod';
import type {
  CandidateStatus,
  ContactChannel,
  ContactTimeSlot,
  DossierStage,
  DossierStatus,
  EmploymentType,
  FinancingPreference,
  HoldReason,
  LeadKind,
  LeadStatus,
  PropertyType,
  PurchasePurpose,
  PurchaseTimeframe,
  ResidencyStatus,
} from './enums.js';
import type { Money } from './http.js';
import type { PublicImage } from './catalogue.js';



// ─── Shell (ECL-001, ECL-002) ────────────────────────────────────────────────

export interface SpaceDossierLink {
  reference: string;
  stage: DossierStage;
  status: DossierStatus;
  propertyTitle: string | null;
  /** 2.9 — « Mes pièces » appears only on a dossier that has a list of documents. */
  hasDocumentList: boolean;
  lastActivityAt: string;
}

/** `GET /client/space` — what the frame of every page needs: names, counters, dossiers for the menu. */
export interface ClientSpaceSummary {
  firstName: string | null;
  lastName: string | null;
  email: string;
  /** TRV-031 — every date of the space is shown in the client's zone (record, else the business calendar's). */
  timeZone: string;
  /** MSG-040 — the bell's counter. */
  unreadNotifications: number;
  /** AUT-071 — the address bounced: banner « Mon adresse est correcte ». */
  emailBounced: boolean;
  /** Most recently active first (ECL-033). */
  dossiers: SpaceDossierLink[];
  /** ECL-014 — the dossier the dashboard shows (and the « Dossier » tab opens), or null. */
  shownDossierReference: string | null;
  badges: {
    /** ECL-001 — proposals not opened yet (EC-13). */
    proposals: number;
  };
  /** INT-044 — the « Rendez-vous » entry shows when the client has at least one appointment (or the request is on). */
  hasAppointments: boolean;
}

// ─── People ──────────────────────────────────────────────────────────────────

/** ECL-012, TRV-145 — the advisor as the client sees him (« Amel K. »). Never his personal phone. */
export interface AdvisorCard {
  firstName: string;
  lastInitial: string | null;
  jobTitle: string | null;
  /** The account's avatar when it has one; else the screen draws initials (TRV-145). */
  photo: PublicImage | null;
}

/** NOT-053 + ECL-035 — what the screen needs to compose « Un conseiller vous appelle {quand}. » for ONE request. */
export interface CallbackPromise {
  leadReference: string;
  kind: LeadKind;
  preferredCallbackDate: string | null;
  preferredSlot: ContactTimeSlot | null;
  /** The person's zone (lead, else client, else calendar). */
  timeZone: string;
  /** ECL-035 — the first-contact deadline passed without contact. */
  breached: boolean;
  createdAt: string;
}

// ─── Notifications (NOT-030, MSG-040, ECL-010) ───────────────────────────────

/** MSG-040 — icon by the destination of the link. */
export type NotificationTarget = 'DOCUMENT' | 'DOSSIER' | 'FINANCING' | 'MESSAGE' | 'APPOINTMENT' | 'PROPERTY' | 'CAFE' | 'OTHER';

export interface ClientNotificationItem {
  id: string;
  type: string;
  /** Rendered at creation in the recipient's language (NOT-031); plural form when `count` > 1. */
  title: string;
  titlePlural: string | null;
  body: string | null;
  link: string | null;
  target: NotificationTarget;
  count: number;
  read: boolean;
  /** Sorted on this (NOT-016). */
  updatedAt: string;
}

export interface ClientNotificationList {
  data: ClientNotificationItem[];
  unread: number;
}

export const notificationReadRequestSchema = z.union([
  z.strictObject({ ids: z.array(z.uuid()).min(1).max(100) }),
  z.strictObject({ entityType: z.enum(['Dossier', 'Lead', 'Conversation']), entityId: z.uuid() }),
]);
export type NotificationReadRequest = z.infer<typeof notificationReadRequestSchema>;

// ─── Dossier (ECL-020 … ECL-033) ─────────────────────────────────────────────

/** ECL-020 — one of the six displayed steps, with the date it was reached. */
export interface DisplayedStep {
  n: 1 | 2 | 3 | 4 | 5 | 6;
  state: 'DONE' | 'CURRENT' | 'UPCOMING' | 'NOT_CONCERNED';
  reachedAt: string | null;
}

/**
 * ECL-021 — the « Prochaine étape » sentence, as a code and its values; `advisorText` wins when the advisor wrote one
 * (`Dossier.clientNextStep`). `null` on a closed dossier (the banner replaces it).
 */
export interface DossierNextStep {
  code:
    | 'ADVISOR'
    | 'INTEREST'
    | 'INTEREST_PLAIN'
    | 'QUALIFICATION_CALL'
    | 'QUALIFICATION'
    | 'MATCHING_SELECTED'
    | 'MATCHING_SELECTION_REQUESTED'
    | 'MATCHING_PROPOSALS'
    | 'MATCHING_VISIT'
    | 'MATCHING_INTERESTED'
    | 'MATCHING_PREPARING'
    | 'DOCUMENTS_UNAVAILABLE'
    | 'DOCUMENTS_TO_PROVIDE'
    | 'DOCUMENTS_CHECKING'
    | 'DOCUMENTS_CONSENT'
    | 'DOCUMENTS_COMPLETE_FINANCING'
    | 'DOCUMENTS_COMPLETE_CASH'
    | 'DOCUMENTS_LIST_PENDING'
    | 'BANK_INFO'
    | 'BANK_STUDY'
    | 'BANK_OTHER'
    | 'APPROVED_ACCEPT'
    | 'APPROVED'
    | 'ACQUISITION_CANCELLED'
    | 'ACQUISITION_SIGNING'
    | 'ACQUISITION'
    | 'WON_KEYS'
    | 'WON';
  advisorText: string | null;
  params: {
    n?: number;
    property?: string;
    bank?: string;
    banks?: string;
    date?: string;
  };
  /** INTEREST / QUALIFICATION_CALL — the promise of the request ECL-012 retains. */
  promise: CallbackPromise | null;
}

/** ECL-022 — banner above the steps. */
export interface DossierBanner {
  kind: 'ON_HOLD' | 'LOST' | 'WON';
  holdUntil: string | null;
  holdReason: HoldReason | null;
  holdClientNote: string | null;
  /** LOST — files deleted at the end of their retention (DOS-016). */
  filesPurged: boolean;
}

export interface PropertySummary {
  reference: string;
  title: string;
  slug: string;
  region: string | null;
  city: string | null;
  standing: 'COMFORT' | 'STANDING' | 'PREMIUM';
  type: PropertyType;
  rooms: number | null;
  /** Listed in the public catalogue: its page opens (FIC). */
  online: boolean;
  /** PUBLISHED but temporarily offline (CYC-121): « Fiche en cours de mise à jour ». */
  offline: boolean;
  /** No longer offered (unpublished for good, archived, sold out, withdrawn): « Ce bien n'est plus proposé ». */
  gone: boolean;
  availability: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'WITHDRAWN';
  photo: PublicImage | null;
  /** Reference-currency price « à partir de » (CAT-040), or the price kept with the dossier when not online. */
  price: Money | null;
  priceIsFrom: boolean;
  /** CAT-040 — indicative monthly payment; hidden when reserved or sold (CAT-043). */
  monthly: Money | null;
  /** CAT-040 line 9 — down payment of the reference financing, with its share of the price; null when not online. */
  downPayment: Money | null;
  downPaymentPct: string | null;
  surfaceMin: string | null;
  surfaceMax: string | null;
}

/**
 * ECL-023, DOS-001 — where the pieces of a dossier stand, for « Plus que {n} pièces à déposer » and the figures of the
 * dashboard. Counts follow ECL-011 « Ce qui compte »: required pieces the CLIENT provides; `required` / `satisfied`
 * are those of the completeness (CAL-055). Null without a list of pieces, and on a closed dossier.
 */
export interface DocumentsSummary {
  required: number;
  satisfied: number;
  toProvide: number;
  toRedo: number;
  inReview: number;
  /** `YYYY-MM-DD` — the nearest due date of a piece to provide. */
  nearestDue: string | null;
}

export interface DossierView {
  /** NOT-032 — displaying the dossier marks its notifications read (`{entityType: 'Dossier', entityId}`). */
  id: string;
  reference: string;
  stage: DossierStage;
  status: DossierStatus;
  financingRequested: boolean;
  steps: DisplayedStep[];
  nextStep: DossierNextStep | null;
  banner: DossierBanner | null;
  /** ECL-023 — from DOCUMENTS on, on a dossier that is not closed. */
  completenessPct: number | null;
  /** ECL-023 — the figures behind the bar (same condition as `completenessPct`, and a list of pieces). */
  documents: DocumentsSummary | null;
  property: PropertySummary | null;
  advisor: AdvisorCard | null;
  hasDocumentList: boolean;
  lastActivityAt: string;
  createdAt: string;
}

export interface DossierListItem {
  reference: string;
  stage: DossierStage;
  status: DossierStatus;
  propertyTitle: string | null;
  lastActivityAt: string;
  /** ECL-033 — what the row shows: the property (photo, town), the displayed step (1…6) and the completeness. */
  property: PropertySummary | null;
  step: 1 | 2 | 3 | 4 | 5 | 6;
  completenessPct: number | null;
  createdAt: string;
}

/** ECL-031 — one line of the client timeline; the screen composes the sentence from `kind` and `params`. */
export interface TimelineEntry {
  id: string;
  kind: string;
  occurredAt: string;
  params: Record<string, string | number | null>;
}

/**
 * ECL-031 — the families the « Suivi » can be filtered by (`?family=`): each kind of line belongs to one. The filter
 * and its counters are computed by the server: this list is the one of the space that can grow long (TRV-100).
 */
export const TIMELINE_FAMILIES = {
  REQUESTS: ['LEAD_SENT', 'LEAD_SENT_AGAIN'],
  PROPERTY: ['PROPERTIES_PROPOSED', 'APPOINTMENT_DONE', 'PROPERTY_SELECTED', 'SELECTION_DECLINED', 'SELECTION_WITHDRAWN', 'OPTION_PLACED', 'RESERVATION_CONFIRMED', 'OPTION_ENDED', 'RESERVATION_CANCELLED', 'DEPOSIT_DUE', 'DEPOSIT_REFUNDED', 'DEPOSIT_RETAINED'],
  DOCUMENTS: ['DOCUMENTS_REQUESTED', 'DOSSIER_COMPLETE', 'CONSENT_GIVEN', 'CONSENT_WITHDRAWN'],
  FINANCING: ['SUBMISSION_SENT', 'INFO_REQUESTED', 'BANK_APPROVED', 'BANK_REJECTED', 'BANK_DECISION_REVERTED', 'FINANCING_DROPPED', 'FINANCING_RESUMED', 'OFFER_UPDATED', 'OFFER_EXTENDED', 'OFFER_EXPIRED', 'SUBMISSION_WITHDRAWN'],
  PROJECT: ['AGENT_ASSIGNED', 'QUALIFIED', 'MILESTONE_REACHED', 'PUT_ON_HOLD', 'RESUMED', 'CLOSED', 'REOPENED'],
} as const;
export type TimelineFamily = keyof typeof TIMELINE_FAMILIES;
export const TIMELINE_FAMILY_KEYS = Object.keys(TIMELINE_FAMILIES) as TimelineFamily[];

/** The family of a kind of line (`PROJECT` for a kind this list does not know yet). */
export function timelineFamilyOf(kind: string): TimelineFamily {
  for (const f of TIMELINE_FAMILY_KEYS) if ((TIMELINE_FAMILIES[f] as readonly string[]).includes(kind)) return f;
  return 'PROJECT';
}

export interface TimelinePage {
  data: TimelineEntry[];
  meta: {
    nextCursor: string | null;
    /** Lines of the whole timeline, and per family (TRV-106) — whatever the family asked for. */
    total: number;
    counts: Record<TimelineFamily, number>;
  };
}

// ─── Dashboard (EC-10) ───────────────────────────────────────────────────────

/** ECL-011 — the « À faire » cards, by priority (five at most). */
export interface TodoCard {
  code:
    | 'OFFER_WAITING'
    | 'CONSENT_NEEDED'
    | 'DOCUMENTS_TO_REDO'
    | 'BANK_INFO'
    | 'DOCUMENTS_TO_PROVIDE'
    | 'DOCUMENTS_TO_RENEW'
    | 'APPOINTMENT_SOON'
    | 'PROPOSALS_NEW'
    | 'OPTION_ENDING'
    | 'SURVEY'
    | 'PROFILE_INCOMPLETE';
  params: { n?: number; bank?: string; date?: string; time?: string; type?: string; lot?: string; transmitted?: boolean; advisor?: string };
  /** The page it leads to; the screen shows a card only when its page is delivered (ECL-006). */
  href: string;
}

/** ECL-010 — the counts the dashboard leads with (TRV-106: computed by the server). `null`: the function is off. */
export interface DashboardOverview {
  /** INT-001 — « Les biens qui m'intéressent ». */
  interests: number;
  /** EC-13 — proposals not opened yet. */
  proposalsNew: number;
  /** INT-003 — requests still open (`NEW`, `IN_PROGRESS`). */
  openRequests: number;
  favorites: number | null;
  simulations: number;
  /** SFA-030 — active alerts. */
  alerts: number | null;
}

export type DashboardSituation = 'NOTHING' | 'LEAD_ONLY' | 'ACTIVE' | 'WON' | 'CLOSED_ONLY';

export interface DashboardCafe {
  registered: boolean;
  slug: string;
  title: string;
  startsAt: string;
  timezone: string;
  city: string | null;
  venue: string | null;
}

/** `GET /client/dashboard` — ECL-010 … ECL-014. */
export interface ClientDashboard {
  firstName: string | null;
  /** TRV-031 — the client's zone. */
  timeZone: string;
  situation: DashboardSituation;
  dossier: DossierView | null;
  otherDossiersCount: number;
  todo: TodoCard[];
  /** ECL-012 — null = « L'équipe Diaspora Patrimoine ». */
  advisor: AdvisorCard | null;
  /** ECL-012 — the open request without first contact (most recent), or null: no sentence. */
  promise: CallbackPromise | null;
  /** ECL-014 — LEAD_ONLY: « Votre demande {référence} est enregistrée. »; CLOSED_ONLY: the message sent since. */
  lead: { reference: string; kind: LeadKind; createdAt: string } | null;
  /** ECL-014 CLOSED_ONLY — the last closed dossier. */
  closedDossierReference: string | null;
  /** PRO-003 — « Profil complété à {n} % ». */
  profileCompletePct: number;
  cafe: DashboardCafe | null;
  overview: DashboardOverview;
  /** ECL-010 block 7 — ten lines before EC-31 (ECL-006). */
  news: ClientNotificationItem[];
}

// ─── Interests, proposals, requests (EC-12, EC-13, INT-001 … INT-023) ────────

export interface CandidateCard {
  id: string;
  dossierReference: string;
  dossierStage: DossierStage;
  status: CandidateStatus;
  origin: 'CLIENT_INTEREST' | 'ADVISOR_PROPOSAL';
  property: PropertySummary;
  /** INT-022 / INT-002 — every lot reserved by other dossiers. */
  fullyReserved: boolean;
  /** UNAVAILABLE: sold, withdrawn, archived. */
  unavailable: boolean;
  /** Date of the interest (or of the proposal). */
  since: string;
  viewedAt: string | null;
  selectionRequestedAt: string | null;
  /** CYC-071 — « {conseiller} n'a pas pu retenir ce bien : {raison}. » */
  selectionDeclineNote: string | null;
  visitAt: string | null;
  /** INT-002 INTERESTED — the promise of the request behind the interest, while no first contact. */
  promise: CallbackPromise | null;
  advisor: AdvisorCard | null;
  /** INT-004 — the answers the client may give now, by the server's rule: the card shows these and no other. */
  actions: CandidateActions;
}

/** INT-004, INT-020, INT-021, INT-030, INT-031 — what the client may answer on a property envisaged, now. */
export interface CandidateActions {
  /** « Ce bien m'intéresse » · « Finalement, il m'intéresse ». */
  interested: boolean;
  /** « Ce bien ne me convient pas » · « Ce bien ne m'intéresse plus » (with the reason of INT-021). */
  decline: boolean;
  /** « Je retiens ce bien » (INT-030). */
  selectRequest: boolean;
  /** « Annuler mon choix » (INT-031). */
  cancelSelect: boolean;
  /** « Demander une visite » — INT-040, or its fallback while the request is not delivered (ECL-006). */
  visit: boolean;
}

export interface ClientRequestRow {
  reference: string;
  kind: LeadKind;
  status: Exclude<LeadStatus, 'SPAM'>;
  createdAt: string;
  advisor: AdvisorCard | null;
  /** The property or programme the request is about. */
  subject: string | null;
  /** INT-001 — an interest that did not create a candidate: « Votre conseiller revient vers vous à ce sujet. » */
  noCandidate: boolean;
  /** MSG-021 — written from the space. */
  fromSpace: boolean;
  /** D-107 — what the client wrote, as he wrote it (his message, or the one of a form), else null. */
  message: string | null;
}

export interface ClientInterests {
  properties: CandidateCard[];
  requests: ClientRequestRow[];
}

export interface ProposalGroup {
  sentAt: string;
  advisor: AdvisorCard | null;
  message: string | null;
  items: CandidateCard[];
}

export interface ClientProposals {
  /** INT-023 — before qualification: « Il vous contacte d'abord… »; after: « Sa sélection arrive. ». */
  qualified: boolean;
  groups: ProposalGroup[];
}

// ─── « Écrire à mon conseiller » (MSG-021) ───────────────────────────────────

/** MSG-021 `prefilledFrom` — the button the form was opened from (null: no prefill). */
export const CLIENT_MESSAGE_ORIGINS = [
  'PROPERTY_ABOUT',
  'PROPERTY_SELECT',
  'PROPERTY_VISIT',
  'RESUME_PROJECT',
  'RELAUNCH_PROJECT',
  'SIMULATION',
  'APPOINTMENT_AGAIN',
  'DOCUMENTS',
  'ADVISOR',
] as const;
export type ClientMessageOrigin = (typeof CLIENT_MESSAGE_ORIGINS)[number];

export const CLIENT_MESSAGE_MIN = 10;
export const CLIENT_MESSAGE_MAX = 2000;

export const clientMessageRequestSchema = z.strictObject({
  message: z.string().trim().min(CLIENT_MESSAGE_MIN).max(CLIENT_MESSAGE_MAX),
  prefilledFrom: z.enum(CLIENT_MESSAGE_ORIGINS).nullable().default(null),
  /** The dossier the message is about; null = « Autre sujet ». Must be one of the client's dossiers. */
  dossierReference: z.string().regex(/^[A-Z0-9-]{3,20}$/).nullable().default(null),
  /** Page of the space the message leaves from (no parameters). */
  submittedFromPath: z.string().regex(/^\/espace-client(?:\/[a-z0-9\-/]*)?$/).max(400).nullable().default(null),
});
export type ClientMessageRequest = z.input<typeof clientMessageRequestSchema>;

/** `GET /client/advisor-contact` — who the form writes to, and the dossiers it can be about. */
export interface ClientMessageContext {
  advisor: AdvisorCard | null;
  dossiers: { reference: string; propertyTitle: string | null; status: DossierStatus }[];
  /** MSG-001 — the dossier preselected (ECL-014, open or on hold), else null (« Autre sujet »). */
  defaultDossierReference: string | null;
}

export interface ClientMessageResponse {
  reference: string;
  advisor: AdvisorCard | null;
}

// ─── Profile (EC-50, PRO-001 … PRO-004) ──────────────────────────────────────

export const PROFILE_SECTIONS = ['identity', 'contact', 'situation', 'project', 'finances'] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export interface ClientProfile {
  /** MOD-007 — optimistic locking (TRV-094). */
  version: number;
  email: string;
  pendingEmail: string | null;
  identity: { firstName: string | null; lastName: string | null; birthDate: string | null; nationalities: string[] };
  contact: {
    phone: string | null;
    whatsappOptIn: boolean;
    countryOfResidence: string | null;
    cityOfResidence: string | null;
    preferredContactChannel: ContactChannel | null;
    preferredContactSlot: ContactTimeSlot | null;
    timezone: string | null;
  };
  situation: { residencyStatus: ResidencyStatus | null; employmentType: EmploymentType | null; profession: string | null; employerName: string | null; employedSince: string | null };
  project: {
    preferredRegionIds: string[];
    preferredTypes: PropertyType[];
    minRooms: number | null;
    budgetMax: string | null;
    budgetCurrency: string | null;
    budgetMonthly: string | null;
    budgetMonthlyCurrency: string | null;
    purchasePurpose: PurchasePurpose | null;
    purchaseTimeframe: PurchaseTimeframe | null;
    financingPreference: FinancingPreference | null;
  };
  finances: { currency: string | null; monthlyIncome: string | null; otherMonthlyIncome: string | null; monthlyDebts: string | null; downPayment: string | null };
  /** PRO-003 */
  completePct: number;
  /** Choices of the form. */
  options: {
    countries: { code: string; name: string }[];
    regions: { id: string; name: string; countryCode: string }[];
    currencies: string[];
  };
}

const text = (max: number) => z.string().trim().max(max).nullable();
const decimal = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/).nullable();
const isoDate = z.iso.date().nullable();

/** SEC-095 — the platform serves adults only: a birth date that gives less than 18 years is refused (a future one too). */
export const ADULT_AGE = 18;
export function isAdultBirthDate(value: string, today: string = new Date().toISOString().slice(0, 10)): boolean {
  const [y, m, d] = today.split('-');
  return value <= `${String(Number(y) - ADULT_AGE).padStart(4, '0')}-${m}-${d}`;
}
const birthDate = isoDate.superRefine((v, ctx) => {
  if (!v) return;
  if (v > new Date().toISOString().slice(0, 10)) ctx.addIssue({ code: 'custom', message: 'DATE_IN_FUTURE' });
  else if (!isAdultBirthDate(v)) ctx.addIssue({ code: 'custom', message: 'UNDER_AGE' });
});

export const profileSectionSchemas = {
  identity: z.strictObject({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    birthDate,
    nationalities: z.array(z.string().regex(/^[A-Z]{2}$/)).max(3),
  }),
  contact: z.strictObject({
    phone: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable(),
    whatsappOptIn: z.boolean(),
    countryOfResidence: z.string().regex(/^[A-Z]{2}$/).nullable(),
    cityOfResidence: text(80),
    preferredContactChannel: z.enum(['EMAIL', 'PHONE', 'WHATSAPP']).nullable(),
    preferredContactSlot: z.enum(['MORNING', 'NOON', 'AFTERNOON', 'EVENING', 'ANYTIME']).nullable(),
    timezone: z.string().max(64).nullable(),
  }),
  situation: z.strictObject({
    residencyStatus: z.enum(['NON_RESIDENT', 'EXPATRIATE', 'RESIDENT', 'OTHER']).nullable(),
    employmentType: z.enum(['PERMANENT', 'FIXED_TERM', 'CIVIL_SERVANT', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'RETIRED', 'OTHER']).nullable(),
    profession: text(80),
    employerName: text(120),
    employedSince: isoDate,
  }),
  project: z.strictObject({
    preferredRegionIds: z.array(z.uuid()).max(10),
    preferredTypes: z.array(z.enum(['APARTMENT', 'STUDIO', 'DUPLEX', 'VILLA', 'LAND', 'COMMERCIAL'])).max(6),
    minRooms: z.number().int().min(1).max(10).nullable(),
    budgetMax: decimal,
    budgetCurrency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    budgetMonthly: decimal,
    purchasePurpose: z.enum(['HOLIDAY_HOME', 'RETURN_HOME', 'FAMILY', 'RENTAL_INVESTMENT', 'OTHER']).nullable(),
    purchaseTimeframe: z.enum(['LT_6M', 'M6_12', 'GT_12M', 'UNDEFINED']).nullable(),
    financingPreference: z.enum(['CONVENTIONAL', 'ISLAMIC', 'NO_PREFERENCE', 'CASH']).nullable(),
  }),
  finances: z.strictObject({
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    monthlyIncome: decimal,
    otherMonthlyIncome: decimal,
    monthlyDebts: decimal,
    downPayment: decimal,
  }),
} as const;

export const profileUpdateRequestSchema = z.discriminatedUnion('section', [
  z.strictObject({ section: z.literal('identity'), version: z.number().int().positive(), values: profileSectionSchemas.identity }),
  z.strictObject({ section: z.literal('contact'), version: z.number().int().positive(), values: profileSectionSchemas.contact }),
  z.strictObject({ section: z.literal('situation'), version: z.number().int().positive(), values: profileSectionSchemas.situation }),
  z.strictObject({ section: z.literal('project'), version: z.number().int().positive(), values: profileSectionSchemas.project }),
  z.strictObject({ section: z.literal('finances'), version: z.number().int().positive(), values: profileSectionSchemas.finances }),
]);
export type ProfileUpdateRequest = z.input<typeof profileUpdateRequestSchema>;

// ─── Trusted people (PRO-040) ────────────────────────────────────────────────

export const CLIENT_CONTACTS_MAX = 5;

export interface TrustedPerson {
  id: string;
  fullName: string;
  relation: string | null;
  phone: string | null;
  email: string | null;
  canVisitOnBehalf: boolean;
  notes: string | null;
  informedConfirmedAt: string | null;
}

export const trustedPersonSchema = z.strictObject({
  fullName: z.string().trim().min(2).max(160),
  relation: z.string().trim().max(60).nullable(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable(),
  email: z.email().max(254).nullable(),
  canVisitOnBehalf: z.boolean(),
  notes: z.string().trim().max(300).nullable(),
});
export const trustedPersonCreateSchema = trustedPersonSchema.extend({ informed: z.literal(true) });
export type TrustedPersonInput = z.input<typeof trustedPersonSchema>;

// ─── Agreements (EC-53, PRO-051) ─────────────────────────────────────────────

export interface LegalAcceptance {
  type: 'TERMS_OF_USE' | 'PRIVACY_POLICY';
  version: string | null;
  acceptedAt: string | null;
  /** Public page of the text. */
  href: string;
}

export interface TransmissionAgreement {
  state: 'GIVEN' | 'RECORDED' | 'WITHDRAWN' | 'WITHDRAWAL_RECORDED' | 'NOT_GIVEN';
  at: string | null;
  /** RECORDED / WITHDRAWAL_RECORDED — the advisor who recorded it (« Amel K. »). */
  recordedBy: string | null;
}

export interface PartyAgreement {
  dossierReference: string;
  firstName: string | null;
  at: string;
}

export interface ClientAgreements {
  legal: LegalAcceptance[];
  marketing: { granted: boolean; at: string | null };
  /** MOD-106 — the state is the most recent row for (client, DATA_SHARING_PARTNERS). */
  transmission: TransmissionAgreement;
  parties: PartyAgreement[];
  /** DOS-040 — where « Donner mon accord » is also offered (the « Pièces » tab of these dossiers). */
  documentsDossierReference: string | null;
}

/**
 * `POST /client/me/consents` (PRO-030, PRO-051) — the « Actualités » switch, and the withdrawal of the transmission
 * agreement. GIVING it is the box of DOS-040 in the « Pièces » tab (package 2.9). One `Consent` row each time.
 */
export const consentChangeRequestSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('MARKETING_EMAIL'), granted: z.boolean() }),
  z.strictObject({ type: z.literal('DATA_SHARING_PARTNERS'), granted: z.literal(false) }),
]);
export type ConsentChangeRequest = z.infer<typeof consentChangeRequestSchema>;
