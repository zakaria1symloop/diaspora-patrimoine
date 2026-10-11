// EC-40 — « Mes simulations » (03-espace-client/06 § 1; package 2.9). Private data: the visitor's cookies, never cached.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import type { ClientSimulationList } from '@dp/contracts';
import { ButtonInner, buttonClass } from '@dp/ui';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { PageHeader } from '@/components/client-space/PageHeader';
import { SimulationsList } from '@/components/client-tools/SimulationsList';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: t('ui.clientTools.simulations.seoTitle') };

export default async function SimulationsPage() {
  const r = await spaceGet<ClientSimulationList>('/client/simulations');
  return (
    <>
      <PageHeader
        title={t('ui.clientTools.simulations.title')}
        intro={t('ui.clientTools.simulations.intro')}
        actions={
          r.ok && r.data.data.length ? (
            <>
              <Link href="/financements/simulateur-eligibilite" className={buttonClass('secondary', 'M')}>
                <ButtonInner size="M" icon="badge">
                  {t('ui.clientTools.simulations.testEligibility')}
                </ButtonInner>
              </Link>
              <Link href="/financements/simulateur-credit" className={buttonClass('secondary', 'M')}>
                <ButtonInner size="M" icon="calculator">
                  {t('ui.clientTools.simulations.computeMonthly')}
                </ButtonInner>
              </Link>
            </>
          ) : undefined
        }
      />
      {r.ok ? (
        <Suspense fallback={null}>
          <SimulationsList initial={r.data} />
        </Suspense>
      ) : (
        <SpaceReadFailure result={r} />
      )}
    </>
  );
}
