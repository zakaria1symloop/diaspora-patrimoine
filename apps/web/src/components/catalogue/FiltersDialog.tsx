'use client';
// EP-03, CAT-030 … CAT-036 — filters. On a computer (1024 px and more): a PANEL docked on the right; the page moves
// aside and the results stay visible beside it. On a phone: full screen. In both, the choices are a DRAFT: nothing is
// searched while the visitor is choosing; « Voir {m} biens » applies them all at once (CAT-031, D-102), and a draft
// left unapplied is kept in session storage when the window closes. Only the counter of the button and the option
// counters follow the draft (CAT-032, CAT-033): one light request, 500 ms after the last change, never twice for the
// same criteria. A minimum above its maximum is refused before anything is asked (CAT-034). Opened by ?filtres=1
// (NAV-001); « Retour » closes it.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  activeFilterCount,
  criteriaToSearch,
  type CatalogueCriteria,
  type CatalogueFacetOption,
  type CatalogueFacets,
  type CatalogueResponse,
} from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { formatMoney, formatNumber } from '@dp/i18n';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { Dropdown } from '@/components/vitrine/Dropdown';
import { announceCatalogueSearch } from './ResultsPending';
import s from './filters.module.css';

const KEY = 'dp_form_filters';
const DOCKED = '(min-width: 1024px)';
/** Wait after the last change before the counter is asked (one request for a burst of choices). */
const COUNT_DELAY = 500;

export interface FiltersDialogProps {
  criteria: CatalogueCriteria;
  facets: CatalogueFacets;
  total: number;
  monthlyEnabled: boolean;
  islamicEnabled: boolean;
  tour360Enabled: boolean;
  roomsPrefix: string;
  newDays: number;
  year: number;
}

const TYPE_ORDER = ['apartment', 'studio', 'duplex', 'villa', 'land', 'commercial'];
const TYPE_ENUM: Record<string, string> = { apartment: 'APARTMENT', studio: 'STUDIO', duplex: 'DUPLEX', villa: 'VILLA', land: 'LAND', commercial: 'COMMERCIAL' };
const STANDING_ENUM: Record<string, string> = { comfort: 'COMFORT', standing: 'STANDING', premium: 'PREMIUM' };

function strip(c: CatalogueCriteria): CatalogueCriteria {
  const n = { ...c };
  delete n.page;
  return n;
}

function same(a: CatalogueCriteria, b: CatalogueCriteria): boolean {
  return criteriaToSearch(strip(a)) === criteriaToSearch(strip(b));
}

/** CAT-034 — slider bound rounded up to the step of the amount (1 000 above 100 000), ten for a monthly amount. */
function ceilStep(v: number, monthly = false): number {
  if (monthly) return Math.ceil(v / 10) * 10;
  const step = v > 100_000 ? 1000 : v > 10_000 ? 500 : 100;
  return Math.ceil(v / step) * step;
}

/** A minimum above its maximum: the pair is refused as a whole (CAT-034), it is never sent. */
function inverted(min: number | undefined, max: number | undefined): boolean {
  return min !== undefined && max !== undefined && min > max;
}

export function FiltersDialog(p: FiltersDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const open = params.get('filtres') === '1';
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<CatalogueCriteria>(() => strip(p.criteria));
  const [live, setLive] = useState<{ total: number | null; facets: CatalogueFacets; pending: boolean; failed: boolean }>({
    total: p.total,
    facets: p.facets,
    pending: false,
    failed: false,
  });
  const [budgetMode, setBudgetMode] = useState<'monthly' | 'total'>(
    p.criteria.priceMin !== undefined || p.criteria.priceMax !== undefined || !p.monthlyEnabled ? 'total' : 'monthly',
  );
  const [promoterQuery, setPromoterQuery] = useState('');
  // CAT-030 — docked panel on a computer, full-screen window on a phone
  const [docked, setDocked] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DOCKED);
    const sync = () => setDocked(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  /** Counters already asked, by criteria: going back to a choice costs no request. */
  const counted = useRef(new Map<string, { total: number; facets: CatalogueFacets }>());
  // CAT-035 — the visitor's estimated budget (own eligibility simulation, `dp_anon`): read from the browser, since the
  // catalogue page itself is cached for everyone. x = properties within it, m = the same criteria without a budget.
  const [estimate, setEstimate] = useState<{ amount: string; currency: string; x: number; m: number } | null>(null);

  // What the page shows is already counted: opening the panel asks nothing.
  useEffect(() => {
    counted.current.set(criteriaToSearch(strip(p.criteria)), { total: p.total, facets: p.facets });
  }, [p.criteria, p.total, p.facets]);

  // Opening (and every change of the applied criteria: a chip removed, the search bar, the choices just applied):
  // the draft kept from the last visit, otherwise the applied criteria (CAT-031).
  useEffect(() => {
    if (!open) return;
    try {
      const saved = sessionStorage.getItem(KEY);
      setDraft(saved ? (JSON.parse(saved) as CatalogueCriteria) : strip(p.criteria));
    } catch {
      setDraft(strip(p.criteria));
    }
  }, [open, p.criteria]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (d.open) d.close(); // reopened in the right mode when the screen crosses 1024 px
    if (!open) return;
    if (docked) d.show();
    else d.showModal();
  }, [open, docked]);

  // Docked: the page gives the panel its place (the results stay whole beside it).
  useEffect(() => {
    const root = document.documentElement;
    if (open && docked) root.dataset.filtersDocked = '';
    else delete root.dataset.filtersDocked;
    return () => {
      delete root.dataset.filtersDocked;
    };
  }, [open, docked]);

  const priceInvalid = inverted(draft.priceMin, draft.priceMax);
  const surfaceInvalid = inverted(draft.surfaceMin, draft.surfaceMax);
  const invalid = priceInvalid || surfaceInvalid;
  const dirty = !same(draft, p.criteria);
  const draftQs = criteriaToSearch(draft);

  const close = useCallback(() => {
    try {
      if (same(draft, p.criteria)) sessionStorage.removeItem(KEY);
      else sessionStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      /* storage unavailable */
    }
    const qs = new URLSearchParams(params.toString());
    qs.delete('filtres');
    const rest = qs.toString();
    router.replace(`${pathname}${rest ? `?${rest}` : ''}`, { scroll: false });
  }, [draft, p.criteria, params, pathname, router]);

  // CAT-035 — asked for the criteria without their budget: moving the budget does not ask again.
  const noBudgetQs = useMemo(() => {
    const c: CatalogueCriteria = { ...draft };
    delete c.priceMin;
    delete c.priceMax;
    delete c.monthlyMax;
    return criteriaToSearch(c);
  }, [draft]);
  useEffect(() => {
    if (!open || surfaceInvalid) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/public/simulations/estimated-budget${noBudgetQs}`, { signal: controller.signal, credentials: 'same-origin' });
        const budget = res.ok ? ((await res.json()) as { amount: string; currency: string; matchingCount: number } | null) : null;
        if (!budget) return setEstimate(null);
        let total = counted.current.get(noBudgetQs)?.total ?? null;
        if (total === null) {
          const all = await fetch(`/api/v1/public/properties${noBudgetQs}${noBudgetQs ? '&' : '?'}perPage=1`, { signal: controller.signal });
          total = all.ok ? ((await all.json()) as CatalogueResponse).meta.total : null;
        }
        setEstimate(total === null ? null : { amount: budget.amount, currency: budget.currency, x: budget.matchingCount, m: total });
      } catch {
        if (!controller.signal.aborted) setEstimate(null);
      }
    }, COUNT_DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [noBudgetQs, open, surfaceInvalid]);

  // CAT-032 — the counter of the draft: once per criteria, after the visitor has stopped choosing, three tries
  // (TRV-115). An inverted range asks nothing.
  useEffect(() => {
    if (!open || invalid) return;
    const known = counted.current.get(draftQs);
    if (known) {
      setLive({ total: known.total, facets: known.facets, pending: false, failed: false });
      return;
    }
    const controller = new AbortController();
    setLive((l) => ({ ...l, pending: true }));
    const timer = setTimeout(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`/api/v1/public/properties${draftQs}${draftQs ? '&' : '?'}facets=1&perPage=1`, { signal: controller.signal });
          if (!res.ok) throw new Error(String(res.status));
          const body = (await res.json()) as CatalogueResponse;
          const facets = body.facets ?? p.facets;
          counted.current.set(draftQs, { total: body.meta.total, facets });
          setLive({ total: body.meta.total, facets, pending: false, failed: false });
          return;
        } catch {
          if (controller.signal.aborted) return;
          if (attempt === 2) setLive((l) => ({ ...l, total: null, pending: false, failed: true }));
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    }, COUNT_DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draftQs, open, invalid, p.facets]);

  /** The one moment a search starts: every choice of the draft goes to the address together. */
  const apply = () => {
    if (invalid) return;
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
    if (!dirty) return close();
    // Docked: the panel stays open beside the new results; on a phone the window gives way to them.
    const url = `${pathname}${draftQs}${docked ? `${draftQs ? '&' : '?'}filtres=1` : ''}`;
    announceCatalogueSearch(url);
    router.push(url, { scroll: !docked });
  };

  const toggle = (key: 'type' | 'rooms' | 'delivery' | 'standing' | 'promoter' | 'city', value: string) => {
    setDraft((d) => {
      const list = ((d[key] as string[] | undefined) ?? []).slice();
      const i = list.indexOf(value);
      if (i >= 0) list.splice(i, 1);
      else list.push(value);
      const n = { ...d } as Record<string, unknown>;
      if (list.length) n[key] = list;
      else delete n[key];
      return n as CatalogueCriteria;
    });
  };
  const setFlag = (key: 'financing' | 'islamic' | 'tour360' | 'new', on: boolean) =>
    setDraft((d) => {
      const n = { ...d };
      if (on) n[key] = true;
      else delete n[key];
      return n;
    });
  const setNum = (key: 'monthlyMax' | 'priceMin' | 'priceMax' | 'surfaceMin' | 'surfaceMax', v: number | undefined) =>
    setDraft((d) => {
      const n = { ...d };
      if (v === undefined || Number.isNaN(v)) delete n[key];
      else n[key] = v;
      if (key === 'monthlyMax' && v !== undefined) {
        delete n.priceMin;
        delete n.priceMax;
      }
      if ((key === 'priceMin' || key === 'priceMax') && v !== undefined) delete n.monthlyMax;
      return n;
    });

  const f = live.facets;
  const count = (list: CatalogueFacetOption[], v: string) => list.find((o) => o.value === v)?.count ?? 0;
  const onlyLandOrCommercial = (draft.type?.length ?? 0) > 0 && draft.type!.every((x) => x === 'land' || x === 'commercial');
  const priceMax = ceilStep(f.bounds.priceMax ?? p.facets.bounds.priceMax ?? 500_000);
  const monthlyMax = ceilStep(f.bounds.monthlyMax ?? p.facets.bounds.monthlyMax ?? 3000, true);
  const surfaceMax = Math.ceil((f.bounds.surfaceMax ?? p.facets.bounds.surfaceMax ?? 300) / 5) * 5;
  const promoters = useMemo(
    () => f.promoter.filter((o) => o.label.toLowerCase().includes(promoterQuery.trim().toLowerCase())),
    [f.promoter, promoterQuery],
  );
  const years = [p.year, p.year + 1, p.year + 2];
  const optionCount = (v: string) => f.options.find((o) => o.value === v)?.count ?? 0;
  const activeDraft = activeFilterCount(draft);

  const checkbox = (key: Parameters<typeof toggle>[0], value: string, label: string, n: number) => {
    const checked = ((draft[key] as string[] | undefined) ?? []).includes(value);
    return (
      <label key={value} className={s.check} data-disabled={!checked && n === 0 ? true : undefined}>
        <input type="checkbox" checked={checked} disabled={!checked && n === 0} onChange={() => toggle(key, value)} />
        <span className={s.checkLabel}>{label}</span>
        <span className={s.n}>{formatNumber(n)}</span>
      </label>
    );
  };

  return (
    <dialog
      ref={dialog}
      className={s.dialog}
      aria-labelledby="filtres-titre"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={(e) => {
        // a docked panel is not modal: the browser sends no « cancel » for Escape
        if (docked && e.key === 'Escape') close();
      }}
      onClick={(e) => {
        // Click on the backdrop closes only when nothing would be lost (CAT-031).
        if (e.target === dialog.current && !dirty) close();
      }}
    >
      <div className={s.frame}>
        <header className={s.header}>
          <div>
            <h2 id="filtres-titre" className={s.title}>
              {t('ui.catalogue.filters.title')}
            </h2>
            <p className={s.status} aria-live="polite">
              {invalid
                ? t('ui.catalogue.filters.fixFirst')
                : live.total === null
                  ? t('ui.catalogue.filters.countUnavailable')
                  : t('ui.catalogue.filters.status', { f: activeDraft, m: live.total })}
            </p>
          </div>
          <button type="button" className={s.close} onClick={close}>
            <Icon name="close" label={t('ui.catalogue.filters.close')} />
          </button>
        </header>

        <div className={s.body}>
          <fieldset className={s.group}>
            <legend>{t('ui.catalogue.filters.type')}</legend>
            <div className={s.checks}>
              {TYPE_ORDER.map((ty) => checkbox('type', ty, t(`ui.enum.PropertyType.${TYPE_ENUM[ty]}` as never), count(f.type, ty)))}
            </div>
          </fieldset>

          {!onlyLandOrCommercial ? (
            <fieldset className={s.group}>
              <legend>{t('ui.catalogue.filters.rooms')}</legend>
              <div className={s.pills}>
                {['1', '2', '3', '4', '5plus'].map((r) => {
                  const on = draft.rooms?.includes(r as never) ?? false;
                  const n = count(f.rooms, r);
                  return (
                    <button
                      key={r}
                      type="button"
                      className={s.pill}
                      aria-pressed={on}
                      disabled={!on && n === 0}
                      onClick={() => toggle('rooms', r)}
                    >
                      {on ? <Icon name="check" size={16} /> : null}
                      {r === '5plus'
                        ? t('ui.catalogue.filters.roomsPlus', { prefix: p.roomsPrefix })
                        : t('ui.catalogue.filters.roomsValue', { prefix: p.roomsPrefix, n: r })}
                      <span className={s.pillCount}>{formatNumber(n)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <fieldset className={s.group}>
            <legend>{t('ui.catalogue.filters.budget')}</legend>
            {p.monthlyEnabled ? (
              <div className={s.segmented} role="radiogroup">
                {(['monthly', 'total'] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={budgetMode === m} onClick={() => setBudgetMode(m)}>
                    {m === 'monthly' ? t('ui.catalogue.filters.budgetMonthly') : t('ui.catalogue.filters.budgetTotal')}
                  </button>
                ))}
              </div>
            ) : null}
            {budgetMode === 'monthly' ? (
              <div className={s.range}>
                <p className={s.rangeValue}>
                  {t('ui.catalogue.filters.monthlyUpTo', { n: formatNumber(draft.monthlyMax ?? monthlyMax) })}
                </p>
                <input
                  type="range"
                  min={0}
                  max={monthlyMax}
                  step={10}
                  value={Math.min(draft.monthlyMax ?? monthlyMax, monthlyMax)}
                  aria-label={t('ui.catalogue.filters.budgetMonthly')}
                  onChange={(e) => setNum('monthlyMax', Number(e.target.value) >= monthlyMax ? undefined : Number(e.target.value))}
                />
                {/* At its top the slider means « no limit »: the field keeps showing that top value, never an empty box. */}
                <NumField label={t('ui.catalogue.filters.max')} step={10} value={draft.monthlyMax} fallback={monthlyMax} onChange={(v) => setNum('monthlyMax', v)} />
              </div>
            ) : (
              <div className={s.range}>
                <p className={s.rangeValue}>
                  {t('ui.catalogue.filters.priceRange', { min: formatNumber(draft.priceMin ?? 0), max: formatNumber(draft.priceMax ?? priceMax) })}
                </p>
                <div className={s.numRow}>
                  <NumField label={t('ui.catalogue.filters.min')} step={1000} value={draft.priceMin} invalid={priceInvalid} describedBy="filtres-prix-erreur" onChange={(v) => setNum('priceMin', v)} />
                  <NumField label={t('ui.catalogue.filters.max')} step={1000} value={draft.priceMax} invalid={priceInvalid} describedBy="filtres-prix-erreur" onChange={(v) => setNum('priceMax', v)} />
                </div>
                {priceInvalid ? (
                  <p id="filtres-prix-erreur" className={s.rangeError} role="alert">
                    <Icon name="warning" size={16} />
                    {t('ui.catalogue.filters.priceOrder')}
                  </p>
                ) : null}
              </div>
            )}
            {estimate ? (
              <div className={s.estimate}>
                <p>
                  {t('ui.catalogue.filters.estimated', {
                    montant: formatMoney(Number(estimate.amount), estimate.currency, 'fr-FR', 0),
                    x: estimate.x,
                    m: estimate.m,
                  })}
                </p>
                <button
                  type="button"
                  className={s.estimateApply}
                  onClick={() => {
                    setBudgetMode('total');
                    setDraft((d) => ({ ...d, monthlyMax: undefined, priceMin: undefined, priceMax: Math.round(Number(estimate.amount)) }));
                  }}
                >
                  {t('ui.catalogue.filters.estimatedApply')}
                </button>
              </div>
            ) : (
              <Link href="/financements/simulateur-eligibilite" className={s.estimateLink}>
                <Icon name="calculator" size={20} />
                {t('ui.catalogue.filters.estimate')}
              </Link>
            )}
          </fieldset>

          <fieldset className={s.group}>
            <legend>{t('ui.catalogue.filters.surface')}</legend>
            <p className={s.rangeValue}>
              {t('ui.catalogue.filters.surfaceRange', { min: String(draft.surfaceMin ?? 0), max: String(draft.surfaceMax ?? surfaceMax) })}
            </p>
            <div className={s.numRow}>
              <NumField label={t('ui.catalogue.filters.min')} step={5} value={draft.surfaceMin} invalid={surfaceInvalid} describedBy="filtres-surface-erreur" onChange={(v) => setNum('surfaceMin', v)} />
              <NumField label={t('ui.catalogue.filters.max')} step={5} value={draft.surfaceMax} invalid={surfaceInvalid} describedBy="filtres-surface-erreur" onChange={(v) => setNum('surfaceMax', v)} />
            </div>
            {surfaceInvalid ? (
              <p id="filtres-surface-erreur" className={s.rangeError} role="alert">
                <Icon name="warning" size={16} />
                {t('ui.catalogue.filters.surfaceOrder')}
              </p>
            ) : null}
          </fieldset>

          <fieldset className={s.group}>
            <legend>{t('ui.catalogue.filters.location')}</legend>
            <div className={s.selectField}>
              <label id="filtres-ville-label" htmlFor="filtres-ville">
                {t('ui.catalogue.filters.region')}
              </label>
              <Dropdown
                id="filtres-ville"
                labelledBy="filtres-ville-label filtres-ville"
                value={draft.region?.length === 1 ? draft.region[0]! : ''}
                groups={[
                  {
                    options: [
                      { value: '', label: t('ui.catalogue.filters.regionAll') },
                      ...f.region.map((o) => ({ value: o.value, label: o.label, note: formatNumber(o.count), disabled: o.count === 0 })),
                    ],
                  },
                ]}
                onChange={(value) =>
                  setDraft((d) => {
                    const n = { ...d };
                    delete n.city;
                    if (value) n.region = [value];
                    else delete n.region;
                    return n;
                  })
                }
              />
            </div>
            {draft.region?.length === 1 && f.city.length > 0 ? (
              <div className={s.checks}>
                <p className={s.sub}>{t('ui.catalogue.filters.cities')}</p>
                {f.city.slice(0, 6).map((o) => checkbox('city', o.value, o.label, o.count))}
              </div>
            ) : null}
          </fieldset>

          <fieldset className={s.group}>
            <legend>{t('ui.catalogue.filters.delivery')}</legend>
            <div className={s.checks}>
              {checkbox('delivery', 'delivered', t('ui.catalogue.filters.deliveryDelivered'), count(f.delivery, 'delivered'))}
              {years.map((y) => checkbox('delivery', String(y), String(y), count(f.delivery, String(y))))}
              {checkbox('delivery', 'later', t('ui.catalogue.filters.deliveryLater', { annee: String(p.year + 3) }), count(f.delivery, 'later'))}
            </div>
          </fieldset>

          <fieldset className={s.group}>
            <legend>{t('ui.catalogue.filters.standing')}</legend>
            <div className={s.checks}>
              {(['comfort', 'standing', 'premium'] as const).map((st) =>
                checkbox('standing', st, t(`ui.enum.Standing.${STANDING_ENUM[st]}` as never), count(f.standing, st)),
              )}
            </div>
          </fieldset>

          {f.promoter.length ? (
            <fieldset className={s.group}>
              <legend>{t('ui.catalogue.filters.promoter')}</legend>
              {f.promoter.length > 8 ? (
                <input
                  type="search"
                  className={s.search}
                  placeholder={t('ui.catalogue.filters.promoterSearch')}
                  aria-label={t('ui.catalogue.filters.promoterSearch')}
                  value={promoterQuery}
                  onChange={(e) => setPromoterQuery(e.target.value)}
                />
              ) : null}
              <div className={s.checks}>{promoters.map((o) => checkbox('promoter', o.value, o.label, o.count))}</div>
            </fieldset>
          ) : null}

          <fieldset className={s.group}>
            <legend>{t('ui.catalogue.filters.options')}</legend>
            <div className={s.switches}>
              <Switch label={t('ui.catalogue.filters.optFinancing')} help={t('ui.catalogue.filters.optFinancingHelp')} checked={Boolean(draft.financing)} n={optionCount('financing')} onChange={(v) => setFlag('financing', v)} />
              {p.islamicEnabled ? (
                <Switch label={t('ui.catalogue.filters.optIslamic')} checked={Boolean(draft.islamic)} n={optionCount('islamic')} onChange={(v) => setFlag('islamic', v)} />
              ) : null}
              {p.tour360Enabled ? (
                <Switch label={t('ui.catalogue.filters.optTour360')} help={t('ui.catalogue.filters.optTour360Help')} checked={Boolean(draft.tour360)} n={optionCount('tour360')} onChange={(v) => setFlag('tour360', v)} />
              ) : null}
              <Switch label={t('ui.catalogue.filters.optNew')} help={t('ui.catalogue.filters.optNewHelp', { n: p.newDays })} checked={Boolean(draft.new)} n={optionCount('new')} onChange={(v) => setFlag('new', v)} />
              <Switch
                label={t('ui.catalogue.filters.optAll')}
                checked={draft.availability === 'all'}
                n={optionCount('availability')}
                onChange={(v) =>
                  setDraft((d) => {
                    const n = { ...d };
                    if (v) n.availability = 'all';
                    else delete n.availability;
                    return n;
                  })
                }
              />
            </div>
          </fieldset>
        </div>

        <footer className={s.footer}>
          <Button variant="tertiary" size="M" onClick={() => setDraft({ ...(p.criteria.q ? { q: p.criteria.q } : {}) })}>
            {t('ui.catalogue.filters.reset')}
          </Button>
          <div className={s.applyBox}>
            <Button variant="primary" size="L" pending={live.pending && !invalid} disabled={invalid} onClick={apply}>
              {live.total === null || invalid
                ? t('ui.catalogue.filters.showUnknown')
                : live.total === 0
                  ? t('ui.catalogue.filters.showNone')
                  : t('ui.catalogue.filters.show', { m: live.total })}
            </Button>
            {/* Nothing is searched until this button: say so while choices wait. */}
            {dirty && !invalid ? <span className={s.pendingNote}>{t('ui.catalogue.filters.pending')}</span> : null}
            {live.failed ? <span className={s.unavailable}>{t('ui.catalogue.filters.countUnavailable')}</span> : null}
          </div>
        </footer>
      </div>
    </dialog>
  );
}

/**
 * A number field that keeps what is being typed (an empty box while the visitor retypes) and, when left empty, shows
 * `fallback` — the value the absence of a limit stands for.
 */
function NumField({
  label,
  value,
  fallback,
  step,
  invalid,
  describedBy,
  onChange,
}: {
  label: string;
  value: number | undefined;
  fallback?: number;
  step: number;
  invalid?: boolean;
  describedBy?: string;
  onChange: (v: number | undefined) => void;
}) {
  const [text, setText] = useState<string | null>(null); // null: not being typed, the value shows
  const shown = text ?? (value !== undefined ? String(value) : fallback !== undefined ? String(fallback) : '');
  return (
    <label className={s.numField} data-invalid={invalid || undefined}>
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={step}
        value={shown}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? describedBy : undefined}
        onFocus={() => setText(value !== undefined ? String(value) : fallback !== undefined ? String(fallback) : '')}
        onBlur={() => setText(null)}
        onChange={(e) => {
          setText(e.target.value);
          const n = e.target.value === '' ? undefined : Number(e.target.value);
          onChange(n !== undefined && (Number.isNaN(n) || n < 0) ? undefined : n);
        }}
      />
    </label>
  );
}

function Switch({ label, help, checked, n, onChange }: { label: string; help?: string; checked: boolean; n: number; onChange: (v: boolean) => void }) {
  return (
    <label className={s.switchRow} data-disabled={!checked && n === 0 ? true : undefined}>
      <span>
        <span className={s.switchLabel}>{label}</span>
        {help ? <span className={s.switchHelp}>{help}</span> : null}
      </span>
      <span className={s.n}>{formatNumber(n)}</span>
      <input type="checkbox" role="switch" className={s.switch} checked={checked} disabled={!checked && n === 0} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
