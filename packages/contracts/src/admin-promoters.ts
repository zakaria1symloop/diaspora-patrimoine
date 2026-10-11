// Package 3.4 « Promoteurs » (EA-50, EA-51; 04-back-office/04 § 1: CTL-001 … CTL-007), « Autres partenaires » (EA-47,
// CTL-170) and the review of partner applications (ACP-084) — wire contracts of `/admin/promoters…`, `/admin/partners…`
// and `/admin/leads/{id}/…-partner…`.
import { z } from 'zod';
import type { AdminImageRef } from './admin-catalogue.js';
import { catalogueCsv, catalogueIdCsv, cataloguePageSchema, type AdminPublication } from './admin-programs.js';

export const PARTNER_STATUSES = ['PROSPECT', 'ACTIVE', 'SUSPENDED', 'ENDED'] as const;
export type AdminPartnerStatus = (typeof PARTNER_STATUSES)[number];

// ─── List (CTL-001) ─────────────────────────────────────────────────────────

/** CTL-001 — « Sélectionnés » (ACTIVE) · « En discussion » (PROSPECT) · « Suspendus et terminés » · « Tous ». */
export const PROMOTER_VIEWS = ['selected', 'prospects', 'suspended-ended', 'all'] as const;
export type PromoterView = (typeof PROMOTER_VIEWS)[number];
export const PROMOTER_SORTS = ['name', '-name', 'conventionExpiresAt', '-conventionExpiresAt', 'updatedAt', '-updatedAt'] as const;

export const promoterListQuerySchema = z.strictObject({
  view: z.enum(PROMOTER_VIEWS).optional(),
  q: z.string().trim().max(120).optional(),
  regionId: catalogueIdCsv,
  /** AUT-073 — `expiring`: within 30 days · `expired`. */
  convention: catalogueCsv(['expiring', 'expired', 'none'] as const),
  isPublic: z.enum(['true', 'false']).optional(),
  sort: z.enum(PROMOTER_SORTS).default('name'),
  ...cataloguePageSchema,
});

/** AUT-073 — the state of a convention: « Convention expirée », or expiring within 30 days. */
export type ConventionState = 'OK' | 'EXPIRING' | 'EXPIRED' | 'NONE';

export interface PromoterListItem {
  id: string;
  name: string;
  legalName: string;
  status: AdminPartnerStatus;
  region: string | null;
  programCount: number;
  publishedProperties: number;
  openDossiers: number;
  conventionExpiresAt: string | null;
  conventionState: ConventionState;
  isPublic: boolean;
  logo: AdminImageRef | null;
  updatedAt: string;
}

export interface PromoterList {
  data: PromoterListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  views: Record<PromoterView, number>;
  facets: { regionId: Record<string, number>; convention: Record<string, number>; isPublic: Record<string, number> };
  regions: { id: string; name: string }[];
}

// ─── One promoter (CTL-003) ─────────────────────────────────────────────────

/** Q-003 — a line of the vetting checklist. */
export interface VettingLine {
  label: string;
  done: boolean;
  note: string | null;
}

export interface AdminPromoterContact {
  id: string;
  fullName: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  notes: string | null;
  /** The person has an account (an accepted application, ACP-084). */
  hasAccount: boolean;
}

export const PARTNER_DOCUMENT_CATEGORIES = ['Agrément', 'Convention', 'Registre de commerce', 'Attestation', 'Autre'] as const;

export interface AdminPartnerDocument {
  id: string;
  label: string;
  category: string;
  issuedAt: string | null;
  expiresAt: string | null;
  /** AUT-073 — within 30 days, or past. */
  expiry: 'OK' | 'EXPIRING' | 'EXPIRED' | 'NONE';
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  scanStatus: string;
  createdAt: string;
}

export interface PromoterProgramRow {
  id: string;
  name: string;
  publication: AdminPublication;
  region: string;
  lotsAvailable: number;
  lotsTotal: number;
  properties: { id: string; reference: string; title: string; publication: AdminPublication; availability: string }[];
}

export interface AdminPromoterDetail {
  id: string;
  version: number;
  name: string;
  legalName: string;
  brandName: string | null;
  slug: string;
  status: AdminPartnerStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  countryCode: string;
  country: string;
  registrationNumber: string | null;
  taxId: string | null;
  licenseNumber: string | null;
  addressLine: string | null;
  regionId: string | null;
  region: string | null;
  cityId: string | null;
  city: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  descriptionPublic: string | null;
  referencesPublic: string | null;
  foundedYear: number | null;
  deliveredUnits: number | null;
  isPublic: boolean;
  logo: AdminImageRef | null;
  cover: AdminImageRef | null;
  vettingChecklist: VettingLine[];
  vettedAt: string | null;
  /** CTL-003 « Convention » — the two dates are read by everyone (in the header). */
  conventionSignedAt: string | null;
  conventionExpiresAt: string | null;
  conventionState: ConventionState;
  /** Only with `partner.convention.manage`: absent otherwise (the API never sends it). */
  commissionTerms?: string | null;
  accountManager: string | null;
  contacts: AdminPromoterContact[];
  documents: AdminPartnerDocument[];
  programs: PromoterProgramRow[];
  /** Standalone properties of the promoter. */
  standalone: { id: string; reference: string; title: string; publication: AdminPublication; availability: string }[];
  /** CTL-004 « Après une suspension » — the records still marked `unpublishedBySuspensionAt`. */
  suspension: { count: number; date: string } | null;
  counts: { programs: number; properties: number; openDossiers: number; documents: number; contacts: number };
  /** CTL-007, MOD-111 — delete only without programme, property or dossier. */
  deleteBlocked: boolean;
  /** The public page (EDI-031): served when public AND ACTIVE. */
  publicPath: string | null;
  createdAt: string;
  updatedAt: string;
  can: { write: boolean; convention: boolean; delete: boolean; publish: boolean };
}

export const promoterContactSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  role: z.string().trim().max(80).nullable().optional(),
  email: z.email().nullable().optional().or(z.literal('').transform(() => null)),
  phone: z.string().trim().max(20).nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export type PromoterContactInput = z.input<typeof promoterContactSchema>;

export const vettingSchema = z.object({
  version: z.number().int().optional(),
  lines: z.array(z.object({ label: z.string().trim().min(1).max(120), done: z.boolean(), note: z.string().trim().max(500).nullable().optional() })).max(30),
  vettedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE').nullable().optional(),
});

export const partnerDocumentSchema = z.object({
  label: z.string().trim().min(1).max(160),
  category: z.enum(PARTNER_DOCUMENT_CATEGORIES),
  issuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE').nullable().optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE').nullable().optional(),
});

/** CTL-004 — « Suspendre », « Terminer »: a reason is required. */
export const promoterReasonSchema = z.object({ reason: z.string().trim().min(1).max(500), version: z.number().int().optional() });

/** CTL-004 — what suspending or ending does, announced BEFORE confirming (MOD-110). */
export interface PromoterImpact {
  programs: number;
  properties: number;
  openDossiers: number;
  advisers: number;
}

/** CTL-004 « Les republier ». */
export interface RepublishResult {
  republished: number;
  blocked: { kind: 'PROGRAM' | 'PROPERTY'; id: string; label: string; missing: string[] }[];
}

// ─── Relation (CTL-005) and « Ce que nous attendons de lui » (ACP-015, ACP-020) ─

export interface PromoterRelation {
  from: string;
  to: string;
  figures: {
    proposed: number;
    interests: number;
    visits: number;
    optionsNow: number;
    reservations: number;
    sales: number;
    externalSales: number;
    closed: number;
    closedByReason: Record<string, number>;
  };
  openDossiers: { id: string; reference: string; clientName: string | null; property: string; lot: string | null; stage: string; agentName: string | null }[];
  holds: { id: string; reference: string; kind: 'OPTION' | 'RESERVED'; lot: string; property: string; dossierReference: string; dueAt: string | null }[];
}

/** ACP-020 — the gesture each line waits for. */
export type ExpectationKind = 'OPTION_ANSWER' | 'RESERVATION_CONFIRM' | 'DOCUMENT_PROVIDE' | 'DEPOSIT_OUTCOME' | 'VISIT_HOST' | 'STOCK_UPDATE' | 'DELIVERY_UPDATE' | 'PARTNER_DOCUMENT';

export interface Expectation {
  kind: ExpectationKind;
  /** What it is about (« Résidence El Yasmine », « Lot A-101 · DOS-2026-0012 », « Registre de commerce »). */
  label: string;
  /** The deadline, if any. */
  dueAt: string | null;
  /** Since when it waits. */
  since: string;
  /** Where « Saisir la réponse » leads (a path of the back office); null when that screen is not delivered. */
  href: string | null;
}

export interface PromoterExpectations {
  items: Expectation[];
}

// ─── Autres partenaires (CTL-170) ──────────────────────────────────────────

export const PARTNER_CATEGORIES = ['NOTARY', 'INSURER', 'INSTITUTION', 'MEDIA', 'OTHER'] as const;

export interface AdminPartner {
  id: string;
  name: string;
  category: (typeof PARTNER_CATEGORIES)[number];
  descriptionPublic: string | null;
  url: string | null;
  isPublic: boolean;
  sortOrder: number;
  logo: AdminImageRef | null;
  updatedAt: string;
}

export const PARTNER_VIEWS = ['visible', 'hidden', 'all'] as const;
export const partnerListQuerySchema = z.strictObject({
  view: z.enum(PARTNER_VIEWS).optional(),
  q: z.string().trim().max(120).optional(),
  category: catalogueCsv(PARTNER_CATEGORIES),
  sort: z.enum(['sortOrder', '-sortOrder', 'name', '-name']).default('sortOrder'),
  ...cataloguePageSchema,
});
export interface PartnerList {
  data: AdminPartner[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  views: Record<(typeof PARTNER_VIEWS)[number], number>;
  facets: { category: Record<string, number> };
}

export const partnerInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.enum(PARTNER_CATEGORIES),
  descriptionPublic: z.string().trim().max(600).nullable().optional(),
  url: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional()
    .refine((v) => !v || /^https?:\/\/[^\s]+\.[^\s]+$/.test(v), 'INVALID_CHOICE'),
  isPublic: z.boolean().default(false),
});
export type PartnerInput = z.input<typeof partnerInputSchema>;

// ─── Partner applications (ACP-084) ────────────────────────────────────────

export interface PartnerApplicationPanel {
  leadId: string;
  kind: 'PROMOTER' | 'BANK';
  status: string;
  emailVerified: boolean;
  company: { name: string; country: string | null; city: string | null; website: string | null; registrationNumber: string | null; foundedYear: number | null };
  person: { firstName: string | null; lastName: string | null; role: string | null; email: string | null; phone: string | null };
  sections: { key: string; done: boolean }[];
  answers: { label: string; value: string }[];
  files: { id: string; label: string; fileName: string; sizeBytes: number; scanStatus: string }[];
  /** « Rattacher à {nom} » — existing records whose name or registration number matches. */
  matches: { id: string; name: string; status: string }[];
  /** The record created or attached, after acceptance. */
  result: { type: 'PROMOTER' | 'BANK'; id: string; name: string } | null;
  can: { decide: boolean };
}

export const approvePartnerSchema = z.object({ attachToId: z.uuid().nullable().optional() });
export const requestPartnerInfoSchema = z.object({ message: z.string().trim().min(1).max(2000) });
export const declinePartnerSchema = z.object({ reason: z.string().trim().min(1).max(500), message: z.string().trim().max(1000).nullable().optional() });
