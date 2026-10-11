// EP-15 — the registration drawn as a Café ticket: the date block and the place on the left, the stub with the access
// code and its QR code on the right (CAF-030, CAF-051). A waiting registration gets an open stub (no code, no exact
// place, CAF-032); a cancelled one is stamped. The steam of the cup is the page's only motion (reduced-motion: still).
import type { CafeRegistrationView } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { eventDateParts, eventHours } from '@/lib/events';
import { t } from '@/lib/i18n';
import s from './manage.module.css';

function Steam() {
  return (
    <svg className={s.steam} viewBox="0 0 64 64" aria-hidden="true">
      <path className={s.steam1} d="M24 30c-3-4 3-6 0-10s3-6 0-10" />
      <path className={s.steam2} d="M32 30c-3-4 3-6 0-10s3-6 0-10" />
      <path className={s.steam3} d="M40 30c-3-4 3-6 0-10s3-6 0-10" />
      <path className={s.cupBody} d="M16 34h34v6a14 14 0 0 1-14 14h-6a14 14 0 0 1-14-14z" />
      <path className={s.cupHandle} d="M50 37h3a5 5 0 0 1 0 10h-4" />
      <path className={s.saucer} d="M10 58h44" />
    </svg>
  );
}

export function Ticket({ view, fullBrand }: { view: CafeRegistrationView; fullBrand: string }) {
  const c = view.cafe;
  const card = { ...c, state: { kind: 'OPEN' as const }, hasPromoter: false, hasBank: false };
  const d = eventDateParts(card);
  const h = eventHours(card);
  const cancelled = view.status === 'CANCELLED' || view.phase === 'EVENT_CANCELLED';
  const waiting = view.status === 'WAITLISTED';
  const statusKey = `ui.cafe.manage.status${view.status}` as const;
  return (
    <article className={[s.ticket, cancelled && s.ticketVoid, waiting && s.ticketWaiting].filter(Boolean).join(' ')} aria-label={t('ui.cafe.manage.ticketLabel')}>
      <div className={s.ticketMain}>
        <div className={s.ticketTop}>
          <span className={s.brand}>
            <Icon name="cafe-cup" size={20} className={s.brandIcon} />
            {fullBrand}
          </span>
          <span className={[s.badge, s[`badge${view.status}`]].filter(Boolean).join(' ')}>{t(statusKey)}</span>
        </div>
        <div className={s.dateRow}>
          <div className={s.dateBlock} aria-hidden="true">
            <span className={s.dateWeekday}>{d.weekday.slice(0, 3)}</span>
            <span className={s.dateDay}>{d.day}</span>
            <span className={s.dateMonth}>{d.month}</span>
          </div>
          <div className={s.dateText}>
            <h2 className={s.ticketTitle}>{c.locationLabel === c.cityName ? c.cityName : `${c.locationLabel} · ${c.cityName}`}</h2>
            <p className={s.ticketWhen}>
              <span className={s.srOnly}>{t('ui.cafe.manage.when')} : </span>
              {d.long.charAt(0).toUpperCase() + d.long.slice(1)}
            </p>
            <p className={s.ticketHours}>{t('ui.cafe.page.hours', { debut: h.start, fin: h.end, ville: c.cityName })}</p>
          </div>
        </div>
        <dl className={s.facts}>
          <div>
            <dt>
              <Icon name="map-pin" size={16} />
              {t('ui.cafe.manage.where')}
            </dt>
            <dd>
              {c.venue ? (
                <>
                  <strong>{c.venue.name}</strong>
                  <span>{c.venue.address}</span>
                  {c.venue.notes ? <span className={s.muted}>{c.venue.notes}</span> : null}
                </>
              ) : (
                <>
                  <strong>{c.locationLabel === c.cityName ? c.cityName : `${c.locationLabel}, ${c.cityName}`}</strong>
                  {waiting ? <span className={s.muted}>{t('ui.cafe.manage.placeHidden')}</span> : null}
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="partners" size={16} />
              {t('ui.cafe.manage.seats')}
            </dt>
            <dd>
              <strong>{t('ui.cafe.manage.seatsValue', { n: view.seats })}</strong>
            </dd>
          </div>
        </dl>
      </div>
      <div className={s.perforation} aria-hidden="true" />
      <div className={s.stub}>
        {view.accessCode && view.qrCode ? (
          <>
            <p className={s.stubLabel}>{t('ui.cafe.manage.code')}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL produced by the API */}
            <img className={s.qr} src={view.qrCode} width={160} height={160} alt={t('ui.cafe.manage.qrAlt', { code: view.accessCode })} />
            <p className={s.code} translate="no">
              {view.accessCode.split('').map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
            </p>
            <p className={s.stubHelp}>{t('ui.cafe.manage.codeHelp')}</p>
          </>
        ) : (
          <div className={s.stubEmpty}>
            <Steam />
            <p className={s.stubHelp}>{t('ui.cafe.manage.onSite')}</p>
          </div>
        )}
      </div>
      {cancelled ? (
        <span className={s.stamp} aria-hidden="true">
          {t('ui.cafe.manage.statusCANCELLED')}
        </span>
      ) : null}
    </article>
  );
}

