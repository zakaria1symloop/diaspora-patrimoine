// EP-01 sections 4 to 9 (ACC-045 … ACC-086) with their fallbacks (ACC-090). Every number comes from the data,
// every sentence from a content block or a message key.
import Image from 'next/image';
import Link from 'next/link';
import logo from '@dp/ui/assets/logo.png';
import type { ReactNode } from 'react';
import type { HomeResponse, PublicEventCard, PublicImage } from '@dp/contracts';
import { Icon, SectionTitle, buttonClass, ButtonInner, type IconName } from '@dp/ui';
import { Picture } from '@/components/Picture';
import { PropertyCard } from '@/components/vitrine/PropertyCard';
import { EventCard } from '@/components/vitrine/EventCard';
import { SearchBar } from '@/components/vitrine/SearchBar';
import { Snap } from '@/components/vitrine/Snap';
import { WhySpotlight } from './WhySpotlight';
import { eventDateParts } from '@/lib/events';
import { t } from '@/lib/i18n';
import s from './home.module.css';

type Lines = { title1: string | null; title2: string | null; sub1: string | null; sub2: string | null };

const two = (n: number) => String(n).padStart(2, '0');

// ---------- 4. Six motivations (ACC-045) ----------

const WHY_ICONS: IconName[] = ['key', 'medal', 'sparkles', 'sofa', 'scale', 'tree'];

export function WhySection({ lines, items }: { lines: Lines; items: { title: string; text: string; image: PublicImage | null }[] }) {
  const visible = items.map((it, i) => ({ ...it, icon: WHY_ICONS[i] ?? ('star' as IconName) })).filter((it) => it.text.trim() !== '');
  if (visible.length === 0) return null;
  return (
    <section className={`${s.section} ${s.bgIvoireCiel}`} aria-labelledby="motivations">
      <div className="container">
        <SectionTitle id="motivations" line1={lines.title1} line2={lines.title2} sub1={lines.sub1} sub2={lines.sub2} />
        {/* D-101 — a spotlight instead of six static cards */}
        <WhySpotlight items={visible} label={lines.title1 ?? ''} />
      </div>
    </section>
  );
}

// ---------- 5. Biens (ACC-050 … ACC-055) ----------

export interface PropertiesSectionProps {
  lines: Lines;
  home: HomeResponse;
  assistant: { line1: string | null; line2: string | null; enabled: boolean };
  monthlyEnabled: boolean;
  roomsPrefix: string;
  notes: string[];
  illustrationNote: string;
  callbackHref: string;
  fallback: ReactNode;
}

export function PropertiesSection(p: PropertiesSectionProps) {
  const cards = p.home.featured;
  const noneToShow = cards.length === 0;
  return (
    <section className={s.section} aria-labelledby="biens">
      <div className="container">
        <SectionTitle id="biens" line1={p.lines.title1} line2={p.lines.title2} sub1={p.lines.sub1} sub2={p.lines.sub2} />
        {noneToShow ? (
          <div className={s.soon}>
            <p className={s.soonText}>{t('ui.home.properties.soon')}</p>
            {p.fallback}
          </div>
        ) : (
          <>
            <SearchBar options={p.home.search} monthlyEnabled={p.monthlyEnabled} roomsPrefix={p.roomsPrefix} persist />
            {p.assistant.enabled && p.assistant.line1 ? (
              <p className={s.assistant}>
                <Icon name="chat" size={24} />
                <span>{p.assistant.line1}</span>{' '}
                <Link href="/assistant" className={s.assistantLink}>
                  {p.assistant.line2}
                  <Icon name="chevron-right" size={16} />
                </Link>
              </p>
            ) : null}
            <Snap className={[s.cards, cards.length < 3 && s.cardsCentered].filter(Boolean).join(' ')} label={p.lines.title1 ?? ''}>
              {cards.map((c) => (
                <li key={c.id}>
                  <PropertyCard
                    card={c}
                    variant="home"
                    downPaymentPct={p.home.referenceDownPaymentPct}
                    monthlyEnabled={p.monthlyEnabled}
                    illustrationNote={p.illustrationNote}
                  />
                </li>
              ))}
              {cards.length === 1 ? (
                <li>
                  <article className={s.callCardInline}>
                    <h3 className={s.callTitle}>{t('ui.home.properties.moreSoonTitle')}</h3>
                    <p className={s.callText}>{t('ui.home.properties.moreSoonText')}</p>
                    <Link href={p.callbackHref} className={buttonClass('primary', 'L', true)} scroll={false}>
                      <ButtonInner chevron size="L">
                        {t('ui.home.properties.callback')}
                      </ButtonInner>
                    </Link>
                  </article>
                </li>
              ) : null}
            </Snap>
            <div className={s.center}>
              <Link href="/programmes" className={buttonClass('primary', 'L')}>
                <ButtonInner chevron size="L">
                  {t('ui.home.properties.seeAll')}
                </ButtonInner>
              </Link>
            </div>
            {p.notes.length ? <p className={s.note}>{p.notes.join(' ')}</p> : null}
          </>
        )}
      </div>
    </section>
  );
}

// ---------- 6. Le Café (ACC-060 … ACC-062) ----------

export function CafeSection({
  lines,
  cafes,
  places,
  note,
  photo,
}: {
  lines: Lines;
  cafes: PublicEventCard[];
  places: { place1: string; place2: string; rhythm: string };
  note: string | null;
  /** Figma EP-01 — the photo of a Café (block `home.cafe.photo`) carries the aside; none: the aside alone. */
  photo: PublicImage | null;
}) {
  return (
    <section className={`${s.section} ${s.bgCremeOr}`} aria-labelledby="le-cafe">
      <div className="container">
        <SectionTitle id="le-cafe" line1={lines.title1} line2={lines.title2} sub1={lines.sub1} sub2={lines.sub2} />
        <div className={s.cafeGrid}>
          <aside className={[s.cafeAside, photo && s.cafeAsidePhoto].filter(Boolean).join(' ')}>
            {photo ? (
              <div className={s.cafePhoto}>
                <Picture image={photo} sizes="(max-width: 64rem) 92vw, 28rem" alt="" className={s.cafePhotoImg} />
                <p className={`${s.cafeMark} ${s.cafeTag}`}>
                  <Icon name="cafe-cup" size={24} className={s.cafeCup} />
                  {t('ui.nav.header.cafe')}
                </p>
              </div>
            ) : (
              <p className={s.cafeMark}>
                <Icon name="cafe-cup" size={32} className={s.cafeCup} />
                {t('ui.nav.header.cafe')}
              </p>
            )}
            <div className={s.cafeAsideFoot}>
              <p className={s.cafePlaces}>
                <span>
                  <Icon name="map-pin" size={20} className={s.goldIcon} />
                  {places.place1}
                </span>
                <span>
                  <Icon name="map-pin" size={20} className={s.goldIcon} />
                  {places.place2}
                </span>
              </p>
              <p className={s.rhythm}>
                <Icon name="calendar" size={20} />
                {places.rhythm}
              </p>
            </div>
          </aside>
          <div className={s.events}>
            <Snap className={s.eventList} label={lines.title1 ?? ''} wide>
              {cafes.map((e, i) => (
                <li key={e.slug}>
                  <EventCard event={e} next={i === 0} />
                </li>
              ))}
              {cafes.length < 3 ? (
                <li>
                  <article className={`${s.soonCard} ${cafes.length === 0 ? s.soonCardFull : ''}`}>
                    <h3 className={s.callTitleDark}>{t('ui.home.cafe.soonTitle')}</h3>
                    <p>{t('ui.home.cafe.soonText')}</p>
                    <Link href="/le-cafe#me-prevenir" className={buttonClass('secondary', 'M')}>
                      <ButtonInner chevron size="M">
                        {t('ui.home.cafe.notify')}
                      </ButtonInner>
                    </Link>
                  </article>
                </li>
              ) : null}
            </Snap>
            {note ? <p className={s.note}>{note}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- 7. Services (ACC-070 … ACC-072) ----------

const SERVICE_ICONS: IconName[] = ['sliders', 'chat', 'badge', 'diamond', 'cafe-cup', 'coins', 'file'];
const SERVICE_LINKS = ['/programmes', '/assistant', '/promoteurs', '/programmes', '/le-cafe', '/financements', '/notre-concept#accompagnement'];

export function ServicesSection({
  lines,
  items,
  cta,
  hide,
  callbackHref,
}: {
  lines: Lines;
  items: { title: string; text: string }[];
  cta: { title: string; text: string; button: string };
  hide: { assistant: boolean; cafe: boolean };
  callbackHref: string;
}) {
  const visible = items
    .map((it, i) => ({ ...it, icon: SERVICE_ICONS[i]!, href: SERVICE_LINKS[i]!, gold: i === 4, index: i }))
    .filter((it) => !(it.index === 1 && hide.assistant) && !(it.index === 4 && hide.cafe));
  return (
    <section className={`${s.section} ${s.bgCielBlanc}`} aria-labelledby="services">
      <div className="container">
        <SectionTitle id="services" line1={lines.title1} line2={lines.title2} sub1={lines.sub1} sub2={lines.sub2} />
        <ul className={s.grid4} role="list" data-reveal="">
          {visible.map((it, n) => (
            <li key={it.title} className={s.serviceCard}>
              <div className={s.serviceTop}>
                <span className={`${s.medallion} ${it.gold ? s.medallionGold : ''}`}>
                  <Icon name={it.icon} size={24} />
                </span>
                <span className={s.serviceNumber} aria-hidden="true">
                  {two(n + 1)}
                </span>
              </div>
              <h3 className={s.serviceTitle}>
                <Link href={it.href} className={s.stretch}>
                  {it.title}
                </Link>
              </h3>
              <p className={s.serviceText}>{it.text}</p>
              <span className={s.rowChevron} aria-hidden="true">
                <Icon name="chevron-right" size={20} />
              </span>
            </li>
          ))}
          <li className={s.serviceCta}>
            <Icon name="phone" size={24} />
            <h3 className={s.ctaTitle}>{cta.title}</h3>
            <p className={s.ctaText}>{cta.text}</p>
            <Link href={callbackHref} className={buttonClass('primary', 'M', true)} scroll={false}>
              <ButtonInner chevron size="M">
                {cta.button}
              </ButtonInner>
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}

// ---------- 8. Financement (ACC-080 … ACC-081) ----------

const FINANCING_ICONS: Record<string, IconName> = { credit: 'bank', islamic: 'crescent', expertise: 'coins' };

export function FinancingSection({
  lines,
  items,
  downPaymentPct,
  cafeEnabled,
  children,
}: {
  lines: Lines;
  items: { key: string; overline: string; title: string; text: string; points: string[]; visible: boolean }[];
  downPaymentPct: string;
  cafeEnabled: boolean;
  children: ReactNode;
}) {
  const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(downPaymentPct));
  return (
    <section className={s.section} aria-labelledby="financement">
      <div className="container">
        <SectionTitle id="financement" line1={lines.title1} line2={lines.title2} sub1={lines.sub1} sub2={lines.sub2} />
        <div className={s.financingForm}>{children}</div>
        <ul className={[s.grid3, items.length < 3 && s.cardsCentered].filter(Boolean).join(' ')} role="list" data-reveal="">
          {items.map((it) => (
            <li key={it.key} id={`financement-${it.key}`} className={`${s.listCard} ${s[`list_${it.key}`] ?? ''}`}>
              <div className={s.listBand}>
                <span className={s.iconBadge}>
                  <Icon name={FINANCING_ICONS[it.key] ?? 'bank'} size={20} />
                </span>
                <span className={s.listOverline}>{it.overline}</span>
              </div>
              <div className={s.listBody}>
                <span className={s.listBodyIcon} aria-hidden="true">
                  <Icon name={FINANCING_ICONS[it.key] ?? 'bank'} size={24} />
                </span>
                <span className={s.listOverlineRow} aria-hidden="true">
                  {it.overline}
                </span>
                <h3 className={s.listTitle}>
                  <Link href={`/financements#${it.key === 'islamic' ? 'islamique' : it.key}`} className={s.stretch}>
                    {it.title}
                  </Link>
                </h3>
                <p className={s.listText}>{it.text}</p>
                <ul className={s.checks} role="list">
                  {it.points
                    // ACC-090: « Présent aux Cafés, avec le banquier » is hidden while Le Café is off.
                    .filter((pt, i) => !(it.key === 'expertise' && i === 1 && !cafeEnabled))
                    .map((pt) => (
                      <li key={pt}>
                        <span className={s.check}>
                          <Icon name="check" size={16} />
                        </span>
                        {pt.replace('{apport}', pct)}
                      </li>
                    ))}
                </ul>
                <span className={s.rowChevron} aria-hidden="true">
                  <Icon name="chevron-right" size={20} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------- 9. Appel final (ACC-086) ----------

export function FinalSection({
  title1,
  title2,
  text,
  nextCafe,
  cafeEnabled,
  projectionEnabled,
  photo,
}: {
  /** Figma EP-01 — the hero photo behind the final card; none: the soft gradient. */
  photo: PublicImage | null;
  title1: string | null;
  title2: string | null;
  text: string | null;
  nextCafe: PublicEventCard | null;
  cafeEnabled: boolean;
  projectionEnabled: boolean;
}) {
  let cafeLine: string | null = null;
  if (cafeEnabled && nextCafe) {
    const date = eventDateParts(nextCafe).long;
    cafeLine =
      nextCafe.state.kind === 'FEW'
        ? t('ui.home.final.nextCafeSeats', { date, lieu: nextCafe.cityName, n: nextCafe.state.seatsLeft })
        : t('ui.home.final.nextCafe', { date, lieu: nextCafe.cityName });
  }
  return (
    <section className={[s.final, photo && s.finalPhoto].filter(Boolean).join(' ')} aria-labelledby="appel-final">
      {photo ? (
        <div className={s.finalBg} aria-hidden="true">
          <Picture image={photo} sizes="100vw" alt="" className={s.finalBgImg} />
        </div>
      ) : null}
      <div className={s.finalCard}>
        <Image src={logo} alt="" className={s.finalLogo} sizes="64px" />
        <SectionTitle id="appel-final" line1={title1} line2={title2} sub1={text} />
        {cafeLine ? (
          <p className={s.finalPill}>
            <Icon name="cafe-cup" size={20} />
            {cafeLine}
          </p>
        ) : null}
        <div className={s.finalButtons}>
          {cafeEnabled ? (
            <Link href={nextCafe ? `/le-cafe/${nextCafe.slug}#inscription` : '/le-cafe'} className={buttonClass('primary', 'L')}>
              <ButtonInner chevron size="L">
                {t('ui.home.final.register')}
              </ButtonInner>
            </Link>
          ) : (
            <Link href="/programmes" className={buttonClass('primary', 'L')}>
              <ButtonInner chevron size="L">
                {t('ui.home.final.discover')}
              </ButtonInner>
            </Link>
          )}
          {projectionEnabled ? (
            <a href="#projection" className={buttonClass('secondary', 'L')}>
              <ButtonInner chevron size="L">
                {t('ui.home.final.projection')}
              </ButtonInner>
            </a>
          ) : (
            <Link href="/financements/simulateur-eligibilite" className={buttonClass('secondary', 'L')}>
              <ButtonInner chevron size="L">
                {t('ui.home.final.simulate')}
              </ButtonInner>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
