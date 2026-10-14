// CAT-040 … CAT-045 — property card: standing band « À {RÉGION} », photo (or FIC-022 composition), one label,
// standing, title, key facts (catalogue only), price, down payment, monthly payment in the bottom band.
// Without a monthly payment (CAT-042): the price goes in the band, facts take the row. Reserved/sold: veiled (CAT-043).
import Link from 'next/link';
import type { PropertyCard as Card } from '@dp/contracts';
import { Flag, Icon } from '@dp/ui';
import { Picture } from '@/components/Picture';
import { FavoriteButton } from '@/components/discovery/FavoriteButton';
import { CompareToggle } from '@/components/discovery/CompareToggle';
import { deliveryText, money, surfaceText } from '@/lib/format';
import { t } from '@/lib/i18n';
import s from './PropertyCard.module.css';

export interface PropertyCardProps {
  card: Card;
  downPaymentPct: string;
  /** Home cards hide the key-facts line (CAT-040 line 7). */
  variant?: 'catalogue' | 'home';
  monthlyEnabled: boolean;
  illustrationNote: string;
  headingLevel?: 'h3' | 'h2';
}

const BAND: Record<Card['standing'], string> = { COMFORT: s.comfort!, STANDING: s.standing!, PREMIUM: s.premium! };

export function PropertyCard({ card, downPaymentPct, variant = 'catalogue', monthlyEnabled, illustrationNote, headingLevel = 'h3' }: PropertyCardProps) {
  const Heading = headingLevel;
  const veiled = card.availability === 'RESERVED' || card.availability === 'SOLD';
  const monthly = monthlyEnabled && !veiled ? money(card.monthlyFromRef) : null;
  const price = money(card.priceFromRef);
  const priceLabel = card.priceIsFrom ? t('ui.catalogue.card.priceFrom') : t('ui.catalogue.card.price');
  const surface = surfaceText(card.surfaceMin, card.surfaceMax);
  const delivery = deliveryText(card.delivery);
  const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(downPaymentPct));
  const label =
    card.label?.kind === 'MANUAL'
      ? card.label.text
      : card.label?.kind === 'LAST_LOT'
        ? t('ui.catalogue.card.lastLot')
        : card.label?.kind === 'LOW_STOCK'
          ? t('ui.catalogue.card.lowStock', { n: card.label.n })
          : card.label?.kind === 'NEW'
            ? t('ui.catalogue.card.new')
            : null;

  return (
    <article className={[s.card, veiled && s.veiled].filter(Boolean).join(' ')}>
      <div className={`${s.band} ${BAND[card.standing]}`}>
        <Flag country="dz" />
        {t('ui.catalogue.card.region', { region: card.region.name })}
      </div>
      <div className={s.photo}>
        {card.cover ? (
          <Picture image={card.cover} sizes="(max-width: 639px) 90vw, (max-width: 1023px) 45vw, 428px" className={s.img} />
        ) : (
          <div className={s.noPhoto}>
            <Icon name="camera" size={32} />
            <span>{t('ui.catalogue.card.noPhoto')}</span>
          </div>
        )}
        {veiled ? (
          <span className={s.veil}>{card.availability === 'SOLD' ? t('ui.catalogue.card.sold') : t('ui.catalogue.card.reserved')}</span>
        ) : label ? (
          <span className={s.tag}>{label}</span>
        ) : null}
        {card.cover?.isIllustration ? <span className={s.illustration}>{illustrationNote}</span> : null}
        {/* CAT-040 #4 (SFA-020) and CAT-092 — above the card's link, never following it. */}
        <FavoriteButton reference={card.reference} title={card.title} />
        <CompareToggle reference={card.reference} title={card.title} />
      </div>
      <div className={s.panel}>
        <p className={s.standingLabel}>{t(`ui.enum.Standing.${card.standing}`)}</p>
        <Heading className={s.title}>
          <Link href={`/biens/${card.slug}`} className={s.link}>
            {card.title}
          </Link>
        </Heading>
        {variant === 'catalogue' && monthly ? (
          <p className={s.facts}>{[surface, delivery].filter(Boolean).join(' · ')}</p>
        ) : null}
        {monthly ? (
          <dl className={s.values}>
            <div className={s.value}>
              <Icon name="diamond" size={24} className={s.valueIcon} />
              <div>
                <dt>{priceLabel}</dt>
                <dd>{price}</dd>
              </div>
            </div>
            <div className={s.value}>
              <Icon name="coins" size={24} className={s.valueIcon} />
              <div>
                <dt>{t('ui.catalogue.card.downPayment', { pct })}</dt>
                <dd>{money(card.downPaymentRef)}</dd>
              </div>
            </div>
          </dl>
        ) : (
          <dl className={s.values}>
            {surface ? (
              <div className={s.value}>
                <Icon name="surface" size={24} className={s.valueIcon} />
                <div>
                  <dt>{t('ui.catalogue.card.surface')}</dt>
                  <dd className={s.small}>{surface}</dd>
                </div>
              </div>
            ) : null}
            <div className={s.value}>
              <Icon name="calendar" size={24} className={s.valueIcon} />
              <div>
                <dt>{t('ui.catalogue.card.delivery')}</dt>
                <dd className={s.small}>{delivery}</dd>
              </div>
            </div>
          </dl>
        )}
      </div>
      <div className={`${s.bottom} ${BAND[card.standing]}`}>
        {monthly ? (
          <>
            <span className={s.bottomLabel}>{t('ui.catalogue.card.monthly')}</span>
            <span className={s.bottomValue}>
              {monthly} <span className={s.unit}>{t('ui.catalogue.card.perMonth')}</span>
            </span>
          </>
        ) : (
          <>
            <span className={s.bottomLabel}>{priceLabel}</span>
            <span className={s.bottomValue}>{price}</span>
          </>
        )}
      </div>
    </article>
  );
}
