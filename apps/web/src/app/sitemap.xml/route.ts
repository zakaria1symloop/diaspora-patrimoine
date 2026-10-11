// NAV-034 — /sitemap.xml: the index of the family files.
import { sitemapIndex } from '@/lib/sitemap';

export const revalidate = 3600;

export function GET(): Promise<Response> {
  return sitemapIndex();
}
