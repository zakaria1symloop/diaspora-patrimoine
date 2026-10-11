// NAV-034 — site map: an index, one file per family, published objects only with their last change. Cached one hour
// at most, and dropped sooner by the API's invalidation when an object is published, unpublished or changed.
import 'server-only';
import type { PublicSettings, SitemapEntry, SitemapResponse } from '@dp/contracts';
import { apiGet } from './api';
import { env } from './env';
import { getSettings } from './settings';

export const SITEMAP_FAMILIES = ['pages', 'biens', 'programmes', 'promoteurs', 'cafes'] as const;
export type SitemapFamily = (typeof SITEMAP_FAMILIES)[number];

interface Url {
  loc: string;
  lastmod?: string;
}

/** The indexed fixed pages of NAV-001, each kept only while its feature is on (NAV-003). */
function fixedPages(s: PublicSettings): string[] {
  return [
    '/',
    '/programmes',
    '/promoteurs',
    '/financements',
    '/financements/simulateur-eligibilite',
    '/financements/simulateur-credit',
    ...(s['features.cafe'] ? ['/le-cafe'] : []),
    '/notre-concept',
    '/nos-partenaires',
    '/faq',
    '/contact',
    ...(s['features.projectionRequest'] ? ['/projection'] : []),
    ...(s['features.partnerForm'] ? ['/devenir-partenaire'] : []),
    '/mentions-legales',
    '/confidentialite',
    '/conditions-generales',
    '/cookies',
    '/charte-partenaires',
  ];
}

const read = () => apiGet<SitemapResponse>('/public/sitemap', { revalidate: 3600, tags: ['catalogue', 'events', 'content'] });

const objects = (prefix: string, rows: SitemapEntry[]): Url[] => rows.map((r) => ({ loc: `${prefix}/${r.slug}`, lastmod: r.updatedAt }));

async function urls(family: SitemapFamily): Promise<Url[]> {
  const data = await read();
  switch (family) {
    case 'pages':
      return [...fixedPages(await getSettings()).map((loc) => ({ loc })), ...objects('/infos', data.pages)];
    case 'biens':
      return objects('/biens', data.properties);
    case 'programmes':
      return objects('/programmes', data.programs);
    case 'promoteurs':
      return objects('/promoteurs', data.promoters);
    case 'cafes':
      return objects('/le-cafe', data.events);
  }
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const latest = (rows: Url[]) => rows.reduce<string | undefined>((m, r) => (r.lastmod && (!m || r.lastmod > m) ? r.lastmod : m), undefined);

function response(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}

export async function sitemapIndex(): Promise<Response> {
  const base = env().WEB_URL;
  const families = await Promise.all(SITEMAP_FAMILIES.map(async (f) => ({ f, rows: await urls(f) })));
  const items = families
    .filter(({ rows }) => rows.length > 0)
    .map(({ f, rows }) => {
      const lastmod = latest(rows);
      return `  <sitemap><loc>${xml(`${base}/sitemaps/${f}.xml`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</sitemap>`;
    });
  return response(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</sitemapindex>\n`);
}

export async function sitemapFile(family: SitemapFamily): Promise<Response> {
  const base = env().WEB_URL;
  const items = (await urls(family)).map(
    (u) => `  <url><loc>${xml(base + (u.loc === '/' ? '' : u.loc))}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
  );
  return response(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</urlset>\n`);
}
