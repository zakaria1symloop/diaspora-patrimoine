// CAT-090 (list beside the map) and CAT-091 (properties of an unfolded programme) — the compact card: photo, standing,
// title, place, key facts, price and monthly payment, the heart and the « Comparer » box. The whole card is a link.
import Link from 'next/link';
import type { PropertyCard } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { Picture } from '@/components/Picture';
import { FavoriteButton } from '@/components/discovery/FavoriteButton';
import { CompareToggle } from '@/components/discovery/CompareToggle';
import { deliveryText, money, surfaceText } from '@/lib/format';
import { t } from '@/lib/i18n';
import s from './views.module.css';

export function CompactCard({ card, monthlyEnabled, onHover }: { card: PropertyCard; monthlyEnabled: boolean; onHover?: (ref: string | null) => void }) {
  const veiled = card.availability === 'RESERVED' || card.availability === 'SOLD';
  const monthly = monthlyEnabled && !veiled ? money(card.monthlyFromRef) : null;
  const price = money(card.priceFromRef);
  const facts = [surfaceText(card.surfaceMin, card.surfaceMax), deliveryText(card.delivery)].filter(Boolean).join(' · ');
  return (
    <article
      className={[s.compact, veiled && s.compactVeiled].filter(Boolean).join(' ')}
      data-standing={card.standing}
      onMouseEnter={onHover ? () => onHover(card.reference) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(card.reference) : undefined}
      onBlur={onHover ? () => onHover(null) : undefined}
    >
      <div className={s.compactPhoto}>
        {card.cover ? (
          <Picture image={card.cover} sizes="160px" className={s.compactImg} />
        ) : (
          <span className={s.compactNoPhoto}>
            <Icon name="camera" size={24} />
          </span>
        )}
        {veiled ? <span className={s.compactVeil}>{card.availability === 'SOLD' ? t('ui.catalogue.card.sold') : t('ui.catalogue.card.reserved')}</span> : null}
        <FavoriteButton reference={card.reference} title={card.title} />
      </div>
      <div className={s.compactBody}>
        <p className={s.compactStanding}>{t(`ui.enum.Standing.${card.standing}`)}</p>
        <h3 className={s.compactTitle}>
          <Link href={`/biens/${card.slug}`} className={s.compactLink}>
            {card.title}
          </Link>
        </h3>
        <p className={s.compactPlace}>
          <Icon name="map-pin" size={16} />
          {card.city ? `${card.city.name}, ${card.region.name}` : card.region.name}
        </p>
        {facts ? <p className={s.compactFacts}>{facts}</p> : null}
        <p className={s.compactPrice}>
          {card.priceIsFrom ? <span className={s.compactFrom}>{t('ui.catalogue.card.priceFrom')} </span> : null}
          <strong>{price}</strong>
          {monthly ? (
            <span className={s.compactMonthly}>
              {' · '}
              {monthly} {t('ui.catalogue.card.perMonth')}*
            </span>
          ) : null}
        </p>
        <CompareToggle reference={card.reference} title={card.title} />
      </div>
    </article>
  );
}
