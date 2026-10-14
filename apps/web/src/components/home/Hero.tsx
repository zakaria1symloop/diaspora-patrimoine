// ACC-010 … ACC-012, ACC-030, ACC-031, ACC-090 — hero: three-line title (the page's only h1), the Café card
// (or its fallback), the comparison, the two financing mentions.
import Link from 'next/link';
import type { HomeResponse, PublicEventCard, PublicImage } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { Picture } from '@/components/Picture';
import { eventDateParts, shortDate } from '@/lib/events';
import { t } from '@/lib/i18n';
import { Comparison, type ComparisonValue } from './Comparison';
import s from './home.module.css';

interface CafeCardText {
  overline: string;
  brand: string;
  text1: string;
  text2: string;
  place1: string;
  place2: string;
}

export interface HeroProps {
  lines: [string | null, string | null, string | null];
  home: HomeResponse;
  cafeEnabled: boolean;
  islamicEnabled: boolean;
  callbackHref: string;
  cafeCard: CafeCardText;
  fallbackCard: { title: string; text: string };
  mentions: { credit: string; islamic: string };
  comparison: ComparisonValue | null;
  monthlyFootnote: string;
  /** ACC-010 — the photo behind the hero (block `home.hero.image`); none: the soft gradient alone. */
  image: PublicImage | null;
  /** The photo of the Café card (block `home.cafe.photo`). */
  cafePhoto: PublicImage | null;
}

/** ACC-031 — the « PROCHAIN CAFÉ » pill and the button that goes with its state. */
function pill(e: PublicEventCard | null): { line: string; date: string | null; button: string; href: string } {
  if (!e) return { line: t('ui.home.hero.cafeSoon'), date: null, button: t('ui.home.hero.notify'), href: '/le-cafe#me-prevenir' };
  const date = eventDateParts(e).short;
  const href = `/le-cafe/${e.slug}#inscription`;
  const lieu = e.cityName;
  switch (e.state.kind) {
    case 'FEW':
      return { line: t('ui.home.hero.cafeSeats', { lieu, n: e.state.seatsLeft }), date, button: t('ui.home.hero.register'), href };
    case 'FULL':
      return { line: t('ui.home.hero.cafeFull', { lieu }), date, button: t('ui.home.hero.waitlist'), href };
    case 'OPENING':
      return { line: t('ui.home.hero.cafeOpening', { lieu, date: shortDate(e.state.opensAt, e.timezone) }), date, button: t('ui.home.hero.notify'), href };
    default:
      return { line: t('ui.home.hero.cafeOpen', { lieu }), date, button: t('ui.home.hero.register'), href };
  }
}

export function Hero(p: HeroProps) {
  const next = pill(p.home.nextCafe);
  return (
    <section className={s.hero} data-hero>
      <div className={s.heroBg} aria-hidden="true">
        {p.image ? <Picture image={p.image} sizes="100vw" priority alt="" className={s.heroPhoto} /> : null}
      </div>
      <div className={`container ${s.heroGrid}`}>
        <div className={s.heroLeft}>
          {p.cafeEnabled ? (
            <article className={`${s.cafeCard} ${p.cafePhoto ? s.cafeCardPhoto : ''}`}>
              {/* The whole card leads where its main button leads; the buttons stay above it. */}
              <Link href={next.href} className={s.cardCover} aria-hidden="true" tabIndex={-1} />
              {p.cafePhoto ? <Picture image={p.cafePhoto} sizes="(max-width: 64rem) 0px, 11rem" alt="" className={s.cafeCardImage} /> : null}
              <div className={s.cafeCardBody}>
              <p className={s.cafeOverline}>
                <Icon name="cafe-cup" size={32} className={s.cafeCup} />
                <span>{p.cafeCard.overline}</span>
              </p>
              <p className={s.cafeBrand}>{p.cafeCard.brand}</p>
              <p className={s.cafeText}>{p.cafeCard.text1}</p>
              <p className={s.cafeText}>{p.cafeCard.text2}</p>
              <p className={s.cafePlaces}>
                <span>
                  <Icon name="map-pin" size={20} className={s.goldIcon} />
                  {p.cafeCard.place1}
                </span>
                <span>
                  <Icon name="map-pin" size={20} className={s.goldIcon} />
                  {p.cafeCard.place2}
                </span>
              </p>
              <div className={s.nextPill}>
                <span className={s.nextLabel}>{t('ui.home.hero.nextCafe')}</span>
                {next.date ? <span className={s.nextDate}>{next.date}</span> : null}
                <span className={s.nextLine}>{next.line}</span>
              </div>
              <div className={s.cafeButtons}>
                <Link href={next.href} className={buttonClass('primary', 'L', true)}>
                  <ButtonInner chevron size="L">
                    {next.button}
                  </ButtonInner>
                </Link>
                <Link href="/programmes" className={buttonClass('secondary', 'M', true)}>
                  <ButtonInner chevron size="M">
                    {t('ui.home.hero.seeProperties')}
                  </ButtonInner>
                </Link>
              </div>
              </div>
            </article>
          ) : (
            <article className={`${s.cafeCard} ${s.callCard}`}>
              <Link href={p.callbackHref} className={s.cardCover} aria-hidden="true" tabIndex={-1} scroll={false} />
              <Icon name="phone" size={32} className={s.callIcon} />
              <h2 className={s.callTitle}>{p.fallbackCard.title}</h2>
              <p className={s.callText}>{p.fallbackCard.text}</p>
              <Link href={p.callbackHref} className={buttonClass('primary', 'L', true)} scroll={false}>
                <ButtonInner chevron size="L">
                  {t('ui.home.hero.callback')}
                </ButtonInner>
              </Link>
              <Link href="/programmes" className={buttonClass('secondary', 'M', true)}>
                <ButtonInner chevron size="M">
                  {t('ui.home.hero.seeProperties')}
                </ButtonInner>
              </Link>
            </article>
          )}
        </div>
        <h1 className={s.heroTitle}>
          {p.lines[0] ? <span className={s.heroLine1}>{p.lines[0]}</span> : null}{' '}
          {p.lines[1] ? <span className={s.heroLine2}>{p.lines[1]}</span> : null}{' '}
          {p.lines[2] ? (
            <span className={s.heroLine3}>
              {p.lines[2]}
              <svg className={s.heroStroke} viewBox="0 0 320 18" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d="M4 14C70 6 190 2 316 6" stroke="var(--bo-fond-champagne)" strokeWidth="5" strokeLinecap="round" fill="none" />
                <path d="M4 14C60 8 130 5 200 4" stroke="var(--bo-accent-or)" strokeWidth="4" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          ) : null}
        </h1>
      </div>
      <div className={`container ${s.heroBottom}`}>
        {p.comparison && p.comparison.visible !== false ? (
          <Comparison value={p.comparison} footnote={p.monthlyFootnote} propertySlug={p.home.comparisonProperty?.slug ?? null}
            cover={p.home.comparisonProperty?.cover ?? null}
          />
        ) : null}
        <ul className={s.mentions} role="list">
          <li>
            <Link href="/financements#credit" className={s.mention}>
              <Icon name="bank" size={32} />
              {p.mentions.credit}
            </Link>
          </li>
          {p.islamicEnabled ? (
            <li>
              <Link href="/financements#islamique" className={s.mention}>
                <Icon name="crescent" size={32} />
                {p.mentions.islamic}
              </Link>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
