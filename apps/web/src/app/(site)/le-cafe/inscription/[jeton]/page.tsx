// EP-15 — « Gérer mon inscription » (CAF-030 … CAF-032), reached from every Café e-mail, without signing in. Never
// cached (seats and status re-read), never indexed. Unknown token: the « lien expiré » page with the way to /le-cafe.
import type { Metadata } from 'next';
import Link from 'next/link';
import type { CafeRegistrationView } from '@dp/contracts';
import { buttonClass, ButtonInner } from '@dp/ui';
import { ApiError, apiGet } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { t } from '@/lib/i18n';
import { ErrorPage } from '@/components/ErrorPage';
import { EventCard } from '@/components/vitrine/EventCard';
import { ManageRegistration } from '@/components/cafe/manage/ManageRegistration';
import s from '@/components/cafe/manage/manage.module.css';

export const dynamic = 'force-dynamic';

type Params = Promise<{ jeton: string }>;

export const metadata: Metadata = {
  title: t('ui.cafe.manage.seoTitle'),
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

async function load(token: string): Promise<CafeRegistrationView | 'gone'> {
  try {
    return await apiGet<CafeRegistrationView>(`/public/registrations/${encodeURIComponent(token)}`, { revalidate: 0 });
  } catch (e) {
    // 410: unknown token; 404: the Café feature is off (NAV-003) — the link leads nowhere either way.
    if (e instanceof ApiError && (e.status === 410 || e.status === 404)) return 'gone';
    throw e;
  }
}

/** Whole days between today and the Café, both read in the venue's time zone (CAF-011). */
function daysUntil(startsAt: string, timeZone: string): number {
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return Math.round((Date.parse(day(new Date(startsAt))) - Date.parse(day(new Date()))) / 86_400_000);
}

export default async function ManageRegistrationPage({ params }: { params: Params }) {
  const { jeton } = await params;
  const view = await load(jeton);
  if (view === 'gone') {
    return (
      <ErrorPage title={t('ui.cafe.manage.goneTitle')} scene="perdu">
        <p className={s.goneText}>{t('ui.cafe.manage.goneText')}</p>
        <div>
          <Link href="/le-cafe" className={buttonClass('primary', 'L')}>
            <ButtonInner chevron size="L">
              {t('ui.cafe.manage.seeAll')}
            </ButtonInner>
          </Link>
        </div>
      </ErrorPage>
    );
  }
  const settings = await getSettings();
  const showNext = view.upcoming.length > 0;
  return (
    <div className={s.page}>
      <ManageRegistration
        token={jeton}
        view={view}
        brand={settings['events.brandName']}
        fullBrand={settings['events.fullBrandName']}
        islamicEnabled={settings['features.islamicFinance']}
        daysUntil={daysUntil(view.cafe.startsAt, view.cafe.timezone)}
      />
      {showNext ? (
        <section className={`container ${s.next}`} aria-labelledby="prochains-cafes">
          <div className={s.nextHead}>
            <h2 id="prochains-cafes" className={s.h2}>
              {t('ui.cafe.manage.next')}
            </h2>
            <Link href="/le-cafe" className={s.textLink}>
              {t('ui.cafe.manage.seeAll')}
            </Link>
          </div>
          <div className={s.nextList}>
            {view.upcoming.map((e) => (
              <EventCard key={e.slug} event={e} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
