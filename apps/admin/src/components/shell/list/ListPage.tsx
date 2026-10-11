'use client';
// BO-035, BO-040, DSN-053, DSN-054, TRV-080, TRV-100 … TRV-108 — THE list template of the back office. Every list uses
// it: the module gives its columns, its filters and its origin views; the template does the rest, the same everywhere:
//
//   · paged, sorted and filtered BY THE SERVER (TRV-100); the counters come from the answer (TRV-106);
//   · the state of the list lives in the ADDRESS (`view`, `q`, `sort`, `page`, `pageSize`, one parameter per filter):
//     copying the address gives the same view, and « Retour » goes back to the previous state (TRV-101);
//   · no page reload: a request replaces the results in place, the previous one is aborted (TRV-107), the content stays
//     dimmed under a thin progress bar (TRV-080);
//   · the list reopens as it was left — view, filters, sort, columns, page size — from the browser's local storage
//     (`dp_list_{liste}_{utilisateur}`, TRV-105); never the search text, the selection nor the page;
//   · coming back from a record gives the list exactly where it was left, the opened row highlighted (TRV-108);
//   · views: the origin views of the module and the saved views (personal, or shared by an administrator), in tabs;
//     each user chooses his default view (BO-040);
//   · « Colonnes »: which columns show, and their order, remembered per user;
//   · refreshed every 60 seconds while visible: new rows are announced (« n nouveaux éléments · Afficher »), never
//     inserted under the pointer (TRV-107).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { SavedViewConfig, SavedViewItem, SavedViewsResponse } from '@dp/contracts';
import {
  Banner,
  BulkBar,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  Icon,
  Menu,
  Modal,
  SkeletonRows,
  TableFooter,
  dateFilterBounds,
  nextSort,
  useDismiss,
  useToast,
  type DataTableColumn,
  type FilterDefinition,
  type FilterValues,
  type MenuItem,
  type SortState,
} from '@dp/ui';
import { adminCall, type CallResult } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { TextInput, formStyles as f } from '../forms';
import { PageHeader, type PageHeaderProps } from '../Page';
import { FailureDetails } from '../ReadFailure';
import { useShell } from '../ShellContext';
import s from './list.module.css';

// ─── What a module gives ────────────────────────────────────────────────────

export interface ListColumn<T> extends DataTableColumn<T> {
  /** Always shown (the first column: the reference or the name). */
  fixed?: boolean;
  /** Hidden until the user asks for it in « Colonnes ». */
  hiddenByDefault?: boolean;
}

export type ListFilter = FilterDefinition & {
  /** How the chosen values travel to the API. Default: `{ [key]: values.join(',') }`; a date filter gives its two bounds. */
  toQuery?: (values: string[], today: string) => Record<string, string | undefined>;
};

export interface OriginView {
  key: string;
  label: string;
  /** TRV-106 — given by the server; absent: no counter on the tab. */
  count?: number | null;
  /** The parameters the view sends to the API (`{ view: 'to-take' }`). */
  query: Record<string, string>;
}

export interface ListResponse<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ListPageProps<T, R extends ListResponse<T>> {
  /** Key of the list: storage (`dp_list_{listKey}_{user}`) and saved views (`SavedView.listKey`). Lower case, hyphens. */
  listKey: string;
  /** `GET` route of the list (`/admin/leads`). */
  endpoint: string;
  header: PageHeaderProps;
  columns: ListColumn<T>[];
  rowId: (row: T) => string;
  rowLabel: (row: T) => string;
  /** The record of a row: a click opens it, Ctrl + click in a new tab. Absent: rows do not open. */
  rowHref?: (row: T) => string;
  /** `key` of a sortable column and its direction; the API receives `sort=key` or `sort=-key`. */
  defaultSort: SortState;
  /** Built from the last answer, so that each option carries its server count. */
  filters?: (response: R | null) => ListFilter[];
  originViews?: (response: R | null) => OriginView[];
  /** Origin view opened when the user has no default of his own. */
  defaultView?: string;
  /** Placeholder of the list's own search field; absent: no search. */
  searchPlaceholder?: string;
  /** TRV-080 « Vide »: why it is empty, and the action to move on. */
  empty: { title: string; text?: string; actions?: ReactNode };
  rowActions?: (row: T, reload: () => void) => ReactNode;
  /** BO-035 — bulk actions: with them the selection column appears. */
  bulkActions?: (selected: string[], clear: () => void, reload: () => void) => ReactNode;
  /** Above the table (a module notice built from the answer). */
  notice?: (response: R) => ReactNode;
  /** Bump to read the list again after a write made outside the template. */
  reloadToken?: number;
  /** Called with each answer of the list (what the module needs from it: the roles one may give, the advisers…). */
  onResponse?: (response: R) => void;
  /** Saved views are offered (BO-040). Off for a list that has no filter worth keeping. */
  savedViews?: boolean;
}

// ─── State carried by the address ───────────────────────────────────────────

const RESERVED = new Set(['view', 'q', 'sort', 'page', 'pageSize']);
const PAGE_SIZES = [25, 50, 100] as const;

interface Criteria {
  /** `origin key`, or `s:{saved view id}`, or null. */
  view: string | null;
  q: string;
  sort: SortState;
  page: number;
  pageSize: number;
  filters: FilterValues;
}

const sortToParam = (sort: SortState) => (sort.dir === 'desc' ? `-${sort.key}` : sort.key);
const sortFromParam = (v: string | null | undefined, fallback: SortState): SortState => (v ? { key: v.replace(/^-/, ''), dir: v.startsWith('-') ? 'desc' : 'asc' } : fallback);

function toSearch(c: Criteria, defaults: { sort: SortState }): string {
  const p = new URLSearchParams();
  if (c.view) p.set('view', c.view);
  if (c.q) p.set('q', c.q);
  for (const [k, v] of Object.entries(c.filters)) if (v?.length) p.set(k, v.join(','));
  if (sortToParam(c.sort) !== sortToParam(defaults.sort)) p.set('sort', sortToParam(c.sort));
  if (c.page > 1) p.set('page', String(c.page));
  if (c.pageSize !== 25) p.set('pageSize', String(c.pageSize));
  return p.toString();
}

function fromSearch(params: URLSearchParams, defaults: { sort: SortState }, filterKeys: string[]): Criteria {
  const filters: FilterValues = {};
  for (const key of filterKeys) {
    const v = params.get(key);
    if (v) filters[key] = v.split(',').filter(Boolean);
  }
  const size = Number(params.get('pageSize'));
  return {
    view: params.get('view'),
    q: params.get('q') ?? '',
    sort: sortFromParam(params.get('sort'), defaults.sort),
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : 25,
    filters,
  };
}

// ─── Memory (TRV-105) and return (TRV-108) ──────────────────────────────────

interface Memory {
  view: string | null;
  filters: FilterValues;
  sort: string;
  pageSize: number;
  columns: string[] | null;
}

function readMemory(key: string): Memory | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Memory) : null;
  } catch {
    return null;
  }
}
function writeMemory(key: string, memory: Memory): void {
  try {
    localStorage.setItem(key, JSON.stringify(memory));
  } catch {
    /* storage unavailable */
  }
}

/** Results kept five minutes so that coming back is immediate, then read again in the background (TRV-108). */
const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 5 * 60_000;
const OPENED_KEY = (listKey: string) => `dp_list_open_${listKey}`;

const today = () => new Intl.DateTimeFormat('en-CA').format(new Date());

// ─── The template ───────────────────────────────────────────────────────────

export function ListPage<T, R extends ListResponse<T>>(props: ListPageProps<T, R>) {
  const { listKey, endpoint, columns, defaultSort } = props;
  const { shell, can } = useShell();
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  const memoryKey = `dp_list_${listKey}_${shell.user.id}`;
  const wrap = useRef<HTMLDivElement>(null);

  const [response, setResponse] = useState<R | null>(null);
  const [failure, setFailure] = useState<Extract<CallResult<R>, { ok: false }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<R | null>(null); // TRV-107: new rows waiting to be shown
  const [highlight, setHighlight] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<SavedViewsResponse | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [qDraft, setQDraft] = useState('');
  const [dialog, setDialog] = useState<{ kind: 'save' } | { kind: 'rename'; view: SavedViewItem } | { kind: 'delete'; view: SavedViewItem } | null>(null);

  const filterDefs = useMemo(() => props.filters?.(response) ?? [], [props.filters, response]); // eslint-disable-line react-hooks/exhaustive-deps
  const filterKeys = useMemo(() => filterDefs.map((d) => d.key).filter((k) => !RESERVED.has(k)), [filterDefs]);
  const filterKeysSignature = filterKeys.join(',');
  const origins = useMemo(() => props.originViews?.(response) ?? [], [props.originViews, response]); // eslint-disable-line react-hooks/exhaustive-deps

  const criteria = useMemo(() => fromSearch(new URLSearchParams(search), { sort: defaultSort }, filterKeys), [search, filterKeysSignature]); // eslint-disable-line react-hooks/exhaustive-deps
  const savedView = criteria.view?.startsWith('s:') ? (saved?.data.find((v) => v.id === criteria.view!.slice(2)) ?? null) : null;
  const originKey = criteria.view && !criteria.view.startsWith('s:') ? criteria.view : null;

  /** TRV-101 — a change of criteria is a new entry of the history: « Retour » goes back to the previous state. */
  const go = useCallback(
    (next: Partial<Criteria>, opts: { replace?: boolean; keepRestored?: boolean } = {}) => {
      const merged: Criteria = { ...criteria, ...next };
      if (!('page' in next)) merged.page = 1; // any change of criteria goes back to page 1
      const qs = toSearch(merged, { sort: defaultSort });
      const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
      if (opts.replace) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
      if (!opts.keepRestored) setRestored(false);
      setSelected(new Set());
    },
    [criteria, defaultSort],
  );

  // ─── Saved views (BO-040) ─────────────────────────────────────────────────
  const loadSaved = useCallback(async () => {
    if (props.savedViews === false) {
      setSaved({ data: [], defaultViewKey: null });
      return { data: [], defaultViewKey: null } as SavedViewsResponse;
    }
    const r = await adminCall<SavedViewsResponse>('/admin/saved-views', { query: { listKey } });
    const value = r.ok ? r.data : { data: [], defaultViewKey: null };
    setSaved(value);
    return value;
  }, [listKey, props.savedViews]);

  // ─── First display: the address wins; else what the browser remembers; else the user's default view ──────────────
  useEffect(() => {
    let alive = true;
    void (async () => {
      const memory = readMemory(memoryKey);
      if (memory?.columns) setColumnOrder(memory.columns);
      const savedNow = await loadSaved();
      if (!alive) return;
      const hasCriteria = new URLSearchParams(window.location.search).toString() !== '';
      if (!hasCriteria) {
        if (memory) {
          const filters = Object.fromEntries(Object.entries(memory.filters ?? {}).filter(([, v]) => v?.length));
          const view = memory.view?.startsWith('s:') && !savedNow.data.some((v) => `s:${v.id}` === memory.view) ? null : memory.view;
          go({ view: view ?? props.defaultView ?? null, filters, sort: sortFromParam(memory.sort, defaultSort), pageSize: memory.pageSize, q: '', page: 1 }, { replace: true, keepRestored: true });
          // « Filtres de votre dernière visite » — not for a named saved view, which keeps its own filters
          setRestored(Object.keys(filters).length > 0 && !view?.startsWith('s:'));
        } else {
          const def = savedNow.defaultViewKey;
          const fromSaved = def && !def.startsWith('origin:') ? savedNow.data.find((v) => v.id === def) : null;
          if (fromSaved) applySaved(fromSaved, true);
          else {
            const origin = def?.startsWith('origin:') ? def.slice(7) : (props.defaultView ?? null);
            if (origin) go({ view: origin }, { replace: true });
          }
        }
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoryKey]);

  // ─── What the API receives ────────────────────────────────────────────────
  const apiQuery = useMemo(() => {
    const q: Record<string, string> = {};
    const origin = origins.find((o) => o.key === (originKey ?? savedView?.config.filters.view?.[0]));
    Object.assign(q, origin?.query ?? (originKey && !origins.length ? { view: originKey } : {}));
    for (const def of filterDefs) {
      const values = criteria.filters[def.key];
      if (!values?.length) continue;
      if (def.toQuery) {
        for (const [k, v] of Object.entries(def.toQuery(values, today()))) if (v) q[k] = v;
      } else if (def.kind === 'date') {
        const b = dateFilterBounds(values, today());
        if (b.from) q[`${def.key}From`] = b.from;
        if (b.to) q[`${def.key}To`] = b.to;
      } else q[def.key] = values.join(',');
    }
    if (criteria.q.trim().length >= 2) q.q = criteria.q.trim();
    q.sort = sortToParam(criteria.sort);
    q.page = String(criteria.page);
    q.pageSize = String(criteria.pageSize);
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, originKey, savedView?.id, filterKeysSignature, origins.length]);
  const apiKey = `${listKey}?${new URLSearchParams(apiQuery).toString()}`;

  // ─── Reading: one useful request (TRV-107) ────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const hit = cache.get(apiKey);
    if (hit && Date.now() - hit.at < CACHE_MS) setResponse(hit.data as R);
    setLoading(true);
    setPending(null);
    void adminCall<R>(endpoint, { query: apiQuery, signal: controller.signal }).then((r) => {
      if (controller.signal.aborted || (!r.ok && r.aborted)) return;
      setLoading(false);
      if (r.ok) {
        cache.set(apiKey, { at: Date.now(), data: r.data });
        setResponse(r.data);
        setFailure(null);
        props.onResponse?.(r.data);
      } else setFailure(r);
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, ready, reloadTick, props.reloadToken]);

  // TRV-107 — every 60 s and on return to the tab: rows already shown are updated in place; new ones are announced.
  useEffect(() => {
    if (!ready) return;
    const tick = async () => {
      if (document.visibilityState !== 'visible' || loading || selected.size > 0) return;
      const r = await adminCall<R>(endpoint, { query: apiQuery });
      if (!r.ok) return;
      setResponse((current) => {
        if (!current) return r.data;
        const known = new Set(current.data.map(props.rowId));
        const fresh = r.data.data.filter((row) => !known.has(props.rowId(row)));
        if (criteria.page === 1 && fresh.length > 0) {
          setPending(r.data);
          return current;
        }
        cache.set(apiKey, { at: Date.now(), data: r.data });
        return r.data;
      });
    };
    const timer = setInterval(() => void tick(), 60_000);
    const onVisible = () => void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, ready, loading, selected.size]);

  // ─── Memory (TRV-105): view, filters, sort, columns, page size — never the search, the selection, the page ───────
  useEffect(() => {
    if (!ready) return;
    writeMemory(memoryKey, { view: criteria.view, filters: criteria.filters, sort: sortToParam(criteria.sort), pageSize: criteria.pageSize, columns: columnOrder });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, columnOrder, ready]);

  // ─── Return to the list (TRV-108): same place, the opened row highlighted and focused ──────────────────────────────
  useEffect(() => {
    if (!response) return;
    try {
      const raw = sessionStorage.getItem(OPENED_KEY(listKey));
      if (!raw) return;
      const opened = JSON.parse(raw) as { id: string; search: string; top: number };
      if (opened.search !== search) return;
      sessionStorage.removeItem(OPENED_KEY(listKey));
      requestAnimationFrame(() => {
        const scroller = wrap.current?.querySelector<HTMLElement>('[data-dt-scroller]');
        if (scroller) scroller.scrollTop = opened.top;
        setHighlight(opened.id);
      });
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response !== null]);

  // The list's own search: results follow the typing, 300 ms after the last key (TRV-103).
  useEffect(() => setQDraft(criteria.q), [criteria.q]);
  useEffect(() => {
    if (qDraft === criteria.q) return;
    const timer = setTimeout(() => go({ q: qDraft }, { replace: true }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDraft]);

  const reload = useCallback(() => {
    cache.delete(apiKey);
    setReloadTick((n) => n + 1);
  }, [apiKey]);

  // ─── Columns (« Colonnes », TRV-105) ──────────────────────────────────────
  const order = useMemo(() => {
    const all = columns.map((c) => c.key);
    const base = savedView?.config.columns ?? columnOrder;
    if (!base) return columns.filter((c) => !c.hiddenByDefault).map((c) => c.key);
    const shown = base.filter((k) => all.includes(k));
    for (const c of columns) if (c.fixed && !shown.includes(c.key)) shown.unshift(c.key);
    return shown;
  }, [columns, columnOrder, savedView?.id, savedView?.config.columns]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = order.map((k) => columns.find((c) => c.key === k)!).filter(Boolean);

  // ─── Views ────────────────────────────────────────────────────────────────
  function applySaved(view: SavedViewItem, replace = false) {
    const { view: _origin, ...filters } = view.config.filters;
    void _origin;
    if (view.config.columns) setColumnOrder(view.config.columns);
    go({ view: `s:${view.id}`, filters, sort: sortFromParam(view.config.sort, defaultSort), pageSize: view.config.pageSize, q: '', page: 1 }, { replace });
  }
  const currentConfig = (): SavedViewConfig => ({
    filters: { ...Object.fromEntries(Object.entries(criteria.filters).filter(([, v]) => v?.length)), ...(originKey ? { view: [originKey] } : savedView?.config.filters.view ? { view: savedView.config.filters.view } : {}) } as Record<string, string[]>,
    sort: sortToParam(criteria.sort),
    columns: order,
    pageSize: criteria.pageSize as 25 | 50 | 100,
  });
  const activeViewKey = savedView ? savedView.id : originKey ? `origin:${originKey}` : null;
  const isDefault = saved?.defaultViewKey ? saved.defaultViewKey === activeViewKey : originKey !== null && originKey === props.defaultView;

  const viewActions: MenuItem[] = [];
  if (props.savedViews !== false) {
    viewActions.push({ key: 'save', label: t('ui.admin-shell.list.views.saveAs'), icon: 'plus', onSelect: () => setDialog({ kind: 'save' }) });
    if (savedView?.editable) {
      viewActions.push({
        key: 'update',
        label: t('ui.admin-shell.list.views.update'),
        icon: 'check',
        onSelect: async () => {
          const r = await adminCall<SavedViewItem>(`/admin/saved-views/${savedView.id}`, { method: 'PATCH', body: { config: currentConfig() } });
          if (r.ok) {
            toast({ text: t('ui.admin-shell.list.views.updated') });
            void loadSaved();
          } else toast({ tone: 'error', text: errorText(r) });
        },
      });
      viewActions.push({ key: 'rename', label: t('ui.admin-shell.list.views.rename'), icon: 'edit', onSelect: () => setDialog({ kind: 'rename', view: savedView }) });
    }
    if (savedView && can('view.share') && (savedView.mine || savedView.shared)) {
      viewActions.push({
        key: 'share',
        label: savedView.shared ? t('ui.admin-shell.list.views.unshare') : t('ui.admin-shell.list.views.share'),
        icon: 'partners',
        onSelect: async () => {
          const r = await adminCall<SavedViewItem>(`/admin/saved-views/${savedView.id}/share`, { body: { shared: !savedView.shared } });
          if (r.ok) {
            toast({ text: savedView.shared ? t('ui.admin-shell.list.views.unshared') : t('ui.admin-shell.list.views.shared') });
            void loadSaved();
          } else toast({ tone: 'error', text: errorText(r) });
        },
      });
    }
    if (activeViewKey && !isDefault) {
      viewActions.push({
        key: 'default',
        label: t('ui.admin-shell.list.views.makeDefault'),
        icon: 'star',
        onSelect: async () => {
          const r = await adminCall<{ defaultViewKey: string | null }>('/admin/saved-views/default', { method: 'PUT', body: { listKey, viewKey: activeViewKey } });
          if (r.ok) {
            setSaved((v) => (v ? { ...v, defaultViewKey: r.data.defaultViewKey } : v));
            toast({ text: t('ui.admin-shell.list.views.defaultSet') });
          } else toast({ tone: 'error', text: errorText(r) });
        },
      });
    }
    if (savedView?.editable) viewActions.push({ key: 'delete', label: t('ui.admin-shell.list.views.delete'), icon: 'trash', danger: true, separated: true, onSelect: () => setDialog({ kind: 'delete', view: savedView }) });
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  const meta = response?.meta;
  const anyFilter = Object.values(criteria.filters).some((v) => v?.length) || criteria.q.trim().length >= 2;
  const range = meta && meta.total > 0 ? t('ui.common.list.range', { debut: (meta.page - 1) * meta.pageSize + 1, fin: Math.min(meta.total, meta.page * meta.pageSize), total: meta.total }) : null;
  const hrefFor = (page: number) => {
    const qs = toSearch({ ...criteria, page }, { sort: defaultSort });
    return `${typeof window === 'undefined' ? '' : window.location.pathname}${qs ? `?${qs}` : ''}`;
  };
  const open = (row: T, opts: { newTab: boolean }) => {
    const href = props.rowHref?.(row);
    if (!href) return;
    if (opts.newTab) return void window.open(href, '_blank', 'noopener');
    try {
      const scroller = wrap.current?.querySelector<HTMLElement>('[data-dt-scroller]');
      sessionStorage.setItem(OPENED_KEY(listKey), JSON.stringify({ id: props.rowId(row), search, top: scroller?.scrollTop ?? 0 }));
    } catch {
      /* storage unavailable */
    }
    router.push(href);
  };
  const showPending = () => {
    if (!pending || !response) return;
    const known = new Set(response.data.map(props.rowId));
    const first = pending.data.find((row) => !known.has(props.rowId(row)));
    cache.set(apiKey, { at: Date.now(), data: pending });
    setResponse(pending);
    setPending(null);
    setHighlight(first ? props.rowId(first) : null);
  };
  const newCount = pending && response ? pending.data.filter((row) => !response.data.some((r) => props.rowId(r) === props.rowId(row))).length : 0;

  const tabs = origins.length > 0 || (saved?.data.length ?? 0) > 0;
  return (
    <div className={s.page} ref={wrap}>
      <PageHeader {...props.header} />
      {response && props.notice ? props.notice(response) : null}
      <div className={s.card}>
        {tabs || viewActions.length ? (
          <div className={s.views}>
            <div className={s.tabs} role="tablist" aria-label={t('ui.admin-shell.list.views.label')}>
              {origins.map((o) => (
                <button key={o.key} type="button" role="tab" aria-selected={originKey === o.key} className={[s.tab, originKey === o.key && s.tabActive].filter(Boolean).join(' ')} onClick={() => go({ view: o.key, filters: {}, sort: defaultSort, q: '' })}>
                  {o.label}
                  {typeof o.count === 'number' ? <span className={s.tabCount}>{o.count}</span> : null}
                </button>
              ))}
              {saved?.data.map((v) => (
                <button key={v.id} type="button" role="tab" aria-selected={savedView?.id === v.id} className={[s.tab, savedView?.id === v.id && s.tabActive].filter(Boolean).join(' ')} onClick={() => applySaved(v)} title={v.ownerName ? t('ui.admin-shell.list.views.sharedBy', { nom: v.ownerName }) : undefined}>
                  {v.shared ? <Icon name="partners" size={16} label={t('ui.admin-shell.list.views.sharedTag')} /> : null}
                  {v.name}
                </button>
              ))}
            </div>
            {viewActions.length ? (
              <Menu
                label={t('ui.admin-shell.list.views.actions')}
                triggerClassName={s.viewMenu}
                trigger={
                  <>
                    {t('ui.admin-shell.list.views.menu')}
                    <Icon name="chevron-down" size={16} />
                  </>
                }
                items={viewActions}
              />
            ) : null}
          </div>
        ) : null}

        <FilterBar
          filters={filterDefs}
          values={criteria.filters}
          onChange={(filters) => go({ filters })}
          search={
            props.searchPlaceholder ? (
              <label className={s.search}>
                <Icon name="search" size={16} />
                <span className="visually-hidden">{props.searchPlaceholder}</span>
                <input type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder={props.searchPlaceholder} autoComplete="off" spellCheck={false} />
              </label>
            ) : undefined
          }
          labels={{
            clearAll: t('ui.common.clearAll'),
            moreFilters: t('ui.common.list.moreFilters'),
            remove: (name) => t('ui.admin-shell.list.removeFilter', { filtre: name }),
            searchInList: t('ui.common.search'),
            noOption: t('ui.admin-shell.list.noOption'),
            datePresets: { today: t('ui.admin-shell.list.date.today'), last7: t('ui.admin-shell.list.date.last7'), month: t('ui.admin-shell.list.date.month') },
            between: t('ui.admin-shell.list.date.between'),
            from: t('ui.admin-shell.list.date.from'),
            to: t('ui.admin-shell.list.date.to'),
            formatDay: shortDay,
            dateRange: (from, to) => (from && to ? t('ui.admin-shell.list.date.range', { debut: from, fin: to }) : from ? t('ui.admin-shell.list.date.since', { debut: from }) : to ? t('ui.admin-shell.list.date.until', { fin: to }) : ''),
          }}
        >
          <ColumnsButton columns={columns} order={order} onChange={setColumnOrder} />
        </FilterBar>

        {restored ? (
          <p className={s.restored} role="status">
            <Icon name="clock" size={16} />
            {t('ui.common.list.restored')}
            <button type="button" className={f.link} onClick={() => go({ filters: {} })}>
              {t('ui.common.clearAll')}
            </button>
          </p>
        ) : null}
        {newCount > 0 ? (
          <button type="button" className={s.newItems} onClick={showPending}>
            {t('ui.common.list.newItems', { n: newCount })}
          </button>
        ) : null}
        {range ? (
          <p className={s.rangeTop} aria-hidden="true">
            {range}
          </p>
        ) : null}

        {failure && !response ? (
          <div className={s.state}>
            <Banner
              tone="error"
              action={
                <Button variant="secondary" size="S" onClick={reload}>
                  {t('ui.common.retry')}
                </Button>
              }
            >
              <p>{t('ui.common.error.block')}</p>
              <p>{errorText(failure)}</p>
              <FailureDetails failure={failure} />
            </Banner>
          </div>
        ) : !response ? (
          <SkeletonRows rows={8} columns={Math.min(6, visible.length)} label={t('ui.common.loading')} />
        ) : meta!.total === 0 ? (
          <div className={s.state}>
            {anyFilter ? (
              // TRV-104 — a filtered list without result shows its active filters (the chips above) and offers to clear them
              <EmptyState
                icon="search"
                title={t('ui.common.empty.filtered')}
                actions={
                  <Button variant="secondary" size="S" onClick={() => go({ filters: {}, q: '' })}>
                    {t('ui.admin-shell.list.clearFilters')}
                  </Button>
                }
              />
            ) : (
              <EmptyState title={props.empty.title} text={props.empty.text} actions={props.empty.actions} />
            )}
          </div>
        ) : (
          <>
            {failure ? (
              <Banner tone="error" action={<Button variant="secondary" size="S" onClick={reload}>{t('ui.common.retry')}</Button>}>
                {errorText(failure)}
              </Banner>
            ) : null}
            <DataTable<T>
              columns={visible}
              rows={response.data}
              rowId={props.rowId}
              rowLabel={props.rowLabel}
              sort={criteria.sort}
              onSort={(key, firstDir) => go({ sort: nextSort(criteria.sort, key, defaultSort, firstDir) ?? defaultSort })}
              onOpen={props.rowHref ? open : undefined}
              selection={props.bulkActions ? { selected, onChange: setSelected } : undefined}
              rowActions={props.rowActions ? (row) => props.rowActions!(row, reload) : undefined}
              reloading={loading}
              highlightId={highlight}
              labels={{
                caption: props.header.title,
                sortAscending: t('ui.admin-shell.list.sortAsc'),
                sortDescending: t('ui.admin-shell.list.sortDesc'),
                selectAll: t('ui.admin-shell.list.selectAll'),
                selectRow: (name) => t('ui.admin-shell.list.selectRow', { nom: name }),
                actions: t('ui.admin-shell.list.actions'),
              }}
            />
            {props.bulkActions ? (
              <BulkBar count={selected.size} countLabel={t('ui.common.list.selected', { n: selected.size })} clearLabel={t('ui.common.list.unselectAll')} onClear={() => setSelected(new Set())}>
                {props.bulkActions([...selected], () => setSelected(new Set()), reload)}
              </BulkBar>
            ) : null}
            <TableFooter
              range={range ?? ''}
              page={meta!.page}
              totalPages={meta!.totalPages}
              pageSize={criteria.pageSize}
              pageSizeLabel={t('ui.common.list.pageSize')}
              onPageSize={(pageSize) => go({ pageSize })}
              onPage={(page) => {
                go({ page });
                // TRV-107 — a change of page goes back to the top of the results
                wrap.current?.querySelector<HTMLElement>('[data-dt-scroller]')?.scrollTo({ top: 0 });
              }}
              hrefFor={hrefFor}
              labels={{ nav: t('ui.admin-shell.list.pagination'), previous: t('ui.admin-shell.list.previous'), next: t('ui.admin-shell.list.next'), page: (n) => t('ui.admin-shell.list.page', { n }) }}
            />
          </>
        )}
      </div>

      <ViewDialogs
        dialog={dialog}
        close={() => setDialog(null)}
        listKey={listKey}
        config={currentConfig}
        onSaved={(view) => {
          void loadSaved().then(() => go({ view: `s:${view.id}` }, { replace: true }));
          toast({ text: t('ui.admin-shell.list.views.savedToast') });
        }}
        onRenamed={() => void loadSaved()}
        onDeleted={() => {
          void loadSaved();
          go({ view: props.defaultView ?? null, filters: {} });
          toast({ text: t('ui.admin-shell.list.views.deleted') });
        }}
      />
    </div>
  );
}

// ─── « Colonnes » ───────────────────────────────────────────────────────────

function ColumnsButton<T>({ columns, order, onChange }: { columns: ListColumn<T>[]; order: string[]; onChange: (order: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback((restore: boolean) => {
    setOpen(false);
    if (restore) button.current?.focus();
  }, []);
  useDismiss(open, close, [wrap]);
  if (columns.filter((c) => !c.fixed).length < 2) return null;
  // shown columns in their order, then the hidden ones
  const rows = [...order.map((k) => columns.find((c) => c.key === k)!).filter(Boolean), ...columns.filter((c) => !order.includes(c.key))];
  const move = (key: string, delta: number) => {
    const i = order.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length || columns.find((c) => c.key === order[j])?.fixed) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <span className={s.columnsWrap} ref={wrap}>
      <button ref={button} type="button" className={s.toolButton} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="sliders" size={16} />
        {t('ui.admin-shell.list.columns.label')}
      </button>
      {open ? (
        <div className={s.columnsPanel} role="dialog" aria-label={t('ui.admin-shell.list.columns.label')}>
          <p className={s.columnsHint}>{t('ui.admin-shell.list.columns.hint')}</p>
          <ul role="list" className={s.columnsList}>
            {rows.map((c) => {
              const shown = order.includes(c.key);
              const at = order.indexOf(c.key);
              return (
                <li key={c.key} className={s.columnRow}>
                  <label>
                    <input type="checkbox" checked={shown} disabled={c.fixed} onChange={() => onChange(shown ? order.filter((k) => k !== c.key) : [...order, c.key])} />
                    <span>{c.header}</span>
                  </label>
                  {shown && !c.fixed ? (
                    <span className={s.columnMoves}>
                      <button type="button" onClick={() => move(c.key, -1)} disabled={at <= 0 || Boolean(columns.find((x) => x.key === order[at - 1])?.fixed)} aria-label={t('ui.admin-shell.list.columns.up', { colonne: c.header })}>
                        <Icon name="chevron-up" size={16} />
                      </button>
                      <button type="button" onClick={() => move(c.key, 1)} disabled={at === order.length - 1} aria-label={t('ui.admin-shell.list.columns.down', { colonne: c.header })}>
                        <Icon name="chevron-down" size={16} />
                      </button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </span>
  );
}

// ─── Windows of the views ───────────────────────────────────────────────────

function ViewDialogs({
  dialog,
  close,
  listKey,
  config,
  onSaved,
  onRenamed,
  onDeleted,
}: {
  dialog: { kind: 'save' } | { kind: 'rename'; view: SavedViewItem } | { kind: 'delete'; view: SavedViewItem } | null;
  close: () => void;
  listKey: string;
  config: () => SavedViewConfig;
  onSaved: (view: SavedViewItem) => void;
  onRenamed: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setName(dialog?.kind === 'rename' ? dialog.view.name : '');
    setError(null);
    setBanner(null);
  }, [dialog]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dialog) return;
    if (dialog.kind !== 'delete' && !name.trim()) return setError(t('ui.validation.REQUIRED'));
    setPending(true);
    setError(null);
    setBanner(null);
    const r =
      dialog.kind === 'save'
        ? await adminCall<SavedViewItem>('/admin/saved-views', { body: { listKey, name, config: config() } })
        : dialog.kind === 'rename'
          ? await adminCall<SavedViewItem>(`/admin/saved-views/${dialog.view.id}`, { method: 'PATCH', body: { name } })
          : await adminCall<null>(`/admin/saved-views/${dialog.view.id}`, { method: 'DELETE' });
    setPending(false);
    if (!r.ok) {
      const fields = fieldErrors(r.error);
      if (fields.name) return setError(r.error?.details.some((d) => d.code === 'ALREADY_USED') ? t('ui.admin-shell.list.views.nameTaken') : fields.name);
      return setBanner(errorText(r));
    }
    close();
    if (dialog.kind === 'save') onSaved(r.data as SavedViewItem);
    else if (dialog.kind === 'rename') onRenamed();
    else onDeleted();
  }

  const title = dialog?.kind === 'save' ? t('ui.admin-shell.list.views.saveAs') : dialog?.kind === 'rename' ? t('ui.admin-shell.list.views.rename') : t('ui.admin-shell.list.views.delete');
  return (
    <Modal open={dialog !== null} onClose={close} title={title} closeLabel={t('ui.common.close')}>
      <form className={f.form} onSubmit={submit} noValidate>
        {banner ? <Banner tone="error">{banner}</Banner> : null}
        {dialog?.kind === 'delete' ? (
          // TRV-095 — the confirmation names the object
          <p>{t('ui.admin-shell.list.views.deleteConfirm', { nom: dialog.view.name })}</p>
        ) : (
          <TextInput label={t('ui.admin-shell.list.views.name')} hint={dialog?.kind === 'save' ? t('ui.admin-shell.list.views.nameHint') : undefined} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} error={error} autoFocus />
        )}
        <div className={`${f.actions} ${f.actionsEnd}`}>
          <Button variant="secondary" size="M" onClick={close}>
            {t('ui.common.cancel')}
          </Button>
          <Button type="submit" variant={dialog?.kind === 'delete' ? 'danger' : 'tool'} size="M" pending={pending}>
            {dialog?.kind === 'delete' ? t('ui.common.delete') : t('ui.common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
