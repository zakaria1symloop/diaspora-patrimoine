// EP-04 — programme page (FIC-110 … FIC-112). The section « Les biens du programme » follows the commercial state
// of the programme (CYC-127); its action bar too (FIC-112).
import { PreviewFrame } from '@/components/property/PreviewFrame';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { DetailRedirect, ProgramDetail } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { ApiError, apiGet } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { JsonLd, breadcrumbLd } from '@/lib/json-ld';
import { deliveryText, money, surfaceText } from '@/lib/format';
import { whatsappHref } from '@/lib/contact';
import { t } from '@/lib/i18n';
import { ErrorPage } from '@/components/ErrorPage';
import { Picture } from '@/components/Picture';
import { SimpleMore } from '@/components/property/SimpleMore';
import { Lightbox } from '@/components/property/Lightbox';
import { ReadMore } from '@/components/property/ReadMore';
import { ShareButton } from '@/components/property/ShareButton';
import { env } from '@/lib/env';
import { InterestButton, InterestDialog, type InterestTarget } from '@/components/forms/InterestDialog';
import { Suspense } from 'react';
import { ItemList, KeyFacts, LocationSection, Mosaic, Progress, PromoterCard, type Fact } from '@/components/property/parts';
import s from '@/components/property/property.module.css';

type Params = Promise<{ slug: string }>;
/** FIC-120 — `?apercu=` the back office's signed link (« Aperçu »). */
type Search = Promise<{ apercu?: string }>;

async function load(slug: string, apercu?: string): Promise<ProgramDetail | 'gone'> {
  try {
    // a preview is never cached: the page is not online (FIC-120)
    const res = await apiGet<ProgramDetail | DetailRedirect>(`/public/programs/${encodeURIComponent(slug)}${apercu ? `?apercu=${encodeURIComponent(apercu)}` : ''}`, apercu ? { revalidate: 0 } : { tags: ['catalogue'] });
    if ('redirect' in res) permanentRedirect(res.redirect);
    return res;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (e instanceof ApiError && e.status === 410) return 'gone';
    throw e;
  }
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const [{ slug }, { apercu }] = await Promise.all([params, searchParams]);
  const p = await load(slug, apercu);
  if (p === 'gone') return { robots: { index: false } };
  if (p.isPreview) return { title: { absolute: t('ui.property.preview.band') }, robots: { index: false, follow: false } };
  return {
    title: { absolute: (p.seoTitle ?? t('ui.property.programPage.seoTitle', { nom: p.name, region: p.location.region.name })).slice(0, 70) },
    description: p.seoDescription ?? (p.description ?? '').slice(0, 155),
    alternates: { canonical: `/programmes/${p.slug}` },
  };
}

export default async function ProgramPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ slug }, { apercu }] = await Promise.all([params, searchParams]);
  const p = await load(slug, apercu);
  if (p === 'gone') {
    return (
      <ErrorPage title={t('ui.pages.error.programGone.title')}>
        <Link href="/programmes" className={buttonClass('primary', 'L')}>
          <ButtonInner chevron size="L">
            {t('ui.pages.error.programGone.all')}
          </ButtonInner>
        </Link>
      </ErrorPage>
    );
  }
  const settings = await getSettings();
  const base = `/programmes/${p.slug}`;
  const monthlyOn = settings['features.monthlyBudgetSearch'];
  const interestHref = `${base}?interet=1`;
  const callbackHref = settings['features.callbackRequest'] ? `${base}?rappel=1` : `/contact?objet=rappel&programme=${p.slug}`;
  const place = p.location.city ? t('ui.property.header.location', { ville: p.location.city.name, region: p.location.region.name }) : p.location.region.name;

  const facts: Fact[] = [
    { icon: 'medal', label: t('ui.property.programPage.standingTile'), value: t(`ui.enum.Standing.${p.standing}`) },
    { icon: 'calendar', label: t('ui.property.programPage.deliveryTile'), value: deliveryText(p.delivery) },
  ];
  if (p.totalUnits) facts.push({ icon: 'building', label: t('ui.property.programPage.units'), value: String(p.totalUnits) });
  if (p.priceFromRef) facts.push({ icon: 'diamond', label: t('ui.property.programPage.priceTile'), value: t('ui.property.programPage.priceFrom', { prix: money(p.priceFromRef)! }) });
  if (p.lotsAvailable > 0) facts.push({ icon: 'folder', label: t('ui.property.programPage.lotsTile'), value: t('ui.property.facts.lotsValue', { n: p.lotsAvailable }) });

  const stateLine =
    p.state === 'UPCOMING'
      ? t('ui.property.programPage.upcoming')
      : p.state === 'ALL_RESERVED'
        ? t('ui.property.programPage.allReserved')
        : p.state === 'SOLD'
          ? t('ui.property.programPage.sold')
          : p.state === 'WITHDRAWN'
            ? t('ui.property.programPage.withdrawn')
            : null;
  const canInterest = p.state === 'UPCOMING' || p.state === 'ON_SALE';

  const target: InterestTarget = {
    key: `program-${p.slug}`,
    kind: 'program',
    title: p.name,
    summary: place,
    programSlug: p.slug,
    // DEM-012 — the published properties still offered; none for an « À venir » programme.
    choices:
      p.state === 'UPCOMING'
        ? []
        : p.properties
            .filter((c) => c.availability === 'AVAILABLE')
            .map((c) => ({ reference: c.reference, label: c.priceFromRef ? `${c.title} · ${t('ui.property.programPage.priceFrom', { prix: money(c.priceFromRef)! })}` : c.title })),
  };

  const panel = (
    <div className={s.panel}>
      {p.priceFromRef && (p.state === 'ON_SALE' || p.state === 'ALL_RESERVED') ? (
        <div className={s.price}>
          <span className={s.priceFrom}>{t('ui.property.price.from')}</span>
          <span className={s.priceBig}>{money(p.priceFromRef)}</span>
          {monthlyOn && p.monthlyFromRef ? (
            <span className={s.muted}>{t('ui.property.financing.perMonth', { montant: money(p.monthlyFromRef)! })}*</span>
          ) : null}
        </div>
      ) : null}
      <div className={s.buttons}>
        {canInterest ? (
          <InterestButton target={target} label={t('ui.property.actions.programInterest')} href={interestHref} />
        ) : p.state === 'ALL_RESERVED' ? (
          <Link href={callbackHref} scroll={false} className={buttonClass('primary', 'L', true)}>
            <ButtonInner chevron size="L">
              {t('ui.property.actions.callback')}
            </ButtonInner>
          </Link>
        ) : null}
        {canInterest ? (
          <Link href={`${interestHref}&visio=1`} scroll={false} className={buttonClass('secondary', 'M', true)}>
            <ButtonInner size="M">{t('ui.property.actions.visit')}</ButtonInner>
          </Link>
        ) : null}
        {canInterest && settings['contact.whatsapp'] ? (
          <a
            href={`${whatsappHref(settings['contact.whatsapp'])}?text=${encodeURIComponent(t('ui.property.actions.whatsappProgram', { nom: p.name }))}`}
            className={buttonClass('tertiary', 'M', true)}
            target="_blank"
            rel="noopener"
          >
            <ButtonInner size="M" icon="chat">
              {t('ui.property.actions.whatsapp')}
            </ButtonInner>
          </a>
        ) : null}
      </div>
      {monthlyOn && p.monthlyFromRef ? <p className={s.footnote}>{settings['legal.monthlyFootnote']}</p> : null}
    </div>
  );

  return (
    <article className={s.page}>
      <PreviewFrame preview={p.isPreview}>
      <JsonLd
        data={breadcrumbLd([
          { name: t('ui.property.breadcrumb.programs'), path: '/programmes' },
          { name: p.location.region.name, path: `/programmes?region=${p.location.region.slug}` },
          { name: p.name, path: `/programmes/${p.slug}` },
        ])}
      />
      <div hidden data-lead-context={JSON.stringify({ programSlug: p.slug, programName: p.name })} />
      <Suspense fallback={null}>
        <InterestDialog settings={settings} target={target} available={canInterest} />
      </Suspense>
      <div className="container">
        <nav aria-label={t('ui.nav.breadcrumb')} className={s.breadcrumb}>
          <Link href="/programmes">{t('ui.property.breadcrumb.programs')}</Link>
          <Icon name="chevron-right" size={16} />
          <Link href={`/programmes?region=${p.location.region.slug}`}>{p.location.region.name}</Link>
          <Icon name="chevron-right" size={16} />
          <span aria-current="page">{p.name}</span>
        </nav>
        <header className={s.header}>
          <ul className={s.tags} role="list">
            <li>{t(`ui.enum.Standing.${p.standing}`)}</li>
            <li>{deliveryText(p.delivery)}</li>
            {p.label ? <li>{p.label}</li> : null}
          </ul>
          <h1 className={s.title}>{p.name}</h1>
          {p.tagline ? <p className={s.tagline}>{p.tagline}</p> : null}
          <div className={s.headerRow}>
            <p className={s.place}>
              <Icon name="map-pin" size={20} className={s.gold} />
              {place}
            </p>
            <ShareButton url={`${process.env.WEB_URL ?? ''}${base}`} title={p.name} />
          </div>
        </header>
        <Mosaic media={p.media} basePath={base} render3dNote={settings['legal.render3dNote']} illustrationNote={settings['legal.illustrationNote']} title={p.name} />
      </div>

      <div className={`container ${s.columns}`}>
        <div className={s.main}>
          <div className={s.mobilePanel}>{panel}</div>
          <KeyFacts facts={facts} />
          {p.description ? (
            <section className={s.block} aria-labelledby="description">
              <h2 id="description" className={s.h2}>
                {t('ui.property.programPage.description')}
              </h2>
              <ReadMore text={p.description} collapsible />
            </section>
          ) : null}
          <ItemList id="equipements" title={t('ui.property.programPage.amenities')} items={p.amenities} />
          <section className={s.block} aria-labelledby="biens-du-programme">
            <h2 id="biens-du-programme" className={s.h2}>
              {t('ui.property.programPage.properties')}
            </h2>
            {stateLine ? <p className={s.banner}>{stateLine}</p> : null}
            {p.properties.length ? (
              <ul className={s.rows} role="list">
                {/* Figma EP-04 — one row per property: photo, what it is, its price, its state; the whole row opens it */}
                {p.properties.map((c) => (
                  <li key={c.id}>
                    <Link href={`/biens/${c.slug}`} className={s.row}>
                      <span className={s.rowThumb}>
                        {c.cover ? <Picture image={c.cover} sizes="88px" className={s.tileImg} alt="" /> : <Icon name="home" size={24} />}
                      </span>
                      <span className={s.rowMain}>
                        <strong>{c.title}</strong>
                        <span className={s.muted}>{surfaceText(c.surfaceMin, c.surfaceMax)}</span>
                      </span>
                      <span className={s.rowPrice}>
                        {c.priceFromRef ? <strong>{t('ui.property.programPage.priceFrom', { prix: money(c.priceFromRef)! })}</strong> : null}
                        {monthlyOn && c.monthlyFromRef ? <span className={s.muted}>{t('ui.property.financing.perMonth', { montant: money(c.monthlyFromRef)! })}</span> : null}
                      </span>
                      <span className={s.rowState} data-state={c.availability}>
                        {c.availability === 'AVAILABLE'
                          ? t('ui.property.tags.available')
                          : c.availability === 'RESERVED'
                            ? t('ui.catalogue.card.reserved')
                            : t('ui.catalogue.card.sold')}
                      </span>
                      <Icon name="chevron-right" size={20} className={s.rowChevron} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          <Progress progress={p.progress} />
          <PromoterCard promoter={p.promoter} guarantees={p.guarantees} />
          <LocationSection location={p.location} mapStyleUrl={env().MAP_STYLE_URL ?? null} />
          <SimpleMore />
          {p.otherPrograms.length ? (
            <section className={s.block} aria-labelledby="autres-programmes">
              <h2 id="autres-programmes" className={s.h2}>
                {t('ui.property.programPage.otherPrograms')}
              </h2>
              <ul className={s.programTiles} role="list">
                {p.otherPrograms.map((o) => (
                  <li key={o.slug}>
                    <Link href={`/programmes/${o.slug}`} className={s.compactCard}>
                      {o.cover ? <Picture image={o.cover} sizes="(max-width: 639px) 100vw, 280px" className={s.tileImg} alt="" /> : null}
                      <strong>{o.name}</strong>
                      <span>{[o.region, o.priceFromRef ? t('ui.property.programPage.priceFrom', { prix: money(o.priceFromRef)! }) : null].filter(Boolean).join(' · ')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <aside className={s.aside}>{panel}</aside>
      </div>

      {(canInterest || p.state === 'ALL_RESERVED') && !p.isPreview ? (
        <div className={s.stickyBar} data-action-bar>
          <span className={s.stickyPrice}>{p.priceFromRef ? money(p.priceFromRef) : null}</span>
          <Link href={canInterest ? interestHref : callbackHref} scroll={false} className={buttonClass('primary', 'M')}>
            <ButtonInner size="M">{canInterest ? t('ui.property.actions.programInterest') : t('ui.property.actions.callback')}</ButtonInner>
          </Link>
        </div>
      ) : null}

      <Lightbox
        media={p.media}
        title={p.name}
        subtitle={place}
        primary={canInterest ? { label: t('ui.property.actions.programInterest'), href: interestHref } : null}
        visioHref={canInterest ? `${interestHref}&visio=1` : null}
        render3dNote={settings['legal.render3dNote']}
        illustrationNote={settings['legal.illustrationNote']}
      />
      </PreviewFrame>
    </article>
  );
}
