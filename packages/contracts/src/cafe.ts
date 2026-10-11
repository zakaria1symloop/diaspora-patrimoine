// EP-13, EP-14 — public read models of the Café (CAF-001 … CAF-012). The exact venue is never public (CAF-060).
import type { PublicEventCard } from './events.js';
import type { PublicImage } from './catalogue.js';

export interface CafeListResponse {
  data: PublicEventCard[];
  /** CAF-003 — distinct places among the listed Cafés. */
  places: string[];
}

export interface CafePartner {
  kind: 'PROMOTER' | 'BANK' | 'OTHER';
  name: string;
  logo: PublicImage | null;
  slug: string | null;
}

export type CafePageState = PublicEventCard['state'] | { kind: 'PAST' };

export interface CafeDetail extends Omit<PublicEventCard, 'state'> {
  state: CafePageState;
  description: string | null;
  cancelReason: string | null;
  maxSeatsPerRegistration: number;
  seatsLeft: number;
  cover: PublicImage | null;
  partners: CafePartner[];
  upcoming: PublicEventCard[];
}
