// EC-42 — « Mes alertes et recherches » (03-espace-client/06 § 3, CAT-093). Hidden when `features.searchAlerts` is off.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { AccountAlertsResponse } from '@dp/contracts';
import { ButtonInner, buttonClass } from '@dp/ui';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { PageHeader } from '@/components/client-space/PageHeader';
import { AccountAlerts } from '@/components/client-tools/AccountAlerts';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: t('ui.clientTools.alerts.seoTitle') };

export default async function AlertsPage() {
  const r = await spaceGet<AccountAlertsResponse>('/client/alerts');
  if (!r.ok && r.status === 404) notFound();
  return (
    <>
      <PageHeader
        title={t('ui.clientTools.alerts.title')}
        intro={t('ui.clientTools.alerts.intro')}
        actions={
          <Link href="/programmes?alerte=1" className={buttonClass('tool', 'L')}>
            <ButtonInner size="L" icon="bell">
              {t('ui.clientTools.alerts.create')}
            </ButtonInner>
          </Link>
        }
      />
      {r.ok ? (
        <Suspense fallback={null}>
          <AccountAlerts initial={r.data} />
        </Suspense>
      ) : (
        <SpaceReadFailure result={r} />
      )}
    </>
  );
}
