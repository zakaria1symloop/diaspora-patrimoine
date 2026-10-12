// EP-13 — Le Café, next dates (CAF-001 … CAF-004), filtered by place, month and seats left (CAF-003, D-105). 404 while
// features.cafe is off (NAV-003).
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CafeListResponse } from '@dp/contracts';
import { Icon, Scene, SectionTitle } from '@dp/ui';
import { ApiError, apiGet } from '@/lib/api';
import { getBlocks, image, text } from '@/lib/content';
import { Picture } from '@/components/Picture';
import { getSettings } from '@/lib/settings';
import { t } from '@/lib/i18n';
import { EventCard } from '@/components/vitrine/EventCard';
import { NotifyForm } from '@/components/cafe/NotifyForm';
import { CafeFilters, filterCafes, isCafeFiltered, readCafeQuery } from '@/components/cafe/CafeFilters';
import s from '@/components/cafe/cafe.module.css';

export const dynamic = 'force-dynamic'; // seats re-read on each display (NAV-042)

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  if (!settings['features.cafe']) return {};
  return { title: { absolute: `${settings['events.fullBrandName']} – ${settings['seo.siteName']}` }, alternates: { canonical: '/le-cafe' } };
}

export default async function CafeListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const settings = await getSettings();
  if (!settings['features.cafe']) notFound();
  const [sp, blocks] = await Promise.all([searchParams, getBlocks('Le Café', 'Accueil')]);
  const query = readCafeQuery(sp);
  const photo = await image(blocks, 'home.cafe.photo');
  let list: CafeListResponse;
  try {
    list = await apiGet<CafeListResponse>('/public/events', { revalidate: 0 });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const steps = (blocks['cafe.steps'] ?? []) as { title: string; text: string }[];
  const shown = filterCafes(list.data, query);
  const filtered = isCafeFiltered(query);
  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div className={`container ${s.heroGrid}`}>
          <div>
            <p className={s.overline}>
              <Icon name="cafe-cup" size={24} className={s.cup} />
              {settings['events.fullBrandName']}
            </p>
            <SectionTitle as="h1" align="start" line1={t('ui.cafe.list.title1')} line2={t('ui.cafe.list.title2')} />
            {text(blocks, 'cafe.intro') ? <p className={s.intro}>{text(blocks, 'cafe.intro')}</p> : null}
          </div>
          {/* the photo of a Café (block `home.cafe.photo`); without it, the animated drawing (D-091) */}
          {photo ? (
            <Picture image={photo} sizes="(max-width: 767px) 100vw, 34rem" priority alt="" className={s.heroPhoto} />
          ) : (
            <Scene name="attente" className={s.scene} />
          )}
        </div>
      </section>

      {steps.length ? (
        <section className={`container ${s.section}`} aria-labelledby="deroulement">
          <h2 id="deroulement" className={s.h2}>
            {t('ui.cafe.list.how')}
          </h2>
          <ol className={s.steps}>
            {steps.map((st, i) => (
              <li key={st.title}>
                <span className={s.stepNumber} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className={s.stepTitle}>{st.title}</h3>
                <p>{st.text}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className={`container ${s.section}`} aria-labelledby="dates">
        <h2 id="dates" className={s.h2}>
          {t('ui.cafe.list.dates')}
        </h2>
        <CafeFilters events={list.data} places={list.places} query={query} />
        {filtered && list.data.length ? (
          <p className={s.filterCount} role="status">
            {t('ui.cafe.list.filters.count', { n: shown.length })}
          </p>
        ) : null}
        {list.data.length === 0 ? (
          <div className={s.empty}>
            <p className={s.emptyTitle}>{t('ui.cafe.list.none')}</p>
            <div id="me-prevenir">
              <NotifyForm places={list.places} />
            </div>
          </div>
        ) : (
          <>
            {shown.length ? (
              <div className={s.list}>
                {shown.map((e, i) => (
                  <EventCard key={e.slug} event={e} next={i === 0 && !filtered} />
                ))}
              </div>
            ) : (
              <div className={s.filterNone}>
                <p>{t('ui.cafe.list.filters.none')}</p>
                <Link href="/le-cafe#dates" className={s.filterReset} scroll={false}>
                  {t('ui.cafe.list.filters.reset')}
                </Link>
              </div>
            )}
            <p className={s.reminder}>{t('ui.cafe.list.reminder')}</p>
            <div id="me-prevenir" className={s.notifyBox}>
              <h3 className={s.h3}>{t('ui.cafe.notify.title')}</h3>
              <NotifyForm places={list.places} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
