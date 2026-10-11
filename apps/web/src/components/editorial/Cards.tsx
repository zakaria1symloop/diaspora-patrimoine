// EDI-030 promoter card, EDI-031 programme card (state pill, CYC-127), EDI-071 testimonials, EDI-070 key figures.
import Link from 'next/link';
import type { PromoterProgramCard, PublicPromoterCard, PublicTestimonial } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { deliveryText, money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Picture } from '@/components/Picture';
import { Logo } from './Parts';
import s from './editorial.module.css';

/** « Le début de referencesPublic » — about two lines, cut at a word. */
function start(text: string | null, max = 140): string | null {
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

export function PromoterCard({ promoter }: { promoter: PublicPromoterCard }) {
  return (
    <article className={`${s.card} ${s.cardLink} ${s.promoterCard}`}>
      <div className={s.promoterTop}>
        <Logo image={promoter.logo} name={promoter.name} />
        <div>
          <h3 className={s.promoterName}>
            <Link href={`/promoteurs/${promoter.slug}`} className={s.stretch}>
              {promoter.name}
            </Link>
          </h3>
          <p className={s.facts}>
            {promoter.region ? (
              <span>
                <Icon name="map-pin" size={16} />
                {promoter.region}
              </span>
            ) : null}
            <span>
              <Icon name="building" size={16} />
              {t('ui.editorial.promoters.programs', { n: promoter.programCount })}
            </span>
          </p>
        </div>
      </div>
      {promoter.referencesPublic ? <p className={s.cardText}>{start(promoter.referencesPublic)}</p> : null}
      <span className={s.more} aria-hidden="true">
        {t('ui.editorial.promoters.see')}
        <Icon name="chevron-right" size={16} />
      </span>
    </article>
  );
}

export function ProgramCard({ program }: { program: PromoterProgramCard }) {
  const place = program.city ? `${program.city}, ${program.region}` : program.region;
  return (
    <article className={`${s.card} ${s.cardLink} ${s.programCard}`}>
      <div className={s.programPhoto}>
        {program.cover ? (
          <Picture image={program.cover} sizes="(max-width: 767px) 100vw, 420px" className={s.programImg} alt="" />
        ) : (
          <span className={s.programNoPhoto}>
            <Icon name="building" size={32} />
          </span>
        )}
        <span className={`${s.programState} ${s[`state_${program.state}`]}`}>{t(`ui.editorial.promoters.state.${program.state}`)}</span>
      </div>
      <div className={s.programBody}>
        <h3 className={s.cardTitle}>
          <Link href={`/programmes/${program.slug}`} className={s.stretch}>
            {program.name}
          </Link>
        </h3>
        <p className={s.facts}>
          <span>
            <Icon name="map-pin" size={16} />
            {place}
          </span>
          <span>
            <Icon name="calendar" size={16} />
            {deliveryText(program.delivery)}
          </span>
        </p>
        <p className={s.muted}>{t(`ui.enum.Standing.${program.standing}`)}</p>
        {program.priceFromRef ? (
          <p className={s.programPrice}>{t('ui.editorial.promoters.priceFrom', { prix: money(program.priceFromRef)! })}</p>
        ) : null}
      </div>
    </article>
  );
}

/** EDI-071 — shown only from two published testimonials; six at most (the API already limits). */
export function Testimonials({ items }: { items: PublicTestimonial[] }) {
  if (items.length < 2) return null;
  return (
    <ul role="list" className={s.testimonials}>
      {items.slice(0, 6).map((it) => (
        <li key={it.id} className={s.card}>
          <span className={s.quoteMark} aria-hidden="true">
            “
          </span>
          <blockquote className={s.quote}>
            <p>{it.quote}</p>
          </blockquote>
          <div className={s.person}>
            {it.photo ? <Picture image={it.photo} sizes="56px" className={s.personPhoto} alt="" /> : null}
            <div>
              <p className={s.personName}>{it.residenceCity ? t('ui.editorial.concept.testimonialFrom', { nom: it.displayName, ville: it.residenceCity }) : it.displayName}</p>
              {it.purchaseSummary ? <p className={s.muted}>{it.purchaseSummary}</p> : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** EDI-070 — shown only when at least three figures are filled; nothing is computed nor invented. */
export function KeyFigures({ items }: { items: { value: string; label: string }[] }) {
  const filled = items.filter((f) => f.value.trim() && f.label.trim());
  if (filled.length < 3) return null;
  return (
    <ul role="list" className={s.figures}>
      {filled.map((f) => (
        <li key={f.label} className={s.figure}>
          <span className={s.figureValue}>{f.value}</span>
          <span className={s.cardText}>{f.label}</span>
        </li>
      ))}
    </ul>
  );
}
