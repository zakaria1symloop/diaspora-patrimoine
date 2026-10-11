// NAV-034 — /sitemaps/{famille}.xml: one family of the site map.
import { SITEMAP_FAMILIES, sitemapFile, type SitemapFamily } from '@/lib/sitemap';

export const revalidate = 3600;

export function generateStaticParams() {
  return SITEMAP_FAMILIES.map((f) => ({ file: `${f}.xml` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const family = (await params).file.replace(/\.xml$/, '') as SitemapFamily;
  if (!SITEMAP_FAMILIES.includes(family)) return new Response('Not found', { status: 404 });
  return sitemapFile(family);
}
