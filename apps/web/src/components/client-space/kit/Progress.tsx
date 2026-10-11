// DSN-072 « Barre de progression, complétude » — fills in `motion.slow` (a transform, DSN-074), announced as a
// progress bar with its sentence; the legend under it gives the figures behind the bar.
import type { ReactNode } from 'react';
import s from './kit.module.css';

export interface ProgressProps {
  value: number;
  max?: number;
  /** Accessible name: the sentence the bar illustrates (« Votre dossier est complet à 22 %. »). */
  label: string;
  /** Shown under the bar, left and right. */
  legend?: ReactNode;
  legendEnd?: ReactNode;
  tone?: 'gold' | 'green';
}

export function Progress({ value, max = 100, label, legend, legendEnd, tone = 'gold' }: ProgressProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className={[s.progress, tone === 'green' && s.progressGreen].filter(Boolean).join(' ')}>
      <div className={s.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(max, Math.max(0, value))} aria-label={label}>
        <span className={s.progressFill} style={{ ['--v' as string]: ratio }} />
      </div>
      {legend || legendEnd ? (
        <div className={s.progressLegend}>
          <span>{legend}</span>
          {legendEnd ? <span>{legendEnd}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** A journey in a few steps on one line (the six steps of ECL-020 in a list row). Decorative: the text says it. */
export function StepDots({ total, current, done }: { total: number; current: number; done?: boolean }) {
  return (
    <span className={s.dots} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={[s.dot, (done || i + 1 < current) && s.dotDone, !done && i + 1 === current && s.dotCurrent].filter(Boolean).join(' ')} />
      ))}
    </span>
  );
}
