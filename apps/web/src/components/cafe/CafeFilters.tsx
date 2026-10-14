// CAF-003, D-105 — « Prochaines dates » filters: place, month, dates with seats left. Each row appears only when it
// separates something (two places, two months, dates both with and without seats). One choice per row, kept in the
// address (TRV-101) with the other rows' choices: a chip is a link, the page is filtered on the server.
import Link from 'next/link';
import type { PublicEventCard } from '@dp/contracts';
import { t } from '@/lib/i18n';
import s from './cafe.module.css';

export interface CafeQuery {
  lieu: string | null;
  mois: string | null;
  places: boolean;
}

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;

export function readCafeQuery(sp: Search): CafeQuery {
  const mois = one(sp.mois);
  return { lieu: one(sp.lieu), mois: mois && /^\d{4}-\d{2}$/.test(mois) ? mois : null, places: one(sp.places) === '1' };
}

/** « 2026-10 », in the Café's own time zone (a Café at 23:30 in Paris belongs to Paris's day). */
export function monthKey(e: PublicEventCard): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: e.timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(e.startsAt));
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const hasSeats = (e: PublicEventCard) => e.state.kind === 'OPEN' || e.state.kind === 'FEW';

export function filterCafes(list: PublicEventCard[], q: CafeQuery): PublicEventCard[] {
  return list.filter((e) => (!q.lieu || e.locationLabel === q.lieu) && (!q.mois || monthKey(e) === q.mois) && (!q.places || hasSeats(e)));
}

export const isCafeFiltered = (q: CafeQuery) => Boolean(q.lieu || q.mois || q.places);

export function cafeHref(q: CafeQuery): string {
  const p = new URLSearchParams();
  if (q.lieu) p.set('lieu', q.lieu);
  if (q.mois) p.set('mois', q.mois);
  if (q.places) p.set('places', '1');
  const qs = p.toString();
  return `/le-cafe${qs ? `?${qs}` : ''}#dates`;
}

export function CafeFilters({ events, places, query }: { events: PublicEventCard[]; places: string[]; query: CafeQuery }) {
  const months = [...new Set(events.map(monthKey))].sort();
  const seatsSplit = events.some(hasSeats) && events.some((e) => !hasSeats(e));
  const rows: { id: string; label: string; chips: { label: string; href: string; current: boolean }[] }[] = [];
  if (places.length >= 2) {
    rows.push({
      id: 'lieu',
      label: t('ui.cafe.list.filters.place'),
      chips: [
        { label: t('ui.cafe.list.all'), href: cafeHref({ ...query, lieu: null }), current: query.lieu === null },
        ...places.map((p) => ({ label: p, href: cafeHref({ ...query, lieu: p }), current: query.lieu === p })),
      ],
    });
  }
  if (months.length >= 2) {
    rows.push({
      id: 'mois',
      label: t('ui.cafe.list.filters.month'),
      chips: [
        { label: t('ui.cafe.list.filters.anyMonth'), href: cafeHref({ ...query, mois: null }), current: query.mois === null },
        ...months.map((m) => ({ label: monthLabel(m), href: cafeHref({ ...query, mois: m }), current: query.mois === m })),
      ],
    });
  }
  if (seatsSplit) {
    rows.push({
      id: 'places',
      label: t('ui.cafe.list.filters.seats'),
      chips: [
        { label: t('ui.cafe.list.filters.anySeats'), href: cafeHref({ ...query, places: false }), current: !query.places },
        { label: t('ui.cafe.list.filters.withSeats'), href: cafeHref({ ...query, places: true }), current: query.places },
      ],
    });
  }
  if (!rows.length) return null;
  return (
    <div className={s.filters} role="group" aria-label={t('ui.cafe.list.filters.title')}>
      {rows.map((r) => (
        <div key={r.id} className={s.filterRow}>
          <span id={`cafe-filtre-${r.id}`} className={s.filterLabel}>
            {r.label}
          </span>
          <ul className={s.places} role="list" aria-labelledby={`cafe-filtre-${r.id}`}>
            {r.chips.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className={s.place} aria-current={c.current ? 'true' : undefined} scroll={false}>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
