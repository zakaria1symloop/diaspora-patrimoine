// CAT-090 (map view), CAT-091 (grouped by programme), CAT-092 (comparator, EP-31), SFA-021/SFA-022 (favourites
// without account, EC-41 public variant) — read models shared by the API and the site.
import type { Money } from './http.js';
import type { PropertyCard, PublicImage } from './catalogue.js';

// ---------- CAT-090 — map ----------

/**
 * One marker per programme (one per isolated property), at the approximate point of FIC-060 — the centre of a
 * ~500 m cell, never the exact address (TRV-045). `count` is the number of properties matching the criteria.
 */
export interface MapMarker {
  /** Programme slug, or the reference of an isolated property. */
  key: string;
  kind: 'PROGRAM' | 'PROPERTY';
  lat: number;
  lng: number;
  name: string;
  city: string | null;
  region: string;
  count: number;
  priceFromRef: Money | null;
  /** « Voir les biens »: the catalogue filtered on the programme, or the property page. */
  href: string;
  /** References of the matching properties shown by the list (hovering a card enlarges its marker). */
  references: string[];
}

export interface CatalogueMap {
  markers: MapMarker[];
  /** Matching properties without any coordinates (not on the map, still in the list). */
  unlocated: number;
}

// ---------- CAT-091 — grouped by programme ----------

export type CatalogueGroup =
  | {
      kind: 'PROGRAM';
      program: { slug: string; name: string; city: string | null; region: string; cover: PublicImage | null };
      /** Matching properties of the programme (all of them, not only the first page). */
      count: number;
      priceMin: Money | null;
      priceMax: Money | null;
      properties: PropertyCard[];
    }
  | { kind: 'PROPERTY'; property: PropertyCard };

// ---------- CAT-092 — comparator ----------

export const COMPARE_MAX = 3;

export interface CompareItem {
  card: PropertyCard;
  /** Price in the property's own currency (the promoter's price, FIC-050). */
  priceFrom: Money | null;
  bathrooms: number | null;
  floors: { min: number; max: number } | null;
  lotsAvailable: number;
  promoter: { slug: string; name: string };
  program: { slug: string; name: string } | null;
  /** FIC-030 « Caractéristiques » codes and labels; the page shows ✓ or — per feature of any compared property. */
  features: { code: string; label: string }[];
  pois: { label: string; category: string; minutes: number; mode: string }[];
  travelTimes: { fromCity: string; minutes: number; via: string | null }[];
}

export interface CompareResponse {
  data: CompareItem[];
  /** References given but unknown or archived: omitted, with one line on the page (CAT-092). */
  missing: number;
  referenceDownPaymentPct: string;
}

// ---------- SFA-021 / SFA-022 — favourites without account ----------

export const FAVORITES_MAX_ANONYMOUS = 20;

/** A favourite reference read back: the card while the property is online, else what remains of it. */
export type FavoriteEntry =
  | { reference: string; state: 'ONLINE'; card: PropertyCard }
  /** Archived: shown 30 days with « Ce bien n'est plus proposé », then dropped (SFA-022). */
  | { reference: string; state: 'GONE'; title: string; archivedAt: string | null }
  /** Unknown reference (deleted, or never existed): the site drops it from the browser. */
  | { reference: string; state: 'UNKNOWN' };

export interface FavoritesResponse {
  data: FavoriteEntry[];
  referenceDownPaymentPct: string;
}

/** Shape of `dp_favorites` (NAV-051): property references and the date each was added (SFA-022 shows it). */
export interface StoredFavorite {
  ref: string;
  /** Epoch milliseconds. */
  at: number;
}

const REF = /^[A-Z0-9][A-Z0-9-]{2,39}$/;

/** References of a `refs=` parameter: upper-cased, deduplicated, malformed ones dropped, `max` at most. */
export function parseRefs(raw: string | string[] | undefined, max: number): string[] {
  const value = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  const out: string[] = [];
  for (const part of value.split(',')) {
    const ref = part.trim().toUpperCase();
    if (ref && REF.test(ref) && !out.includes(ref)) out.push(ref);
    if (out.length === max) break;
  }
  return out;
}
