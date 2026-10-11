// The frame of every public page: skip link, header, main, footer, consent banner, acceptance band (ENV-030).
import { Suspense, type ReactNode } from 'react';
import { getSettings } from '@/lib/settings';
import { getBlocks, text } from '@/lib/content';
import { env } from '@/lib/env';
import { JsonLd, organizationLd } from '@/lib/json-ld';
import { t } from '@/lib/i18n';
import { Header } from './Header';
import { Footer } from './Footer';
import { CookieConsent } from './CookieConsent';
import { ListenButton } from './ListenButton';
import { SimpleModeBand } from './SimpleMode';
import { RevealOnScroll } from './RevealOnScroll';
import { CallbackDialog } from '@/components/forms/CallbackDialog';
import { DiscoveryProvider } from '@/components/discovery/DiscoveryProvider';
import { DiscoveryHost } from '@/components/discovery/DiscoveryHost';
import s from './SiteChrome.module.css';

export async function SiteChrome({ children }: { children: ReactNode }) {
  const [settings, blocks] = await Promise.all([getSettings(), getBlocks('Marque', 'Pied de page')]);
  const tagline = text(blocks, 'brand.tagline');
  const staging = env().APP_ENV === 'staging';
  return (
    <DiscoveryProvider flags={{ favorites: settings['features.favorites'], alerts: settings['features.searchAlerts'] }}>
      <JsonLd data={organizationLd(settings)} />
      <a href="#contenu" className="skip-link">
        {t('ui.nav.skipToContent')}
      </a>
      {staging ? (
        <div className={s.staging} role="note">
          {t('ui.pages.staging')}
        </div>
      ) : null}
      <Header tagline={tagline} cafeEnabled={settings['features.cafe']} />
      <SimpleModeBand />
      <RevealOnScroll />
      <main id="contenu" tabIndex={-1} className={s.main}>
        {/* TRV-127 — « Écouter cette page », at the head of the content of every page */}
        <div className={`container ${s.listen}`} data-listen-skip>
          <ListenButton />
        </div>
        {children}
      </main>
      <Footer
        settings={settings}
        year={new Date().getFullYear()}
        blocks={{ tagline, cafeLine: text(blocks, 'footer.cafeLine'), note: text(blocks, 'footer.note') }}
      />
      <CookieConsent enabled={settings['analytics.enabled']} />
      {/* SFA-020, CAT-092, TRV-081 — short messages and the comparison tray. */}
      <DiscoveryHost />
      <Suspense fallback={null}>
        <CallbackDialog settings={settings} />
      </Suspense>
    </DiscoveryProvider>
  );
}
