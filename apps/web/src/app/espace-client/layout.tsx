// The client space (package 2.8): its own door and frame (D-091…D-093, ECL-001), not the public chrome. The frame
// reads the shell summary server-side with the visitor's cookies (never cached); every page below renders inside it.
// The proxy already sends a visitor without session cookie to /connexion?suite=… (AUTH-023).
import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import type { ClientPreviewState, ClientSpaceSummary } from '@dp/contracts';
import { getSettings } from '@/lib/settings';
import { getBlocks, text } from '@/lib/content';
import { t } from '@/lib/i18n';
import { spaceGet, needsSession } from '@/components/client-space/server';
import { SessionRenewal } from '@/components/client-space/SessionRenewal';
import { BlockError } from '@/components/client-space/BlockError';
import { SpaceProvider, type SpaceSettings } from '@/components/client-space/SpaceContext';
import { SpaceShell } from '@/components/client-space/SpaceShell';
import { DiscoveryProvider } from '@/components/discovery/DiscoveryProvider';
import { CallbackDialog } from '@/components/forms/CallbackDialog';
import s from '@/components/client-space/space.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: t('ui.client.meta.title'), template: `%s – ${t('ui.client.meta.title')}` },
  robots: { index: false, follow: false },
};

export default async function ClientSpaceLayout({ children }: { children: ReactNode }) {
  const [summary, settings, blocks, preview] = await Promise.all([
    spaceGet<ClientSpaceSummary>('/client/space'),
    getSettings(),
    getBlocks('Marque').catch(() => ({})),
    // ROL-017, ECL-004 — a preview opened by the team: every action of the space is inactive
    spaceGet<ClientPreviewState>('/client/preview'),
  ]);
  if (!summary.ok) {
    return (
      <main id="contenu" className={s.bare}>
        {needsSession(summary) ? (
          <Suspense fallback={null}>
            <SessionRenewal />
          </Suspense>
        ) : (
          <BlockError />
        )}
      </main>
    );
  }
  const spaceSettings: SpaceSettings = {
    companyName: settings['contact.companyName'],
    phone: settings['contact.phone'] || null,
    whatsapp: settings['contact.whatsapp'] || null,
    email: settings['contact.email'] || null,
    firstContactBusinessDays: settings['sla.firstContactBusinessDays'],
    calendarTimeZone: settings['business.calendar.timezone'],
    workdays: settings['business.calendar.workdays'],
    illustrationNote: settings['legal.illustrationNote'],
    render3dNote: settings['legal.render3dNote'],
    features: { favorites: settings['features.favorites'], searchAlerts: settings['features.searchAlerts'], cafe: settings['features.cafe'], callback: settings['features.callbackRequest'] },
  };
  return (
    <DiscoveryProvider flags={{ favorites: settings['features.favorites'], alerts: settings['features.searchAlerts'] }}>
      <SpaceProvider initial={summary.data} settings={spaceSettings}>
        <SpaceShell tagline={text(blocks, 'brand.tagline')} readOnly={preview.ok && preview.data.active}>
          {children}
        </SpaceShell>
        {/* ECL-013 « Être rappelé » — the window of EP-21, opened by ?rappel=1 (fallback ACC-090 when inactive). */}
        <Suspense fallback={null}>
          <CallbackDialog settings={settings} />
        </Suspense>
      </SpaceProvider>
    </DiscoveryProvider>
  );
}
