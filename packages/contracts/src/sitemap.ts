// NAV-034 — what the site map lists: published objects only, each with its last change (ISO date-time).
export interface SitemapEntry {
  slug: string;
  updatedAt: string;
}

export interface SitemapResponse {
  /** Free pages (`/infos/{slug}`, EDI-002). */
  pages: SitemapEntry[];
  properties: SitemapEntry[];
  programs: SitemapEntry[];
  promoters: SitemapEntry[];
  /** Cafés; empty when `features.cafe` is off. */
  events: SitemapEntry[];
}
