// CAT-020 — catalogue criteria: URL parameters = public API keys = SearchAlert.criteria keys.
// One parser for the site and the API: an unknown or malformed value is ignored and dropped from the address.
import type { Money } from './http.js';

export const PROPERTY_TYPE_SLUGS = ['apartment', 'studio', 'duplex', 'villa', 'land', 'commercial'] as const;
export type PropertyTypeSlug = (typeof PROPERTY_TYPE_SLUGS)[number];
export const ROOMS_VALUES = ['1', '2', '3', '4', '5plus'] as const;
export type RoomsValue = (typeof ROOMS_VALUES)[number];
export const STANDING_SLUGS = ['comfort', 'standing', 'premium'] as const;
export type StandingSlug = (typeof STANDING_SLUGS)[number];
export const SORTS = ['relevance', 'price_asc', 'price_desc', 'monthly_asc', 'surface_desc', 'delivery_asc', 'newest'] as const;
export type CatalogueSort = (typeof SORTS)[number];

export const typeSlugToEnum = {
  apartment: 'APARTMENT',
  studio: 'STUDIO',
  duplex: 'DUPLEX',
  villa: 'VILLA',
  land: 'LAND',
  commercial: 'COMMERCIAL',
} as const;
export const standingSlugToEnum = { comfort: 'COMFORT', standing: 'STANDING', premium: 'PREMIUM' } as const;

export interface CatalogueCriteria {
  q?: string;
  country?: string;
  region?: string[];
  city?: string[];
  type?: PropertyTypeSlug[];
  rooms?: RoomsValue[];
  priceMin?: number;
  priceMax?: number;
  monthlyMax?: number;
  surfaceMin?: number;
  surfaceMax?: number;
  /** 'delivered', a year ('2027'), or 'later' */
  delivery?: string[];
  standing?: StandingSlug[];
  promoter?: string[];
  program?: string;
  financing?: true;
  islamic?: true;
  tour360?: true;
  new?: true;
  availability?: 'all';
  sort?: CatalogueSort;
  page?: number;
  vue?: 'carte';
  groupe?: 'programme';
  bbox?: [number, number, number, number];
}

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: Params, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function list<T extends string>(raw: string | undefined, allowed?: readonly T[], pattern?: RegExp): T[] | undefined {
  if (!raw) return undefined;
  const values = [...new Set(raw.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean))].filter(
    (v) => (allowed ? (allowed as readonly string[]).includes(v) : true) && (pattern ? pattern.test(v) : true),
  ) as T[];
  return values.length ? values.slice(0, 50) : undefined;
}

function int(raw: string | undefined, min = 0, max = 100_000_000): number | undefined {
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= min && n <= max ? n : undefined;
}

/**
 * Parses and normalises the criteria. `currentYear` is the year of the business calendar (for `delivery`).
 * CAT-020: city only with exactly one region; monthlyMax excludes priceMin/priceMax (CAL-032).
 */
export function parseCatalogueCriteria(params: Params, currentYear: number): CatalogueCriteria {
  const c: CatalogueCriteria = {};
  const q = read(params, 'q')?.trim();
  if (q && q.length >= 2 && q.length <= 80) c.q = q;
  const country = read(params, 'country')?.toUpperCase();
  if (country && /^[A-Z]{2}$/.test(country)) c.country = country;
  c.region = list(read(params, 'region'), undefined, SLUG);
  c.city = c.region?.length === 1 ? list(read(params, 'city'), undefined, SLUG) : undefined;
  c.type = list(read(params, 'type'), PROPERTY_TYPE_SLUGS);
  c.rooms = list(read(params, 'rooms'), ROOMS_VALUES);
  c.monthlyMax = int(read(params, 'monthlyMax'), 1);
  if (c.monthlyMax === undefined) {
    c.priceMin = int(read(params, 'priceMin'));
    c.priceMax = int(read(params, 'priceMax'), 1);
    if (c.priceMin !== undefined && c.priceMax !== undefined && c.priceMin > c.priceMax) delete c.priceMin;
  }
  c.surfaceMin = int(read(params, 'surfaceMin'), 0, 100_000);
  c.surfaceMax = int(read(params, 'surfaceMax'), 1, 100_000);
  if (c.surfaceMin !== undefined && c.surfaceMax !== undefined && c.surfaceMin > c.surfaceMax) delete c.surfaceMin;
  const years = Array.from({ length: 3 }, (_, i) => String(currentYear + i));
  c.delivery = list(read(params, 'delivery'), ['delivered', 'later', ...years]);
  c.standing = list(read(params, 'standing'), STANDING_SLUGS);
  c.promoter = list(read(params, 'promoter'), undefined, SLUG);
  const program = read(params, 'program')?.toLowerCase();
  if (program && SLUG.test(program)) c.program = program;
  for (const flag of ['financing', 'islamic', 'tour360', 'new'] as const) if (read(params, flag) === '1') c[flag] = true;
  if (read(params, 'availability') === 'all') c.availability = 'all';
  const sort = read(params, 'sort') as CatalogueSort | undefined;
  if (sort && (SORTS as readonly string[]).includes(sort) && sort !== 'relevance') c.sort = sort;
  const page = int(read(params, 'page'), 1, 10_000);
  if (page && page > 1) c.page = page;
  if (read(params, 'vue') === 'carte') c.vue = 'carte';
  if (read(params, 'groupe') === 'programme') c.groupe = 'programme';
  const bbox = read(params, 'bbox')?.split(',').map(Number);
  if (
    bbox?.length === 4 &&
    bbox.every(Number.isFinite) &&
    bbox[0]! >= -180 && bbox[2]! <= 180 && bbox[1]! >= -90 && bbox[3]! <= 90 &&
    bbox[0]! < bbox[2]! && bbox[1]! < bbox[3]!
  ) {
    c.bbox = bbox as [number, number, number, number];
  }
  for (const k of Object.keys(c) as (keyof CatalogueCriteria)[]) if (c[k] === undefined) delete c[k];
  return c;
}

/** Canonical query string in a fixed key order (NAV-038 uses region, type first). */
export const CRITERIA_ORDER: (keyof CatalogueCriteria)[] = [
  'region', 'type', 'q', 'country', 'city', 'rooms', 'priceMin', 'priceMax', 'monthlyMax', 'surfaceMin', 'surfaceMax',
  'delivery', 'standing', 'promoter', 'program', 'financing', 'islamic', 'tour360', 'new', 'availability', 'sort',
  'page', 'vue', 'groupe', 'bbox',
];

export function criteriaToSearch(c: CatalogueCriteria, omit: (keyof CatalogueCriteria)[] = []): string {
  const out = new URLSearchParams();
  for (const k of CRITERIA_ORDER) {
    if (omit.includes(k)) continue;
    const v = c[k];
    if (v === undefined) continue;
    if (v === true) out.set(k, '1');
    else if (Array.isArray(v)) out.set(k, v.join(','));
    else out.set(k, String(v));
  }
  const s = out.toString().replace(/%2C/g, ',');
  return s ? `?${s}` : '';
}

/** Criteria that count as « filtres actifs » (CAT-001, CAT-002): everything but sort, page, view keys and q. */
export function activeFilterCount(c: CatalogueCriteria): number {
  const keys: (keyof CatalogueCriteria)[] = [
    'region', 'city', 'type', 'rooms', 'priceMin', 'priceMax', 'monthlyMax', 'surfaceMin', 'surfaceMax', 'delivery',
    'standing', 'promoter', 'program', 'financing', 'islamic', 'tour360', 'new', 'availability', 'country',
  ];
  let n = 0;
  for (const k of keys) if (c[k] !== undefined) n++;
  if (c.priceMin !== undefined && c.priceMax !== undefined) n--; // one budget filter
  if (c.surfaceMin !== undefined && c.surfaceMax !== undefined) n--;
  return n;
}

// ---- Public read models (API-002 formats) ----

export interface PublicImage {
  id: string;
  /** Base URL of the renditions: `${base}/${rendition}.${format}` (MED-016). */
  base: string;
  width: number | null;
  height: number | null;
  alt: string;
  blur: string | null;
  isIllustration: boolean;
  isRender3d: boolean;
  renditions: string[];
  formats: string[];
}

export interface PublicDelivery {
  status: 'ON_PLAN' | 'UNDER_CONSTRUCTION' | 'DELIVERED';
  date: string | null;
  precision: 'MONTH' | 'QUARTER' | 'YEAR';
  /** MOD-202: end of the announced period passed without delivery. */
  overdue: boolean;
}

export type CardLabel =
  | { kind: 'MANUAL'; text: string }
  | { kind: 'LAST_LOT' }
  | { kind: 'LOW_STOCK'; n: number }
  | { kind: 'NEW' };

export interface PropertyCard {
  id: string;
  reference: string;
  slug: string;
  title: string;
  type: 'APARTMENT' | 'STUDIO' | 'DUPLEX' | 'VILLA' | 'LAND' | 'COMMERCIAL';
  rooms: number | null;
  standing: 'COMFORT' | 'STANDING' | 'PREMIUM';
  region: { name: string; slug: string };
  city: { name: string; slug: string } | null;
  program: { name: string; slug: string } | null;
  surfaceMin: string | null;
  surfaceMax: string | null;
  delivery: PublicDelivery;
  availability: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'WITHDRAWN';
  priceFromRef: Money | null;
  /** « À partir de » when available lots do not all have the same price (CAT-040 line 8). */
  priceIsFrom: boolean;
  downPaymentRef: Money | null;
  monthlyFromRef: Money | null;
  label: CardLabel | null;
  cover: PublicImage | null;
  has360Tour: boolean;
  financingEligible: boolean;
}

export interface CatalogueFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface CatalogueFacets {
  type: CatalogueFacetOption[];
  rooms: CatalogueFacetOption[];
  region: CatalogueFacetOption[];
  city: CatalogueFacetOption[];
  delivery: CatalogueFacetOption[];
  standing: CatalogueFacetOption[];
  promoter: CatalogueFacetOption[];
  options: CatalogueFacetOption[];
  bounds: { priceMax: number | null; monthlyMax: number | null; surfaceMax: number | null };
}

export interface CatalogueResponse {
  data: PropertyCard[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    /** Published properties in the whole catalogue, any availability (CAT-062, CAT-064). */
    publishedCount: number;
    /** Published and AVAILABLE properties in the whole catalogue. */
    availableCount: number;
    /** Normalised criteria actually applied (invalid ones dropped). */
    criteria: CatalogueCriteria;
    /** CAT-040 line 9 — down-payment percentage of the reference financing. */
    referenceDownPaymentPct: string;
    /** CAT-091 — with `groupe=programme`, `total` counts groups; this counts the matching properties (CAT-002). */
    propertyCount?: number;
  };
  facets?: CatalogueFacets;
  /** Quick filters of CAT-012 that give at least one result in the whole catalogue. */
  quickFilters?: string[];
  /** CAT-090 — with `vue=carte`: one marker per programme over ALL matching properties (not only the page). */
  map?: import('./discovery.js').CatalogueMap;
  /** CAT-091 — with `groupe=programme`: the page of groups (pagination counts the groups). */
  groups?: import('./discovery.js').CatalogueGroup[];
}

export interface SearchOptions {
  regions: { slug: string; name: string; count: number }[];
  types: { type: PropertyCard['type']; rooms: number | null; count: number }[];
  monthlyBudgetSteps: number[];
  priceBudgetSteps: number[];
  estimatedBudget: { amount: string; currency: string; simulationId: string; matchingCount: number } | null;
  /** The active catalogue country (Q-011: one country until multi-country opens). */
  country: { code: string; name: string } | null;
}
