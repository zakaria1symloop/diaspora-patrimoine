// Package 3.5 « Biens » (EA-42, EA-43, EA-46; 04-back-office/04 § 3, § 7, § 9: CTL-040 … CTL-045, CTL-130, CTL-150)
// — wire contracts of the reads of `/admin/properties…`, of the home pins and of the financing eligibility.
import { z } from 'zod';
import type { AdminImageRef } from './admin-catalogue.js';
import {
  catalogueCsv,
  catalogueIdCsv,
  cataloguePageSchema,
  DELIVERY_STATUSES,
  PUBLICATION_STATUSES,
  STANDINGS,
  type AdminDatePrecision,
  type AdminDeliveryStatus,
  type AdminOrientation,
  type AdminPublication,
  type AdminStanding,
  type StockCheckView,
} from './admin-programs.js';

export const PROPERTY_TYPES = ['APARTMENT', 'STUDIO', 'DUPLEX', 'VILLA', 'LAND', 'COMMERCIAL'] as const;
export const AVAILABILITIES = ['AVAILABLE', 'RESERVED', 'SOLD', 'WITHDRAWN'] as const;
export type AdminPropertyType = (typeof PROPERTY_TYPES)[number];
export type AdminAvailability = (typeof AVAILABILITIES)[number];

// ─── List (CTL-040) ─────────────────────────────────────────────────────────

/** CTL-040 — origin views. `to-complete`: published, score under `catalogue.completeScore`; `no-real-photo`: no own photo that is not an illustration (Q-031). */
export const PROPERTY_VIEWS = ['published', 'drafts', 'to-complete', 'no-real-photo', 'reserved-sold', 'archived', 'all'] as const;
export type PropertyView = (typeof PROPERTY_VIEWS)[number];
export const PROPERTY_SORTS = ['reference', '-reference', 'title', '-title', 'priceFrom', '-priceFrom', 'surfaceM2', '-surfaceM2', 'completenessScore', '-completenessScore', 'viewCount', '-viewCount', 'interestCount', '-interestCount', 'updatedAt', '-updatedAt'] as const;

export const propertyListQuerySchema = z.strictObject({
  view: z.enum(PROPERTY_VIEWS).optional(),
  q: z.string().trim().max(120).optional(),
  programId: catalogueIdCsv,
  promoterId: catalogueIdCsv,
  regionId: catalogueIdCsv,
  type: catalogueCsv(PROPERTY_TYPES),
  availability: catalogueCsv(AVAILABILITIES),
  publication: catalogueCsv(PUBLICATION_STATUSES),
  standing: catalogueCsv(STANDINGS),
  deliveryStatus: catalogueCsv(DELIVERY_STATUSES),
  /** `standalone`: without programme · `typology`: in a programme. */
  kind: catalogueCsv(['standalone', 'typology'] as const),
  sort: z.enum(PROPERTY_SORTS).default('-updatedAt'),
  ...cataloguePageSchema,
});

export interface PropertyListItem {
  id: string;
  reference: string;
  title: string;
  program: { id: string; name: string } | null;
  promoter: { id: string; name: string };
  region: string;
  type: AdminPropertyType;
  rooms: number | null;
  surfaceM2: string;
  priceFrom: string | null;
  currency: string;
  priceFromRef: string | null;
  referenceCurrency: string;
  lotsAvailable: number;
  lotsTotal: number;
  availability: AdminAvailability;
  publication: AdminPublication;
  completenessScore: number;
  viewCount: number;
  interestCount: number;
  updatedAt: string;
  cover: AdminImageRef | null;
  featuredRank: number | null;
}

export interface PropertyList {
  data: PropertyListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  views: Record<PropertyView, number>;
  facets: {
    type: Record<string, number>;
    availability: Record<string, number>;
    publication: Record<string, number>;
    standing: Record<string, number>;
    deliveryStatus: Record<string, number>;
    kind: Record<string, number>;
    programId: Record<string, number>;
    promoterId: Record<string, number>;
    regionId: Record<string, number>;
  };
  programs: { id: string; name: string }[];
  promoters: { id: string; name: string }[];
  regions: { id: string; name: string }[];
  thresholds: { publishMinScore: number; completeScore: number };
}

// ─── One property (CTL-042 … CTL-045, CTL-063) ──────────────────────────────

/** CTL-043 — the completeness card (CAL-050, CAL-051). */
export interface CompletenessCard {
  score: number;
  /** `DRAFT` « Brouillon · {n} obligatoires manquants » · `PUBLISHABLE` « Publiable · à améliorer » · `COMPLETE` « Fiche complète ». */
  state: 'DRAFT' | 'PUBLISHABLE' | 'COMPLETE';
  missingMandatory: string[];
  /** Three at most, mandatory first, then by gain. */
  actions: { code: string; gain: number; mandatory: boolean; count?: number }[];
  publishMinScore: number;
  completeScore: number;
}

/** CTL-063 — the single lot of a standalone property, edited in « Informations ». */
export interface StandaloneLot {
  id: string;
  version: number;
  price: string;
  floor: number | null;
  orientation: AdminOrientation | null;
  parkingIncluded: boolean | null;
  extras: string | null;
  building: string | null;
  door: string | null;
  status: string;
  statusNote: string | null;
  externalSale: boolean;
  deliveredAt: string | null;
}

export interface AdminPropertyDetail {
  id: string;
  version: number;
  reference: string;
  slug: string;
  title: string;
  titleAuto: boolean;
  description: string | null;
  descriptionAuto: boolean;
  type: AdminPropertyType;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  surfaceM2: string;
  terraceM2: string | null;
  landM2: string | null;
  features: string[];
  standing: AdminStanding;
  deliveryStatus: AdminDeliveryStatus;
  deliveryDate: string | null;
  deliveryDatePrecision: AdminDatePrecision;
  deliveryOverridden: boolean;
  countryCode: string;
  country: string;
  regionId: string;
  region: string;
  cityId: string | null;
  city: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  highlightLabel: string | null;
  highlightUntil: string | null;
  featuredRank: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publication: AdminPublication;
  availability: AdminAvailability;
  publishedAt: string | null;
  firstPublishedAt: string | null;
  unpublishedAt: string | null;
  program: { id: string; name: string; publication: AdminPublication; deliveryStatus: AdminDeliveryStatus; deliveryDate: string | null; deliveryDatePrecision: AdminDatePrecision } | null;
  promoter: { id: string; name: string; status: string };
  currency: string;
  referenceCurrency: string;
  priceFrom: string | null;
  priceTo: string | null;
  priceFromRef: string | null;
  lotsTotal: number;
  lotsAvailable: number;
  lotsTaken: number;
  viewCount: number;
  interestCount: number;
  cover: AdminImageRef | null;
  /** MOD-236 — no own image: the programme's are used. */
  usesProgramPhotos: boolean;
  completeness: CompletenessCard;
  /** CYC-120 — every missing condition (`REQUIRED_FIELDS`, `LOT_WITH_PRICE`, `READY_MEDIA`, `COMPLETENESS_SCORE`, `PROMOTER_ACTIVE`, `PROGRAM_PUBLISHED`, `COUNTRY_ACTIVE`). */
  publicationMissing: string[];
  /** MOD-213 — type, rooms and programme locked (published once, and a request received). */
  identityLocked: boolean;
  /** CTL-063 — the single lot of a standalone property. */
  lot: StandaloneLot | null;
  /** CTL-064 — on a standalone property only. */
  stock: StockCheckView | null;
  /** CTL-044 « Archiver » announces: « {n} dossiers ouverts envisagent ce bien ; {m} l'ont retenu. ». */
  archiveImpact: { considering: number; selected: number };
  /** CTL-044 « Supprimer » — refused when it has a request, a dossier or a reservation. */
  deleteBlocked: boolean;
  counts: { lots: number; media: number; dossiers: number; leads: number };
  publicPath: string | null;
  createdAt: string;
  updatedAt: string;
  can: { write: boolean; publish: boolean; delete: boolean; eligibility: boolean };
}

// ─── Financing eligibility (CTL-130, MOD-240) ───────────────────────────────

export interface EligibilityRow {
  bankId: string;
  bankName: string;
  /** The line of this object: `null` « Non renseigné ». */
  accepted: boolean | null;
  note: string | null;
  checkedAt: string | null;
  checkedBy: string | null;
  /** On a property: the line of its programme, which applies when the property has none (MOD-240). */
  inherited: { accepted: boolean; note: string | null; checkedAt: string } | null;
}

export interface EligibilityView {
  rows: EligibilityRow[];
  /** The public tag « Éligible au financement » that results (property: its own value; programme: any property eligible). */
  eligible: boolean;
}

/** `PUT /admin/programs/{id}/eligibility/{bankId}` — `accepted: null` removes the line (« Non renseigné »). */
export const eligibilityInputSchema = z.object({
  accepted: z.boolean().nullable(),
  note: z.string().trim().max(500).nullable().optional(),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE').optional(),
});
export type AdminEligibilityInput = z.input<typeof eligibilityInputSchema>;

// ─── Home pins (CTL-150, EA-46) ─────────────────────────────────────────────

export interface FeaturedCard {
  propertyId: string;
  reference: string;
  title: string;
  region: string;
  priceFrom: string | null;
  currency: string;
  cover: AdminImageRef | null;
  /** `PINNED`: pinned and shown · `AUTO`: chosen automatically by the home (ACC-051). */
  source: 'PINNED' | 'AUTO';
  rank: number | null;
}

export interface FeaturedView {
  /** The three cards the home shows now, in order. */
  shown: FeaturedCard[];
  /** The pins (rank 1 to 3), shown or not: « Épinglé, hors ligne » · « Épinglé, plus disponible ». */
  pins: (FeaturedCard & { state: 'SHOWN' | 'OFFLINE' | 'UNAVAILABLE' })[];
  canPublish: boolean;
}
