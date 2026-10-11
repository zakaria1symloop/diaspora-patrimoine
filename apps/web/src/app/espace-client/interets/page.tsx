// EC-12 — Mes intérêts (INT-001 … INT-005): « Les biens qui m'intéressent » (cards) and « Mes demandes » (list, with
// the state of each request, INT-003). Every request sent is visible here (FIC-054 « Suivre dans mon espace »).
import { Suspense } from 'react';
import type { ClientInterests, ClientSpaceSummary } from '@dp/contracts';
import { t } from '@/lib/i18n';
import { getSettings } from '@/lib/settings';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { PageHeader } from '@/components/client-space/PageHeader';
import { BiensTabs } from '@/components/client-space/properties/BiensTabs';
import { InterestsBoard } from '@/components/client-space/properties/InterestsBoard';

export const metadata = { title: t('ui.client.interests.title') };

export default async function InterestsPage() {
  const [r, space, settings] = await Promise.all([spaceGet<ClientInterests>('/client/interests'), spaceGet<ClientSpaceSummary>('/client/space'), getSettings()]);
  if (!r.ok) return <SpaceReadFailure result={r} />;
  const { properties, requests } = r.data;
  const timeZone = space.ok ? space.data.timeZone : 'Europe/Paris';
  return (
    <>
      <PageHeader eyebrow={t('ui.client.properties.tabs.label')} title={t('ui.client.interests.title')} intro={t('ui.client.interests.intro')} />
      <BiensTabs />
      <Suspense fallback={null}>
        <InterestsBoard properties={properties} requests={requests} timeZone={timeZone} footnote={settings['legal.monthlyFootnote']} />
      </Suspense>
    </>
  );
}
