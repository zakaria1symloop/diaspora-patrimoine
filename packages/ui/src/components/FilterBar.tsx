// DSN-054 — `FilterBar`: filter without waiting. Above the table: the list's own search field, then one chip per
// filter. A chip opens as a list (check boxes with their SERVER counts, a search field beyond eight values) or as
// dates (« Aujourd'hui », « 7 derniers jours », « Ce mois-ci », « Entre… »). Each choice applies at once, 300 ms after
// the last click, without any « Appliquer » button; an active chip shows its value and its cross; « Tout effacer » at
// the end of the row as soon as a filter is active; « Plus de filtres » opens the rare ones in the same form.
'use client';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useDismiss, usePlacement } from './Overlays';
import s from './FilterBar.module.css';

export interface FilterOption {
  value: string;
  label: string;
  /** TRV-106 — computed by the server, never deduced in the interface. */
  count?: number | null;
}

export type FilterDefinition =
  | { key: string; label: string; kind: 'options'; options: FilterOption[]; single?: boolean; rare?: boolean }
  | { key: string; label: string; kind: 'date'; rare?: boolean };

/** `options`: the chosen values. `date`: `['today']`, `['last7']`, `['month']` or `['between', from, to]` (ISO days, either may be ''). */
export type FilterValues = Record<string, string[] | undefined>;

export const DATE_PRESETS = ['today', 'last7', 'month'] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

/** The bounds (inclusive ISO days) of a date filter value, for the `…From` / `…To` parameters of the API (API-011). */
export function dateFilterBounds(value: string[] | undefined, today: string): { from: string | null; to: string | null } {
  if (!value?.length) return { from: null, to: null };
  const [kind, a, b] = value;
  const shift = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  if (kind === 'today') return { from: today, to: today };
  if (kind === 'last7') return { from: shift(today, -6), to: today };
  if (kind === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (kind === 'between') return { from: a || null, to: b || null };
  return { from: null, to: null };
}

export interface FilterBarLabels {
  clearAll: string;
  moreFilters: string;
  /** « Retirer le filtre {filtre} ». */
  remove: (filter: string) => string;
  searchInList: string;
  noOption: string;
  datePresets: Record<DatePreset, string>;
  between: string;
  from: string;
  to: string;
  /** How an active date value reads on its chip: the application formats the days (TRV-020). */
  formatDay: (iso: string) => string;
  /** « du {debut} au {fin} », « depuis le {debut} », « jusqu'au {fin} ». */
  dateRange: (from: string | null, to: string | null) => string;
}

export interface FilterBarProps {
  filters: FilterDefinition[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  labels: FilterBarLabels;
  /** The list's own search field (first in the row). */
  search?: ReactNode;
  /** After the chips (« Colonnes », « Enregistrer cette vue »…). */
  children?: ReactNode;
}

const isActive = (v: string[] | undefined) => Boolean(v && v.length > 0);

export function FilterBar({ filters, values, onChange, labels, search, children }: FilterBarProps) {
  const [more, setMore] = useState(false);
  const common = filters.filter((f) => !f.rare || isActive(values[f.key]));
  const rare = filters.filter((f) => f.rare && !isActive(values[f.key]));
  const anyActive = filters.some((f) => isActive(values[f.key]));
  const set = (key: string, next: string[]) => onChange({ ...values, [key]: next.length ? next : undefined });
  return (
    <div className={s.bar}>
      {search ? <div className={s.search}>{search}</div> : null}
      <div className={s.chips} role="group">
        {common.map((f) => (
          <FilterChip key={f.key} filter={f} value={values[f.key] ?? []} onChange={(v) => set(f.key, v)} labels={labels} />
        ))}
        {more ? rare.map((f) => <FilterChip key={f.key} filter={f} value={[]} onChange={(v) => set(f.key, v)} labels={labels} />) : null}
        {rare.length > 0 && !more ? (
          <button type="button" className={s.more} onClick={() => setMore(true)}>
            <Icon name="sliders" size={16} />
            {labels.moreFilters}
          </button>
        ) : null}
        {anyActive ? (
          <button type="button" className={s.clear} onClick={() => onChange({})}>
            {labels.clearAll}
          </button>
        ) : null}
      </div>
      {children ? <div className={s.tools}>{children}</div> : null}
    </div>
  );
}

/** One filter as a chip with a list: rest, open, active with its value. */
export function FilterChip({ filter, value, onChange, labels }: { filter: FilterDefinition; value: string[]; onChange: (value: string[]) => void; labels: FilterBarLabels }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const [query, setQuery] = useState('');
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string[] | null>(null);
  const id = useId();

  // The value changed from outside (« Tout effacer », a saved view, the address): the draft follows.
  const signature = value.join('\u0001');
  useEffect(() => {
    if (!pending.current) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current) {
      const next = pending.current;
      pending.current = null;
      onChange(next);
    }
  }, [onChange]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /** DSN-054 — applied 300 ms after the last click. */
  const choose = (next: string[]) => {
    setDraft(next);
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 300);
  };

  const close = useCallback(
    (restore: boolean) => {
      flush();
      setOpen(false);
      setQuery('');
      if (restore) button.current?.focus();
    },
    [flush],
  );
  useDismiss(open, close, [wrap]);
  const flip = usePlacement(open, panel, 'start');

  const active = draft.length > 0;
  let summary = '';
  if (active) {
    if (filter.kind === 'options') {
      summary = draft.map((v) => filter.options.find((o) => o.value === v)?.label ?? v).join(', ');
    } else {
      const [kind, a, b] = draft;
      summary =
        kind === 'between'
          ? labels.dateRange(a ? labels.formatDay(a) : null, b ? labels.formatDay(b) : null)
          : (labels.datePresets[kind as DatePreset] ?? '');
    }
  }

  return (
    <span className={[s.chipWrap, active && s.chipActive].filter(Boolean).join(' ')} ref={wrap}>
      <button ref={button} type="button" className={s.chip} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => (open ? close(false) : setOpen(true))}>
        <span className={s.chipLabel}>
          {filter.label}
          {active ? <span className={s.chipValue}>{` : ${summary}`}</span> : null}
        </span>
        {active ? null : <Icon name="chevron-down" size={16} />}
      </button>
      {active ? (
        <button
          type="button"
          className={s.chipRemove}
          aria-label={labels.remove(filter.label)}
          title={labels.remove(filter.label)}
          onClick={() => {
            pending.current = null;
            if (timer.current) clearTimeout(timer.current);
            setDraft([]);
            onChange([]);
          }}
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
      {open ? (
        <div ref={panel} id={id} role="dialog" aria-label={filter.label} className={[s.panel, flip.x && s.flipX].filter(Boolean).join(' ')}>
          {filter.kind === 'options' ? (
            <OptionsPanel filter={filter} draft={draft} choose={choose} query={query} setQuery={setQuery} labels={labels} />
          ) : (
            <DatePanel draft={draft} choose={choose} labels={labels} />
          )}
        </div>
      ) : null}
    </span>
  );
}

function OptionsPanel({
  filter,
  draft,
  choose,
  query,
  setQuery,
  labels,
}: {
  filter: Extract<FilterDefinition, { kind: 'options' }>;
  draft: string[];
  choose: (next: string[]) => void;
  query: string;
  setQuery: (q: string) => void;
  labels: FilterBarLabels;
}) {
  const fold = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const shown = query ? filter.options.filter((o) => fold(o.label).includes(fold(query))) : filter.options;
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  return (
    <>
      {filter.options.length > 8 ? (
        <label className={s.panelSearch}>
          <Icon name="search" size={16} />
          <input ref={first} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={labels.searchInList} aria-label={labels.searchInList} />
        </label>
      ) : null}
      <ul className={s.options} role="list">
        {shown.map((o, i) => {
          const checked = draft.includes(o.value);
          return (
            <li key={o.value}>
              <label className={s.option}>
                <input
                  ref={i === 0 && filter.options.length <= 8 ? first : undefined}
                  type={filter.single ? 'radio' : 'checkbox'}
                  name={filter.key}
                  checked={checked}
                  onChange={() => {
                    if (filter.single) choose(checked ? [] : [o.value]);
                    else choose(checked ? draft.filter((v) => v !== o.value) : [...draft, o.value]);
                  }}
                  onClick={() => {
                    // a radio that is already chosen can be released
                    if (filter.single && checked) choose([]);
                  }}
                />
                <span className={s.optionLabel}>{o.label}</span>
                {typeof o.count === 'number' ? <span className={s.count}>{o.count}</span> : null}
              </label>
            </li>
          );
        })}
        {shown.length === 0 ? <li className={s.none}>{labels.noOption}</li> : null}
      </ul>
    </>
  );
}

function DatePanel({ draft, choose, labels }: { draft: string[]; choose: (next: string[]) => void; labels: FilterBarLabels }) {
  const [kind, from = '', to = ''] = draft;
  const name = useId();
  return (
    <div className={s.dates}>
      {DATE_PRESETS.map((p) => (
        <label key={p} className={s.option}>
          <input type="radio" name={name} checked={kind === p} onChange={() => choose([p])} />
          <span className={s.optionLabel}>{labels.datePresets[p]}</span>
        </label>
      ))}
      <label className={s.option}>
        <input type="radio" name={name} checked={kind === 'between'} onChange={() => choose(['between', from, to])} />
        <span className={s.optionLabel}>{labels.between}</span>
      </label>
      {kind === 'between' ? (
        <div className={s.between}>
          <label>
            <span>{labels.from}</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => choose(['between', e.target.value, to])} />
          </label>
          <label>
            <span>{labels.to}</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => choose(['between', from, e.target.value])} />
          </label>
        </div>
      ) : null}
    </div>
  );
}
