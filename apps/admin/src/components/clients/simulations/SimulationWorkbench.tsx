'use client';
// CRM-046 « Faire une simulation » — `/clients/{id}/simulations/nouvelle?type=eligibilite|credit`: the two simulators of
// EP-11 and EP-12 in the frame of the back office. Prefilled with the record (SIM-033 for the team; financial values
// only with `client.sensitive.read`), recomputed 300 ms after the last keystroke by the SAME calculations as the site
// (`POST /admin/simulations/compute`, nothing written), then « Enregistrer sur la fiche » (`POST /admin/simulations`:
// `clientId`, `createdById`, `isSaved` false — the client does not see it in « Mes simulations »).
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SIM_DEBOUNCE_MS, SIM_SCENARIOS_MAX, type AdminSimulationComputed, type AdminSimulationPrefill, type CreditResponse, type CreditResult, type EligibilityResult, type Money, type SimulatorOptions } from '@dp/contracts';
import { type MessageKey } from '@dp/i18n';
import { Banner, Button, Icon, useToast } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { PageHeader } from '../../shell/Page';
import { SelectInput, TextInput } from '../../shell/forms';
import s from './simulations.module.css';

const S = (k: string, p?: Record<string, string | number>) => t(`ui.admin-simulations.${k}` as MessageKey, p);
const m = (v: Money | null | undefined, approx = false) => (v ? `${approx ? '≈ ' : ''}${money(v.amount, v.currency)}` : '—');
const pct = (bps: number | null | undefined) => (bps === null || bps === undefined ? '—' : S('common.bps', { taux: (bps / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) }));
const years = (months: number | null | undefined) => (months ? (months % 12 === 0 ? S('common.years', { n: months / 12 }) : S('common.months', { n: months })) : '—');
/** « 1 234,50 » → « 1234.50 »: what the API reads (API-002). */
const amount = (v: string) => v.replace(/[\s  ]/g, '').replace(',', '.');

export type SimulatorKind = 'eligibilite' | 'credit';

interface Props {
  clientId: string;
  kind: SimulatorKind;
  options: SimulatorOptions;
  prefill: AdminSimulationPrefill;
  countries: { code: string; name: string }[];
}

/** The live calculation: debounced, the last answer wins, field errors kept for the form. */
function useCompute(body: Record<string, unknown> | null) {
  const [state, setState] = useState<{ result: AdminSimulationComputed | null; errors: Record<string, string>; pending: boolean; failure: string | null }>({ result: null, errors: {}, pending: false, failure: null });
  const seq = useRef(0);
  const key = JSON.stringify(body);
  useEffect(() => {
    if (!body) return;
    const n = ++seq.current;
    setState((x) => ({ ...x, pending: true }));
    const timer = window.setTimeout(() => {
      void adminCall<AdminSimulationComputed>('/admin/simulations/compute', { body }).then((r) => {
        if (n !== seq.current) return;
        if (r.ok) setState({ result: r.data, errors: {}, pending: false, failure: null });
        else {
          const fields = fieldErrors(r.error);
          setState({ result: null, errors: fields, pending: false, failure: Object.keys(fields).length ? null : errorText(r) });
        }
      });
    }, SIM_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function SimulationWorkbench({ clientId, kind, options, prefill, countries }: Props) {
  const name = prefill.clientName ?? '';
  return (
    <div className={s.page}>
      <PageHeader
        title={S('page.title')}
        crumbs={[{ label: t('ui.admin-shell.menu.group.crm') }, { label: t('ui.admin-clients.title'), href: '/clients' }, { label: name || t('ui.admin-clients.unnamed'), href: `/clients/${clientId}?onglet=simulations` }, { label: S('page.crumb') }]}
        intro={S('page.intro', { nom: name })}
      />
      <nav className={s.switch} aria-label={S('page.title')}>
        {(['eligibilite', 'credit'] as const).map((k) => (
          <Link key={k} href={`/clients/${clientId}/simulations/nouvelle?type=${k}`} aria-current={k === kind ? 'page' : undefined} replace>
            <Icon name={k === 'credit' ? 'calculator' : 'check'} size={16} />
            {S(k === 'credit' ? 'tab.credit' : 'tab.eligibility')}
          </Link>
        ))}
      </nav>
      {prefill.withheld ? <Banner tone="info">{S('page.withheld')}</Banner> : null}
      {kind === 'credit' ? <CreditBench clientId={clientId} options={options} prefill={prefill} /> : <EligibilityBench clientId={clientId} options={options} prefill={prefill} countries={countries} />}
    </div>
  );
}

// ─── Saving (shared) ────────────────────────────────────────────────────────

function SaveBox({ clientId, body, disabled }: { clientId: string; body: Record<string, unknown> | null; disabled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const save = async () => {
    if (!body) return;
    setPending(true);
    setFailure(null);
    const r = await adminCall<{ id: string }>('/admin/simulations', { body: { ...body, clientId, label: label.trim() || null } });
    setPending(false);
    if (!r.ok) return setFailure(errorText(r));
    toast({ text: S('page.saved') });
    router.push(`/clients/${clientId}?onglet=simulations`);
  };
  return (
    <div className={s.saveBox}>
      <label className={s.saveLabel}>
        {S('page.label')}
        <span className={s.saveHint}>{S('page.labelHint')}</span>
        <input className={s.saveInput} value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} autoComplete="off" />
      </label>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <Button variant="primary" size="M" fullWidth pending={pending} disabled={disabled} onClick={() => void save()}>
        {S('page.save')}
      </Button>
      <p className={s.note}>{S('tab.hiddenFromClient')}</p>
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className={s.segLabel}>{label}</p>
      <div className={s.segmented} role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── EP-11 eligibility ──────────────────────────────────────────────────────

function EligibilityBench({ clientId, options, prefill, countries }: { clientId: string; options: SimulatorOptions; prefill: AdminSimulationPrefill; countries: { code: string; name: string }[] }) {
  const firstCountry = options.propertyCountries.find((c) => c.code === prefill.propertyCountry)?.code ?? options.propertyCountries[0]?.code ?? '';
  const [v, setV] = useState({
    propertyCountry: firstCountry,
    residencyStatus: prefill.residencyStatus ?? 'NON_RESIDENT',
    countryOfResidence: prefill.countryOfResidence ?? '',
    birthYear: prefill.birthYear ? String(prefill.birthYear) : '',
    monthlyIncome: prefill.monthlyIncome ?? '',
    incomeCurrency: prefill.incomeCurrency ?? (prefill.countryOfResidence ? options.currencyByCountry[prefill.countryOfResidence] : null) ?? options.referenceCurrency,
    coBorrowerIncome: '',
    otherIncome: prefill.otherIncome ?? '',
    monthlyDebts: prefill.monthlyDebts ?? '0',
    downPayment: prefill.downPayment ?? '0',
    durationYears: '',
    financingPreference: (prefill.financingPreference ?? 'NO_PREFERENCE') as 'CONVENTIONAL' | 'ISLAMIC' | 'NO_PREFERENCE',
    targetPrice: '',
    targetCurrency: options.referenceCurrency,
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  const body = useMemo(() => {
    if (!v.propertyCountry || !v.countryOfResidence || !/^\d{4}$/.test(v.birthYear) || !v.monthlyIncome.trim()) return null;
    return {
      type: 'ELIGIBILITY',
      input: {
        propertyCountry: v.propertyCountry,
        residencyStatus: v.residencyStatus,
        countryOfResidence: v.countryOfResidence,
        birthYear: Number(v.birthYear),
        monthlyIncome: amount(v.monthlyIncome),
        incomeCurrency: v.incomeCurrency,
        coBorrowerIncome: v.coBorrowerIncome.trim() ? amount(v.coBorrowerIncome) : undefined,
        otherIncome: v.otherIncome.trim() ? amount(v.otherIncome) : undefined,
        monthlyDebts: amount(v.monthlyDebts || '0'),
        downPayment: amount(v.downPayment || '0'),
        desiredDurationMonths: /^\d+$/.test(v.durationYears) ? Number(v.durationYears) * 12 : undefined,
        financingPreference: v.financingPreference,
        targetPrice: v.targetPrice.trim() ? amount(v.targetPrice) : undefined,
        targetCurrency: v.targetPrice.trim() ? v.targetCurrency : undefined,
      },
    } as Record<string, unknown>;
  }, [v]);
  const live = useCompute(body);
  const e = (k: string) => live.errors[`input.${k}`];
  const result = live.result?.type === 'ELIGIBILITY' ? live.result.result : null;

  const financing = [
    { value: 'NO_PREFERENCE' as const, label: t('ui.enum.FinancingPreference.NO_PREFERENCE') },
    { value: 'CONVENTIONAL' as const, label: t('ui.enum.FinancingPreference.CONVENTIONAL') },
    ...(options.islamicFinance ? [{ value: 'ISLAMIC' as const, label: t('ui.enum.FinancingPreference.ISLAMIC') }] : []),
  ];

  return (
    <div className={s.work}>
      <form className={s.form} onSubmit={(ev) => ev.preventDefault()} noValidate>
        <section className={s.group}>
          <h2 className={s.groupTitle}>{S('elig.situation')}</h2>
          <div className={s.grid2}>
            <SelectInput label={S('elig.propertyCountry')} value={v.propertyCountry} onChange={set('propertyCountry')} error={e('propertyCountry')}>
              {options.propertyCountries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
            <SelectInput label={S('elig.residencyStatus')} value={v.residencyStatus} onChange={set('residencyStatus')} error={e('residencyStatus')}>
              {['NON_RESIDENT', 'EXPATRIATE', 'RESIDENT', 'OTHER'].map((r) => (
                <option key={r} value={r}>
                  {t(`ui.enum.ResidencyStatus.${r}` as MessageKey)}
                </option>
              ))}
            </SelectInput>
            <SelectInput label={S('elig.countryOfResidence')} value={v.countryOfResidence} onChange={(ev) => setV((x) => ({ ...x, countryOfResidence: ev.target.value, incomeCurrency: options.currencyByCountry[ev.target.value] ?? x.incomeCurrency }))} error={e('countryOfResidence')}>
              <option value="" disabled>
                —
              </option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
            <TextInput label={S('elig.birthYear')} inputMode="numeric" value={v.birthYear} onChange={set('birthYear')} error={e('birthYear')} maxLength={4} />
          </div>
        </section>
        <section className={s.group}>
          <h2 className={s.groupTitle}>{S('elig.money')}</h2>
          <div className={s.grid2}>
            <TextInput label={S('elig.income')} inputMode="decimal" value={v.monthlyIncome} onChange={set('monthlyIncome')} error={e('monthlyIncome')} />
            <SelectInput label={S('elig.currency')} value={v.incomeCurrency} onChange={set('incomeCurrency')} hint={S('elig.currencyHint')} error={e('incomeCurrency')}>
              {options.currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
            <TextInput label={S('elig.coBorrowerIncome')} optional inputMode="decimal" value={v.coBorrowerIncome} onChange={set('coBorrowerIncome')} error={e('coBorrowerIncome')} />
            <TextInput label={S('elig.otherIncome')} optional inputMode="decimal" value={v.otherIncome} onChange={set('otherIncome')} error={e('otherIncome')} />
            <TextInput label={S('elig.debts')} inputMode="decimal" value={v.monthlyDebts} onChange={set('monthlyDebts')} error={e('monthlyDebts')} />
            <TextInput label={S('elig.downPayment')} inputMode="decimal" value={v.downPayment} onChange={set('downPayment')} error={e('downPayment')} />
          </div>
        </section>
        <section className={s.group}>
          <h2 className={s.groupTitle}>{S('elig.project')}</h2>
          <Segmented label={S('elig.financing')} value={v.financingPreference} options={financing} onChange={(x) => setV((y) => ({ ...y, financingPreference: x }))} />
          <div className={s.grid3}>
            <TextInput label={S('elig.duration')} optional inputMode="numeric" value={v.durationYears} onChange={set('durationYears')} hint={S('elig.durationHint')} error={e('desiredDurationMonths')} maxLength={2} />
            <TextInput label={S('elig.targetPrice')} optional inputMode="decimal" value={v.targetPrice} onChange={set('targetPrice')} error={e('targetPrice')} />
            <SelectInput label={S('elig.targetCurrency')} value={v.targetCurrency} onChange={set('targetCurrency')} error={e('targetCurrency')}>
              {options.currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </div>
        </section>
      </form>
      <aside className={s.result} aria-live="polite">
        <p className={s.resultTitle}>{S('page.result')}</p>
        {result ? <EligibilityResultView r={result} /> : <p className={s.wait}>{live.pending ? S('page.computing') : Object.keys(live.errors).length ? S('page.fix') : (live.failure ?? S('page.nothingYet'))}</p>}
        {result ? <SaveBox clientId={clientId} body={body} disabled={live.pending} /> : null}
      </aside>
    </div>
  );
}

function EligibilityResultView({ r }: { r: EligibilityResult }) {
  const a = r.approx.figures;
  const target = r.target;
  let targetText: string | null = null;
  if (target) {
    if (target.case === 'FINANCEABLE') targetText = S('elig.targetFinanceable', { montant: m(target.monthlyPayment, r.approx.target) });
    else if (target.case === 'DOWN_PAYMENT_SHORT') targetText = S('elig.targetShort', { montant: m(target.missingDownPayment, r.approx.target) });
    else if (target.case === 'PAYMENT_TOO_HIGH') targetText = S('elig.targetTooHigh', { x: m(target.requiredMonthlyPayment ?? target.monthlyPayment, r.approx.target), y: m(r.maxMonthlyPayment, a) });
    else if (target.case === 'NO_FINANCING_NEEDED') targetText = S('elig.targetNoFinancing');
    else targetText = S('elig.targetBelowMin');
  }
  const solutions = Object.entries(r.solutions).filter(([, n]) => n);
  return (
    <>
      <p className={s.resultStatus}>{S(`elig.status.${r.status}`)}</p>
      {r.shown.maxBudget || r.shown.capacity ? (
        <div className={s.figure} key={`${r.shown.maxBudget?.amount}-${r.shown.capacity?.amount}`}>
          <span className={s.figureLabel}>{r.shown.maxBudget ? S('elig.budget') : S('elig.capacity')}</span>
          <span className={s.figureValue}>{m(r.shown.maxBudget ?? r.shown.capacity, a)}</span>
        </div>
      ) : null}
      {r.status !== 'NOT_ELIGIBLE' ? (
        <dl className={s.facts}>
          <div>
            <dt>{S('elig.maxLoan')}</dt>
            <dd>{m(r.shown.maxLoan, a)}</dd>
          </div>
          <div>
            <dt>{S('elig.maxMonthly')}</dt>
            <dd>{m(r.maxMonthlyPayment, a)}</dd>
          </div>
          <div>
            <dt>{S('elig.duration2')}</dt>
            <dd>{years(r.durationMonths)}</dd>
          </div>
          <div>
            <dt>{S('elig.rate')}</dt>
            <dd>{pct(r.rateBps)}</dd>
          </div>
          {r.budgetMonthlyPayment ? (
            <div>
              <dt>{S('elig.budgetMonthly')}</dt>
              <dd>{m(r.budgetMonthlyPayment, a)}</dd>
            </div>
          ) : null}
          {r.advisedDownPayment ? (
            <div>
              <dt>{S('elig.advisedDownPayment')}</dt>
              <dd>{m(r.advisedDownPayment, a)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {r.limitingFactor ? <p className={s.note}>{S(`elig.limit.${r.limitingFactor}`)}</p> : null}
      {r.reasons.length ? (
        <>
          <p className={s.resultTitle}>{S('elig.reasonsTitle')}</p>
          <ul className={s.reasons}>
            {[...new Set(r.reasons)].map((x) => (
              <li key={x}>{S(`elig.reason.${x}`)}</li>
            ))}
          </ul>
        </>
      ) : null}
      {targetText ? (
        <>
          <p className={s.resultTitle}>{S('elig.targetTitle')}</p>
          <p>{targetText}</p>
        </>
      ) : null}
      {solutions.length ? (
        <p className={s.note}>
          {S('elig.solutions')} : {solutions.map(([type, n]) => `${t(`ui.enum.FinancingType.${type}` as MessageKey)} (${n})`).join(' · ')}
        </p>
      ) : null}
      <p className={s.note}>
        {r.feesIncluded ? S('common.feesIncluded', { pct: r.acquisitionFeesPct.replace('.', ',') }) : S('common.feesExcluded')}
        {r.indicative ? ` ${S('common.indicative')}` : ''}
        {r.rateDate ? ` ${S('common.rateDate', { date: r.rateDate })}` : ''}
      </p>
    </>
  );
}

// ─── EP-12 credit ───────────────────────────────────────────────────────────

interface ScenarioForm {
  mode: 'FROM_PRICE' | 'FROM_AMOUNT';
  price: string;
  downPayment: string;
  amount: string;
  currency: string;
  durationYears: string;
  bankProductId: string;
  rate: string;
  insurance: string;
}

function CreditBench({ clientId, options, prefill }: { clientId: string; options: SimulatorOptions; prefill: AdminSimulationPrefill }) {
  const first: ScenarioForm = {
    mode: 'FROM_PRICE',
    price: '',
    downPayment: prefill.downPayment ?? '',
    amount: '',
    currency: prefill.downPaymentCurrency ?? options.referenceCurrency,
    durationYears: String(Math.round(options.reference.durationMonths / 12)),
    bankProductId: '',
    rate: String(options.indicative.annualRateBps / 100).replace('.', ','),
    insurance: '',
  };
  const [scenarios, setScenarios] = useState<ScenarioForm[]>([first]);
  const [active, setActive] = useState(0);
  const sc = scenarios[active]!;
  const set = (k: keyof ScenarioForm) => (e: { target: { value: string } }) => setScenarios((all) => all.map((x, i) => (i === active ? { ...x, [k]: e.target.value } : x)));

  const toWire = (f: ScenarioForm) => {
    const rate = Number(amount(f.rate));
    const ins = f.insurance.trim() ? Number(amount(f.insurance)) : null;
    return {
      mode: f.mode,
      price: f.mode === 'FROM_PRICE' && f.price.trim() ? amount(f.price) : undefined,
      downPayment: f.mode === 'FROM_PRICE' && f.downPayment.trim() ? amount(f.downPayment) : undefined,
      amount: f.mode === 'FROM_AMOUNT' && f.amount.trim() ? amount(f.amount) : undefined,
      currency: f.currency,
      durationMonths: /^\d+$/.test(f.durationYears) ? Number(f.durationYears) * 12 : undefined,
      bankProductId: f.bankProductId || undefined,
      annualRateBps: !f.bankProductId && Number.isFinite(rate) && f.rate.trim() ? Math.round(rate * 100) : undefined,
      insuranceRateBps: !f.bankProductId && ins !== null && Number.isFinite(ins) ? Math.round(ins * 100) : undefined,
    };
  };
  const ready = (f: ScenarioForm) => /^\d+$/.test(f.durationYears) && (f.mode === 'FROM_PRICE' ? f.price.trim() : f.amount.trim()) && (f.bankProductId || f.rate.trim());
  const body = useMemo(() => (scenarios.every(ready) ? ({ type: 'CREDIT', scenarios: scenarios.map(toWire), activeIndex: active } as Record<string, unknown>) : null), [scenarios, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = useCompute(body);
  const e = (k: string) => live.errors[`scenarios.${active}.${k}`];
  const response = live.result?.type === 'CREDIT' ? live.result.result : null;
  const products = options.products;

  const productLabel = (p: SimulatorOptions['products'][number]) => (p.bankName && p.productName ? `${p.bankName} – ${p.productName}` : t(`ui.sim.credit.productOrdinal.${p.financingType}` as MessageKey, { n: p.ordinal }));

  return (
    <div className={s.work}>
      <form className={s.form} onSubmit={(ev) => ev.preventDefault()} noValidate>
        <div className={s.scenarios} role="group" aria-label={S('credit.compareTitle')}>
          {scenarios.map((_, i) => (
            <span key={i} className={s.segmented}>
              <button type="button" aria-pressed={i === active} onClick={() => setActive(i)}>
                {S('credit.scenario', { n: i + 1 })}
              </button>
              {scenarios.length > 1 && i === active ? (
                <button type="button" className={s.removeScenario} aria-label={S('credit.removeScenario', { n: i + 1 })} title={S('credit.removeScenario', { n: i + 1 })} onClick={() => {
                  setScenarios((all) => all.filter((_, j) => j !== i));
                  setActive(0);
                }}>
                  <Icon name="close" size={16} />
                </button>
              ) : null}
            </span>
          ))}
          {scenarios.length < SIM_SCENARIOS_MAX ? (
            <Button variant="secondary" size="S" icon="plus" onClick={() => {
              setScenarios((all) => [...all, { ...all[active]! }]);
              setActive(scenarios.length);
            }}>
              {S('credit.addScenario')}
            </Button>
          ) : null}
        </div>
        <section className={s.group}>
          <h2 className={s.groupTitle}>{S('credit.scenario', { n: active + 1 })}</h2>
          <Segmented
            label={S('credit.mode')}
            value={sc.mode}
            options={[
              { value: 'FROM_PRICE', label: t('ui.enum.CreditMode.FROM_PRICE') },
              { value: 'FROM_AMOUNT', label: t('ui.enum.CreditMode.FROM_AMOUNT') },
            ]}
            onChange={(mode) => setScenarios((all) => all.map((x, i) => (i === active ? { ...x, mode } : x)))}
          />
          <div className={s.grid3}>
            {sc.mode === 'FROM_PRICE' ? (
              <>
                <TextInput label={S('credit.price')} inputMode="decimal" value={sc.price} onChange={set('price')} error={e('price')} />
                <TextInput label={S('credit.downPayment')} optional inputMode="decimal" value={sc.downPayment} onChange={set('downPayment')} error={e('downPayment')} />
              </>
            ) : (
              <TextInput label={S('credit.amount')} inputMode="decimal" value={sc.amount} onChange={set('amount')} error={e('amount')} />
            )}
            <SelectInput label={S('credit.currency')} value={sc.currency} onChange={set('currency')} error={e('currency')}>
              {options.currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </div>
          <div className={s.grid3}>
            <TextInput label={S('credit.duration')} inputMode="numeric" value={sc.durationYears} onChange={set('durationYears')} error={e('durationMonths')} maxLength={2} />
            <SelectInput label={S('credit.solution')} value={sc.bankProductId} onChange={set('bankProductId')} error={e('bankProductId')}>
              <option value="">{S('credit.noProduct')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {productLabel(p)}
                </option>
              ))}
            </SelectInput>
            {!sc.bankProductId ? <TextInput label={S('credit.rate')} inputMode="decimal" value={sc.rate} onChange={set('rate')} error={e('annualRateBps')} /> : <span />}
          </div>
          {!sc.bankProductId ? (
            <div className={s.grid3}>
              <TextInput label={S('credit.insurance')} optional inputMode="decimal" value={sc.insurance} onChange={set('insurance')} error={e('insuranceRateBps')} />
            </div>
          ) : null}
        </section>
      </form>
      <aside className={s.result} aria-live="polite">
        <p className={s.resultTitle}>{S('page.result')}</p>
        {response?.scenarios[active] ? <CreditResultView r={response.scenarios[active]!} /> : <p className={s.wait}>{live.pending ? S('page.computing') : Object.keys(live.errors).length ? S('page.fix') : (live.failure ?? S('page.nothingYet'))}</p>}
        {response && response.scenarios.length > 1 ? <Compare response={response} /> : null}
        {response ? <SaveBox clientId={clientId} body={body} disabled={live.pending} /> : null}
      </aside>
    </div>
  );
}

function CreditResultView({ r }: { r: CreditResult }) {
  if (r.nothingToFinance) return <p className={s.resultStatus}>{S('credit.nothing')}</p>;
  const a = Boolean(r.productCurrency);
  return (
    <>
      <div className={s.figure} key={r.monthlyPayment?.amount}>
        <span className={s.figureLabel}>{S('credit.monthly')}</span>
        <span className={s.figureValue}>{m(r.monthlyPayment, a)}</span>
        {r.monthlyInsurance && r.monthlyTotal ? <span className={s.note}>{S('credit.monthlyTotal', { montant: m(r.monthlyTotal, a) })}</span> : null}
      </div>
      <dl className={s.facts}>
        <div>
          <dt>{S('credit.amountFinanced')}</dt>
          <dd>{m(r.amount, a)}</dd>
        </div>
        <div>
          <dt>{S('elig.duration2')}</dt>
          <dd>{years(r.durationMonths)}</dd>
        </div>
        <div>
          <dt>{S('elig.rate')}</dt>
          <dd>{pct(r.annualRateBps)}</dd>
        </div>
        <div>
          <dt>{S('credit.interest')}</dt>
          <dd>{m(r.totalInterest, a)}</dd>
        </div>
        {r.totalInsurance ? (
          <div>
            <dt>{S('credit.insuranceTotal')}</dt>
            <dd>{m(r.totalInsurance, a)}</dd>
          </div>
        ) : null}
        {r.fees ? (
          <div>
            <dt>{S('credit.fees')}</dt>
            <dd>{m(r.fees, a)}</dd>
          </div>
        ) : null}
        <div>
          <dt>{S('credit.totalCost')}</dt>
          <dd>{m(r.totalCost, a)}</dd>
        </div>
        <div>
          <dt>{S('credit.totalRepaid')}</dt>
          <dd>{m(r.totalRepaid, a)}</dd>
        </div>
      </dl>
      {r.warnings.map((w) => (
        <p key={w.code} className={s.note}>
          {warningText(w, r.currency)}
        </p>
      ))}
      {r.productCurrency ? <p className={s.note}>{t('ui.sim.credit.productCurrency', { devise: r.productCurrency })}</p> : null}
      {r.schedule.length ? (
        <details className={s.schedule}>
          <summary>{S('credit.schedule')}</summary>
          <table className={s.scheduleTable}>
            <thead>
              <tr>
                <th scope="col">{S('credit.period')}</th>
                <th scope="col">{S('credit.payments')}</th>
                <th scope="col">{S('credit.principal')}</th>
                <th scope="col">{S('credit.remaining')}</th>
              </tr>
            </thead>
            <tbody>
              {r.schedule.map((y) => (
                <tr key={y.year}>
                  <td>{S('credit.year', { n: y.year })}</td>
                  <td>{money(y.payments, r.currency)}</td>
                  <td>{money(y.principal, r.currency)}</td>
                  <td>{money(y.remaining, r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </>
  );
}

/** The warnings of SIM-020, in the words of the site's simulator (same parameters, same mapping). */
function warningText(w: CreditResult['warnings'][number], currency: string): string {
  const fmt = (v: string | number | undefined) => (v === undefined ? '—' : money(String(v), currency));
  if (w.code === 'AMOUNT_OUT_OF_PRODUCT_BOUNDS') return t('ui.sim.credit.warnings.AMOUNT_OUT_OF_PRODUCT_BOUNDS', { min: fmt(w.params.min), max: fmt(w.params.max) });
  if (w.code === 'DURATION_OUT_OF_PRODUCT_BOUNDS') return t('ui.sim.credit.warnings.DURATION_OUT_OF_PRODUCT_BOUNDS', { min: years(Number(w.params.min)), max: years(Number(w.params.max)) });
  return t('ui.sim.credit.warnings.DOWN_PAYMENT_BELOW_MIN', { pct: String(w.params.pct ?? '').replace('.', ','), montant: fmt(w.params.amount) });
}

function Compare({ response }: { response: CreditResponse }) {
  const c = response.comparison;
  return (
    <>
      <p className={s.resultTitle}>{S('credit.compareTitle')}</p>
      <table className={s.compare}>
        <thead>
          <tr>
            <th scope="col" />
            {response.scenarios.map((_, i) => (
              <th key={i} scope="col">
                {S('credit.scenario', { n: i + 1 })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{S('credit.monthly')}</td>
            {response.scenarios.map((r, i) => (
              <td key={i} className={c?.lowestMonthlyIndex === i ? s.best : undefined}>
                {m(r.monthlyPayment)}
              </td>
            ))}
          </tr>
          <tr>
            <td>{S('credit.totalCost')}</td>
            {response.scenarios.map((r, i) => (
              <td key={i} className={c?.lowestCostIndex === i ? s.best : undefined}>
                {m(r.totalCost)}
              </td>
            ))}
          </tr>
          <tr>
            <td>{S('elig.duration2')}</td>
            {response.scenarios.map((r, i) => (
              <td key={i}>{years(r.durationMonths)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </>
  );
}
