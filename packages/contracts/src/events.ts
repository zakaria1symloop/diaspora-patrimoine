// CYC-181 — public state of a Café, computed on each request; ACC-030 next Café; ACC-061 cards.
import type { PublicImage } from './catalogue.js';

export type PublicEventState =
  | { kind: 'OPENING'; opensAt: string }
  | { kind: 'OPEN' }
  | { kind: 'FEW'; seatsLeft: number }
  | { kind: 'FULL' }
  | { kind: 'CLOSED' }
  | { kind: 'CANCELLED' };

export interface PublicEventCard {
  slug: string;
  title: string;
  locationLabel: string;
  cityName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  state: PublicEventState;
  hasPromoter: boolean;
  hasBank: boolean;
}

export interface HomeResponse {
  /** ACC-051 — up to three properties, displayed by increasing price. */
  featured: import('./catalogue.js').PropertyCard[];
  /** ACC-030 — null: fallback « Prochaines dates bientôt annoncées ». */
  nextCafe: PublicEventCard | null;
  /** ACC-061 — the next three published, not cancelled, Cafés. */
  cafes: PublicEventCard[];
  catalogue: {
    publishedCount: number;
    availableCount: number;
    /** ACC-055: published but all sold or withdrawn → same fallback as « no property ». */
    onlyGone: boolean;
  };
  search: import('./catalogue.js').SearchOptions;
  /** CAL-030 — down-payment percentage of the reference financing (ACC-080 `{apport}`, CAT-040 line 9). */
  referenceDownPaymentPct: string;
  /** ACC-041 — the comparison's property, when set and no longer AVAILABLE, is reported by the back office only. */
  /** ACC-040 — the property behind the « À ALGER » column; its cover illustrates both columns (« équivalent »). */
  comparisonProperty: { slug: string; available: boolean; cover: PublicImage | null } | null;
}
