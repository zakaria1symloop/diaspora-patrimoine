// CAF-003 — « Tous » · « {lieu} » chips when at least two places are listed; state in the address.
import Link from 'next/link';
import { t } from '@/lib/i18n';
import s from './cafe.module.css';

export function PlaceFilter({ places, current }: { places: string[]; current: string | null }) {
  return (
    <ul className={s.places} role="list">
      <li>
        <Link href="/le-cafe" className={s.place} aria-current={current === null ? 'true' : undefined} scroll={false}>
          {t('ui.cafe.list.all')}
        </Link>
      </li>
      {places.map((p) => (
        <li key={p}>
          <Link href={`/le-cafe?lieu=${encodeURIComponent(p)}`} className={s.place} aria-current={current === p ? 'true' : undefined} scroll={false}>
            {p}
          </Link>
        </li>
      ))}
    </ul>
  );
}
