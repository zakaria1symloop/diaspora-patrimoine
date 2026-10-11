// DSN-050 EventCard, ACC-061 — date block, place, line, state with seats gauge, button by CYC-181.
import Link from 'next/link';
import type { PublicEventCard } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { eventDateParts, eventHours, shortDate } from '@/lib/events';
import { t } from '@/lib/i18n';
import s from './EventCard.module.css';

export function EventCard({ event, next, capacityHint }: { event: PublicEventCard; next?: boolean; capacityHint?: number }) {
  const d = eventDateParts(event);
  const h = eventHours(event);
  const presence = event.hasPromoter && event.hasBank ? t('ui.home.cafe.both') : event.hasPromoter ? t('ui.home.cafe.promoter') : event.hasBank ? t('ui.home.cafe.bank') : null;
  const line = [t('ui.home.cafe.line', { jour: d.weekday.charAt(0).toUpperCase() + d.weekday.slice(1), debut: h.start, fin: h.end }), presence]
    .filter(Boolean)
    .join(' · ');
  const st = event.state;
  const stateText =
    st.kind === 'FEW'
      ? t('ui.home.cafe.seats', { n: st.seatsLeft })
      : st.kind === 'OPEN'
        ? t('ui.home.cafe.open')
        : st.kind === 'FULL'
          ? t('ui.home.cafe.full')
          : st.kind === 'OPENING'
            ? t('ui.home.cafe.opening', { date: shortDate(st.opensAt, event.timezone) })
            : st.kind === 'CANCELLED'
              ? t('ui.home.cafe.cancelled')
              : t('ui.home.cafe.closed');
  const button =
    st.kind === 'OPEN' || st.kind === 'FEW'
      ? t('ui.home.cafe.register')
      : st.kind === 'FULL'
        ? t('ui.home.cafe.waitlist')
        : st.kind === 'OPENING'
          ? t('ui.home.cafe.notify')
          : null;
  const gauge = st.kind === 'FEW' && capacityHint ? Math.max(0.05, 1 - st.seatsLeft / capacityHint) : st.kind === 'FULL' ? 1 : st.kind === 'OPEN' ? 0.1 : null;

  return (
    <article className={[s.card, next && s.next].filter(Boolean).join(' ')}>
      <div className={s.date} aria-hidden="true">
        <span className={s.weekday}>{d.weekday}</span>
        <span className={s.day}>{d.day}</span>
        <span className={s.month}>{d.month}</span>
      </div>
      <div className={s.body}>
        <h3 className={s.place}>
          <Icon name="map-pin" size={20} className={s.pin} />
          <span>
            <span className="visually-hidden">{d.long}, </span>
            {event.locationLabel}
          </span>
        </h3>
        <p className={s.line}>{line}</p>
        <div className={s.foot}>
          <div className={s.state}>
            <span>{stateText}</span>
            {gauge !== null ? (
              <span className={s.gauge} aria-hidden="true">
                <span style={{ inlineSize: `${Math.round(gauge * 100)}%` }} />
              </span>
            ) : null}
          </div>
          {button ? (
            <Link href={`/le-cafe/${event.slug}#inscription`} className={buttonClass(next ? 'primary' : 'secondary', 'M')}>
              <ButtonInner chevron size="M">
                {button}
              </ButtonInner>
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
