// EP-14 — one Café and its registration (CAF-010 … CAF-012, CAF-061). Hours are the venue's (CAF-011).
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CafeDetail } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { ApiError, apiGet } from '@/lib/api';
import { getBlocks, text } from '@/lib/content';
import { getSettings } from '@/lib/settings';
import { JsonLd, breadcrumbLd, cafeLd } from '@/lib/json-ld';
import { eventDateParts, eventHours, shortDate } from '@/lib/events';
import { t } from '@/lib/i18n';
import { Picture } from '@/components/Picture';
import { EventCard } from '@/components/vitrine/EventCard';
import { ShareButton } from '@/components/property/ShareButton';
import { NotifyForm } from '@/components/cafe/NotifyForm';
import { CafeRegistration } from '@/components/cafe/CafeRegistration';
import { ErrorPage } from '@/components/ErrorPage';
import s from '@/components/cafe/cafe.module.css';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

async function load(slug: string): Promise<CafeDetail | 'gone'> {
  try {
    return await apiGet<CafeDetail>(`/public/events/${encodeURIComponent(slug)}`, { revalidate: 0 });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (e instanceof ApiError && e.status === 410) return 'gone';
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const c = await load(slug);
  if (c === 'gone') return { robots: { index: false } };
  const settings = await getSettings();
  return {
    title: { absolute: t('ui.cafe.seo.title', { lieu: c.locationLabel, date: eventDateParts(c as never).long, site: settings['seo.siteName'] }).slice(0, 70) },
    alternates: { canonical: `/le-cafe/${c.slug}` },
  };
}

function minutesBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 60_000);
}

export default async function CafePage({ params }: { params: Params }) {
  const { slug } = await params;
  const c = await load(slug);
  if (c === 'gone') {
    return (
      <ErrorPage title={t('ui.cafe.page.past')}>
        <Link href="/le-cafe" className={buttonClass('primary', 'L')}>
          <ButtonInner chevron size="L">
            {t('ui.cafe.page.next')}
          </ButtonInner>
        </Link>
      </ErrorPage>
    );
  }
  const [settings, blocks] = await Promise.all([getSettings(), getBlocks('Le Café')]);
  const d = eventDateParts(c as never);
  const h = eventHours(c as never);
  const minutes = minutesBetween(c.startsAt, c.endsAt);
  const duration = minutes % 60 === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  const st = c.state;
  const open = st.kind === 'OPEN' || st.kind === 'FEW' || st.kind === 'FULL';
  const callbackHref = settings['features.callbackRequest'] ? `/le-cafe/${c.slug}?rappel=1` : '/contact?objet=rappel';
  const byKind = (k: 'PROMOTER' | 'BANK' | 'OTHER') => c.partners.filter((p) => p.kind === k);
  const description = c.description ?? text(blocks, 'cafe.defaultDescription');
  const stateLine =
    st.kind === 'FEW'
      ? t('ui.home.cafe.seats', { n: st.seatsLeft })
      : st.kind === 'OPEN'
        ? t('ui.home.cafe.open')
        : st.kind === 'FULL'
          ? t('ui.home.cafe.full')
          : st.kind === 'OPENING'
            ? t('ui.home.cafe.opening', { date: shortDate(st.opensAt, c.timezone) })
            : st.kind === 'CANCELLED'
              ? t('ui.home.cafe.cancelled')
              : st.kind === 'PAST'
                ? t('ui.cafe.page.past')
                : t('ui.home.cafe.closed');

  const registration = (
    <aside className={s.registration} id="inscription" aria-labelledby="inscription-titre">
      <h2 id="inscription-titre" className={s.h2}>
        {t('ui.cafe.page.registerTitle')}
      </h2>
      {open ? (
        <>
          {st.kind === 'FULL' ? <p className={s.notice}>{t('ui.cafe.page.full')}</p> : null}
          <CafeRegistration
            slug={c.slug}
            maxSeats={Math.min(c.maxSeatsPerRegistration, st.kind === 'FULL' ? c.maxSeatsPerRegistration : Math.max(1, c.seatsLeft))}
            waitlist={st.kind === 'FULL'}
            islamicEnabled={settings['features.islamicFinance']}
          />
        </>
      ) : st.kind === 'OPENING' ? (
        <>
          <p className={s.notice}>{t('ui.cafe.page.opening', { date: shortDate(st.opensAt, c.timezone) })}</p>
          <NotifyForm places={[]} eventSlug={c.slug} />
        </>
      ) : (
        <p className={s.notice}>
          {st.kind === 'CANCELLED' ? t('ui.cafe.page.cancelled') : st.kind === 'PAST' ? t('ui.cafe.page.past') : t('ui.cafe.page.closed')}
          {st.kind === 'CANCELLED' && c.cancelReason ? ` ${c.cancelReason}` : null}
        </p>
      )}
    </aside>
  );

  return (
    <div className={s.page}>
      <JsonLd
        data={[
          cafeLd(c, settings),
          breadcrumbLd([
            { name: settings['events.brandName'], path: '/le-cafe' },
            { name: `${c.locationLabel}, ${d.long}`, path: `/le-cafe/${c.slug}` },
          ]),
        ]}
      />
      <div className={`container ${s.detail}`}>
        <div className={s.info}>
          <nav aria-label={t('ui.nav.breadcrumb')} className={s.breadcrumb}>
            <Link href="/le-cafe">{settings['events.brandName']}</Link>
            <Icon name="chevron-right" size={16} />
            <span aria-current="page">{`${c.locationLabel}, ${d.long}`}</span>
          </nav>
          {st.kind === 'CANCELLED' ? (
            <p className={s.banner} role="status">
              <Icon name="status-warning" size={20} />
              {t('ui.cafe.page.cancelled')}
              {c.cancelReason ? ` ${c.cancelReason}` : null}
            </p>
          ) : null}
          <header className={s.header}>
            <h1 className={s.title}>{t('ui.cafe.page.title', { marque: settings['events.brandName'], lieu: c.locationLabel })}</h1>
            <p className={s.date}>{d.long.charAt(0).toUpperCase() + d.long.slice(1)}</p>
            <p className={s.hours}>{t('ui.cafe.page.hours', { debut: h.start, fin: h.end, ville: c.cityName })}</p>
            <div className={s.headerRow}>
              <span className={s.state}>{stateLine}</span>
              <ShareButton url={`${process.env.WEB_URL ?? ''}/le-cafe/${c.slug}`} title={t('ui.cafe.page.title', { marque: settings['events.brandName'], lieu: c.locationLabel })} />
            </div>
          </header>
          {c.cover ? <Picture image={c.cover} sizes="(max-width: 1023px) 100vw, 760px" className={s.cover} priority /> : null}

          <div className={s.mobileRegistration}>{registration}</div>

          <section className={s.block} aria-labelledby="lieu">
            <h2 id="lieu" className={s.h2}>
              {t('ui.cafe.page.place')}
            </h2>
            <p className={s.placeLine}>
              <Icon name="map-pin" size={20} className={s.cup} />
              {c.locationLabel === c.cityName ? c.cityName : `${c.locationLabel} · ${c.cityName}`}
            </p>
            <p className={s.muted}>{t('ui.cafe.page.placeText')}</p>
          </section>

          {c.partners.length ? (
            <section className={s.block} aria-labelledby="presents">
              <h2 id="presents" className={s.h2}>
                {t('ui.cafe.page.who')}
              </h2>
              {(['PROMOTER', 'BANK', 'OTHER'] as const).map((k) =>
                byKind(k).length ? (
                  <div key={k} className={s.partnerGroup}>
                    <h3 className={s.h3}>{t(k === 'PROMOTER' ? 'ui.cafe.page.promoters' : k === 'BANK' ? 'ui.cafe.page.banks' : 'ui.cafe.page.others')}</h3>
                    <ul className={s.partners} role="list">
                      {byKind(k).map((p) => (
                        <li key={p.name}>
                          {p.logo ? <Picture image={p.logo} sizes="64px" className={s.partnerLogo} alt="" /> : <span className={s.partnerInitial}>{p.name.charAt(0)}</span>}
                          {p.slug ? <Link href={`/promoteurs/${p.slug}`}>{p.name}</Link> : <span>{p.name}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </section>
          ) : null}

          {description ? (
            <section className={s.block} aria-labelledby="programme-cafe">
              <h2 id="programme-cafe" className={s.h2}>
                {t('ui.cafe.page.description')}
              </h2>
              {c.description ? <p className={s.prewrap}>{c.description}</p> : <div className={s.rich} dangerouslySetInnerHTML={{ __html: description }} />}
            </section>
          ) : null}

          <section className={s.block} aria-labelledby="pratique">
            <h2 id="pratique" className={s.h2}>
              {t('ui.cafe.page.practical')}
            </h2>
            <ul className={s.practical} role="list">
              <li>
                <Icon name="check" size={20} />
                {t('ui.cafe.page.free')}
              </li>
              <li>
                <Icon name="partners" size={20} />
                {t('ui.cafe.page.seats', { n: c.maxSeatsPerRegistration })}
              </li>
              <li>
                <Icon name="clock" size={20} />
                {t('ui.cafe.page.duration', { duree: duration })}
              </li>
              <li>
                <Icon name="chat" size={20} />
                {t('ui.cafe.page.questions')}
              </li>
            </ul>
          </section>

          {!open && c.upcoming.length ? (
            <section className={s.block} aria-labelledby="prochains">
              <h2 id="prochains" className={s.h2}>
                {t('ui.cafe.page.next')}
              </h2>
              <div className={s.list}>
                {c.upcoming.map((e) => (
                  <EventCard key={e.slug} event={e} />
                ))}
              </div>
            </section>
          ) : null}
          <p className={s.reminder}>
            <Link href={callbackHref} scroll={false}>
              {t('ui.cafe.page.callback')}
            </Link>
          </p>
        </div>
        <div className={s.desktopRegistration}>{registration}</div>
      </div>
      {open ? (
        <div className={s.sticky}>
          <a href="#inscription" className={buttonClass('primary', 'M', true)}>
            <ButtonInner size="M">{st.kind === 'FULL' ? t('ui.home.hero.waitlist') : t('ui.cafe.page.register')}</ButtonInner>
          </a>
        </div>
      ) : null}
    </div>
  );
}
