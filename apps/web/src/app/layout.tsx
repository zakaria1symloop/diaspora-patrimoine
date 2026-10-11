// Root layout: html/lang, fonts and tokens, text size applied before paint (TRV-123), skip link (NAV-016).
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { textSizeBootScript } from '@dp/ui';
import { simpleModeBootScript } from '@/components/layout/SimpleMode';
import '@dp/ui/styles/fonts.css';
import '@dp/ui/styles/base.css';
import { getSettings } from '@/lib/settings';
import { env } from '@/lib/env';
import { PreviewBand } from '@/components/preview/PreviewBand';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings().catch(() => null);
  const siteName = settings?.['seo.siteName'] ?? '';
  const indexing = env().APP_ENV === 'production' && settings?.['seo.allowIndexing'] === true && !env().SITE_GATE_PASSWORD;
  return {
    metadataBase: new URL(env().WEB_URL),
    title: { default: siteName, template: `%s – ${siteName}` },
    description: settings?.['seo.defaultDescription'],
    robots: indexing ? undefined : { index: false, follow: false }, // NAV-030
    openGraph: { siteName, locale: 'fr_FR', type: 'website' },
    twitter: { card: 'summary_large_image' },
    icons: { icon: '/icon.png' },
  };
}

export const viewport: Viewport = {
  themeColor: '#01295B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <head>
        {/* TRV-123, TRV-122 — applied before the first paint (no jump). React (dev only) warns « Encountered a script
            tag » when it renders the document on the client, which it does for a 404 inside the site: harmless. */}
        <script dangerouslySetInnerHTML={{ __html: textSizeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: simpleModeBootScript }} />
      </head>
      <body>
        {children}
        {/* ECL-004 — the band of a preview opened by the team (renders nothing otherwise) */}
        <PreviewBand />
      </body>
    </html>
  );
}
