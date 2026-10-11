// 02-site-public/08 — editorial pages: promoters (EDI-030 … EDI-032), banks and partners (EDI-020, EDI-035),
// FAQ (EDI-040), legal texts (EDI-060), free pages (EDI-002), testimonials (EDI-071), documents usually asked
// (EDI-021) and the express calculation (EDI-023). Response shapes of API-100 « Public » routes; formats of API-002.
import { z } from 'zod';
import type { DocumentCategory, FaqCategory, FaqPlacement, LegalDocumentType, PartnerCategory } from './enums.js';
import type { Money } from './http.js';
import type { PublicDelivery, PublicImage, PropertyCard } from './catalogue.js';
import type { CommercialState } from './property-detail.js';

// ─── Promoters (EDI-030, EDI-031) — never the private fields of EDI-032 ─────────────────────────

export interface PublicPromoterCard {
  slug: string;
  /** `brandName`, else `legalName`. */
  name: string;
  logo: PublicImage | null;
  region: string | null;
  /** Published programmes. */
  programCount: number;
  referencesPublic: string | null;
}

export interface PromoterProgramCard {
  slug: string;
  name: string;
  region: string;
  city: string | null;
  cover: PublicImage | null;
  standing: PropertyCard['standing'];
  /** CYC-127; `WITHDRAWN` programmes are never listed. */
  state: Exclude<CommercialState, 'WITHDRAWN'>;
  /** Only while something is or was on sale (ON_SALE, ALL_RESERVED). */
  priceFromRef: Money | null;
  delivery: PublicDelivery;
}

export interface PublicPromoterDetail extends PublicPromoterCard {
  cover: PublicImage | null;
  /** Year of `vettedAt` (« Promoteur sélectionné depuis {année} »). */
  selectedSince: number | null;
  descriptionPublic: string | null;
  foundedYear: number | null;
  deliveredUnits: number | null;
  /** Current programmes first (ON_SALE, ALL_RESERVED, UPCOMING), then SOLD. */
  programs: PromoterProgramCard[];
}

// ─── Banks and other partners (EDI-020, EDI-035) ────────────────────────────────────────────────

export interface PublicBank {
  slug: string;
  name: string;
  shortName: string | null;
  logo: PublicImage | null;
}

export interface PublicPartner {
  id: string;
  name: string;
  category: PartnerCategory;
  logo: PublicImage | null;
  url: string | null;
  description: string | null;
}

export interface ListResponse<T> {
  data: T[];
}

// ─── FAQ (EDI-040) ──────────────────────────────────────────────────────────────────────────────

/** EDI-040 — the order of the categories, everywhere. */
export const FAQ_CATEGORY_ORDER: FaqCategory[] = ['BUYING', 'FINANCING', 'DOSSIER', 'CAFE', 'PLATFORM'];
/** EDI-040 — at most six questions on a placement page, then « Toutes les questions ». */
export const FAQ_PLACEMENT_LIMIT = 6;

export interface PublicFaqItem {
  slug: string;
  category: FaqCategory;
  question: string;
  /** Plain text or sanitised HTML (bold, links, lists). */
  answer: string;
  placements: FaqPlacement[];
}

// ─── Legal texts (EDI-060), free pages (EDI-002) ────────────────────────────────────────────────

export interface PublicLegalDocument {
  type: LegalDocumentType;
  /** `LegalDocument.version`; « 0.1 – projet » is the provisional one (CMS-060). */
  version: string;
  title: string;
  /** Sanitised HTML (SEC-060). */
  body: string;
  effectiveAt: string;
}

/** The provisional version installed by PAR-083 starts with « 0.1 ». */
export function isProvisionalLegalVersion(version: string): boolean {
  return version.trim().startsWith('0.1');
}

export interface PublicPage {
  slug: string;
  title: string;
  /** Sanitised HTML (SEC-060). */
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

// ─── Testimonials (EDI-071), documents usually asked (EDI-021) ─────────────────────────────────

export interface PublicTestimonial {
  id: string;
  displayName: string;
  residenceCity: string | null;
  purchaseSummary: string | null;
  quote: string;
  photo: PublicImage | null;
}

export interface PublicChecklist {
  groups: { category: DocumentCategory; labels: string[] }[];
}

// ─── Express calculation (EDI-023, API-100 `POST /public/simulations/quick`) ─────────────────────

const amount = (max: number) =>
  z.union([z.number(), z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number)]).pipe(z.number().min(0).max(max));

/** Amounts in the reference currency (DEM-007). Wider than the sliders: the fields accept more (EDI-023). */
export const quickSimulationRequestSchema = z.object({
  downPayment: amount(100_000_000),
  monthlyPayment: amount(1_000_000).pipe(z.number().min(1)),
});
export type QuickSimulationRequest = z.input<typeof quickSimulationRequestSchema>;

export interface QuickSimulationResponse {
  /** Down payment + financing, rounded down to the CAL-021 step (decimal string, API-002). */
  budget: string;
  /** Displayed financing = budget − down payment. */
  financing: string;
  /** Computed financing, to the unit, which prefills EP-12 (SIM-031). */
  financingComputed: string;
  durationMonths: number;
  annualRateBps: number;
  currency: string;
}

/** EDI-023 — slider bounds and starting values. */
export const QUICK_SIMULATION_SLIDERS = {
  downPayment: { min: 0, max: 300_000, step: 1_000, start: 30_000 },
  monthlyPayment: { min: 100, max: 3_000, step: 10, start: 500 },
} as const;
