// Package 3.5 « Programmes et lots » (EA-40, EA-41; 04-back-office/04 § 2, § 4, § 8: CTL-020 … CTL-024, CTL-060 …
// CTL-064, CTL-140, CTL-145) — wire contracts of the reads of `/admin/programs…`, `/admin/lots…` and of the gestures
// the write services did not have yet (duplicate, delete, bulk price, delivered lots, stock check, POIs, works).
import { z } from 'zod';
import type { AdminImageRef } from './admin-catalogue.js';

export const STANDINGS = ['COMFORT', 'STANDING', 'PREMIUM'] as const;
export const DELIVERY_STATUSES = ['ON_PLAN', 'UNDER_CONSTRUCTION', 'DELIVERED'] as const;
export const DATE_PRECISIONS = ['MONTH', 'QUARTER', 'YEAR'] as const;
export const PUBLICATION_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export const LOT_STATUSES = ['AVAILABLE', 'OPTIONED', 'RESERVED', 'SOLD', 'WITHDRAWN'] as const;
export const ORIENTATIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export const POI_CATEGORIES = ['TRANSPORT', 'EDUCATION', 'SHOPPING', 'HEALTH', 'LEISURE', 'OTHER'] as const;
export const TRAVEL_MODES = ['WALK', 'CAR', 'TRANSIT'] as const;
export const CONSTRUCTION_STAGES = ['FOUNDATIONS', 'STRUCTURE', 'SECONDARY_WORKS', 'FINISHES', 'DELIVERY'] as const;
export type AdminStanding = (typeof STANDINGS)[number];
export type AdminDeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type AdminDatePrecision = (typeof DATE_PRECISIONS)[number];
export type AdminPublication = (typeof PUBLICATION_STATUSES)[number];
export type AdminLotStatus = (typeof LOT_STATUSES)[number];
export type AdminOrientation = (typeof ORIENTATIONS)[number];
export type AdminPoiCategory = (typeof POI_CATEGORIES)[number];
export type AdminTravelMode = (typeof TRAVEL_MODES)[number];
export type AdminConstructionStage = (typeof CONSTRUCTION_STAGES)[number];

/** Shared by the catalogue lists: a comma list of closed values, a comma list of ids, the page sizes (API-010). */
export const catalogueCsv = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(values as unknown as [T, ...T[]])).max(values.length));
export const catalogueIdCsv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').filter(Boolean) : []))
  .pipe(z.array(z.uuid()).max(50));
export const CATALOGUE_PAGE_SIZES = [25, 50, 100] as const;
export const cataloguePageSchema = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .refine((n) => (CATALOGUE_PAGE_SIZES as readonly number[]).includes(n))
    .default(25),
};

/** CTL-064 — state of the « Disponibilités vérifiées » line (AUT-079). */
export interface StockCheckView {
  /** `DUE`: older than `catalogue.stockCheckDays` (« À vérifier avec le promoteur ») · `OK` · `NOT_CONCERNED` (nothing published or nothing to sell). */
  state: 'DUE' | 'OK' | 'NOT_CONCERNED';
  confirmedAt: string | null;
  /** Who confirmed it at the promoter's (a contact's name, or a name typed). */
  confirmedBy: string | null;
  /** When it becomes due (or became due). */
  dueAt: string | null;
  days: number;
  /** The promoter's contacts, proposed in the window. */
  contacts: { id: string; name: string; role: string | null }[];
}

// ─── Programmes list (CTL-020) ──────────────────────────────────────────────

export const PROGRAM_VIEWS = ['published', 'drafts', 'archived', 'all'] as const;
export type ProgramView = (typeof PROGRAM_VIEWS)[number];
export const PROGRAM_SORTS = ['name', '-name', 'updatedAt', '-updatedAt', 'deliveryDate', '-deliveryDate', 'priceFrom', '-priceFrom'] as const;

/** `GET /admin/programs` — CTL-020. An unknown parameter is refused (400). */
export const programListQuerySchema = z.strictObject({
  view: z.enum(PROGRAM_VIEWS).optional(),
  q: z.string().trim().max(120).optional(),
  promoterId: catalogueIdCsv,
  regionId: catalogueIdCsv,
  standing: catalogueCsv(STANDINGS),
  deliveryStatus: catalogueCsv(DELIVERY_STATUSES),
  /** `to-check`: availabilities to verify with the promoter (AUT-079) · `late`: delivery date passed (FIC-110). */
  attention: catalogueCsv(['to-check', 'late'] as const),
  sort: z.enum(PROGRAM_SORTS).default('-updatedAt'),
  ...cataloguePageSchema,
});

export interface ProgramListItem {
  id: string;
  name: string;
  promoter: { id: string; name: string };
  region: string;
  city: string | null;
  standing: AdminStanding;
  deliveryStatus: AdminDeliveryStatus;
  deliveryDate: string | null;
  deliveryDatePrecision: AdminDatePrecision;
  /** The announced period is over and the programme is not delivered. */
  deliveryLate: boolean;
  propertyCount: number;
  /** Lots of all its properties, drafts included (the team's view; the public counts published ones, CYC-127). */
  lotsAvailable: number;
  lotsTotal: number;
  priceFrom: string | null;
  currency: string;
  publication: AdminPublication;
  updatedAt: string;
  cover: AdminImageRef | null;
  stockCheck: StockCheckView['state'];
}

export interface ProgramList {
  data: ProgramListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  views: Record<ProgramView, number>;
  facets: { standing: Record<string, number>; deliveryStatus: Record<string, number>; promoterId: Record<string, number>; regionId: Record<string, number>; attention: Record<string, number> };
  promoters: { id: string; name: string }[];
  regions: { id: string; name: string }[];
}

// ─── One programme (CTL-021 … CTL-024) ──────────────────────────────────────

/** One typology of the programme (CTL-023, « Biens » tab). */
export interface ProgramPropertyRow {
  id: string;
  reference: string;
  title: string;
  type: string;
  rooms: number | null;
  surfaceM2: string;
  priceFrom: string | null;
  priceTo: string | null;
  currency: string;
  lotsAvailable: number;
  lotsTotal: number;
  publication: AdminPublication;
  availability: string;
  completenessScore: number;
  cover: AdminImageRef | null;
}

export interface AdminProgramDetail {
  id: string;
  version: number;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  standing: AdminStanding;
  countryCode: string;
  country: string;
  regionId: string;
  region: string;
  cityId: string | null;
  city: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveryStatus: AdminDeliveryStatus;
  deliveryDate: string | null;
  deliveryDatePrecision: AdminDatePrecision;
  deliveryLate: boolean;
  totalUnits: number | null;
  amenities: string[];
  guarantees: string | null;
  highlightLabel: string | null;
  highlightUntil: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publication: AdminPublication;
  publishedAt: string | null;
  firstPublishedAt: string | null;
  promoter: { id: string; name: string; status: string };
  currency: string;
  referenceCurrency: string;
  lotsTotal: number;
  lotsAvailable: number;
  lotsHeld: number;
  lotsSold: number;
  priceFrom: string | null;
  priceFromRef: string | null;
  cover: AdminImageRef | null;
  /** CYC-125 — what is missing to publish (`REQUIRED_FIELDS`, `DESCRIPTION_LENGTH`, `PROMOTER_ACTIVE`, `READY_MEDIA`, `COUNTRY_ACTIVE`). */
  publicationMissing: string[];
  /** CYC-126 — properties that left with the programme and may come back with it. */
  cascade: { unpublished: number; archived: number };
  /** CYC-126 — what archiving touches: its properties not archived yet, and the open dossiers that depend on them. */
  archiveImpact: { properties: number; openDossiers: number };
  stock: StockCheckView;
  properties: ProgramPropertyRow[];
  counts: { properties: number; lots: number; media: number; dossiers: number; updates: number; pois: number };
  /** The public page, when it is served (published): `/programmes/{slug}` on the site. */
  publicPath: string | null;
  createdAt: string;
  updatedAt: string;
  can: { write: boolean; publish: boolean; delete: boolean; eligibility: boolean; import: boolean };
}

/** `POST /admin/programs/{id}/duplicate` — CTL-024 « Copie ». */
export interface DuplicatedObject {
  id: string;
}

// ─── Lots (CTL-060 … CTL-063) ───────────────────────────────────────────────

/** CTL-062 — a lot held by a dossier: the dossier (link) and its deadline. */
export interface LotHold {
  kind: 'OPTION' | 'RESERVED' | 'COMPLETED';
  dossierReference: string | null;
  /** End of the option or deadline of the reservation. */
  dueAt: string | null;
}

export interface AdminLot {
  id: string;
  version: number;
  reference: string;
  /** MOD-230 — a provisional reference (« {référence}-copie »): « Référence à saisir ». */
  referencePending: boolean;
  propertyId: string;
  propertyReference: string;
  /** The typology (title of the property). */
  propertyTitle: string;
  propertyPublication: AdminPublication;
  building: string | null;
  floor: number | null;
  door: string | null;
  orientation: AdminOrientation | null;
  surfaceM2: string;
  terraceM2: string | null;
  landM2: string | null;
  price: string;
  currency: string;
  /** CTL-061 — the equivalent in the reference currency (null without a rate). */
  priceRef: string | null;
  /** CAL-024 — price ÷ surface, rounded to the unit. */
  pricePerM2: string;
  status: AdminLotStatus;
  statusChangedAt: string;
  statusNote: string | null;
  externalSale: boolean;
  parkingIncluded: boolean | null;
  extras: string | null;
  hasPlan: boolean;
  deliveredAt: string | null;
  hold: LotHold | null;
  /** Open dossiers that consider its property / target this lot (CYC-073, CYC-102 — announced before sold or withdrawn). */
  dossiers: { considering: number; targeting: number };
}

export interface LotsResponse {
  data: AdminLot[];
  /** The typologies of the programme (filter and « Typologie » column), drafts included. */
  typologies: { id: string; reference: string; title: string; publication: AdminPublication }[];
  currency: string;
  referenceCurrency: string;
  /** Number of units of the reference currency for one unit of the currency (null: no rate). */
  rate: string | null;
}

export interface LotPriceChange {
  at: string;
  before: string | null;
  after: string;
  /** « Prénom Nom » of the author, or null for the system (an import, the demo). */
  author: string | null;
}

/** CTL-061 — « Augmenter ou baisser de {x} % » or « Fixer à {montant} » on selected lots; `preview` gives the summary. */
export const lotBulkPriceSchema = z
  .object({
    lotIds: z.array(z.uuid()).min(1).max(500),
    mode: z.enum(['PERCENT', 'SET']),
    /** PERCENT: −90 … +500, two decimals at most · SET: an amount (CAL-027). */
    value: z.union([z.string(), z.number()]).transform((v) => String(v).trim().replace(',', '.')),
    preview: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'PERCENT') {
      if (!/^-?\d{1,3}(\.\d{1,2})?$/.test(v.value) || Number(v.value) < -90 || Number(v.value) > 500 || Number(v.value) === 0) {
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'OUT_OF_RANGE' });
      }
    } else if (!/^\d{1,12}(\.\d{1,2})?$/.test(v.value) || Number(v.value) <= 0) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'INVALID_AMOUNT' });
    }
  });
export type LotBulkPriceInput = z.input<typeof lotBulkPriceSchema>;

export interface LotBulkPriceResult {
  lines: { lotId: string; reference: string; before: string; after: string; currency: string; /** MOD-313 — the agreed price of its reservation does not move. */ reserved: boolean }[];
  applied: boolean;
}

/** CTL-060 « Marquer livrés » — never a future date (Q-014). */
export const lotDeliveredSchema = z.object({
  lotIds: z.array(z.uuid()).min(1).max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE'),
});

/** CTL-064 — `POST /admin/programs/{id}/confirm-stock`, `/admin/properties/{id}/confirm-stock`. */
export const stockConfirmSchema = z.object({
  /** A contact of the promoter, or a name typed (optional both). */
  contactId: z.uuid().nullable().optional(),
  name: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});
export type StockConfirmInput = z.input<typeof stockConfirmSchema>;

// ─── « À proximité » (CTL-140) ──────────────────────────────────────────────

export interface AdminPoi {
  id: string;
  label: string;
  category: AdminPoiCategory;
  minutes: number;
  mode: AdminTravelMode;
  sortOrder: number;
}

export const poiInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  category: z.enum(POI_CATEGORIES),
  minutes: z.number().int().min(1).max(180),
  mode: z.enum(TRAVEL_MODES),
});
/** `PUT /admin/programs/{id}/pois` — the whole list, in its order (eight at most, CTL-140). */
export const poiListSchema = z.object({ items: z.array(poiInputSchema.extend({ id: z.uuid().optional() })).max(8) });
export type PoiListInput = z.input<typeof poiListSchema>;

// ─── « Chantier » (CTL-145) ─────────────────────────────────────────────────

export interface AdminProgramUpdate {
  id: string;
  stage: AdminConstructionStage;
  percent: number;
  note: string | null;
  publishedAt: string;
  photos: AdminImageRef[];
  author: string | null;
}

export const programUpdateInputSchema = z.object({
  stage: z.enum(CONSTRUCTION_STAGES),
  percent: z.number().int().min(0).max(100),
  note: z.string().trim().max(1000).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE'),
  /** « Ne pas prévenir les clients ». */
  silent: z.boolean().default(false),
});
export type ProgramUpdateInput = z.input<typeof programUpdateInputSchema>;

// ─── « Dossiers » tab (CTL-021) and « Demandes et dossiers » (CTL-045) ──────

export interface CatalogueDossierRow {
  id: string;
  reference: string;
  /** Masked for SUPPORT (ROL-015). */
  clientName: string | null;
  propertyReference: string;
  propertyTitle: string;
  lotReference: string | null;
  stage: string;
  status: string;
  candidateStatus: string | null;
  selected: boolean;
  agentName: string | null;
  updatedAt: string;
}

export interface CatalogueLeadRow {
  id: string;
  reference: string;
  kind: string;
  status: string;
  clientName: string | null;
  propertyReference: string | null;
  createdAt: string;
}

export interface CatalogueDossiers {
  dossiers: CatalogueDossierRow[];
  leads: CatalogueLeadRow[];
  /** CTL-045 counters. */
  counters: { views: number; interests: number; proposals: number; visits: number };
}
