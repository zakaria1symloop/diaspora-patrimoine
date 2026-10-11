// TRV-109, DSN-050 `SearchSuggest` — suggestions under a search field while typing: a `listbox` announced
// (« 5 suggestions »), grouped, the part that matches the typing in bold; arrows, Enter, Escape. The application
// fetches (from 2 characters, 300 ms after the last key — TRV-103) and hands the groups; this component shows them.
'use client';
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import s from './SearchSuggest.module.css';

export interface SuggestItem {
  id: string;
  /** Main line: the matching part is set in bold by the component. */
  primary: string;
  secondary?: string | null;
  icon?: IconName;
  /** A state shown at the end of the line (a `StatusTag`). */
  trailing?: ReactNode;
}

export interface SuggestGroup<T extends SuggestItem = SuggestItem> {
  key: string;
  label: string;
  items: T[];
  /** « Voir tous les résultats » of the group, as a last line. */
  more?: { label: string; onSelect: () => void } | null;
}

export interface SearchSuggestHandle {
  focus: () => void;
}

export interface SearchSuggestProps<T extends SuggestItem = SuggestItem> {
  value: string;
  onChange: (value: string) => void;
  groups: SuggestGroup<T>[];
  onPick: (item: T, opts: { newTab: boolean }) => void;
  /** Enter without a highlighted line. */
  onSubmit?: (value: string) => void;
  loading?: boolean;
  /** Suggestions exist for this typing (false while fewer than 2 characters, or before the first answer). */
  ready: boolean;
  labels: { label: string; placeholder: string; count: (n: number) => string; noResult: (query: string) => string; clear: string; loading: string };
  /** A key hint shown at the end of the empty field (« / »). */
  hint?: string;
  size?: 'M' | 'S';
}

function fold(v: string): string {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** The part of `text` that matches `query` (case and accents ignored) in bold. */
export function Highlighted({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim());
  if (q.length < 2) return <>{text}</>;
  const at = fold(text).indexOf(q);
  // folding keeps the length for the Latin letters used here; when it does not, show the text as it is
  if (at < 0 || fold(text).length !== text.length) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <strong>{text.slice(at, at + q.length)}</strong>
      {text.slice(at + q.length)}
    </>
  );
}

function SearchSuggestInner<T extends SuggestItem>(
  { value, onChange, groups, onPick, onSubmit, loading, ready, labels, hint, size = 'M' }: SearchSuggestProps<T>,
  ref: React.ForwardedRef<SearchSuggestHandle>,
) {
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), []);

  type Line = { kind: 'item'; item: T } | { kind: 'more'; run: () => void; id: string };
  const lines: Line[] = [];
  for (const g of groups) {
    for (const item of g.items) lines.push({ kind: 'item', item });
    if (g.more) lines.push({ kind: 'more', run: g.more.onSelect, id: `${g.key}-more` });
  }
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  const lineId = (i: number) => `${listId}-o${i}`;

  useEffect(() => setActive(-1), [value]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && e.target instanceof Node && !wrap.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);
  useEffect(() => {
    if (active >= 0) document.getElementById(lineId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const run = (line: Line, newTab: boolean) => {
    setOpen(false);
    if (line.kind === 'item') onPick(line.item, { newTab });
    else line.run();
  };

  const showPanel = open && value.trim().length >= 2 && (ready || loading);
  let index = -1;
  return (
    <div className={[s.wrap, s[size]].join(' ')} ref={wrap}>
      <label className={s.field}>
        <span className="visually-hidden">{labels.label}</span>
        <Icon name="search" size={20} className={s.icon} />
        <input
          ref={input}
          type="text"
          role="combobox"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? lineId(active) : undefined}
          placeholder={labels.placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => (lines.length ? (a + 1) % lines.length : -1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (lines.length ? (a <= 0 ? lines.length - 1 : a - 1) : -1));
            } else if (e.key === 'Enter') {
              const line = lines[active];
              if (line) {
                e.preventDefault();
                run(line, e.ctrlKey || e.metaKey);
              } else if (onSubmit) {
                e.preventDefault();
                setOpen(false);
                onSubmit(value);
              }
            } else if (e.key === 'Escape') {
              if (open && value) {
                e.preventDefault();
                setOpen(false);
              } else {
                input.current?.blur();
              }
            }
          }}
        />
        {loading ? <span className={s.spinner} role="status" aria-label={labels.loading} /> : null}
        {value ? (
          <button
            type="button"
            className={s.clear}
            onClick={() => {
              onChange('');
              input.current?.focus();
            }}
          >
            <Icon name="close" size={16} label={labels.clear} />
          </button>
        ) : hint ? (
          <kbd className={s.hint} aria-hidden="true">
            {hint}
          </kbd>
        ) : null}
      </label>
      <span className="visually-hidden" role="status" aria-live="polite">
        {showPanel && ready ? (count > 0 ? labels.count(count) : labels.noResult(value.trim())) : ''}
      </span>
      <div id={listId} role="listbox" aria-label={labels.label} className={s.panel} hidden={!showPanel}>
        {showPanel && ready && count === 0 ? <p className={s.none}>{labels.noResult(value.trim())}</p> : null}
        {showPanel
          ? groups.map((g) =>
              g.items.length === 0 ? null : (
                <div key={g.key} role="group" aria-label={g.label} className={s.group}>
                  <p className={s.groupLabel} aria-hidden="true">
                    {g.label}
                  </p>
                  {g.items.map((item) => {
                    index += 1;
                    const i = index;
                    return (
                      <div
                        key={item.id}
                        id={lineId(i)}
                        role="option"
                        aria-selected={active === i}
                        className={[s.option, active === i && s.active].filter(Boolean).join(' ')}
                        onPointerMove={() => setActive(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => run({ kind: 'item', item }, e.ctrlKey || e.metaKey)}
                      >
                        {item.icon ? <Icon name={item.icon} size={20} className={s.optionIcon} /> : null}
                        <span className={s.optionText}>
                          <span className={s.primary}>
                            <Highlighted text={item.primary} query={value} />
                          </span>
                          {item.secondary ? (
                            <span className={s.secondary}>
                              <Highlighted text={item.secondary} query={value} />
                            </span>
                          ) : null}
                        </span>
                        {item.trailing ? <span className={s.trailing}>{item.trailing}</span> : null}
                      </div>
                    );
                  })}
                  {g.more
                    ? (() => {
                        index += 1;
                        const i = index;
                        const more = g.more;
                        return (
                          <div
                            id={lineId(i)}
                            role="option"
                            aria-selected={active === i}
                            className={[s.option, s.more, active === i && s.active].filter(Boolean).join(' ')}
                            onPointerMove={() => setActive(i)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => run({ kind: 'more', run: more.onSelect, id: `${g.key}-more` }, false)}
                          >
                            {more.label}
                            <Icon name="chevron-right" size={16} />
                          </div>
                        );
                      })()
                    : null}
                </div>
              ),
            )
          : null}
      </div>
    </div>
  );
}

export const SearchSuggest = forwardRef(SearchSuggestInner) as <T extends SuggestItem = SuggestItem>(
  props: SearchSuggestProps<T> & { ref?: React.ForwardedRef<SearchSuggestHandle> },
) => ReturnType<typeof SearchSuggestInner>;
