// DSN-042 — round country flag of the standing bands (property card, comparison). Decorative: the place is always
// written next to it. Algeria: green and white halves, red crescent and star astride the middle.
import s from './Flag.module.css';

export type FlagCountry = 'dz' | 'fr';

export function Flag({ country, className }: { country: FlagCountry; className?: string }) {
  return (
    <svg className={[s.flag, className].filter(Boolean).join(' ')} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {country === 'dz' ? (
        <>
          <rect width="12" height="24" fill="var(--bo-drapeau-dz-vert)" />
          <rect x="12" width="12" height="24" fill="var(--bo-drapeau-dz-blanc)" />
          <path d="M15.64 9.35A4.5 4.5 0 1 0 15.64 14.65A3.6 3.6 0 1 1 15.64 9.35Z" fill="var(--bo-drapeau-dz-rouge)" />
          <polygon
            points="15.30,10.00 15.77,11.35 17.20,11.38 16.06,12.25 16.48,13.62 15.30,12.80 14.12,13.62 14.54,12.25 13.40,11.38 14.83,11.35"
            fill="var(--bo-drapeau-dz-rouge)"
          />
        </>
      ) : (
        <>
          <rect width="8" height="24" fill="var(--bo-drapeau-fr-bleu)" />
          <rect x="8" width="8" height="24" fill="var(--bo-drapeau-fr-blanc)" />
          <rect x="16" width="8" height="24" fill="var(--bo-drapeau-fr-rouge)" />
        </>
      )}
    </svg>
  );
}
