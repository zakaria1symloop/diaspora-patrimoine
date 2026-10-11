'use client';
// EDI-023 — « Combien pourriez-vous acheter ? »: two sliders doubled by a field (DEM-007, SIM-050), computed by the
// server (`POST /public/simulations/quick`, through the site's origin) 300 ms after the last move; the figure rolls
// from the old value to the new one (DSN-072, motion.slow; reduced motion: final value at once); the new result is
// announced to screen readers once stable (SIM-050). Unavailable: the SIM-008 sentence in the card, no figure.
// Nothing is stored, no contact detail is asked.
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { QUICK_SIMULATION_SLIDERS, type QuickSimulationResponse } from '@dp/contracts';
import { formatMoney } from '@dp/i18n';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './interactive.module.css';

const DEBOUNCE_MS = 300;
const ROLL_MS = 400; // motion.slow
/** The fields accept more than the sliders (EDI-023); the API bounds them again. */
const FIELD_MAX = { downPayment: 5_000_000, monthlyPayment: 50_000 } as const;

type Result = { status: 'loading' } | { status: 'ok'; data: QuickSimulationResponse } | { status: 'error' };

function useRolling(target: number | null): number | null {
  const [shown, setShown] = useState(target);
  const from = useRef<number | null>(target);
  useEffect(() => {
    if (target === null) return;
    const start = from.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (start === null || reduced || start === target) {
      from.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ROLL_MS);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(start + (target - start) * eased);
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

function AmountControl({
  id,
  label,
  value,
  onChange,
  slider,
  max,
  suffix,
  currency,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  slider: { min: number; max: number; step: number };
  max: number;
  suffix: string;
  currency: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const fmt = (v: number) => formatMoney(v, currency, 'fr-FR', 0);
  const commit = (raw: string) => {
    const n = Number(raw.replace(/[\s  ]/g, '').replace(',', '.'));
    if (!Number.isFinite(n) || raw.trim() === '') {
      setDraft(String(value));
      return;
    }
    const v = Math.round(Math.min(max, Math.max(slider.min, n)));
    setDraft(String(v));
    onChange(v);
  };
  const pct = ((Math.min(slider.max, Math.max(slider.min, value)) - slider.min) / (slider.max - slider.min)) * 100;
  return (
    <div className={s.calcControl}>
      <div className={s.calcControlTop}>
        <label htmlFor={`${id}-champ`} className={s.calcLabel}>
          {label}
        </label>
        <span className={s.calcField}>
          <input
            id={`${id}-champ`}
            inputMode="numeric"
            autoComplete="off"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = Number(e.target.value.replace(/[\s  ]/g, ''));
              if (Number.isFinite(n) && e.target.value.trim() !== '' && n >= slider.min && n <= max) onChange(Math.round(n));
            }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
            }}
            aria-describedby={`${id}-bornes`}
          />
          <span className={s.calcSuffix} aria-hidden="true">
            {suffix}
          </span>
        </span>
      </div>
      <input
        type="range"
        className={s.range}
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={Math.min(slider.max, Math.max(slider.min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={fmt(value)}
        style={{ ['--fill' as string]: `${pct}%` }}
      />
      <span id={`${id}-bornes`} className={s.calcBounds}>
        <span>{fmt(slider.min)}</span>
        <span>{fmt(slider.max)}</span>
      </span>
    </div>
  );
}

export function QuickCalc({ currency, callbackHref }: { currency: string; callbackHref: string }) {
  const sl = QUICK_SIMULATION_SLIDERS;
  const id = useId();
  const [down, setDown] = useState<number>(sl.downPayment.start);
  const [monthly, setMonthly] = useState<number>(sl.monthlyPayment.start);
  const [result, setResult] = useState<Result>({ status: 'loading' });
  const [announce, setAnnounce] = useState('');
  const first = useRef(true);

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      try {
        const res = await fetch('/api/v1/public/simulations/quick', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ downPayment: down, monthlyPayment: monthly }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as QuickSimulationResponse;
        setResult({ status: 'ok', data });
        if (!first.current) {
          setAnnounce(
            t('ui.editorial.financing.calc.announce', {
              montant: formatMoney(Number(data.budget), data.currency, 'fr-FR', 0),
              financement: formatMoney(Number(data.financing), data.currency, 'fr-FR', 0),
              duree: t('ui.editorial.financing.calc.years', { n: Math.round(data.durationMonths / 12) }),
            }),
          );
        }
        first.current = false;
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setResult({ status: 'error' });
      }
    };
    // First display: at once; then 300 ms after the last move.
    const timer = window.setTimeout(run, first.current ? 0 : DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [down, monthly]);

  const data = result.status === 'ok' ? result.data : null;
  const budget = useRolling(data ? Number(data.budget) : null);
  const symbol =
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
  const years = data ? Math.round(data.durationMonths / 12) : 0;

  return (
    <section className={s.calc} aria-labelledby={`${id}-titre`}>
      <h2 id={`${id}-titre`} className={s.calcTitle}>
        <Icon name="calculator" size={24} />
        {t('ui.editorial.financing.calc.title')}
      </h2>
      <AmountControl
        id={`${id}-apport`}
        label={t('ui.editorial.financing.calc.downPayment')}
        value={down}
        onChange={setDown}
        slider={sl.downPayment}
        max={FIELD_MAX.downPayment}
        suffix={symbol}
        currency={currency}
      />
      <AmountControl
        id={`${id}-mensualite`}
        label={t('ui.editorial.financing.calc.monthly')}
        value={monthly}
        onChange={setMonthly}
        slider={sl.monthlyPayment}
        max={FIELD_MAX.monthlyPayment}
        suffix={`${symbol} ${t('ui.editorial.financing.calc.perMonth')}`}
        currency={currency}
      />

      {result.status === 'error' ? (
        <div className={s.calcError} role="status">
          <Icon name="status-info" size={24} />
          <p>{t('ui.editorial.financing.calc.unavailable')}</p>
          <Link href={callbackHref} className={buttonClass('secondary', 'M')} scroll={false}>
            <ButtonInner chevron size="M">
              {t('ui.editorial.financing.calc.callback')}
            </ButtonInner>
          </Link>
        </div>
      ) : (
        <>
          <div className={s.calcResult} data-loading={result.status === 'loading' || undefined}>
            <span className={s.calcResultLabel}>{t('ui.editorial.financing.calc.budgetLabel')}</span>
            <strong className={s.calcBudget}>{budget !== null ? formatMoney(budget, currency, 'fr-FR', 0) : ' '}</strong>
            <span className={s.calcDetail}>
              {data
                ? t('ui.editorial.financing.calc.detail', {
                    financement: formatMoney(Number(data.financing), data.currency, 'fr-FR', 0),
                    duree: t('ui.editorial.financing.calc.years', { n: years }),
                  })
                : ' '}
            </span>
          </div>
          <p className={s.calcNote}>{t('ui.editorial.financing.calc.note')}</p>
          <div className={s.calcButtons}>
            <Link href={`/financements/simulateur-eligibilite?apport=${down}&mensualite=${monthly}`} className={buttonClass('primary', 'M', true)}>
              <ButtonInner chevron size="M">
                {t('ui.editorial.financing.calc.refine')}
              </ButtonInner>
            </Link>
            <Link
              href={data ? `/programmes?priceMax=${Math.round(Number(data.budget))}` : '/programmes'}
              className={buttonClass('secondary', 'M', true)}
              aria-disabled={!data || undefined}
            >
              <ButtonInner chevron size="M">
                {t('ui.editorial.financing.calc.seeProperties')}
              </ButtonInner>
            </Link>
          </div>
          <div className={s.calcLinks}>
            {data ? (
              <Link href={`/financements/simulateur-credit?montant=${Math.round(Number(data.financingComputed))}&duree=${years}`} className={s.calcLink}>
                <Icon name="coins" size={20} />
                {t('ui.editorial.financing.calc.credit')}
              </Link>
            ) : null}
            <a href="#parcours" className={s.calcLink}>
              <Icon name="file" size={20} />
              {t('ui.editorial.financing.calc.documents')}
            </a>
          </div>
        </>
      )}
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}
