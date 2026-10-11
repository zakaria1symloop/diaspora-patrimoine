'use client';
// TRV-126 point 2 — first visit of the space: three bubbles in turn present the frieze, « À faire » and the advisor,
// with « Suivant » · « Passer »; seen once per browser (`dp_tour_space`); « Revoir la visite » (account menu) replays
// it. A bubble never hides what it presents, and the page stays usable behind it (no backdrop, no focus trap).
import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { t } from '@/lib/i18n';
import s from './dashboard.module.css';

const KEY = 'dp_tour_space';
const TARGETS = ['steps', 'todo', 'advisor'] as const;

export function SpaceTour() {
  const [step, setStep] = useState<number | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; below: boolean } | null>(null);
  const params = useSearchParams();
  const router = useRouter();

  const available = useCallback(() => TARGETS.map((k, i) => ({ k, i })).filter(({ k }) => document.querySelector(`[data-tour="${k}"]`)), []);

  useEffect(() => {
    const start = () => {
      const list = available();
      if (list.length) setStep(list[0]!.i);
    };
    let seen = false;
    try {
      seen = localStorage.getItem(KEY) === '1';
    } catch {
      seen = true;
    }
    if (params?.get('visite') === '1') {
      router.replace('/espace-client', { scroll: false });
      start();
    } else if (!seen) start();
    window.addEventListener('dp:tour', start);
    return () => window.removeEventListener('dp:tour', start);
  }, [available, params, router]);

  useLayoutEffect(() => {
    if (step === null) return;
    const place = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${TARGETS[step]}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = r.top < 260;
      const width = Math.min(340, window.innerWidth - 32);
      const left = Math.min(Math.max(16, r.left + 24), window.innerWidth - width - 16);
      setPos({ top: below ? r.bottom + window.scrollY + 12 : r.top + window.scrollY - 12, left, width, below });
    };
    const el = document.querySelector<HTMLElement>(`[data-tour="${TARGETS[step]}"]`);
    // DSN-055 — the element presented wears a halo; the rest of the screen is not darkened.
    el?.classList.add(s.halo!);
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    place();
    const id = window.setTimeout(place, 350);
    window.addEventListener('resize', place);
    return () => {
      el?.classList.remove(s.halo!);
      window.clearTimeout(id);
      window.removeEventListener('resize', place);
    };
  }, [step]);

  const finish = () => {
    setStep(null);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* storage unavailable */
    }
  };

  if (step === null || !pos) return null;
  const list = available();
  const index = list.findIndex((x) => x.i === step);
  const next = list[index + 1];
  const n = step + 1;
  return (
    <div
      className={[s.tip, pos.below ? s.tipBelow : s.tipAbove].join(' ')}
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      role="dialog"
      aria-modal="false"
      aria-label={t('ui.client.tour.label')}
      onKeyDown={(e) => e.key === 'Escape' && finish()}
    >
      <p className={s.tipStep}>{t('ui.common.tour.step', { n: index + 1, total: list.length })}</p>
      <p className={s.tipTitle}>{t(`ui.client.tour.${n}.title` as 'ui.client.tour.1.title')}</p>
      <p className={s.tipText}>{t(`ui.client.tour.${n}.text` as 'ui.client.tour.1.text')}</p>
      <div className={s.tipActions}>
        <button type="button" className={s.tipSkip} onClick={finish}>
          {t('ui.common.tour.skip')}
        </button>
        <button type="button" className={s.tipNext} onClick={() => (next ? setStep(next.i) : finish())} autoFocus>
          {next ? t('ui.common.tour.next') : t('ui.common.tour.done')}
        </button>
      </div>
    </div>
  );
}
