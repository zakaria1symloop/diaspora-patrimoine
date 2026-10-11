'use client';
// CAL-050 — the completeness score in a table: a small ring and the figure; red under the publication threshold,
// gold between the two thresholds, green from `catalogue.completeScore`.
import { t } from '@/lib/i18n';
import s from './properties.module.css';

export function CompletenessPill({ score, min, complete }: { score: number; min: number; complete: number }) {
  const tone = score >= complete ? 'good' : score >= min ? 'mid' : 'low';
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <span className={s.pill} data-tone={tone} title={t('ui.admin-properties.completeness.score', { n: score })}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r={r} className={s.pillTrack} />
        <circle cx="9" cy="9" r={r} className={s.pillValue} strokeDasharray={`${(c * Math.min(100, score)) / 100} ${c}`} transform="rotate(-90 9 9)" />
      </svg>
      <span className={s.pillFigure}>{score}</span>
    </span>
  );
}
