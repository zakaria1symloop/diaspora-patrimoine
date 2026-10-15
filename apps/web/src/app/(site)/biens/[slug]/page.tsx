// EP-05 — property page. Server-rendered, tags property:{id} and catalogue (ARC-040). Every section has its
// behaviour when its data is missing (FIC-001): never an empty zone.
import { ReportListing } from '@/components/property/ReportListing';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { DetailRedirect, PropertyCard as Card, PropertyDetail } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { formatDate, formatMoney } from '@dp/i18n';
import { ApiError, apiGet } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { JsonLd, breadcrumbLd, propertyLd } from '@/lib/json-ld';
import { getBlocks } from '@/lib/content';
import { deliveryText, money, surfaceText } from '@/lib/format';
import { whatsappHref } from '@/lib/contact';
import { t } from '@/lib/i18n';
import { PropertyCard } from '@/components/vitrine/PropertyCard';
import { Picture } from '@/components/Picture';
import { GoneProperty } from '@/components/property/GoneProperty';
import { Lightbox } from '@/components/property/Lightbox';
import { ReadMore } from '@/components/property/ReadMore';
import { ShareButton } from '@/components/property/ShareButton';
import { env } from '@/lib/env';
import { FavoriteButton } from '@/components/discovery/FavoriteButton';
import { CompareToggle } from '@/components/discovery/CompareToggle';
import { ViewSignal } from '@/components/property/ViewSignal';
import { SimpleMore } from '@/components/property/SimpleMore';
import { InterestButton, InterestDialog, type InterestTarget } from '@/components/forms/InterestDialog';
import { Suspense } from 'react';
import { ItemList, KeyFacts, LocationSection, Mosaic, Progress, PromoterCard, headerFlight, type Fact } from '@/components/property/parts';
import s from '@/components/property/property.module.css';

type Params = Promise<{ slug: string }>;

async function load(slug: string): Promise<PropertyDetail | 'gone'> {
  try {
    const res = await apiGet<PropertyDetail | DetailRedirect>(`/public/properties/${encodeURIComponent(slug)}`, { tags: ['catalogue'] });
    if ('redirect' in res) permanentRedirect(res.redirect); // NAV-040: one redirect
    return res;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (e instanceof ApiError && e.status === 410) return 'gone';
    throw e;
  }
}

function amount(m: { amount: string; currency: string } | null, digits = 0): string | null {
  return m ? formatMoney(Number(m.amount), m.currency, 'fr-FR', digits) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (p === 'gone') return { robots: { index: false } };
  const settings = await getSettings();
  const place = p.location.city ? p.location.city.name : p.location.region.name;
  const price = money(p.priceFromRef) ?? '';
  const title = p.seoTitle ?? t(p.priceIsFrom ? 'ui.property.seo.titleFrom' : 'ui.property.seo.title', { titre: p.title, lieu: place, prix: price }).slice(0, 70);
  return {
    title: { absolute: title },
    description: p.seoDescription ?? p.description.slice(0, 160),
    alternates: { canonical: `/biens/${p.slug}` },
    openGraph: {
      title: t('ui.property.seo.share', { titre: p.title, prix: price }),
      type: 'website',
      siteName: settings['seo.siteName'],
      images: p.media.images[0] ? [`${p.media.images[0].base}/og.jpg`] : undefined,
    },
  };
}

export default async function PropertyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const p = await load(slug);
  if (p === 'gone') return <GoneProperty slug={slug} />;
  const [settings, blocks, similar] = await Promise.all([
    getSettings(),
    getBlocks('Fiche'),
    apiGet<{ data: Card[]; regionCount: number }>(`/public/properties/${encodeURIComponent(p.slug)}/similar`, { tags: ['catalogue'] }),
  ]);
  const prefix = settings['display.roomsPrefix'];
  const monthlyOn = settings['features.monthlyBudgetSearch'];
  const available = p.availability === 'AVAILABLE';
  const reserved = p.availability === 'RESERVED';
  const gone = p.availability === 'SOLD' || p.availability === 'WITHDRAWN';
  const base = `/biens/${p.slug}`;
  const callbackHref = settings['features.callbackRequest'] ? `${base}?rappel=1` : `/contact?objet=rappel&bien=${p.reference}`;
  const interestHref = `${base}?interet=1`;
  const visioHref = available ? `${base}?interet=1&visio=1` : null;
  const place = p.location.city ? t('ui.property.header.location', { ville: p.location.city.name, region: p.location.region.name }) : p.location.region.name;
  const flight = settings['features.poi'] ? headerFlight(p.location) : null;
  const priceRef = amount(p.priceFromRef);
  const native = amount(p.priceFrom);
  const reassurance = (blocks['propertyPage.reassurance'] ?? null) as { line1: string; line2: string } | null;
  const ref = p.referenceFinancing;
  const years = ref.durationMonths % 12 === 0 ? t('ui.home.comparison.years', { n: ref.durationMonths / 12 }) : t('ui.home.comparison.months', { n: ref.durationMonths });
  const rate = `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(ref.annualRateBps / 100)} %`;
  const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(ref.downPaymentPct));
  const onlyRenders = p.media.images.length > 0 && p.media.images.every((i) => i.isRender3d);

  // FIC-030 — four tiles always, the others when the data exists.
  const facts: Fact[] = [{ icon: 'home', label: t('ui.property.facts.type'), value: t(`ui.enum.PropertyType.${p.type}`) }];
  if (p.type !== 'LAND' && p.type !== 'COMMERCIAL' && p.rooms !== null) {
    const roomsValue = t('ui.property.facts.roomsValue', { prefix, rooms: String(p.rooms) });
    facts.push({ icon: 'bed', label: t('ui.property.facts.rooms'), value: p.bedrooms !== null ? `${roomsValue} · ${t('ui.property.facts.bedrooms', { n: p.bedrooms })}` : roomsValue });
  }
  const surface = surfaceText(p.surfaceMin, p.surfaceMax);
  if (surface)
    facts.push({
      icon: 'surface',
      label: t('ui.property.facts.surface'),
      value: p.terraceM2 ? `${surface} ${t('ui.property.facts.terrace', { n: Math.round(Number(p.terraceM2)) })}` : surface,
    });
  facts.push({ icon: 'calendar', label: t('ui.property.facts.delivery'), value: deliveryText(p.delivery) });
  if (p.bathrooms !== null) facts.push({ icon: 'home', label: t('ui.property.facts.bathrooms'), value: String(p.bathrooms) });
  if (p.landM2) facts.push({ icon: 'tree', label: t('ui.property.facts.land'), value: `${Math.round(Number(p.landM2))} m²` });
  if (p.floors) {
    const floor = (n: number) => (n === 0 ? t('ui.property.facts.floorGround') : t('ui.property.facts.floorN', { n }));
    facts.push({
      icon: 'building',
      label: t('ui.property.facts.floors'),
      value: p.floors.min === p.floors.max ? floor(p.floors.min) : t('ui.property.facts.floorsRange', { min: floor(p.floors.min), max: floor(p.floors.max) }),
    });
  }
  if (p.parkingIncludedAll) facts.push({ icon: 'key', label: t('ui.property.facts.parking'), value: t('ui.property.facts.parkingIncluded') });
  facts.push({ icon: 'medal', label: t('ui.property.facts.standing'), value: t(`ui.enum.Standing.${p.standing}`) });
  if (p.lotsAvailable > 0) facts.push({ icon: 'folder', label: t('ui.property.facts.lots'), value: t('ui.property.facts.lotsValue', { n: p.lotsAvailable }) });

  const tags: string[] = [];
  tags.push(t(available ? 'ui.property.tags.available' : reserved ? 'ui.property.tags.reserved' : 'ui.property.tags.sold'));
  if (p.label?.kind === 'MANUAL') tags.push(p.label.text);
  else if (p.label?.kind === 'LAST_LOT') tags.push(t('ui.catalogue.card.lastLot'));
  else if (p.label?.kind === 'LOW_STOCK') tags.push(t('ui.catalogue.card.lowStock', { n: p.label.n }));
  else if (p.label?.kind === 'NEW') tags.push(t('ui.catalogue.card.new'));
  if (p.financingEligible) tags.push(t('ui.property.tags.financing'));
  if (p.islamicFinancingEligible && settings['features.islamicFinance']) tags.push(t('ui.property.tags.islamic'));
  if (p.has360Tour && settings['features.tour360']) tags.push(t('ui.property.tags.tour360'));
  if (onlyRenders) tags.push(t('ui.property.tags.renders'));
  if (p.media.images.length === 0) tags.push(t('ui.property.tags.photosSoon'));

  const similarBlock =
    similar.data.length >= 2 ? (
      <section className={`container ${s.similar}`} aria-labelledby="similaires">
        <h2 id="similaires" className={s.h2}>
          {t('ui.property.similar.title')}
        </h2>
        <ul className={s.cards} role="list">
          {similar.data.map((c) => (
            <li key={c.id}>
              <PropertyCard card={c} downPaymentPct={ref.downPaymentPct} monthlyEnabled={monthlyOn} illustrationNote={settings['legal.illustrationNote']} />
            </li>
          ))}
        </ul>
        {similar.regionCount > 0 ? (
          <Link href={`/programmes?region=${p.location.region.slug}`} className={s.standalone}>
            {t('ui.property.similar.seeRegion', { n: similar.regionCount, region: p.location.region.name })}
            <Icon name="chevron-right" size={16} />
          </Link>
        ) : null}
      </section>
    ) : null;

  const target: InterestTarget = {
    key: p.reference,
    kind: 'property',
    title: p.title,
    summary: t('ui.lead.interest.summary', { ville: p.location.city?.name ?? p.location.region.name, prix: priceRef ?? native ?? '', reference: p.reference }),
    propertyReference: p.reference,
    priceShown: p.priceFromRef?.amount,
    monthlyShown: p.monthlyFromRef?.amount,
    currencyShown: p.priceFromRef?.currency,
    lots: p.lots.map((l) => l.reference),
  };

  const actionPanel = (
    <div className={s.panel}>
      {!gone && priceRef ? (
        <div className={s.price}>
          {p.priceIsFrom ? <span className={s.priceFrom}>{t('ui.property.price.from')}</span> : null}
          <span className={s.priceBig}>{p.convertible ? t('ui.property.price.approx', { prix: priceRef }) : native}</span>
          {native && p.convertible ? <span className={s.priceNative}>{native}</span> : null}
          {p.pricePerM2Ref && p.rateDate ? (
            <span className={s.muted}>
              {p.pricePerM2Ref.min.amount === p.pricePerM2Ref.max.amount
                ? t('ui.property.price.perM2', { prix: amount(p.pricePerM2Ref.min)!, date: formatDate(p.rateDate, 'long') })
                : t('ui.property.price.perM2Range', { min: amount(p.pricePerM2Ref.min)!, max: amount(p.pricePerM2Ref.max)!, date: formatDate(p.rateDate, 'long') })}
            </span>
          ) : null}
        </div>
      ) : null}
      {available ? (
        <div className={s.financing}>
          {monthlyOn && p.monthlyFromRef ? (
            <>
              <span className={s.label}>{t('ui.property.financing.monthly')}</span>
              <span className={s.monthly}>{t('ui.property.financing.perMonth', { montant: money(p.monthlyFromRef)! })}</span>
              <span className={s.muted}>{t('ui.property.financing.hypotheses', { duree: years, pct, taux: rate })}</span>
            </>
          ) : null}
          <Link href={`/financements/simulateur-credit?bien=${p.reference}`} className={s.standalone}>
            {t('ui.property.financing.adjust')}
            <Icon name="chevron-right" size={16} />
          </Link>
          {p.financingEligible ? (
            <p className={s.ok}>
              <Icon name="status-success" size={16} />
              {t('ui.property.financing.eligible')}
            </p>
          ) : (
            <p>
              {t('ui.property.financing.notEligible')}{' '}
              <Link href="/financements/simulateur-eligibilite">{t('ui.property.financing.testEligibility')}</Link>
            </p>
          )}
          {monthlyOn && p.monthlyFromRef ? <p className={s.footnote}>{settings['legal.monthlyFootnote']}</p> : null}
        </div>
      ) : null}
      <div className={s.buttons}>
        {available ? (
          <>
            <InterestButton target={target} label={t('ui.property.actions.interest')} href={interestHref} />
            <Link href={`${interestHref}&visio=1`} scroll={false} className={buttonClass('secondary', 'M', true)}>
              <ButtonInner size="M">{t('ui.property.actions.visit')}</ButtonInner>
            </Link>
          </>
        ) : reserved ? (
          <Link href={callbackHref} scroll={false} className={buttonClass('primary', 'L', true)}>
            <ButtonInner chevron size="L">
              {t('ui.property.actions.callback')}
            </ButtonInner>
          </Link>
        ) : null}
        {!gone && settings['contact.whatsapp'] ? (
          <a
            href={`${whatsappHref(settings['contact.whatsapp'])}?text=${encodeURIComponent(t('ui.property.actions.whatsappMessage', { titre: p.title, reference: p.reference }))}`}
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
      {/* Figma « Prix et actions » — keep it, share it, without going back up the page */}
      {!gone ? (
        <div className={s.panelTools}>
          <FavoriteButton reference={p.reference} title={p.title} variant="page" />
          <ShareButton url={`${process.env.WEB_URL ?? ''}${base}`} title={p.title} />
        </div>
      ) : null}
      {!gone && reassurance ? (
        <ul className={s.reassurance} role="list">
          <li>
            <Icon name="check" size={16} />
            {reassurance.line1}
          </li>
          <li>
            <Icon name="check" size={16} />
            {reassurance.line2}
          </li>
        </ul>
      ) : null}
    </div>
  );

  return (
    <article className={s.page}>
      {p.isPreview ? null : (
        <JsonLd
          data={[
            propertyLd(p),
            breadcrumbLd([
              { name: t('ui.property.breadcrumb.programs'), path: '/programmes' },
              { name: p.location.region.name, path: `/programmes?region=${p.location.region.slug}` },
              ...(p.program ? [{ name: p.program.name, path: `/programmes/${p.program.slug}` }] : []),
              { name: p.title, path: `/biens/${p.slug}` },
            ]),
          ]}
        />
      )}
      <ViewSignal reference={p.reference} />
      <div hidden data-lead-context={JSON.stringify({ propertyReference: p.reference, propertyTitle: p.title })} />
      <Suspense fallback={null}>
        <InterestDialog settings={settings} target={target} available={available} />
      </Suspense>
      <div className="container">
        <nav aria-label={t('ui.nav.breadcrumb')} className={s.breadcrumb}>
          <Link href="/programmes">{t('ui.property.breadcrumb.programs')}</Link>
          <Icon name="chevron-right" size={16} />
          <Link href={`/programmes?region=${p.location.region.slug}`}>{p.location.region.name}</Link>
          {p.program ? (
            <>
              <Icon name="chevron-right" size={16} />
              <Link href={`/programmes/${p.program.slug}`}>{p.program.name}</Link>
            </>
          ) : null}
          <Icon name="chevron-right" size={16} />
          <span aria-current="page">{p.title}</span>
        </nav>

        {reserved || gone ? (
          <p className={s.banner} role="status">
            <Icon name="status-info" size={20} />
            {reserved ? t('ui.property.banners.reserved') : p.availability === 'SOLD' ? t('ui.property.banners.sold') : t('ui.property.banners.withdrawn')}
          </p>
        ) : null}

        <header className={s.header}>
          <ul className={s.tags} role="list">
            {tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
          <h1 className={s.title}>{p.title}</h1>
          <div className={s.headerRow}>
            <p className={s.place}>
              <Icon name="map-pin" size={20} className={s.gold} />
              {place}
              {flight ? <span className={s.flight}> · {flight}</span> : null}
            </p>
            <div className={s.headerTools}>
              {/* FIC-010 « Favori » (SFA-020) and the « Comparer » box (CAT-092). */}
              <FavoriteButton reference={p.reference} title={p.title} variant="page" />
              <CompareToggle reference={p.reference} title={p.title} variant="page" />
              <ShareButton url={`${process.env.WEB_URL ?? ''}${base}`} title={p.title} />
            </div>
          </div>
        </header>

        <Mosaic
          media={p.media}
          basePath={base}
          render3dNote={settings['legal.render3dNote']}
          illustrationNote={settings['legal.illustrationNote']}
          title={p.title}
        />
      </div>

      {(reserved || gone) && similarBlock}

      <div className={`container ${s.columns}`}>
        <div className={s.main}>
          <div className={s.mobilePanel}>{actionPanel}</div>
          <KeyFacts facts={facts} />
          <section className={s.block} aria-labelledby="description">
            <h2 id="description" className={s.h2}>
              {t('ui.property.description.title')}
            </h2>
            <ReadMore text={p.description} collapsible={!p.descriptionAuto} />
          </section>
          <ItemList id="caracteristiques" title={t('ui.property.features.title')} items={p.features} />
          {p.lots.length > 1 && available ? (
            <section className={s.block} aria-labelledby="lots">
              <h2 id="lots" className={s.h2}>
                {t('ui.property.lots.title')}
              </h2>
              <table className={s.lots}>
                <thead>
                  <tr>
                    <th scope="col">{t('ui.property.lots.lot')}</th>
                    <th scope="col">{t('ui.property.lots.floor')}</th>
                    <th scope="col">{t('ui.property.lots.surface')}</th>
                    <th scope="col">{t('ui.property.lots.orientation')}</th>
                    <th scope="col">{t('ui.property.lots.price')}</th>
                    <th scope="col">
                      <span className="visually-hidden">{t('ui.property.lots.interest')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.lots.slice(0, 8).map((l) => (
                    <tr key={l.reference}>
                      <th scope="row">{l.reference}</th>
                      <td>{l.floor === null ? '—' : l.floor === 0 ? t('ui.property.facts.floorGround') : t('ui.property.facts.floorN', { n: l.floor })}</td>
                      <td>{`${Math.round(Number(l.surfaceM2))} m²`}</td>
                      <td>{l.orientation ? t(`ui.enum.Orientation.${l.orientation}` as never) : '—'}</td>
                      <td className={s.num}>
                        <strong>{amount(l.priceRef) ?? amount(l.price)}</strong>
                        <span className={s.muted}>
                          {[l.priceRef ? amount(l.price) : null, l.pricePerM2Ref ? t('ui.property.lots.perM2', { prix: amount(l.pricePerM2Ref)! }) : null].filter(Boolean).join(' · ')}
                        </span>
                      </td>
                      <td>
                        <Link href={`${interestHref}&lot=${encodeURIComponent(l.reference)}`} scroll={false} className={buttonClass('secondary', 'S')}>
                          <ButtonInner size="S">{t('ui.property.lots.interest')}</ButtonInner>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
          <section className={s.block} aria-labelledby="plans">
            <h2 id="plans" className={s.h2}>
              {t('ui.property.plans.title')}
            </h2>
            <div className={s.planCards}>
              {p.has360Tour && settings['features.tour360'] ? (
                <Link href={`${base}?galerie=360`} scroll={false} className={s.planCard}>
                  <Icon name="globe" size={32} />
                  <strong>{t('ui.property.plans.tourTitle')}</strong>
                  <span>{t('ui.property.plans.tourText')}</span>
                </Link>
              ) : available ? (
                <div className={s.planCard}>
                  <Icon name="camera" size={32} />
                  <strong>{t('ui.property.plans.visioTitle')}</strong>
                  <span>{t('ui.property.plans.visioText')}</span>
                  <Link href={visioHref!} scroll={false} className={buttonClass('secondary', 'M')}>
                    <ButtonInner size="M">{t('ui.property.gallery.visio')}</ButtonInner>
                  </Link>
                </div>
              ) : null}
              {p.media.plans.length ? (
                <Link href={`${base}?galerie=plans`} scroll={false} className={s.planCard}>
                  <Icon name="file" size={32} />
                  <strong>{p.media.plans[0]!.caption ?? t('ui.property.plans.plan')}</strong>
                  <span>{t('ui.property.plans.download')}</span>
                </Link>
              ) : null}
            </div>
          </section>
          {p.program ? (
            <section className={`${s.block} ${s.programBlock}`} aria-labelledby="programme">
              <h2 id="programme" className={s.h2}>
                {t('ui.property.program.title')}
              </h2>
              <p className={s.programName}>{p.program.name}</p>
              {p.program.tagline ? <p className={s.tagline}>{p.program.tagline}</p> : null}
              {p.program.descriptionStart ? <p>{p.program.descriptionStart}…</p> : null}
              {p.program.totalUnits ? <p className={s.muted}>{t('ui.property.program.units', { n: p.program.totalUnits })}</p> : null}
              {p.program.amenities.length ? (
                <ul className={s.chips} role="list">
                  {p.program.amenities.map((a) => (
                    <li key={a.code}>{a.label}</li>
                  ))}
                </ul>
              ) : null}
              <Link href={`/programmes/${p.program.slug}`} className={s.standalone}>
                {t('ui.property.program.seeProgram')}
                <Icon name="chevron-right" size={16} />
              </Link>
              {p.program.otherProperties.length ? (
                <>
                  <h3 className={s.h3}>{t('ui.property.program.others')}</h3>
                  <ul className={s.programTiles} role="list">
                    {p.program.otherProperties.map((o) => (
                      <li key={o.id}>
                        <Link href={`/biens/${o.slug}`} className={s.compactCard}>
                          {o.cover ? <Picture image={o.cover} sizes="(max-width: 639px) 100vw, 240px" className={s.tileImg} alt="" /> : null}
                          <strong>{o.title}</strong>
                          <span>{[surfaceText(o.surfaceMin, o.surfaceMax), money(o.priceFromRef), monthlyOn && o.monthlyFromRef ? t('ui.property.financing.perMonth', { montant: money(o.monthlyFromRef)! }) : null].filter(Boolean).join(' · ')}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}
          <Progress progress={p.progress} />
          <PromoterCard promoter={p.promoter} guarantees={p.program?.guarantees ?? null} />
          <LocationSection location={p.location} mapStyleUrl={env().MAP_STYLE_URL ?? null} />
          <SimpleMore />
        </div>
        <aside className={s.aside}>{actionPanel}</aside>
      </div>

      {!(reserved || gone) && similarBlock}

      <footer className={`container ${s.footer}`}>
        <p>
          {t('ui.property.footer.line', {
            reference: p.reference,
            publie: p.firstPublishedAt ? formatDate(p.firstPublishedAt, 'long') : '—',
            maj: formatDate(p.updatedAt, 'long'),
          })}
        </p>
        {/* FIC-055, DEM-018 — not on a page that is gone, nor in a preview (FIC-120) */}
        {!gone ? <ReportListing propertyId={p.id} /> : null}
      </footer>

      {!gone ? (
        <div className={s.stickyBar} data-action-bar>
          <span className={s.stickyPrice}>
            {monthlyOn && p.monthlyFromRef && available ? t('ui.property.financing.perMonth', { montant: money(p.monthlyFromRef)! }) : priceRef}
          </span>
          <Link href={available ? interestHref : callbackHref} scroll={false} className={buttonClass('primary', 'M')}>
            <ButtonInner size="M">{available ? t('ui.property.actions.interest') : t('ui.property.actions.callback')}</ButtonInner>
          </Link>
        </div>
      ) : null}

      <Lightbox
        media={p.media}
        title={p.title}
        subtitle={[p.location.city?.name ?? p.location.region.name, priceRef, t('ui.property.gallery.reference', { reference: p.reference })].filter(Boolean).join(' · ')}
        primary={available ? { label: t('ui.property.actions.interest'), href: interestHref } : reserved ? { label: t('ui.property.actions.callback'), href: callbackHref } : null}
        visioHref={visioHref}
        render3dNote={settings['legal.render3dNote']}
        illustrationNote={settings['legal.illustrationNote']}
      />
    </article>
  );
}
