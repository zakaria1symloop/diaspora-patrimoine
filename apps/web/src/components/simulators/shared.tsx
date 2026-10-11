'use client';
// Pieces shared by EP-11 and EP-12: amount reading (TRV-026), formats (TRV-020, CAL-025), the « ? » help (TRV-126),
// slider doubled by a field (SIM-050), rolling figures (DSN-072, reduced motion respected), the simplified mode
// (TRV-122), the property reminder (SIM-030) and a small JSON client for the simulator routes.
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { isApiErrorBody, LocalKeys, type ApiErrorBody, type Money, type SimulatorProperty } from '@dp/contracts';
import { formatMoney, hasMessage } from '@dp/i18n';
import { Picture } from '@/components/Picture';
import { t } from '@/lib/i18n';
import s from './sim.module.css';
import { newUuid } from '@dp/ui';

// ─── Formats ────────────────────────────────────────────────────────────────

export function fmt(m: Money | null | undefined, digits: 0 | 2 = 0, approx = false): string {
  if (!m) return '—';
  const v = formatMoney(Number(m.amount), m.currency, 'fr-FR', digits);
  return approx ? `≈ ${v}` : v;
}

export const fmtValue = (amount: number | string, currency: string, digits: 0 | 2 = 0) => formatMoney(Number(amount), currency, 'fr-FR', digits);

export function currencySymbol(currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
}

export function durationText(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (rest === 0) return t('ui.sim.common.years', { n: years });
  if (years === 0) return t('ui.sim.common.months', { n: rest });
  return t('ui.sim.common.yearsAndMonths', { ans: t('ui.sim.common.years', { n: years }), mois: t('ui.sim.common.months', { n: rest }) });
}

/** A percentage without its sign, for « {pct} % » messages. */
export const pctNum = (v: string | number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(v));
export const rateText = (bps: number) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bps / 100)} %`;

/**
 * TRV-026 — an amount typed with spaces, apostrophes, comma or point: « 150 000 », « 150'000 », « 150.000 », « 1040,50 ».
 * Returns the wire decimal string (« 150000 », « 1040.50 ») or null when it is not an amount.
 */
export function parseAmount(raw: string): string | null {
  const v = raw.replace(/[\s  '’]/g, '');
  if (v === '') return null;
  // Groups of three after a point or a comma are thousands (« 150.000 », « 1,250,000 »).
  if (/^\d{1,3}([.,]\d{3})+$/.test(v)) return v.replace(/[.,]/g, '');
  const n = v.replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(n) ? n.replace(/^0+(?=\d)/, '') : null;
}

/** Display of a typed amount once the field is left: grouped by Intl (« 150 000 »). */
export function displayAmount(wire: string | null | undefined): string {
  if (!wire) return '';
  const n = Number(wire);
  return Number.isFinite(n) ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n) : wire;
}

// ─── Motion ─────────────────────────────────────────────────────────────────

/** DSN-072 — the figure rolls from its old value to the new one (motion.slow); reduced motion: at once. */
export function useRolling(target: number | null, decimals = 0): number | null {
  const [shown, setShown] = useState(target);
  const from = useRef<number | null>(target);
  useEffect(() => {
    if (target === null) {
      from.current = null;
      setShown(null);
      return;
    }
    const start = from.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (start === null || reduced || start === target) {
      from.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const factor = 10 ** decimals;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 400);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round((start + (target - start) * eased) * factor) / factor;
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, decimals]);
  return shown;
}

/** A Money figure that rolls (DSN-072). */
export function Rolling({ value, digits = 0, approx = false }: { value: Money | null; digits?: 0 | 2; approx?: boolean }) {
  const n = useRolling(value ? Number(value.amount) : null, digits);
  if (!value || n === null) return <>—</>;
  return <>{fmt({ amount: String(n), currency: value.currency }, digits, approx)}</>;
}

// ─── TRV-122 simplified mode ────────────────────────────────────────────────

export function useSimpleMode(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(localStorage.getItem(LocalKeys.simpleMode) === '1');
    } catch {
      /* storage unavailable */
    }
  }, []);
  return on;
}

// ─── HelpTip (TRV-126) ──────────────────────────────────────────────────────

export function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);
  return (
    <span className={s.helpWrap} ref={ref}>
      <button
        type="button"
        className={s.helpButton}
        aria-label={t('ui.sim.common.help')}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open ? (
        <span id={id} role="tooltip" className={s.helpBubble}>
          {text}
        </span>
      ) : null}
    </span>
  );
}

// ─── Slider doubled by a field (SIM-050) ────────────────────────────────────

export function SliderField({
  id,
  label,
  help,
  value,
  min,
  max,
  step,
  fieldMax,
  fieldStep,
  onChange,
  suffix,
  valueText,
  boundsText,
  disabled,
  decimals = 0,
  children,
}: {
  id: string;
  label: ReactNode;
  help?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** The field may accept more than the slider (SIM-020: rate up to 30 %). */
  fieldMax?: number;
  fieldStep?: number;
  onChange: (v: number) => void;
  suffix: string;
  valueText: (v: number) => string;
  boundsText: [string, string];
  disabled?: boolean;
  decimals?: number;
  children?: ReactNode;
}) {
  const show = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(v);
  const [draft, setDraft] = useState(show(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals]);
  const top = fieldMax ?? max;
  const read = (raw: string): number | null => {
    const n = Number(raw.replace(/[\s  ]/g, '').replace(',', '.'));
    return raw.trim() !== '' && Number.isFinite(n) ? n : null;
  };
  const commit = (raw: string) => {
    focused.current = false;
    const n = read(raw);
    const v = n === null ? value : Math.min(top, Math.max(min, fieldStep ? Math.round(n / fieldStep) * fieldStep : n));
    setDraft(show(v));
    if (v !== value) onChange(v);
  };
  const pct = ((Math.min(max, Math.max(min, value)) - min) / (max - min || 1)) * 100;
  return (
    <div className={s.control}>
      <div className={s.controlTop}>
        <label htmlFor={`${id}-champ`} className={s.controlLabel}>
          {label}
          {help ? <HelpTip text={help} /> : null}
        </label>
        <span className={s.miniField}>
          <input
            id={`${id}-champ`}
            inputMode="decimal"
            autoComplete="off"
            value={draft}
            disabled={disabled}
            aria-describedby={`${id}-bornes`}
            onFocus={() => (focused.current = true)}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = read(e.target.value);
              if (n !== null && n >= min && n <= top) onChange(fieldStep ? Math.round(n / fieldStep) * fieldStep : n);
            }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
          />
          <span className={s.miniSuffix} aria-hidden="true">
            {suffix}
          </span>
        </span>
      </div>
      <input
        type="range"
        className={s.range}
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={typeof label === 'string' ? label : undefined}
        aria-valuetext={valueText(value)}
        style={{ ['--fill' as string]: `${pct}%` }}
      />
      <span id={`${id}-bornes`} className={s.bounds}>
        <span>{boundsText[0]}</span>
        <span>{boundsText[1]}</span>
      </span>
      {children}
    </div>
  );
}

// ─── Property reminder (SIM-030) ────────────────────────────────────────────

export function PropertyMini({ property }: { property: SimulatorProperty }) {
  return (
    <a href={`/biens/${property.slug}`} className={s.propertyMini}>
      {property.cover ? <Picture image={property.cover} sizes="88px" alt={property.cover.alt} /> : <span />}
      <span className={s.propertyMiniText}>
        <span className={s.overline}>{t('ui.sim.common.property')}</span>
        <strong>{property.title}</strong>
        <span className={s.muted}>
          {property.cityRegion}
          {property.priceRef ? ` · ${t('ui.sim.common.propertyPrice', { prix: fmt(property.priceRef) })}` : ''}
        </span>
      </span>
    </a>
  );
}

// ─── JSON client ────────────────────────────────────────────────────────────

export type Call<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiErrorBody['error'] | null; retryAfter?: number; offline?: boolean };

export function newKey(): string {
  return newUuid();
}

function csrfHeader(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  for (const part of document.cookie.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === 'dp_web_csrf' || k === '__Host-dp_web_csrf') return { 'X-CSRF-Token': decodeURIComponent(v.join('=')) };
  }
  return {};
}

export async function postJson<T>(url: string, body: unknown, opts: { key?: string; signal?: AbortSignal } = {}): Promise<Call<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      // SEC-027 — a signed-in client's write carries the anti-forgery token (read from its readable cookie).
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(opts.key ? { 'Idempotency-Key': opts.key } : {}), ...csrfHeader() },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return { ok: false, status: 0, error: null, offline: true };
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (res.ok) return { ok: true, status: res.status, data: json as T };
  return { ok: false, status: res.status, error: isApiErrorBody(json) ? json.error : null, retryAfter: Number(res.headers.get('Retry-After') ?? '') || undefined };
}

/** TRV-064 — a field code from the shared schema or the API, in words. */
export function fieldMessage(code: string, params?: Record<string, unknown> | null): string {
  if (code === 'OUT_OF_RANGE' && (!params || params.min === undefined)) return t('ui.validation.INVALID_AMOUNT');
  const key = `ui.validation.${code}`;
  return hasMessage(key) ? t(key, (params ?? undefined) as never) : t('ui.validation.INVALID_CHOICE');
}

/** Debounced value (CAL-112: 300 ms after the last keystroke). */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(h);
  }, [value, ms]);
  return v;
}

/** Downloads a PDF answered by `POST /public/simulations/pdf` (nothing written, SIM-032). */
export function useDownload() {
  return useCallback(async (body: unknown): Promise<'ok' | 'limit' | 'error'> => {
    try {
      const res = await fetch('/api/v1/public/simulations/pdf', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 429) return 'limit';
      if (!res.ok) return 'error';
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'simulation.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      return 'ok';
    } catch {
      return 'error';
    }
  }, []);
}
