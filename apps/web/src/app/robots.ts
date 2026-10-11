// NAV-030, NAV-031 — robots.txt: everything forbidden until indexing is open (always outside production);
// then the non-indexed pages of NAV-001 and /api stay forbidden.
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/settings';

export const revalidate = 60;

const NOT_INDEXED = [
  '/api/',
  '/le-cafe/inscription/',
  '/comparer',
  '/assistant',
  '/partenaires/',
  '/enquete/',
  '/alertes/',
  '/preferences/',
  '/partage/',
  '/connexion',
  '/inscription',
  '/mot-de-passe-oublie',
  '/espace-client',
  '/favoris',
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSettings().catch(() => null);
  const open = env().APP_ENV === 'production' && !env().SITE_GATE_PASSWORD && settings?.['seo.allowIndexing'] === true;
  if (!open) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: NOT_INDEXED },
    sitemap: `${env().WEB_URL}/sitemap.xml`,
  };
}
