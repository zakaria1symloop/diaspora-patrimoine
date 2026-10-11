'use client';
// EC-40 « Mes simulations » (SFA-010 … SFA-013): saved simulations and projections sent by the advisor. Each card LEADS
// with its result as computed (D-098: important data first) — type, name, date, the property — and offers one main
// action, « Ouvrir »: the result opens in a panel on the right that leaves the list visible (D-098), with « Calculée
// le {date}, avec les barèmes et les taux de ce jour-là. » and the other actions (Refaire avec les barèmes actuels,
// Télécharger, En parler à mon conseiller). Renaming happens in place, on the card; deleting keeps its short
// confirmation. A projection is neither renamed nor deleted. The list is bounded (30, SFA-012): filter by type with
// counters, search and sort happen here, their state in the address (`type`, `tri`, `q`, `ouvrir` — TRV-101).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ClientSimulationDetail, ClientSimulationItem, ClientSimulationList, ClientSimulationType, Money } from '@dp/contracts';
import { Button, ButtonInner, Icon, buttonClass, type IconName } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import { EmptyState } from '@/components/client-space/EmptyState';
import { useOptionalSpace } from '@/components/client-space/SpaceContext';
import { writeToAdvisorHref } from '@/components/client-space/advisor-link';
import { Encouragement } from '@/components/client-space/kit/Encouragement';
import { FilterChips, matches, NoMatch, ResultLine, SearchBox, SortSelect, Toolbar, useListState } from '@/components/client-space/kit/ListControls';
import { SidePanel } from '@/components/client-space/kit/SidePanel';
import k from '@/components/client-space/kit/kit.module.css';
import space from '@/components/client-space/space.module.css';
import { Modal } from './Modal';
import { amount, durationLabel, isoDay, longDate, rateLabel } from './format';
import s from './tools.module.css';

const SIMULATOR = { ELIGIBILITY: '/financements/simulateur-eligibilite', CREDIT: '/financements/simulateur-credit', PROJECTION: '/financements/simulateur-credit' } as const;
const TYPE_ICON: Record<ClientSimulationType, IconName> = { ELIGIBILITY: 'badge', CREDIT: 'calculator', PROJECTION: 'sparkles' };
const TYPES: ClientSimulationType[] = ['ELIGIBILITY', 'CREDIT', 'PROJECTION'];
const TYPE_PARAM: Record<ClientSimulationType, string> = { ELIGIBILITY: 'eligibilite', CREDIT: 'credit', PROJECTION: 'projection' };

export function headlineText(item: ClientSimulationItem): { main: string; sub: string | null } | null {
  const h = item.headline;
  if (!h) return null;
  if (h.kind === 'NOT_ELIGIBLE') return { main: t('ui.clientTools.simulations.headline.NOT_ELIGIBLE'), sub: null };
  if (h.kind === 'MONTHLY') {
    return {
      main: t('ui.clientTools.simulations.headline.MONTHLY', { montant: amount(h.amount, true, h.converted), duree: durationLabel(h.durationMonths) }),
      sub: h.principal && h.annualRateBps !== null ? t('ui.clientTools.simulations.headline.MONTHLY_DETAIL', { capital: amount(h.principal), taux: rateLabel(h.annualRateBps) }) : null,
    };
  }
  return { main: t(`ui.clientTools.simulations.headline.${h.kind}`, { montant: amount(h.amount, false, h.converted) }), sub: null };
}

function nameOf(item: ClientSimulationItem, tz: string): string {
  return item.label ?? t('ui.clientTools.simulations.untitled', { date: longDate(item.createdAt, tz) });
}

export function SimulationsList({ initial }: { initial: ClientSimulationList }) {
  const [items, setItems] = useState(initial.data);
  const tz = useOptionalSpace()?.summary.timeZone ?? 'Europe/Paris';
  const [deleting, setDeleting] = useState<ClientSimulationItem | null>(null);
  const list = useListState({ tri: 'recent' });
  useEffect(() => setItems(initial.data), [initial.data]);
  const saved = items.filter((i) => i.type !== 'PROJECTION').length;

  const type = list.get('type');
  const sort = list.get('tri');
  const q = list.get('q');
  const openId = list.get('ouvrir');
  const opened = items.find((i) => i.id === openId) ?? null;

  if (!items.length) {
    return (
      <EmptyState
        icon="calculator"
        title={t('ui.clientTools.simulations.empty')}
        text={t('ui.clientTools.simulations.emptyText')}
        actions={
          <>
            <Link href={SIMULATOR.ELIGIBILITY} className={buttonClass('tool', 'L')}>
              <ButtonInner size="L">{t('ui.clientTools.simulations.testEligibility')}</ButtonInner>
            </Link>
            <Link href={SIMULATOR.CREDIT} className={buttonClass('secondary', 'L')}>
              <ButtonInner size="L">{t('ui.clientTools.simulations.computeMonthly')}</ButtonInner>
            </Link>
          </>
        }
      />
    );
  }

  let shown = items.filter((i) => (!type || TYPE_PARAM[i.type] === type) && matches([nameOf(i, tz), i.property?.title, headlineText(i)?.main], q));
  if (sort === 'ancien') shown = [...shown].reverse();
  if (sort === 'nom') shown = [...shown].sort((a, b) => nameOf(a, tz).localeCompare(nameOf(b, tz), 'fr'));
  const filtered = list.active(['type', 'q']);
  const clear = () => list.clear(['type', 'q']);
  const present = TYPES.filter((ty) => items.some((i) => i.type === ty));

  // D-098 — the page leads with what the person came to remember: the latest estimate (never presented as a price or
  // an offer: « estimé », and the legal mention stays in the result).
  const latestBudget = items.find((i) => i.headline?.kind === 'BUDGET');
  const latestMonthly = items.find((i) => i.headline?.kind === 'MONTHLY');
  const lead = latestBudget ?? latestMonthly ?? null;

  return (
    <div className={s.stack}>
      {lead && lead.headline?.kind === 'BUDGET' ? (
        <Encouragement
          tone="progress"
          icon="coins"
          title={t('ui.clientTools.simulations.encourage.budget.title', { montant: amount(lead.headline.amount, false, lead.headline.converted) })}
          text={t('ui.clientTools.simulations.encourage.budget.text', { date: longDate(lead.createdAt, tz) })}
          actions={
            <>
              {!lead.headline.converted ? (
                <Link href={`/programmes?priceMax=${Math.round(Number(lead.headline.amount.amount))}`} className={buttonClass('tool', 'M')}>
                  <ButtonInner size="M" chevron>
                    {t('ui.clientTools.simulations.encourage.budget.action')}
                  </ButtonInner>
                </Link>
              ) : null}
              <Link href={writeToAdvisorHref({ from: 'SIMULATION', date: isoDay(lead.createdAt, tz) })} className={buttonClass('secondary', 'M')}>
                <ButtonInner size="M" icon="chat">
                  {t('ui.clientTools.simulations.encourage.budget.advisor')}
                </ButtonInner>
              </Link>
            </>
          }
        />
      ) : lead && lead.headline?.kind === 'MONTHLY' ? (
        <Encouragement
          tone="calm"
          icon="calculator"
          title={t('ui.clientTools.simulations.encourage.monthly.title', { montant: amount(lead.headline.amount, true, lead.headline.converted) })}
          text={t('ui.clientTools.simulations.encourage.monthly.text', { date: longDate(lead.createdAt, tz) })}
          actions={
            <Link href={writeToAdvisorHref({ from: 'SIMULATION', date: isoDay(lead.createdAt, tz) })} className={buttonClass('secondary', 'M')}>
              <ButtonInner size="M" icon="chat">
                {t('ui.clientTools.simulations.encourage.monthly.action')}
              </ButtonInner>
            </Link>
          }
        />
      ) : null}

      {items.length > 1 ? (
        <Toolbar
          end={
            <>
              {items.length > 4 ? <SearchBox label={t('ui.clientTools.simulations.search')} value={q} onChange={(v) => list.set({ q: v })} /> : null}
              <SortSelect
                value={sort}
                onChange={(v) => list.set({ tri: v }, { push: true })}
                options={[
                  { value: 'recent', label: t('ui.clientTools.simulations.sort.recent') },
                  { value: 'ancien', label: t('ui.clientTools.simulations.sort.old') },
                  { value: 'nom', label: t('ui.clientTools.simulations.sort.name') },
                ]}
              />
            </>
          }
        >
          {present.length > 1 ? (
            <FilterChips
              label={t('ui.clientTools.simulations.filter.label')}
              value={type}
              onChange={(v) => list.set({ type: v }, { push: true })}
              options={[{ value: '', label: t('ui.clientTools.simulations.filter.all'), count: items.length }, ...present.map((ty) => ({ value: TYPE_PARAM[ty], label: t(`ui.clientTools.simulations.filter.${ty}`), count: items.filter((i) => i.type === ty).length }))]}
            />
          ) : null}
        </Toolbar>
      ) : null}
      <ResultLine shown={shown.length} total={items.length} filtered={filtered} onClear={clear}>
        {!filtered ? <span>{t('ui.clientTools.simulations.count', { n: saved, max: initial.max })}</span> : null}
        {saved >= initial.max ? <span className={s.error}>{t('ui.clientTools.simulations.limit')}</span> : null}
      </ResultLine>

      {shown.length === 0 ? (
        <NoMatch onClear={clear} />
      ) : (
        <ul className={s.cards}>
          {shown.map((item, i) => (
            <SimulationCard
              key={item.id}
              item={item}
              index={i}
              tz={tz}
              open={item.id === openId}
              onOpen={() => list.set({ ouvrir: item.id === openId ? null : item.id }, { push: true })}
              onRenamed={(updated) => setItems((l) => l.map((x) => (x.id === updated.id ? updated : x)))}
              onDelete={() => setDeleting(item)}
            />
          ))}
        </ul>
      )}

      <SidePanel open={Boolean(opened)} onClose={() => list.set({ ouvrir: null }, { push: true })} title={opened ? nameOf(opened, tz) : ''} eyebrow={opened ? t(`ui.clientTools.simulations.type.${opened.type}`) : undefined}>
        {opened ? <Detail key={opened.id} item={opened} tz={tz} /> : null}
      </SidePanel>

      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title={t('ui.clientTools.simulations.delete.title')} closeLabel={t('ui.clientTools.simulations.actions.close')}>
        {deleting ? (
          <ConfirmDelete
            onCancel={() => setDeleting(null)}
            onConfirm={async () => {
              const r = await apiCall(`/client/simulations/${deleting.id}`, { method: 'DELETE', retryOnAuth: true });
              if (!r.ok) return false;
              setItems((l) => l.filter((x) => x.id !== deleting.id));
              if (deleting.id === openId) list.set({ ouvrir: null });
              setDeleting(null);
              showToast({ message: t('ui.clientTools.simulations.delete.done'), tone: 'success' });
              return true;
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function SimulationCard({
  item,
  index,
  tz,
  open,
  onOpen,
  onRenamed,
  onDelete,
}: {
  item: ClientSimulationItem;
  index: number;
  tz: string;
  open: boolean;
  onOpen: () => void;
  onRenamed: (i: ClientSimulationItem) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const h = headlineText(item);
  const name = nameOf(item, tz);
  return (
    <li className={[s.sim, k.enter, open && s.simOpen].filter(Boolean).join(' ')} style={{ ['--i' as string]: index }} data-simulation={item.type}>
      <div className={s.simHead}>
        <span className={s.simIcon} aria-hidden="true">
          <Icon name={TYPE_ICON[item.type]} size={20} />
        </span>
        <span className={[space.tag, item.type === 'PROJECTION' ? space.tagWarning : item.type === 'ELIGIBILITY' ? space.tagSuccess : space.tagInfo].join(' ')}>{t(`ui.clientTools.simulations.type.${item.type}`)}</span>
        <span className={s.simDate}>
          {t('ui.clientTools.simulations.createdOn', { date: longDate(item.createdAt, tz) })}
          {item.type === 'PROJECTION' ? ` · ${t('ui.clientTools.simulations.fromAdvisor')}` : ''}
        </span>
      </div>
      {renaming ? (
        <RenameInline item={item} tz={tz} onCancel={() => setRenaming(false)} onSaved={(u) => (onRenamed(u), setRenaming(false))} />
      ) : (
        <h2 className={s.simTitle}>{name}</h2>
      )}
      {h ? (
        <div className={s.simResult}>
          <span className={s.simResultLabel}>{t('ui.clientTools.simulations.result')}</span>
          <p className={s.headline}>{h.main}</p>
          {h.sub ? <p className={s.headlineSub}>{h.sub}</p> : null}
        </div>
      ) : null}
      {item.property ? (
        <p className={s.simProperty}>
          <Icon name="home" size={16} />
          {item.property.online && item.property.slug ? (
            <Link href={`/biens/${item.property.slug}`}>{t('ui.clientTools.simulations.property', { titre: item.property.title })}</Link>
          ) : (
            t('ui.clientTools.simulations.property', { titre: t('ui.clientTools.simulations.propertyGone', { titre: item.property.title }) })
          )}
        </p>
      ) : null}
      <div className={s.simActions}>
        <Button variant="tool" size="M" icon="eye" onClick={onOpen} aria-expanded={open}>
          {open ? t('ui.clientTools.simulations.actions.close') : t('ui.clientTools.simulations.actions.open')}
        </Button>
        <Link href={`${SIMULATOR[item.type]}?simulation=${item.id}`} className={buttonClass('secondary', 'M')}>
          <ButtonInner size="M">{t('ui.clientTools.simulations.actions.redo')}</ButtonInner>
        </Link>
      </div>
      <div className={s.simTools}>
        <a href={`/api/v1/client/simulations/${item.id}/pdf`} className={k.quiet} download>
          <Icon name="download" size={20} />
          {t('ui.clientTools.simulations.actions.pdf')}
        </a>
        {item.canEdit ? (
          <>
            <button type="button" className={k.quiet} onClick={() => setRenaming(true)} disabled={renaming}>
              <Icon name="edit" size={20} />
              {t('ui.clientTools.simulations.actions.rename')}
            </button>
            <button type="button" className={`${k.quiet} ${k.quietDanger} ${s.toEnd}`} onClick={onDelete}>
              <Icon name="trash" size={20} />
              {t('ui.clientTools.simulations.actions.delete')}
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function Detail({ item, tz }: { item: ClientSimulationItem; tz: string }) {
  const [detail, setDetail] = useState<ClientSimulationDetail | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    void apiCall<ClientSimulationDetail>(`/client/simulations/${item.id}`, { retryOnAuth: true }).then((r) => {
      if (!alive) return;
      if (r.ok) setDetail(r.data);
      else setError(true);
    });
    return () => {
      alive = false;
    };
  }, [item.id]);
  const h = headlineText(item);
  const head = h ? (
    <div className={s.simResult}>
      <span className={s.simResultLabel}>{t('ui.clientTools.simulations.result')}</span>
      <p className={s.headline}>{h.main}</p>
      {h.sub ? <p className={s.headlineSub}>{h.sub}</p> : null}
    </div>
  ) : null;
  const actions = (
    <div className={s.panelActions}>
      <Link href={`${SIMULATOR[item.type]}?simulation=${item.id}`} className={buttonClass('tool', 'M')}>
        <ButtonInner size="M" icon="calculator">
          {t('ui.clientTools.simulations.actions.redo')}
        </ButtonInner>
      </Link>
      <a href={`/api/v1/client/simulations/${item.id}/pdf`} className={buttonClass('secondary', 'M')} download>
        <ButtonInner size="M" icon="download">
          {t('ui.clientTools.simulations.actions.pdf')}
        </ButtonInner>
      </a>
      <Link href={writeToAdvisorHref({ from: 'SIMULATION', date: isoDay(item.createdAt, tz) })} className={buttonClass('secondary', 'M')}>
        <ButtonInner size="M" icon="chat">
          {t('ui.clientTools.simulations.actions.advisor')}
        </ButtonInner>
      </Link>
    </div>
  );
  if (error) {
    return (
      <div className={s.detail}>
        {head}
        <p className={s.error} role="alert">
          <Icon name="status-error" size={16} />
          {t('ui.clientTools.simulations.error')}
        </p>
        {actions}
      </div>
    );
  }
  const figures: [string, string][] = [];
  const m = (x: unknown, cents = false) => (x && typeof x === 'object' && 'amount' in (x as object) ? amount(x as Money, cents) : null);
  if (detail && item.type === 'ELIGIBILITY' && detail.eligibilityResult) {
    const r = detail.eligibilityResult as { shown: { maxBudget: Money | null; capacity: Money | null }; maxMonthlyPayment: Money | null; budgetMonthlyPayment: Money | null; durationMonths: number | null; rateBps: number | null; indicative: boolean };
    const add = (key: string, v: string | null) => v && figures.push([key, v]);
    add(t('ui.clientTools.simulations.detail.budget'), m(r.shown.maxBudget));
    add(t('ui.clientTools.simulations.detail.capacity'), m(r.shown.capacity));
    add(t('ui.clientTools.simulations.detail.maxMonthly'), m(r.maxMonthlyPayment, true));
    add(t('ui.clientTools.simulations.detail.budgetMonthly'), m(r.budgetMonthlyPayment, true));
    add(t('ui.clientTools.simulations.detail.duration'), r.durationMonths ? durationLabel(r.durationMonths) : null);
    add(t('ui.clientTools.simulations.detail.rate'), r.rateBps !== null ? `${rateLabel(r.rateBps)}${r.indicative ? ` · ${t('ui.clientTools.simulations.detail.indicative')}` : ''}` : null);
    const inputs = detail.inputs as { downPayment?: string; downPaymentCurrency?: string; incomeCurrency?: string; monthlyIncome?: string };
    if (inputs.downPayment) add(t('ui.clientTools.simulations.detail.downPayment'), amount({ amount: inputs.downPayment, currency: inputs.downPaymentCurrency ?? inputs.incomeCurrency ?? 'EUR' }));
    if (inputs.monthlyIncome) add(t('ui.clientTools.simulations.detail.income'), amount({ amount: inputs.monthlyIncome, currency: inputs.incomeCurrency ?? 'EUR' }));
  } else if (detail) {
    const out = detail.outputs as { scenarios?: { amount: Money | null; durationMonths: number; annualRateBps: number | null; monthlyPayment: Money | null; totalCost: Money | null }[] };
    const active = (detail.inputs as { activeIndex?: number }).activeIndex ?? 0;
    const sc = out.scenarios?.[active] ?? out.scenarios?.[0];
    if (sc) {
      const add = (key: string, v: string | null) => v && figures.push([key, v]);
      add(t('ui.clientTools.simulations.detail.amount'), m(sc.amount));
      add(t('ui.clientTools.simulations.detail.duration'), durationLabel(sc.durationMonths));
      add(t('ui.clientTools.simulations.detail.rate'), sc.annualRateBps !== null ? rateLabel(sc.annualRateBps) : null);
      add(t('ui.clientTools.simulations.detail.monthly'), m(sc.monthlyPayment, true));
      add(t('ui.clientTools.simulations.detail.totalCost'), m(sc.totalCost, true));
    }
  }
  return (
    <div className={s.detail}>
      {head}
      <p className={s.asComputed}>
        <Icon name="clock" size={20} />
        <span>{t('ui.clientTools.simulations.detail.asComputed', { date: longDate(item.createdAt, tz) })}</span>
      </p>
      {item.headline?.kind === 'NOT_ELIGIBLE' ? <p className={s.note}>{t('ui.clientTools.simulations.detail.notEligible')}</p> : null}
      {!detail ? (
        <div className={space.skeletonBar} aria-busy="true" style={{ height: '8rem' }} />
      ) : figures.length ? (
        <dl className={s.figures}>
          {figures.map(([key, v]) => (
            <div key={key} className={s.figure}>
              <dt>{key}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {actions}
    </div>
  );
}

/** SFA-011 « Renommer » — in place, on the card: no window for one field (D-098). */
function RenameInline({ item, tz, onCancel, onSaved }: { item: ClientSimulationItem; tz: string; onCancel: () => void; onSaved: (i: ClientSimulationItem) => void }) {
  const [value, setValue] = useState(item.label ?? '');
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const id = `nom-${item.id}`;
  const save = async () => {
    setPending(true);
    const r = await apiCall<ClientSimulationItem>(`/client/simulations/${item.id}`, { method: 'PATCH', body: { label: value.trim() || null }, retryOnAuth: true });
    setPending(false);
    if (!r.ok) return setError(true);
    showToast({ message: t('ui.clientTools.simulations.rename.saved'), tone: 'success' });
    onSaved(r.data);
  };
  return (
    <form
      className={s.rename}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <label htmlFor={id} className={s.renameLabel}>
        {t('ui.clientTools.simulations.rename.label')}
      </label>
      <input id={id} className={s.renameInput} value={value} maxLength={120} autoFocus onChange={(e) => setValue(e.target.value)} aria-describedby={`${id}-aide`} aria-invalid={error || undefined} />
      <p id={`${id}-aide`} className={error ? s.error : s.note} role={error ? 'alert' : undefined}>
        {error ? t('ui.clientTools.simulations.error') : t('ui.clientTools.simulations.rename.hint', { defaut: t('ui.clientTools.simulations.untitled', { date: longDate(item.createdAt, tz) }) })}
      </p>
      <div className={s.renameActions}>
        <Button variant="tool" size="S" type="submit" pending={pending}>
          {t('ui.clientTools.simulations.rename.save')}
        </Button>
        <Button variant="tertiary" size="S" onClick={onCancel}>
          {t('ui.clientTools.simulations.rename.cancel')}
        </Button>
      </div>
    </form>
  );
}

export function ConfirmDelete({ onCancel, onConfirm, text, confirmLabel, cancelLabel }: { onCancel: () => void; onConfirm: () => Promise<boolean>; text?: string; confirmLabel?: string; cancelLabel?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className={s.dialogBody}>
      <p>{text ?? t('ui.clientTools.simulations.delete.text')}</p>
      {error ? (
        <p className={s.error} role="alert">
          <Icon name="status-error" size={16} />
          {t('ui.clientTools.simulations.error')}
        </p>
      ) : null}
      <div className={s.dialogActions}>
        <Button variant="tertiary" size="M" onClick={onCancel}>
          {cancelLabel ?? t('ui.clientTools.simulations.delete.cancel')}
        </Button>
        <Button
          variant="danger"
          size="M"
          pending={pending}
          onClick={async () => {
            setPending(true);
            const ok = await onConfirm();
            setPending(false);
            if (!ok) setError(true);
          }}
        >
          {confirmLabel ?? t('ui.clientTools.simulations.delete.confirm')}
        </Button>
      </div>
    </div>
  );
}
