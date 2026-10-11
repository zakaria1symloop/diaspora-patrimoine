// TRV-080 — the skeletons of the public site: each takes the place AND the shape of what it stands for (same frame,
// same heights), so that nothing moves when the content arrives. They show only when the answer is late (300 ms, the
// fade-in delay of <Skeleton>), and say « Chargement » once to a screen reader.
import { Skeleton } from '@dp/ui';
import s from './Skeletons.module.css';

/** The shape of a PropertyCard (CAT-040): band, photo, standing, title, two values, bottom band. */
export function PropertyCardSkeleton() {
  return (
    <div className={s.card} aria-hidden="true">
      <div className={s.band} />
      <div className={s.photo} />
      <div className={s.panel}>
        <Skeleton width="45%" height="0.75rem" />
        <Skeleton width="85%" height="1.25rem" />
        <Skeleton width="60%" height="0.875rem" />
        <div className={s.values}>
          <Skeleton width="42%" height="2.25rem" />
          <Skeleton width="42%" height="2.25rem" />
        </div>
      </div>
      <div className={s.bottom}>
        <Skeleton width="35%" height="0.875rem" />
        <Skeleton width="55%" height="2rem" />
      </div>
    </div>
  );
}

/** A grid of property cards: `className` is the grid of the page it replaces. */
export function PropertyGridSkeleton({ count = 6, label, className }: { count?: number; label: string; className?: string }) {
  return (
    <ul className={className} role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <PropertyCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** Rows of a list read from the browser (favourites, comparison, alerts): a thumbnail and three lines each. */
export function RowsSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div className={s.rows} role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={s.row}>
          <span className={s.thumb} aria-hidden="true" />
          <div className={s.rowLines}>
            <Skeleton width="55%" height="1.125rem" />
            <Skeleton width="35%" height="0.875rem" />
            <Skeleton width="70%" height="0.875rem" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A short form read from the browser (preferences, an alert): a title and its fields. */
export function FormSkeleton({ fields = 3, label }: { fields?: number; label: string }) {
  return (
    <div className={s.form} role="status" aria-label={label} aria-busy="true">
      <Skeleton width="50%" height="1.5rem" />
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className={s.field}>
          <Skeleton width="30%" height="0.875rem" />
          <Skeleton width="100%" height="3rem" radius="var(--radius-m)" />
        </div>
      ))}
      <Skeleton width="12rem" height="3rem" radius="var(--radius-pill)" />
    </div>
  );
}
