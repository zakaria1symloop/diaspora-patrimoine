'use client';
// D-098 « des listes malignes » — the controls of a list of the client space: filters as chips with their counter,
// search, sort. The state lives in the ADDRESS (TRV-101): copying it gives the same view, « Retour » goes back to the
// previous filter. These lists are bounded by a limit of the spec (100 favourites, 30 simulations, 10 alerts…): the
// whole list is already on the page, so filtering happens here without a round trip, and the counters are those of
// the complete list the server sent (TRV-100, TRV-106 as amended for bounded lists). A filtered list without result
// shows the active filters and « Effacer les filtres » (TRV-104).
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './kit.module.css';

export interface ListState {
  get: (key: string) => string;
  /** `push`: a new history entry (a filter, a sort); otherwise the entry is replaced (typing in the search). */
  set: (patch: Record<string, string | null>, opts?: { push?: boolean }) => void;
  /** True when one of `keys` differs from its default. */
  active: (keys: string[]) => boolean;
  clear: (keys: string[]) => void;
}

/** List state in the address. `defaults` are not written (a clean address is the default view). */
export function useListState(defaults: Record<string, string> = {}): ListState {
  const params = useSearchParams();
  const pathname = usePathname() ?? '';
  const defaultsRef = useRef(defaults);
  const get = useCallback((key: string) => params?.get(key) ?? defaultsRef.current[key] ?? '', [params]);
  const set = useCallback(
    (patch: Record<string, string | null>, opts?: { push?: boolean }) => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '' || v === (defaultsRef.current[k] ?? '')) next.delete(k);
        else next.set(k, v);
      }
      const q = next.toString();
      const url = `${pathname}${q ? `?${q}` : ''}${window.location.hash}`;
      // Native history calls are followed by the router (useSearchParams updates) without a server round trip.
      if (opts?.push) window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
    },
    [pathname],
  );
  const active = useCallback((keys: string[]) => keys.some((k) => get(k) !== (defaultsRef.current[k] ?? '')), [get]);
  const clear = useCallback((keys: string[]) => set(Object.fromEntries(keys.map((k) => [k, null])), { push: true }), [set]);
  return useMemo(() => ({ get, set, active, clear }), [get, set, active, clear]);
}

export interface ChipOption {
  value: string;
  label: string;
  /** Number of items the filter keeps; a chip at zero stays visible but cannot be chosen (unless it is the current one). */
  count?: number;
}

/** One filter as a row of chips (single choice). The first option is the « all » of the filter. */
export function FilterChips({ label, options, value, onChange }: { label: string; options: ChipOption[]; value: string; onChange: (value: string) => void }) {
  return (
    <ul role="list" className={s.chips} aria-label={label}>
      {options.map((o) => (
        <li key={o.value}>
          <button type="button" className={s.chip} aria-pressed={o.value === value} disabled={o.count === 0 && o.value !== value} onClick={() => onChange(o.value)}>
            {o.label}
            {o.count !== undefined ? <span className={s.chipCount}>{o.count}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** TRV-103 — the search starts at 2 characters, 300 ms after the last key; case and accents are ignored. */
export function SearchBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // « Retour » or « Effacer les filtres » changed the address: follow it.
  useEffect(() => setText(value), [value]);
  const push = (v: string) => {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v.trim().length >= 2 ? v.trim() : ''), 300);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <label className={s.search}>
      <span className="visually-hidden">{label}</span>
      <Icon name="search" size={20} />
      <input type="search" className={s.searchInput} value={text} placeholder={label} onChange={(e) => push(e.target.value)} enterKeyHint="search" autoComplete="off" />
      {text ? (
        <button type="button" className={s.searchClear} onClick={() => push('')} aria-label={t('ui.client.list.clearSearch')}>
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </label>
  );
}

export function SortSelect({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  return (
    <label className={s.sort}>
      {t('ui.client.list.sort')}
      <select className={s.sortSelect} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toolbar({ children, end }: { children?: ReactNode; end?: ReactNode }) {
  return (
    <div className={s.toolbar} data-list-toolbar>
      {children}
      {end ? <div className={s.toolbarEnd}>{end}</div> : null}
    </div>
  );
}

/** « 3 sur 12 » and « Effacer les filtres » while a filter is active; announced politely (the list changed). */
export function ResultLine({ shown, total, filtered, onClear, children }: { shown: number; total: number; filtered: boolean; onClear: () => void; children?: ReactNode }) {
  if (!filtered && !children) return null;
  return (
    <p className={s.resultLine} role="status" aria-live="polite">
      {filtered ? <span>{t('ui.client.list.shown', { n: shown, total })}</span> : null}
      {children}
      {filtered ? (
        <button type="button" className={s.clear} onClick={onClear}>
          <Icon name="close" size={16} />
          {t('ui.client.list.clear')}
        </button>
      ) : null}
    </p>
  );
}

/** TRV-104 — a filtered list without result: says so and offers to clear the filters. */
export function NoMatch({ onClear }: { onClear: () => void }) {
  return (
    <div className={s.noMatch}>
      <p className={s.noMatchTitle}>{t('ui.common.empty.filtered')}</p>
      <button type="button" className={s.clear} onClick={onClear}>
        <Icon name="close" size={16} />
        {t('ui.client.list.clear')}
      </button>
    </div>
  );
}

/** TRV-103 — comparison that ignores case and accents. */
export function matches(haystack: (string | null | undefined)[], needle: string): boolean {
  if (!needle) return true;
  const norm = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const n = norm(needle);
  return haystack.some((h) => h && norm(h).includes(n));
}
