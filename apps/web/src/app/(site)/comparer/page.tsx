// EP-31 — the comparator (CAT-092): `/comparer?biens={réf},{réf},{réf}`, one column per property, read from
// `GET /public/properties/compare`. Without `biens`, the page takes the browser's set (`dp_compare`). The page is made to
// be sent to a relative: « Partager » shares the current address with its references (NAV-037). Never indexed.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { COMPARE_MAX, parseRefs, type CompareResponse } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { apiGet } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { env } from '@/lib/env';
import { t } from '@/lib/i18n';
import { ShareButton } from '@/components/property/ShareButton';
import { CompareTable, CompareFromStorage, BackToResults } from '@/components/discovery/ComparePage';
import { LineArt } from '@/components/discovery/LineArt';
import p from '@/components/discovery/pages.module.css';

export const metadata: Metadata = {
  title: t('ui.compare.page.seoTitle'),
  robots: { index: false, follow: true },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ComparePage({ searchParams }: { searchParams: SP }) {
  const refs = parseRefs((await searchParams).biens, COMPARE_MAX);
  const [settings, res] = await Promise.all([
    getSettings(),
    refs.length ? apiGet<CompareResponse>('/public/properties/compare', { tags: ['catalogue'], revalidate: 30, searchParams: { refs: refs.join(',') } }) : Promise.resolve(null),
  ]);
  const shareUrl = `${env().WEB_URL}/comparer${refs.length ? `?biens=${refs.join(',')}` : ''}`;
  const items = res?.data ?? [];

  return (
    <div className={p.page}>
      <header className={`container ${p.head}`}>
        <nav aria-label={t('ui.nav.breadcrumb')} className={p.breadcrumb}>
          <Link href="/programmes">{t('ui.property.breadcrumb.programs')}</Link>
          <Icon name="chevron-right" size={16} />
          <span aria-current="page">{t('ui.compare.page.breadcrumb')}</span>
        </nav>
        <div className={p.headRow}>
          <div>
            <p className={p.eyebrow}>{t('ui.compare.page.eyebrow')}</p>
            <h1 className={p.title}>{t('ui.compare.page.title')}</h1>
          </div>
          <div className={p.headTools}>
            <BackToResults />
            {items.length ? <ShareButton url={shareUrl} title={t('ui.compare.page.title')} /> : null}
          </div>
        </div>
        {res?.missing ? (
          <p className={p.notice} role="status">
            <Icon name="status-info" size={20} />
            {t('ui.compare.page.missing')}
          </p>
        ) : null}
      </header>

      <div className="container">
        {!refs.length ? (
          <Suspense fallback={null}>
            <CompareFromStorage
              empty={
                <section className={p.empty}>
                  <LineArt name="compare" className={p.art} />
                  <div className={p.emptyText}>
                    <h2 className={p.h2}>{t('ui.compare.page.emptyTitle')}</h2>
                    <p>{t('ui.compare.page.emptyText')}</p>
                    <Link href="/programmes" className={p.cta}>
                      {t('ui.compare.page.browse')}
                      <Icon name="chevron-right" size={16} />
                    </Link>
                  </div>
                </section>
              }
            />
          </Suspense>
        ) : items.length === 0 ? (
          <section className={p.empty}>
            <LineArt name="compare" className={p.art} />
            <div className={p.emptyText}>
              <h2 className={p.h2}>{t('ui.compare.page.emptyTitle')}</h2>
              <p>{t('ui.compare.page.emptyText')}</p>
              <Link href="/programmes" className={p.cta}>
                {t('ui.compare.page.browse')}
                <Icon name="chevron-right" size={16} />
              </Link>
            </div>
          </section>
        ) : (
          <CompareTable
            items={items}
            refs={refs}
            prefix={settings['display.roomsPrefix']}
            monthlyEnabled={settings['features.monthlyBudgetSearch']}
            footnote={settings['legal.monthlyFootnote']}
            convertedNote={settings['legal.convertedPricesNote']}
          />
        )}
      </div>
    </div>
  );
}
