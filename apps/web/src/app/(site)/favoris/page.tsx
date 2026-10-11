// EC-41 without an account (SFA-021, NAV-001 `/favoris`) — the favourites kept in this browser. The list is read in the
// browser (`dp_favorites`) and described by `GET /public/properties/cards`; the page itself holds no data. Not indexed.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@dp/ui';
import { getSettings } from '@/lib/settings';
import { t } from '@/lib/i18n';
import { FavoritesList } from '@/components/discovery/FavoritesList';
import p from '@/components/discovery/pages.module.css';

export const metadata: Metadata = {
  title: t('ui.favorites.page.seoTitle'),
  robots: { index: false, follow: true },
};

export default async function FavoritesPage() {
  const settings = await getSettings();
  if (!settings['features.favorites']) notFound(); // PAR-010
  return (
    <div className={p.page}>
      <header className={`container ${p.head}`}>
        <nav aria-label={t('ui.nav.breadcrumb')} className={p.breadcrumb}>
          <Link href="/programmes">{t('ui.property.breadcrumb.programs')}</Link>
          <Icon name="chevron-right" size={16} />
          <span aria-current="page">{t('ui.favorites.page.breadcrumb')}</span>
        </nav>
        <p className={p.eyebrow}>{t('ui.favorites.page.eyebrow')}</p>
        <h1 className={p.title}>{t('ui.favorites.page.title')}</h1>
        <p className={p.intro}>{t('ui.favorites.page.intro')}</p>
      </header>
      <div className="container">
        <FavoritesList monthlyEnabled={settings['features.monthlyBudgetSearch']} illustrationNote={settings['legal.illustrationNote']} />
      </div>
    </div>
  );
}
