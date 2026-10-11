// DSN-053 — `DataTable`, a living table (BO-035, TRV-100…TRV-108): sticky header, sticky first column, sort on a
// header (aria-sort; second click reverses, third goes back to the default), row = the record (click, Ctrl+click,
// keyboard: arrows, Enter, Space, Escape), selection with the bulk bar rising from the bottom, the footer with the
// range, the page size and the numbered pagination. Sorting, filtering and paging are done by the SERVER (TRV-100):
// this component only shows rows and reports gestures. It holds no interface text: labels come from the application.
'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Icon } from './Icon';
import s from './DataTable.module.css';

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

/** DSN-053 — first click: the column's first direction; second: the opposite; third: the default sort of the list. */
export function nextSort(current: SortState | null, key: string, fallback: SortState | null, firstDir: 'asc' | 'desc' = 'asc'): SortState | null {
  const first: SortState = { key, dir: firstDir };
  const second: SortState = { key, dir: firstDir === 'asc' ? 'desc' : 'asc' };
  const same = (a: SortState | null, b: SortState | null) => a?.key === b?.key && a?.dir === b?.dir;
  if (same(current, first)) return second;
  if (same(current, second)) return same(fallback, second) || !fallback ? first : fallback;
  return first;
}

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** TRV-126 — a « ? » for a header whose meaning is not obvious (a `HelpTip`). */
  help?: ReactNode;
  sortable?: boolean;
  /** Direction of the first click (a date column usually starts with the most recent). */
  firstDir?: 'asc' | 'desc';
  align?: 'start' | 'end';
  /** CSS width of the column (`12rem`, `20%`). */
  width?: string;
  cell: (row: T) => ReactNode;
  /** TRV-070 — the full text of the cell, shown on hover when it is truncated. */
  text?: (row: T) => string | null | undefined;
}

export interface DataTableLabels {
  /** Accessible name of the table. */
  caption: string;
  sortAscending: string;
  sortDescending: string;
  selectAll: string;
  selectRow: (row: string) => string;
  actions: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowId: (row: T) => string;
  /** The name read with the row's checkbox and menu (a reference, a person's name). */
  rowLabel: (row: T) => string;
  labels: DataTableLabels;
  sort?: SortState | null;
  onSort?: (key: string, firstDir: 'asc' | 'desc') => void;
  /** Click or Enter on a row: its record; `newTab` with Ctrl/⌘ or the middle button. */
  onOpen?: (row: T, opts: { newTab: boolean }) => void;
  /** BO-035 — one box per row; absent: no selection column. */
  selection?: { selected: ReadonlySet<string>; onChange: (next: Set<string>) => void };
  /** Quick actions of a row (« ⋯ »), reachable with the keyboard and by touch, never by hover alone. */
  rowActions?: (row: T) => ReactNode;
  /** TRV-080 — reload of a content already shown: it stays in place, dimmed, under a thin progress bar. */
  reloading?: boolean;
  /** TRV-108, TRV-107 — the row just left or just arrived: briefly highlighted and focused. */
  highlightId?: string | null;
}

const INTERACTIVE = 'a,button,input,select,textarea,label,[role="menu"],[role="menuitem"]';

export function DataTable<T>({ columns, rows, rowId, rowLabel, labels, sort, onSort, onOpen, selection, rowActions, reloading, highlightId }: DataTableProps<T>) {
  const body = useRef<HTMLTableSectionElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolledX, setScrolledX] = useState(false);
  // DSN-072 — only at the first display of a page, the first six rows appear one after the other.
  const [stagger, setStagger] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setStagger(false), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!highlightId) return;
    const row = body.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(highlightId)}"]`);
    row?.focus({ preventScroll: false });
  }, [highlightId, rows]);

  const ids = rows.map(rowId);
  const selected = selection?.selected ?? new Set<string>();
  const allOnPage = ids.length > 0 && ids.every((id) => selected.has(id));
  const someOnPage = ids.some((id) => selected.has(id));

  const toggle = (id: string) => {
    if (!selection) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };
  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selected);
    if (allOnPage) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    selection.onChange(next);
  };

  const focusRow = (index: number) => {
    const nodes = body.current?.querySelectorAll<HTMLElement>('tr[data-row-id]');
    nodes?.[Math.max(0, Math.min(index, (nodes?.length ?? 1) - 1))]?.focus();
  };

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T, index: number) => {
    if (e.target !== e.currentTarget) return; // a control inside the row keeps its own keys
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusRow(index + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusRow(index - 1);
    } else if (e.key === 'Enter' && onOpen) {
      e.preventDefault();
      onOpen(row, { newTab: e.ctrlKey || e.metaKey });
    } else if (e.key === ' ' && selection) {
      e.preventDefault();
      toggle(rowId(row));
    } else if (e.key === 'Escape' && selection && selected.size > 0) {
      e.preventDefault();
      selection.onChange(new Set());
    }
  };

  const onRowClick = (e: MouseEvent<HTMLTableRowElement>, row: T) => {
    if (!onOpen) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    if (window.getSelection()?.toString()) return; // the person is selecting text
    onOpen(row, { newTab: e.ctrlKey || e.metaKey });
  };

  return (
    <div
      ref={scroller}
      data-dt-scroller=""
      className={[s.scroller, scrolledX && s.scrolledX, reloading && s.reloading].filter(Boolean).join(' ')}
      onScroll={(e) => setScrolledX(e.currentTarget.scrollLeft > 0)}
      aria-busy={reloading || undefined}
    >
      {reloading ? <span className={s.progress} aria-hidden="true" /> : null}
      <table className={s.table}>
        <caption className={s.caption}>{labels.caption}</caption>
        <colgroup>
          {selection ? <col style={{ width: '2.75rem' }} /> : null}
          {columns.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
          {rowActions ? <col style={{ width: '3.25rem' }} /> : null}
        </colgroup>
        <thead>
          <tr>
            {selection ? (
              <th scope="col" className={`${s.th} ${s.check}`}>
                <input
                  type="checkbox"
                  aria-label={labels.selectAll}
                  checked={allOnPage}
                  ref={(el) => {
                    if (el) el.indeterminate = someOnPage && !allOnPage;
                  }}
                  onChange={toggleAll}
                />
              </th>
            ) : null}
            {columns.map((c, i) => {
              const active = sort?.key === c.key ? sort.dir : null;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={[s.th, c.align === 'end' && s.end, i === 0 && s.first].filter(Boolean).join(' ')}
                  aria-sort={c.sortable ? (active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none') : undefined}
                >
                  <span className={s.thInner}>
                    {c.sortable && onSort ? (
                      <button
                        type="button"
                        className={[s.sort, active && s.sortActive].filter(Boolean).join(' ')}
                        onClick={() => onSort(c.key, c.firstDir ?? 'asc')}
                        title={active === 'asc' ? labels.sortDescending : labels.sortAscending}
                      >
                        {c.header}
                        <Icon name={active === 'desc' ? 'chevron-down' : 'chevron-up'} size={16} className={active ? s.arrow : `${s.arrow} ${s.arrowIdle}`} />
                      </button>
                    ) : (
                      c.header
                    )}
                    {c.help}
                  </span>
                </th>
              );
            })}
            {rowActions ? (
              <th scope="col" className={`${s.th} ${s.actions}`}>
                <span className="visually-hidden">{labels.actions}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody ref={body} className={stagger ? s.stagger : undefined}>
          {rows.map((row, index) => {
            const id = rowId(row);
            const isSelected = selected.has(id);
            return (
              <tr
                key={id}
                data-row-id={id}
                tabIndex={0}
                className={[s.row, onOpen && s.clickable, isSelected && s.selected, highlightId === id && s.highlight].filter(Boolean).join(' ')}
                aria-selected={selection ? isSelected : undefined}
                onClick={(e) => onRowClick(e, row)}
                onAuxClick={(e) => {
                  if (e.button === 1 && onOpen && !(e.target as HTMLElement).closest(INTERACTIVE)) onOpen(row, { newTab: true });
                }}
                onKeyDown={(e) => onRowKey(e, row, index)}
              >
                {selection ? (
                  <td className={`${s.td} ${s.check}`}>
                    <input type="checkbox" aria-label={labels.selectRow(rowLabel(row))} checked={isSelected} onChange={() => toggle(id)} />
                  </td>
                ) : null}
                {columns.map((c, i) => {
                  const text = c.text?.(row) ?? undefined;
                  const content = c.cell(row);
                  return i === 0 ? (
                    <th key={c.key} scope="row" className={[s.td, s.first, c.align === 'end' && s.end].filter(Boolean).join(' ')} title={text}>
                      <span className={s.cell}>{content}</span>
                    </th>
                  ) : (
                    <td key={c.key} className={[s.td, c.align === 'end' && s.end].filter(Boolean).join(' ')} title={text}>
                      <span className={s.cell}>{content}</span>
                    </td>
                  );
                })}
                {rowActions ? <td className={`${s.td} ${s.actions}`}>{rowActions(row)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  /** TRV-107 — each page has its address: the numbers are links (Ctrl+click opens the page in a new tab). */
  hrefFor?: (page: number) => string;
  labels: { nav: string; previous: string; next: string; page: (n: number) => string };
}

function pagesAround(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(total - 1, page + 1);
  if (from > 2) out.push('gap');
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push('gap');
  out.push(total);
  return out;
}

/** Numbered pagination with Précédent and Suivant — never an infinite scroll (TRV-107). */
export function Pagination({ page, totalPages, onPage, hrefFor, labels }: PaginationProps) {
  if (totalPages <= 1) return null;
  const item = (p: number, content: ReactNode, opts: { current?: boolean; disabled?: boolean; label: string; className?: string }) => {
    const className = [s.page, opts.current && s.pageCurrent, opts.className].filter(Boolean).join(' ');
    if (opts.disabled) {
      return (
        <span className={`${className} ${s.pageDisabled}`} aria-disabled="true" aria-label={opts.label}>
          {content}
        </span>
      );
    }
    return hrefFor ? (
      <a
        className={className}
        href={hrefFor(p)}
        aria-label={opts.label}
        aria-current={opts.current ? 'page' : undefined}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) return;
          e.preventDefault();
          onPage(p);
        }}
      >
        {content}
      </a>
    ) : (
      <button type="button" className={className} aria-label={opts.label} aria-current={opts.current ? 'page' : undefined} onClick={() => onPage(p)}>
        {content}
      </button>
    );
  };
  return (
    <nav className={s.pagination} aria-label={labels.nav}>
      {item(page - 1, <Icon name="chevron-left" size={16} />, { disabled: page <= 1, label: labels.previous, className: s.pageArrow })}
      <ol className={s.pages}>
        {pagesAround(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} className={s.gap} aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>{item(p, p, { current: p === page, label: labels.page(p) })}</li>
          ),
        )}
      </ol>
      {item(page + 1, <Icon name="chevron-right" size={16} />, { disabled: page >= totalPages, label: labels.next, className: s.pageArrow })}
    </nav>
  );
}

// ─── Footer: range, page size, pagination ───────────────────────────────────

export interface TableFooterProps extends PaginationProps {
  /** « {début}–{fin} sur {total} » (`common.list.range`), computed from the SERVER's total (TRV-106). */
  range: string;
  pageSize: number;
  pageSizes?: readonly number[];
  onPageSize: (size: number) => void;
  pageSizeLabel: string;
}

export function TableFooter({ range, pageSize, pageSizes = [25, 50, 100], onPageSize, pageSizeLabel, ...pagination }: TableFooterProps) {
  return (
    <div className={s.footer}>
      <p className={s.range} aria-live="polite">
        {range}
      </p>
      <label className={s.pageSize}>
        <span>{pageSizeLabel}</span>
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
          {pageSizes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <Pagination {...pagination} />
    </div>
  );
}

// ─── Bulk bar (DSN-072: rises from the bottom) ──────────────────────────────

export function BulkBar({ count, countLabel, clearLabel, onClear, children }: { count: number; countLabel: string; clearLabel: string; onClear: () => void; children?: ReactNode }) {
  if (count <= 0) return null;
  return (
    <div className={s.bulk} role="region" aria-label={countLabel}>
      <strong className={s.bulkCount} aria-live="polite">
        {countLabel}
      </strong>
      <div className={s.bulkActions}>{children}</div>
      <button type="button" className={s.bulkClear} onClick={onClear}>
        {clearLabel}
      </button>
    </div>
  );
}
