// EC-41 — « Mes favoris » of the account (03-espace-client/06 § 2). Hidden when `features.favorites` is off (404).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { AccountFavoritesResponse } from '@dp/contracts';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { PageHeader } from '@/components/client-space/PageHeader';
import { AccountFavorites } from '@/components/client-tools/AccountFavorites';
import { getSettings } from '@/lib/settings';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: t('ui.clientTools.favorites.seoTitle') };

export default async function FavoritesPage() {
  const [r, settings] = await Promise.all([spaceGet<AccountFavoritesResponse>('/client/favorites'), getSettings()]);
  if (!r.ok && r.status === 404) notFound();
  return (
    <>
      <PageHeader title={t('ui.clientTools.favorites.title')} intro={t('ui.clientTools.favorites.intro')} />
      {r.ok ? (
        <Suspense fallback={null}>
          <AccountFavorites initial={r.data} monthlyEnabled={settings['features.monthlyBudgetSearch']} footnote={settings['legal.monthlyFootnote']} />
        </Suspense>
      ) : (
        <SpaceReadFailure result={r} />
      )}
    </>
  );
}
