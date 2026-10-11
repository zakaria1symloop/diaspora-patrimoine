// Root layout of the back office (BO-001): never indexed, the register « Outil » of the design system (DSN-052), French.
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@dp/ui/styles/fonts.css';
import '@dp/ui/styles/base.css';
import '@dp/ui/styles/tool.css';
import { t } from '@/lib/i18n';

export const metadata: Metadata = {
  title: { default: t('ui.admin-shell.meta.title'), template: `%s – ${t('ui.admin-shell.meta.title')}` },
  robots: { index: false, follow: false },
  referrer: 'strict-origin-when-cross-origin',
};

export const viewport: Viewport = { themeColor: '#01295B', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" dir="ltr" data-register="tool">
      <body>
        <a href="#contenu" className="skip-link">
          {t('ui.admin-shell.skip')}
        </a>
        {children}
      </body>
    </html>
  );
}
