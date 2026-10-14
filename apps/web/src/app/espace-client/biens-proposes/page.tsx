// EC-13 — Biens proposés (INT-010 … INT-023): the properties the advisor sent, most recent first, grouped by sending
// (« Proposés par {conseiller} le {date} » and his note). « Nouveau » until opened. Each card answers in place
// (« Ce bien m'intéresse », « Ce bien ne me convient pas », INT-020 — `CandidateCard`).
import Link from 'next/link';
import { Suspense } from 'react';
import type { ClientProposals, ClientSpaceSummary } from '@dp/contracts';
import { buttonClass, ButtonInner } from '@dp/ui';
import { t } from '@/lib/i18n';
import { getSettings } from '@/lib/settings';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { PageHeader } from '@/components/client-space/PageHeader';
import { EmptyState } from '@/components/client-space/EmptyState';
import { writeToAdvisorHref } from '@/components/client-space/advisor-link';
import { BiensTabs } from '@/components/client-space/properties/BiensTabs';
import { ProposalsBoard } from '@/components/client-space/properties/ProposalsBoard';

export const metadata = { title: t('ui.client.proposals.title') };

export default async function ProposalsPage() {
  const [r, space, settings] = await Promise.all([spaceGet<ClientProposals>('/client/proposals'), spaceGet<ClientSpaceSummary>('/client/space'), getSettings()]);
  if (!r.ok) return <SpaceReadFailure result={r} />;
  const { groups, qualified } = r.data;
  const timeZone = space.ok ? space.data.timeZone : 'Europe/Paris';
  return (
    <>
      <PageHeader eyebrow={t('ui.client.properties.tabs.label')} title={t('ui.client.proposals.title')} intro={t('ui.client.proposals.intro')} />
      <BiensTabs />
      {groups.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title={t('ui.client.proposals.empty')}
          text={qualified ? t('ui.client.proposals.emptyAfter') : t('ui.client.proposals.emptyBefore')}
          actions={
            <>
              <Link href="/programmes" className={buttonClass('tool', 'L')}>
                <ButtonInner chevron size="L">
                  {t('ui.client.proposals.browse')}
                </ButtonInner>
              </Link>
              <Link href={writeToAdvisorHref({ from: 'ADVISOR' })} className={buttonClass('secondary', 'L')}>
                <ButtonInner size="L" icon="chat">
                  {t('ui.common.writeToAdvisor')}
                </ButtonInner>
              </Link>
            </>
          }
        />
      ) : (
        <Suspense fallback={null}>
          <ProposalsBoard groups={groups} timeZone={timeZone} footnote={settings['legal.monthlyFootnote']} />
        </Suspense>
      )}
    </>
  );
}
