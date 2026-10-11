// API-002, API-010 — wire formats shared by the API and the applications.

/** A money amount: decimal string + ISO 4217 currency (ARC-071, API-002). */
export interface Money {
  amount: string;
  currency: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface CursorPage<T> {
  data: T[];
  meta: { nextCursor: string | null };
}

export const API_PREFIX = '/api/v1';

/** Cookie names (NAV-051). */
export const Cookies = {
  gate: 'dp_gate',
  consent: 'dp_consent',
  anon: 'dp_anon',
  device: 'dp_device',
  share: 'dp_share',
  signup: 'dp_signup',
} as const;

/** Browser local-storage keys (NAV-051). */
export const LocalKeys = {
  textSize: 'dp_text_size',
  simpleMode: 'dp_simple_mode',
  recentSearches: 'dp_recent_searches',
  compare: 'dp_compare',
  favorites: 'dp_favorites',
} as const;
