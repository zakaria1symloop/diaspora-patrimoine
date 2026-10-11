'use client';
// EP-12 — credit simulator (SIM-020 … SIM-023, SIM-030, SIM-031). Settings on the left (top on phone), result on the
// right, recomputed by the server 300 ms after each change (CAL-112) for every scenario (CAL-111: up to three, the lowest
// monthly payment and total cost marked by the server). Warnings under the setting concerned, without blocking
// (SIM-022). Schedule by year, each year unfolding into its months (CAL-043, a real table, SIM-050). Phone: a sticky bar
// shows the monthly payment while the result is off screen (SIM-020). Inputs kept in session storage (SIM-007).
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  SIM_DEBOUNCE_MS,
  SIM_RATE,
  SIM_SCENARIOS_MAX,
  creditInputSchema,
  type ClientSimulationDetail,
  type CreditInputWire,
  type CreditResponse,
  type CreditResult,
  type CreditWarningItem,
  type PublicSettings,
  type SimulationCreatedResponse,
  type SimulatorOptions,
  type SimulatorProduct,
  type SimulatorProperty,
} from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { useDraft } from '@/lib/public-form';
import { apiCall } from '@/lib/auth-client';
import { useClientSession } from '@/lib/session-client';
import { t } from '@/lib/i18n';
import { SelectField, TextField } from '@/components/forms/fields';
import { ResultActions } from './ResultActions';
import {
  HelpTip,
  PropertyMini,
  Rolling,
  SliderField,
  currencySymbol,
  displayAmount,
  durationText,
  fieldMessage,
  fmt,
  fmtValue,
  newKey,
  parseAmount,
  pctNum,
  postJson,
  rateText,
  useDebounced,
} from './shared';
import s from './sim.module.css';

export interface CreditPrefill {
  montant?: string;
  /** Years when ≤ 40 (express calculation link), else months. */
  duree?: string;
  /** Months, exact (from EP-11). */
  mois?: string;
  taux?: string;
  devise?: string;
  produit?: string;
  methode?: string;
  /** SIM-031 origin line: `prix` or `budget`, its value, the fees, the down payment. */
  base?: string;
  ref?: string;
  frais?: string;
  apport?: string;
  /** SFA-011 « Refaire avec les barèmes actuels » — a saved credit simulation of the signed-in client. */
  simulation?: string;
}

interface Scenario {
  mode: 'FROM_PRICE' | 'FROM_AMOUNT';
  price: string;
  downPayment: string;
  amount: string;
  durationMonths: number;
  /** '' = indicative scale. */
  solution: string;
  ratePct: number;
  type: 'CONVENTIONAL' | 'ISLAMIC';
  insurancePct: number;
  currency: string;
  priceLinked: boolean;
  propertyId: string;
}

interface Origin {
  base: 'prix' | 'budget';
  ref: string;
  fees: string;
  down: string;
  amount: string;
}

interface Draft {
  scenarios: Scenario[];
  active: number;
  origin: Origin | null;
  propertyReference: string;
  prefillApplied: string;
}

const productLabel = (p: SimulatorProduct) =>
  p.bankName && p.productName ? t('ui.sim.credit.productName', { banque: p.bankName, produit: p.productName }) : t(`ui.sim.credit.productOrdinal.${p.financingType}`, { n: p.ordinal });

function toWire(sc: Scenario): CreditInputWire {
  const w: CreditInputWire = {
    mode: sc.mode,
    currency: sc.currency,
    durationMonths: sc.durationMonths,
    pricingMethod: sc.type === 'ISLAMIC' ? 'FLAT_MARGIN' : 'AMORTIZED_RATE',
  };
  if (sc.mode === 'FROM_PRICE') {
    w.price = parseAmount(sc.price) ?? (sc.price.trim() || undefined);
    w.downPayment = parseAmount(sc.downPayment) ?? (sc.downPayment.trim() ? sc.downPayment : '0');
    if (sc.priceLinked && sc.propertyId) {
      w.priceLinked = true;
      w.propertyId = sc.propertyId;
    }
  } else {
    w.amount = parseAmount(sc.amount) ?? (sc.amount.trim() || undefined);
  }
  if (sc.propertyId) w.propertyId = sc.propertyId;
  if (sc.solution) w.bankProductId = sc.solution;
  else w.annualRateBps = Math.round(sc.ratePct * 100);
  if (!sc.solution && sc.insurancePct > 0) w.insuranceRateBps = Math.round(sc.insurancePct * 100);
  return w;
}

function durationFromParams(p: CreditPrefill): number | null {
  if (p.mois && /^\d+$/.test(p.mois)) return Number(p.mois);
  if (p.duree && /^\d+$/.test(p.duree)) {
    const n = Number(p.duree);
    return n <= 40 ? n * 12 : n;
  }
  return null;
}

export function CreditSimulator({
  settings,
  options,
  property,
  prefill,
}: {
  settings: PublicSettings;
  options: SimulatorOptions;
  property: SimulatorProperty | null;
  prefill: CreditPrefill;
}) {
  const uid = useId();
  const ref = options.referenceCurrency;
  const base: Scenario = {
    mode: 'FROM_PRICE',
    price: '',
    downPayment: '',
    amount: '',
    durationMonths: options.indicative.maxDurationMonths,
    solution: '',
    ratePct: options.indicative.annualRateBps / 100,
    type: 'CONVENTIONAL',
    insurancePct: 0,
    currency: ref,
    priceLinked: false,
    propertyId: '',
  };
  const [d, set, clear] = useDraft<Draft>('sim-credit', { scenarios: [base], active: 0, origin: null, propertyReference: '', prefillApplied: '' });
  const latest = useRef(d);
  latest.current = d;

  // Prefill from the address, once per address (SIM-030 property, SIM-031 from EP-11, EDI-023 express link).
  useEffect(() => {
    const signature = JSON.stringify({ p: property?.reference ?? null, ...prefill });
    const hasPrefill = property || prefill.montant || prefill.ref;
    if (!hasPrefill) return;
    const timer = window.setTimeout(() => {
      if (latest.current.prefillApplied === signature) return;
      const sc: Scenario = { ...base };
      let origin: Origin | null = null;
      const months = durationFromParams(prefill);
      if (property) {
        Object.assign(sc, {
          mode: 'FROM_PRICE',
          price: property.priceRef ? displayAmount(property.priceRef.amount) : '',
          downPayment: property.financing.downPayment ? displayAmount(property.financing.downPayment.amount) : '',
          durationMonths: property.financing.durationMonths,
          ratePct: property.financing.annualRateBps / 100,
          type: property.financing.pricingMethod === 'FLAT_MARGIN' ? 'ISLAMIC' : 'CONVENTIONAL',
          priceLinked: Boolean(property.priceRef),
          propertyId: property.id,
          currency: property.priceRef?.currency ?? ref,
        });
      }
      const amount = prefill.montant ? parseAmount(prefill.montant) : null;
      if (amount && Number(amount) > 0) {
        Object.assign(sc, { mode: 'FROM_AMOUNT', amount: displayAmount(amount) });
        if (prefill.base === 'prix' || prefill.base === 'budget') {
          origin = { base: prefill.base, ref: parseAmount(prefill.ref ?? '') ?? '0', fees: parseAmount(prefill.frais ?? '') ?? '0', down: parseAmount(prefill.apport ?? '') ?? '0', amount };
        }
      }
      if (months && months >= 12 && months <= 480) sc.durationMonths = months;
      if (prefill.devise && options.currencies.includes(prefill.devise)) sc.currency = prefill.devise;
      if (prefill.produit && options.products.some((p) => p.id === prefill.produit)) sc.solution = prefill.produit;
      if (prefill.taux && /^\d+$/.test(prefill.taux) && Number(prefill.taux) <= SIM_RATE.maxBps) sc.ratePct = Number(prefill.taux) / 100;
      if (prefill.methode === 'FLAT_MARGIN' && options.islamicFinance) sc.type = 'ISLAMIC';
      set({ scenarios: [sc], active: 0, origin, propertyReference: property?.reference ?? '', prefillApplied: signature });
    }, 30);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SFA-011 « Refaire avec les barèmes actuels » — the scenarios of a saved simulation, recomputed today (a new
  // simulation); a solution no longer offered falls back to the indicative scale, a property gone is left out.
  const session = useClientSession();
  const [redoNote, setRedoNote] = useState<string | null>(null);
  useEffect(() => {
    const id = prefill.simulation;
    if (session.status !== 'authenticated' || !id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    let alive = true;
    void apiCall<ClientSimulationDetail>(`/client/simulations/${id}`, { retryOnAuth: true }).then((r) => {
      if (!alive || !r.ok || r.data.type === 'ELIGIBILITY') return;
      const stored = r.data.inputs as { scenarios?: Record<string, unknown>[]; activeIndex?: number };
      const list = (stored.scenarios ?? []).slice(0, 3);
      if (!list.length) return;
      const str = (v: unknown) => (typeof v === 'string' ? v : '');
      const scenarios: Scenario[] = list.map((w) => {
        const product = str(w.bankProductId);
        const offered = product && options.products.some((p) => p.id === product);
        return {
          ...base,
          mode: w.mode === 'FROM_AMOUNT' ? 'FROM_AMOUNT' : 'FROM_PRICE',
          price: str(w.price) ? displayAmount(str(w.price)) : '',
          downPayment: str(w.downPayment) ? displayAmount(str(w.downPayment)) : '',
          amount: str(w.amount) ? displayAmount(str(w.amount)) : '',
          durationMonths: typeof w.durationMonths === 'number' ? w.durationMonths : base.durationMonths,
          solution: offered ? product : '',
          ratePct: !product && typeof w.annualRateBps === 'number' ? w.annualRateBps / 100 : base.ratePct,
          type: w.pricingMethod === 'FLAT_MARGIN' && options.islamicFinance ? 'ISLAMIC' : 'CONVENTIONAL',
          insurancePct: typeof w.insuranceRateBps === 'number' ? w.insuranceRateBps / 100 : 0,
          currency: str(w.currency) && options.currencies.includes(str(w.currency)) ? str(w.currency) : ref,
          priceLinked: Boolean(w.priceLinked && w.propertyId && !r.data.propertyGone),
          propertyId: r.data.propertyGone ? '' : str(w.propertyId),
        };
      });
      set({ scenarios, active: Math.min(stored.activeIndex ?? 0, scenarios.length - 1), origin: null, propertyReference: r.data.propertyGone ? '' : (r.data.property?.reference ?? ''), prefillApplied: `sim:${id}` });
      const date = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(r.data.createdAt));
      setRedoNote(
        [
          t('ui.clientTools.simulator.redoBanner', { date }),
          r.data.productGone ? t('ui.clientTools.simulator.productGone', { date }) : null,
          r.data.propertyGone ? t('ui.clientTools.simulator.propertyGone') : null,
        ]
          .filter(Boolean)
          .join(' '),
      );
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, prefill.simulation]);

  const active = Math.min(d.active, d.scenarios.length - 1);
  const sc = d.scenarios[active]!;
  const update = useCallback(
    (patch: Partial<Scenario>) => {
      const cur = latest.current;
      const list = cur.scenarios.map((x, i) => (i === Math.min(cur.active, cur.scenarios.length - 1) ? { ...x, ...patch } : x));
      set({ scenarios: list });
    },
    [set],
  );

  // ─── Validation and server calculation ────────────────────────────────
  const wires = useMemo(() => d.scenarios.map(toWire), [d.scenarios]);
  const checks = wires.map((w) => creditInputSchema.safeParse(w));
  const errors: Record<string, string> = {};
  const activeCheck = checks[active]!;
  if (!activeCheck.success) {
    for (const issue of activeCheck.error.issues) {
      const f = String(issue.path[0]);
      if (!errors[f]) errors[f] = fieldMessage(issue.message);
    }
  }
  const allValid = checks.every((c) => c.success);
  const request = useDebounced(allValid ? JSON.stringify({ scenarios: wires, activeIndex: active }) : null, SIM_DEBOUNCE_MS);
  const [response, setResponse] = useState<CreditResponse | null>(null);
  const [state, setState] = useState<'idle' | 'pending' | 'unavailable'>('idle');
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    if (!request) return;
    const ctrl = new AbortController();
    setState('pending');
    postJson<CreditResponse>('/api/v1/public/simulations/credit', JSON.parse(request) as unknown, { signal: ctrl.signal })
      .then((res) => {
        if (res.ok) {
          setResponse(res.data);
          setState('idle');
          const r = res.data.scenarios[(JSON.parse(request) as { activeIndex: number }).activeIndex];
          setAnnounce(r && !r.nothingToFinance ? t('ui.sim.credit.announce', { montant: fmt(r.monthlyPayment, 2) }) : t('ui.sim.credit.warnings.NOTHING'));
        } else if (res.status === 409 || res.status >= 500 || res.offline) {
          setState('unavailable');
        } else {
          setState('idle');
        }
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [request]);

  const result: CreditResult | null = response && allValid ? (response.scenarios[active] ?? null) : null;
  const warnings = result?.warnings ?? [];
  const warn = (code: CreditWarningItem['code']) => warnings.find((w) => w.code === code) ?? null;

  // ─── Written simulation for the actions (SIM-032 « Routes ») ──────────
  const written = useRef<{ sig: string; id: string } | null>(null);
  const ensureId = useCallback(
    async (isSaved: boolean): Promise<string | null> => {
      const body = { scenarios: latest.current.scenarios.map(toWire), activeIndex: Math.min(latest.current.active, latest.current.scenarios.length - 1) };
      const sig = JSON.stringify(body);
      if (written.current?.sig === sig) return written.current.id;
      const res = await postJson<SimulationCreatedResponse>('/api/v1/public/simulations', { ...body, isSaved }, { key: newKey() });
      if (!res.ok) return null;
      written.current = { sig, id: res.data.id };
      return res.data.id;
    },
    [],
  );

  // ─── Phone sticky bar (SIM-020) ───────────────────────────────────────
  const resultRef = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    const el = resultRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e!.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const islamic = (result?.financingType ?? sc.type) === 'ISLAMIC';
  const vocab = (k: 'rate' | 'interest' | 'creditCost' | 'amount') => t(`ui.sim.vocab.${islamic ? 'islamic' : 'conventional'}.${k}`);
  const sym = currencySymbol(sc.currency);
  const product = sc.solution ? (options.products.find((p) => p.id === sc.solution) ?? null) : null;
  const bounds = result?.durationBounds ?? (product ? { min: product.minDurationMonths, max: product.maxDurationMonths } : { min: 12, max: 480 });
  const yearsMin = Math.max(1, Math.ceil(bounds.min / 12));
  const yearsMax = Math.floor(bounds.max / 12);
  const priceN = Number(parseAmount(sc.price) ?? 0);
  const downN = Number(parseAmount(sc.downPayment) ?? 0);
  const downPct = priceN > 0 ? Math.round((downN / priceN) * 10_000) / 100 : 0;
  const originShown = d.origin && sc.mode === 'FROM_AMOUNT' && parseAmount(sc.amount) === d.origin.amount ? d.origin : null;
  const feesCounted = d.origin && Number(d.origin.fees) > 0;

  const setMode = (mode: Scenario['mode']) => {
    if (mode === sc.mode) return;
    if (mode === 'FROM_PRICE' && d.origin) {
      // SIM-031 — the price (or budget) and the down payment of the result come back; no acquisition fees in this mode.
      update({ mode, price: displayAmount(d.origin.ref), downPayment: displayAmount(d.origin.down) });
    } else if (mode === 'FROM_AMOUNT' && !sc.amount && priceN > 0) {
      update({ mode, amount: displayAmount(String(Math.max(0, priceN - downN))) });
    } else update({ mode });
  };

  const amountInput = (key: 'price' | 'downPayment' | 'amount', label: string, help?: string) => (
    <TextField
      id={`${uid}-${key}`}
      label={
        <>
          {label}
          {help ? <HelpTip text={help} /> : null}
        </>
      }
      inputMode="decimal"
      autoComplete="off"
      suffix={sym}
      value={sc[key]}
      onChange={(e) => update({ [key]: e.target.value, ...(key === 'price' ? { priceLinked: false } : {}) } as Partial<Scenario>)}
      onBlur={() => {
        const w = parseAmount(sc[key]);
        if (w) update({ [key]: displayAmount(w) } as Partial<Scenario>);
      }}
      error={sc[key].trim() ? (errors[key] ?? null) : null}
    />
  );
  const warningLine = (w: CreditWarningItem | null) =>
    w ? (
      <p className={s.fieldWarn} role="status">
        <Icon name="status-warning" size={16} />
        {warningText(w, sc.currency)}
      </p>
    ) : null;

  const capital = result?.amount ? Number(result.amount.amount) : 0;
  const cost = result?.totalCost ? Number(result.totalCost.amount) : 0;
  const total = capital + cost;
  const pctCapital = total > 0 ? Math.round((capital / total) * 100) : 0;
  const eligHref = (() => {
    const q = new URLSearchParams();
    const price = sc.mode === 'FROM_PRICE' ? parseAmount(sc.price) : parseAmount(sc.amount);
    if (price) q.set('prix', price);
    q.set('devise', sc.currency);
    if (d.propertyReference && sc.priceLinked) q.set('bien', d.propertyReference);
    return `/financements/simulateur-eligibilite?${q.toString()}`;
  })();

  return (
    <div className={s.wrap}>
      {redoNote ? (
        <p className={s.expressBanner} role="status">
          <Icon name="user" size={20} />
          {redoNote}
        </p>
      ) : null}
      {property && d.propertyReference ? <PropertyMini property={property} /> : null}
      <div className={s.creditGrid}>
        <form className={`${s.card} ${s.settings}`} onSubmit={(e) => e.preventDefault()} noValidate aria-labelledby={`${uid}-reglages`}>
          <h2 id={`${uid}-reglages`} className={s.cardTitle}>
            {t('ui.sim.credit.settings')}
          </h2>
          <fieldset className={s.fieldset}>
            <legend className={s.legend}>{t('ui.sim.credit.mode')}</legend>
            <div className={s.segmented}>
              {(['FROM_PRICE', 'FROM_AMOUNT'] as const).map((m) => (
                <label key={m}>
                  <input type="radio" name={`${uid}-mode`} checked={sc.mode === m} onChange={() => setMode(m)} />
                  {t(`ui.enum.CreditMode.${m}`)}
                </label>
              ))}
            </div>
          </fieldset>
          {sc.mode === 'FROM_PRICE' ? (
            <div className={s.stack}>
              <div className={s.row}>
                {amountInput('price', t('ui.sim.credit.price'))}
                {amountInput('downPayment', t('ui.sim.credit.downPayment'), t('ui.help.downPayment'))}
              </div>
              {priceN > 0 ? (
                <SliderField
                  id={`${uid}-pct`}
                  label={t('ui.sim.credit.downPaymentPct')}
                  value={downPct}
                  min={0}
                  max={100}
                  step={1}
                  decimals={0}
                  onChange={(v) => update({ downPayment: displayAmount(String(Math.round((priceN * v) / 100))) })}
                  suffix="%"
                  valueText={(v) => `${pctNum(v)} %`}
                  boundsText={['0 %', '100 %']}
                />
              ) : null}
              {warningLine(warn('DOWN_PAYMENT_BELOW_MIN'))}
              {priceN > 0 ? (
                <p className={s.muted}>
                  {t('ui.sim.credit.amountComputed')} : <strong>{fmtValue(Math.max(0, priceN - downN), sc.currency)}</strong>
                </p>
              ) : null}
              {d.origin && feesCounted ? <p className={s.origin}>{t('ui.sim.common.feesExcludedShort')}</p> : null}
            </div>
          ) : (
            <div className={s.stack}>
              {amountInput('amount', t('ui.sim.credit.amount'))}
              {originShown ? (
                <p className={s.origin}>
                  {originShown.base === 'prix'
                    ? Number(originShown.fees) > 0
                      ? t('ui.sim.credit.originPrice', { prix: fmtValue(originShown.ref, sc.currency), frais: fmtValue(originShown.fees, sc.currency), apport: fmtValue(originShown.down, sc.currency) })
                      : t('ui.sim.credit.originPriceNoFees', { prix: fmtValue(originShown.ref, sc.currency), apport: fmtValue(originShown.down, sc.currency) })
                    : Number(originShown.fees) > 0
                      ? t('ui.sim.credit.originBudget', { budget: fmtValue(originShown.ref, sc.currency), frais: fmtValue(originShown.fees, sc.currency), apport: fmtValue(originShown.down, sc.currency) })
                      : t('ui.sim.credit.originBudgetNoFees', { budget: fmtValue(originShown.ref, sc.currency), apport: fmtValue(originShown.down, sc.currency) })}
                </p>
              ) : null}
            </div>
          )}
          {warningLine(warn('AMOUNT_OUT_OF_PRODUCT_BOUNDS'))}

          <SliderField
            id={`${uid}-duree`}
            label={t('ui.sim.credit.duration')}
            value={Math.round(sc.durationMonths / 12)}
            min={yearsMin}
            max={Math.max(yearsMin + 1, yearsMax)}
            step={1}
            fieldStep={1}
            onChange={(v) => update({ durationMonths: v * 12 })}
            suffix={t('ui.sim.common.yearsSuffix')}
            valueText={(v) => t('ui.sim.common.years', { n: v })}
            boundsText={[durationText(bounds.min), durationText(bounds.max)]}
          >
            {warningLine(warn('DURATION_OUT_OF_PRODUCT_BOUNDS'))}
          </SliderField>

          <SelectField id={`${uid}-solution`} label={t('ui.sim.credit.solution')} value={sc.solution} onChange={(e) => update({ solution: e.target.value })}>
            <option value="">{t('ui.sim.common.indicativeLabel')}</option>
            {options.products.map((p) => (
              <option key={p.id} value={p.id}>
                {productLabel(p)}
              </option>
            ))}
          </SelectField>

          {sc.solution ? (
            result?.annualRateBps !== undefined && result?.annualRateBps !== null ? (
              <p className={s.muted}>{t('ui.sim.credit.rateFromProduct', { label: vocab('rate'), taux: rateText(result.annualRateBps) })}</p>
            ) : null
          ) : (
            <>
              <SliderField
                id={`${uid}-taux`}
                label={vocab('rate')}
                value={sc.ratePct}
                min={0}
                max={SIM_RATE.sliderMaxBps / 100}
                fieldMax={SIM_RATE.maxBps / 100}
                step={SIM_RATE.stepBps / 100}
                fieldStep={0.01}
                decimals={2}
                onChange={(v) => update({ ratePct: Math.round(v * 100) / 100 })}
                suffix="%"
                valueText={(v) => rateText(Math.round(v * 100))}
                boundsText={['0 %', `${pctNum(SIM_RATE.sliderMaxBps / 100)} %`]}
              >
                {sc.ratePct === 0 ? (
                  <p className={s.fieldWarn}>
                    <Icon name="status-warning" size={16} />
                    {t('ui.sim.credit.rateZero')}
                  </p>
                ) : null}
              </SliderField>
              {options.islamicFinance ? (
                <fieldset className={s.fieldset}>
                  <legend className={s.legend}>
                    {t('ui.sim.credit.type')}
                    <HelpTip text={t('ui.help.islamicFinancing')} />
                  </legend>
                  <div className={s.segmented}>
                    {(['CONVENTIONAL', 'ISLAMIC'] as const).map((ty) => (
                      <label key={ty}>
                        <input type="radio" name={`${uid}-type`} checked={sc.type === ty} onChange={() => update({ type: ty })} />
                        {t(`ui.sim.credit.typeOptions.${ty}`)}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </>
          )}

          <details className={s.advanced}>
            <summary>{t('ui.sim.credit.advanced')}</summary>
            <div className={s.row}>
              {!sc.solution ? (
                <TextField
                  id={`${uid}-assurance`}
                  label={t('ui.sim.credit.insurance')}
                  optional
                  inputMode="decimal"
                  suffix="%"
                  value={sc.insurancePct ? String(sc.insurancePct).replace('.', ',') : ''}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(',', '.'));
                    if (e.target.value.trim() === '') update({ insurancePct: 0 });
                    else if (Number.isFinite(n) && n >= 0 && n <= 5) update({ insurancePct: n });
                  }}
                />
              ) : null}
              {options.currencies.length > 1 ? (
                <SelectField id={`${uid}-devise`} label={t('ui.sim.common.currencyLabel')} value={sc.currency} onChange={(e) => update({ currency: e.target.value, priceLinked: false })}>
                  {options.currencies.map((c) => (
                    <option key={c} value={c}>
                      {`${c} (${currencySymbol(c)})`}
                    </option>
                  ))}
                </SelectField>
              ) : null}
            </div>
          </details>
          <Link href={eligHref} className={s.linkButton}>
            {t('ui.sim.credit.toEligibility')}
          </Link>
        </form>

        <div className={s.resultSide}>
          <section ref={resultRef} className={`${s.monthlyCard} ${state === 'pending' ? s.pending : ''}`} aria-labelledby={`${uid}-resultat`} aria-busy={state === 'pending'}>
            <h2 id={`${uid}-resultat`} className={s.heroBadge}>
              {t('ui.sim.credit.result')}
            </h2>
            <span className={s.srOnly} aria-live="polite">
              {announce}
            </span>
            {state === 'unavailable' ? (
              <p className={s.nothing}>{t('ui.sim.common.unavailable')}</p>
            ) : !result ? (
              <p className={s.nothing}>{t('ui.sim.common.nothingYet')}</p>
            ) : result.nothingToFinance ? (
              <p className={s.nothing}>{t('ui.sim.credit.warnings.NOTHING')}</p>
            ) : (
              <>
                <p className={s.monthlyBig}>
                  <Rolling value={result.monthlyPayment} digits={2} approx={result.productCurrency !== null} /> <small>{`${t('ui.common.perMonth')}*`}</small>
                </p>
                {result.monthlyInsurance && Number(result.monthlyInsurance.amount) > 0 ? (
                  <p className={s.monthlySub}>{t('ui.sim.credit.monthlyWithInsurance', { total: fmt(result.monthlyTotal, 2, result.productCurrency !== null) })}</p>
                ) : null}
                {result.productCurrency ? <p className={s.heroLegal}>{t('ui.sim.credit.productCurrency', { devise: result.productCurrency })}</p> : null}
                <dl className={s.details}>
                  <div>
                    <dt>{t('ui.sim.credit.amountFinanced')}</dt>
                    <dd>{fmt(result.amount, 2)}</dd>
                  </div>
                  <div>
                    <dt>{vocab('creditCost')}</dt>
                    <dd>{fmt(result.totalInterest, 2)}</dd>
                  </div>
                  <div>
                    <dt>{t('ui.sim.credit.insuranceTotal')}</dt>
                    <dd>{fmt(result.totalInsurance, 2)}</dd>
                  </div>
                  {result.fees && Number(result.fees.amount) > 0 ? (
                    <div>
                      <dt>{t('ui.sim.credit.fees')}</dt>
                      <dd>{fmt(result.fees, 2)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>{t('ui.sim.credit.totalCost')}</dt>
                    <dd>{fmt(result.totalCost, 2)}</dd>
                  </div>
                  <div>
                    <dt>{t('ui.sim.credit.totalRepaid')}</dt>
                    <dd>{fmt(result.totalRepaid, 2)}</dd>
                  </div>
                </dl>
                {result.otherFeesNote ? <p className={s.heroLegal}>{result.otherFeesNote}</p> : null}
                <div className={s.chart}>
                  <span className={s.figureLabel}>{t('ui.sim.credit.chartTitle')}</span>
                  <div className={s.chartBar} aria-hidden="true">
                    <span className={s.chartCapital} style={{ width: `${pctCapital}%` }} />
                    <span className={s.chartCost} style={{ width: `${100 - pctCapital}%` }} />
                  </div>
                  <div className={s.chartLegend} aria-hidden="true">
                    <span>
                      <i className={s.dot} style={{ background: 'var(--bo-accent-bleu)' }} />
                      {t('ui.sim.credit.chartCapital')}
                    </span>
                    <span>
                      <i className={s.dot} style={{ background: 'var(--bo-accent-or)' }} />
                      {t('ui.sim.credit.chartCost')}
                    </span>
                  </div>
                  <p className={s.srOnly}>
                    {t('ui.sim.credit.chartText', {
                      total: fmt(result.totalRepaid, 2),
                      capital: fmt(result.amount, 2),
                      pctCapital,
                      cout: fmt(result.totalCost, 2),
                      pctCout: 100 - pctCapital,
                    })}
                  </p>
                </div>
              </>
            )}
            {!sc.solution ? (
              <p className={s.heroLegal}>
                <strong>{t('ui.sim.common.indicativeLabel')}</strong>
                <HelpTip text={t('ui.help.indicativeScale')} /> {t('ui.sim.common.indicativeBanner')}
              </p>
            ) : null}
            <p className={s.heroLegal}>
              {settings['legal.simulatorDisclaimer']} {settings['legal.monthlyFootnote']}
              {result?.rateDate ? ` ${t('ui.common.rateDate', { date: new Date(`${result.rateDate}T12:00:00Z`).toLocaleDateString('fr-FR') })}` : ''}
            </p>
          </section>
          {result && !result.nothingToFinance ? (
            <ResultActions settings={settings} ensureId={ensureId} pdfBody={() => ({ type: 'CREDIT', scenarios: wires, activeIndex: active })} propertyReference={sc.priceLinked ? d.propertyReference : null} />
          ) : null}
        </div>
      </div>

      <Compare
        uid={uid}
        scenarios={d.scenarios}
        active={active}
        response={allValid ? response : null}
        onSelect={(i) => set({ active: i })}
        onAdd={() => set({ scenarios: [...d.scenarios, { ...sc }], active: d.scenarios.length })}
        onRemove={(i) => set({ scenarios: d.scenarios.filter((_, k) => k !== i), active: Math.max(0, active >= i ? active - 1 : active) })}
      />

      {result && !result.nothingToFinance ? <Schedule uid={uid} result={result} interestLabel={vocab('interest')} /> : null}

      <p className={s.legal}>
        <button
          type="button"
          className={s.linkButton}
          onClick={() => {
            clear();
            set({ scenarios: [base], active: 0, origin: null, propertyReference: '', prefillApplied: d.prefillApplied });
          }}
        >
          {t('ui.sim.elig.restart')}
        </button>
      </p>

      <div className={s.sticky} data-visible={Boolean(offscreen && result && !result.nothingToFinance)} aria-hidden={!offscreen}>
        <span>{result?.monthlyPayment ? t('ui.sim.common.monthly', { montant: fmt(result.monthlyPayment, 2) }) : ''}</span>
        <button type="button" className={s.stickyButton} onClick={() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          {t('ui.sim.credit.sticky')}
        </button>
      </div>
    </div>
  );
}

function warningText(w: CreditWarningItem, currency: string): string {
  const m = (v: string | number) => fmtValue(v, currency);
  switch (w.code) {
    case 'AMOUNT_OUT_OF_PRODUCT_BOUNDS':
      return t('ui.sim.credit.warnings.AMOUNT_OUT_OF_PRODUCT_BOUNDS', { min: m(w.params.min!), max: m(w.params.max!) });
    case 'DURATION_OUT_OF_PRODUCT_BOUNDS':
      return t('ui.sim.credit.warnings.DURATION_OUT_OF_PRODUCT_BOUNDS', { min: durationText(Number(w.params.min)), max: durationText(Number(w.params.max)) });
    default:
      return t('ui.sim.credit.warnings.DOWN_PAYMENT_BELOW_MIN', { pct: pctNum(w.params.pct!), montant: m(w.params.amount!) });
  }
}

// ─── SIM-023 scenarios ──────────────────────────────────────────────────────

function Compare({
  uid,
  scenarios,
  active,
  response,
  onSelect,
  onAdd,
  onRemove,
}: {
  uid: string;
  scenarios: Scenario[];
  active: number;
  response: CreditResponse | null;
  onSelect: (i: number) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  if (scenarios.length === 1 && !response) return null;
  const cmp = response?.comparison ?? null;
  return (
    <section className={s.stack} aria-labelledby={`${uid}-comparer`}>
      <h2 id={`${uid}-comparer`} className={s.cardTitle}>
        {t('ui.sim.credit.compare.title')}
      </h2>
      <div className={s.compare}>
        {scenarios.map((sc, i) => {
          const r = response?.scenarios[i] ?? null;
          return (
            <article key={i} className={`${s.scenario} ${i === active ? s.scenarioActive : ''}`}>
              <div className={s.scenarioHead}>
                <button type="button" className={s.scenarioSelect} onClick={() => onSelect(i)} aria-pressed={i === active} aria-label={t('ui.sim.credit.compare.select', { n: i + 1 })}>
                  {t('ui.sim.credit.compare.column', { n: i + 1 })}
                </button>
                {scenarios.length > 1 ? (
                  <button type="button" className={s.scenarioRemove} onClick={() => onRemove(i)} aria-label={t('ui.sim.credit.compare.remove', { n: i + 1 })}>
                    <Icon name="close" size={16} />
                  </button>
                ) : null}
              </div>
              {i === active ? <span className={s.muted}>{t('ui.sim.credit.compare.active')}</span> : null}
              <dl className={s.scenarioLines}>
                <dt>{t('ui.sim.credit.compare.downPayment')}</dt>
                <dd>{sc.mode === 'FROM_PRICE' && parseAmount(sc.downPayment) ? fmtValue(parseAmount(sc.downPayment)!, sc.currency) : '—'}</dd>
                <dt>{t('ui.sim.credit.compare.duration')}</dt>
                <dd>{durationText(r?.durationMonths ?? sc.durationMonths)}</dd>
                <dt>{t('ui.sim.credit.compare.rate')}</dt>
                <dd>{r?.annualRateBps !== null && r?.annualRateBps !== undefined ? rateText(r.annualRateBps) : sc.solution ? '—' : rateText(Math.round(sc.ratePct * 100))}</dd>
                <dt>{t('ui.sim.credit.compare.monthly')}</dt>
                <dd>{r && !r.nothingToFinance ? fmt(r.monthlyPayment, 2) : '—'}</dd>
                <dt>{t('ui.sim.credit.compare.totalCost')}</dt>
                <dd>{r && !r.nothingToFinance ? fmt(r.totalCost, 2) : '—'}</dd>
                <dt>{t('ui.sim.credit.compare.totalRepaid')}</dt>
                <dd>{r && !r.nothingToFinance ? fmt(r.totalRepaid, 2) : '—'}</dd>
              </dl>
              {scenarios.length > 1 && cmp?.lowestMonthlyIndex === i ? <span className={s.tag}>{t('ui.sim.credit.compare.lowestMonthly')}</span> : null}
              {scenarios.length > 1 && cmp?.lowestCostIndex === i ? <span className={s.tag}>{t('ui.sim.credit.compare.lowestCost')}</span> : null}
            </article>
          );
        })}
        {scenarios.length < SIM_SCENARIOS_MAX ? (
          <button type="button" className={s.addScenario} onClick={onAdd}>
            <Icon name="plus" size={24} />
            {t('ui.sim.credit.compare.add')}
          </button>
        ) : null}
      </div>
    </section>
  );
}

// ─── SIM-021 schedule ───────────────────────────────────────────────────────

function Schedule({ uid, result, interestLabel }: { uid: string; result: CreditResult; interestLabel: string }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [all, setAll] = useState(false);
  const c = (v: string) => fmtValue(v, result.currency, 2);
  const years = all ? result.schedule : result.schedule.slice(0, 10);
  const toggle = (y: number) => setOpen((o) => (o.has(y) ? new Set([...o].filter((x) => x !== y)) : new Set([...o, y])));
  return (
    <section className={s.stack} aria-labelledby={`${uid}-echeancier`}>
      <h2 id={`${uid}-echeancier`} className={s.cardTitle}>
        {t('ui.sim.credit.schedule')}
      </h2>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <caption>{t('ui.sim.credit.scheduleCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('ui.sim.credit.col.period')}</th>
              <th scope="col">{t('ui.sim.credit.col.payments')}</th>
              <th scope="col">{t('ui.sim.credit.col.principal')}</th>
              <th scope="col">{interestLabel}</th>
              <th scope="col">{t('ui.sim.credit.col.insurance')}</th>
              <th scope="col">{t('ui.sim.credit.col.remaining')}</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const expanded = open.has(y.year);
              return [
                <tr key={`y${y.year}`}>
                  <th scope="row">
                    {y.months.length ? (
                      <button
                        type="button"
                        className={s.yearToggle}
                        aria-expanded={expanded}
                        aria-label={t(expanded ? 'ui.sim.credit.hideMonths' : 'ui.sim.credit.showMonths', { n: y.year })}
                        onClick={() => toggle(y.year)}
                      >
                        <Icon name="chevron-right" size={16} />
                        {t('ui.sim.credit.year', { n: y.year })}
                      </button>
                    ) : (
                      t('ui.sim.credit.year', { n: y.year })
                    )}
                  </th>
                  <td>{c(y.payments)}</td>
                  <td>{c(y.principal)}</td>
                  <td>{c(y.interest)}</td>
                  <td>{c(y.insurance)}</td>
                  <td>{c(y.remaining)}</td>
                </tr>,
                ...(expanded
                  ? y.months.map((m) => (
                      <tr key={`m${m.number}`} className={s.monthRow}>
                        <td>{new Date(`${m.date}T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</td>
                        <td>{c(m.payment)}</td>
                        <td>{c(m.principal)}</td>
                        <td>{c(m.interest)}</td>
                        <td>{c(m.insurance)}</td>
                        <td>{c(m.remaining)}</td>
                      </tr>
                    ))
                  : []),
              ];
            })}
          </tbody>
        </table>
      </div>
      {!all && result.schedule.length > 10 ? (
        <button type="button" className={buttonClass('secondary', 'M')} onClick={() => setAll(true)} style={{ alignSelf: 'flex-start' }}>
          <ButtonInner size="M">{t('ui.sim.credit.showAllYears')}</ButtonInner>
        </button>
      ) : null}
    </section>
  );
}
