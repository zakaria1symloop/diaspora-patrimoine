'use client';
// EP-11 — « Testez votre éligibilité » (SIM-010 … SIM-015). Three steps with live validation by the shared schema
// (ARC-030), « Voir mon résultat » computed AND written by the server (SIM-001, SIM-015: dp_anon); inputs kept in session
// storage and the result reopened (recomputed, same Idempotency-Key → same simulation) on reload (SIM-007); the recap
// « Votre simulation » opens each step; simplified mode (TRV-122): one question per screen, « Étape {n} sur {total} ».
// The result never recomputes anything: every figure comes from the response (`shown`, CAL-026).
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  eligibilityInputSchemaFor,
  type CatalogueResponse,
  type ClientSimulationDetail,
  type SimulatorPrefill,
  type EligibilityInputWire,
  type EligibilityResponse,
  type EligibilityResult,
  type PropertyCard as Card,
  type PublicSettings,
  type SimulatorOptions,
  type SimulatorProperty,
} from '@dp/contracts';
import { Button, Icon, buttonClass, ButtonInner } from '@dp/ui';
import { useDraft } from '@/lib/public-form';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { useClientSession } from '@/lib/session-client';
import { t } from '@/lib/i18n';
import { CheckboxField, SelectField, TextField } from '@/components/forms/fields';
import { CountrySelect } from '@/components/forms/lead-parts';
import { PropertyCard } from '@/components/vitrine/PropertyCard';
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
  newKey,
  parseAmount,
  pctNum,
  postJson,
  useSimpleMode,
} from './shared';
import s from './sim.module.css';

export interface EligibilityPrefill {
  /** EDI-023 « Affiner »: down payment of the express calculation (step 3 prefilled). */
  apport?: string;
  /** EDI-023: banner « Vous souhaitiez {m} / mois ». */
  mensualite?: string;
  /** From EP-12 « Tester mon éligibilité »: the price as target price (SIM-031). */
  prix?: string;
  devise?: string;
  /** SFA-011 « Refaire avec les barèmes actuels » — a saved simulation of the signed-in client. */
  simulation?: string;
}

interface Draft {
  propertyCountry: string;
  residencyStatus: string;
  countryOfResidence: string;
  birthYear: string;
  monthlyIncome: string;
  incomeCurrency: string;
  currencyTouched: boolean;
  coBorrower: boolean;
  coBorrowerIncome: string;
  otherIncome: string;
  monthlyDebts: string;
  downPayment: string;
  durationMode: 'longest' | 'choose';
  durationYears: number;
  financingPreference: 'NO_PREFERENCE' | 'CONVENTIONAL' | 'ISLAMIC';
  targetPrice: string;
  targetCurrency: string;
  targetPriceLinked: boolean;
  propertyId: string;
  propertyReference: string;
  expressMonthly: string;
  screen: number;
  showResult: boolean;
  key: string;
  sig: string;
  prefillApplied: string;
  /** SIM-033 — the record's values were applied once (`profile`), or a saved simulation (`sim:{id}`). */
  accountApplied: string;
  /** SIM-033 « Mettre à jour mon profil avec ces informations » — unchecked by default. */
  updateProfile: boolean;
}

type Step = 1 | 2 | 3;
interface Question {
  key: string;
  step: Step;
  fields: (keyof EligibilityInputWire)[];
  render: () => ReactNode;
}

const STEP_OF_REASON: Record<string, Step> = { DEBT_RATIO: 2, INCOME_TOO_LOW: 2, AGE_OR_DURATION: 3, AMOUNT_BELOW_MIN: 3 };

function wireAmount(raw: string): string | undefined {
  if (!raw.trim()) return undefined;
  return parseAmount(raw) ?? raw;
}

function toWire(d: Draft): EligibilityInputWire {
  return {
    propertyCountry: d.propertyCountry,
    residencyStatus: d.residencyStatus as EligibilityInputWire['residencyStatus'],
    countryOfResidence: d.countryOfResidence,
    birthYear: (d.birthYear.trim() ? Number(d.birthYear.trim()) : undefined) as number,
    monthlyIncome: wireAmount(d.monthlyIncome) as string,
    incomeCurrency: d.incomeCurrency,
    coBorrowerIncome: d.coBorrower ? wireAmount(d.coBorrowerIncome) : undefined,
    otherIncome: wireAmount(d.otherIncome),
    monthlyDebts: wireAmount(d.monthlyDebts) as string,
    downPayment: wireAmount(d.downPayment) as string,
    downPaymentCurrency: d.incomeCurrency,
    desiredDurationMonths: d.durationMode === 'choose' ? d.durationYears * 12 : undefined,
    financingPreference: d.financingPreference,
    targetPrice: wireAmount(d.targetPrice),
    targetCurrency: d.targetPrice.trim() ? d.targetCurrency || d.incomeCurrency : undefined,
    targetPriceLinked: d.targetPriceLinked && Boolean(d.propertyId),
    propertyId: d.propertyId || undefined,
  };
}

export function EligibilitySimulator({
  settings,
  options,
  property,
  prefill,
  year,
}: {
  settings: PublicSettings;
  options: SimulatorOptions;
  property: SimulatorProperty | null;
  prefill: EligibilityPrefill;
  year: number;
}) {
  const uid = useId();
  const simple = useSimpleMode();
  const schema = useMemo(() => eligibilityInputSchemaFor(year), [year]);
  const ref = options.referenceCurrency;
  const singleCountry = options.propertyCountries.length === 1 ? options.propertyCountries[0]!.code : '';
  const initial: Draft = {
    propertyCountry: property?.countryCode ?? singleCountry,
    residencyStatus: '',
    countryOfResidence: '',
    birthYear: '',
    monthlyIncome: '',
    incomeCurrency: ref,
    currencyTouched: false,
    coBorrower: false,
    coBorrowerIncome: '',
    otherIncome: '',
    monthlyDebts: '',
    downPayment: '',
    durationMode: 'longest',
    durationYears: Math.round(options.indicative.maxDurationMonths / 12),
    financingPreference: 'NO_PREFERENCE',
    targetPrice: '',
    targetCurrency: ref,
    targetPriceLinked: false,
    propertyId: '',
    propertyReference: '',
    expressMonthly: '',
    screen: 0,
    showResult: false,
    key: '',
    sig: '',
    prefillApplied: '',
    accountApplied: '',
    updateProfile: false,
  };
  const [d, set, clear] = useDraft<Draft>('sim-eligibilite', initial);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ id: string; result: EligibilityResult } | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'unavailable' | 'error'>('idle');
  const [callbackSignal, setCallbackSignal] = useState(0);
  const headRef = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);

  const latest = useRef(d);
  latest.current = d;
  const session = useClientSession();
  const signedIn = session.status === 'authenticated';
  const [accountNote, setAccountNote] = useState<string | null>(null);
  // SIM-033 — signed in: steps 1 and 2 prefilled from the record (only empty fields, once); SFA-011 « Refaire »: the
  // settings of a saved simulation, recomputed with today's scales (a new simulation).
  useEffect(() => {
    if (!signedIn) return;
    const sim = prefill.simulation && /^[0-9a-f-]{36}$/i.test(prefill.simulation) ? prefill.simulation : null;
    const tag = sim ? `sim:${sim}` : 'profile';
    if (latest.current.accountApplied === tag) return;
    let alive = true;
    if (sim) {
      void apiCall<ClientSimulationDetail>(`/client/simulations/${sim}`, { retryOnAuth: true }).then((r) => {
        if (!alive || !r.ok || r.data.type !== 'ELIGIBILITY') return;
        const i = r.data.inputs as Record<string, string | number | boolean | undefined>;
        const str = (v: unknown) => (typeof v === 'string' ? v : '');
        const date = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(r.data.createdAt));
        set({
          accountApplied: tag,
          showResult: false,
          screen: 0,
          propertyCountry: str(i.propertyCountry) || latest.current.propertyCountry,
          residencyStatus: str(i.residencyStatus),
          countryOfResidence: str(i.countryOfResidence),
          birthYear: i.birthYear ? String(i.birthYear) : '',
          monthlyIncome: i.monthlyIncome ? displayAmount(String(i.monthlyIncome)) : '',
          incomeCurrency: str(i.incomeCurrency) || ref,
          currencyTouched: true,
          coBorrower: Boolean(i.coBorrowerIncome),
          coBorrowerIncome: i.coBorrowerIncome ? displayAmount(String(i.coBorrowerIncome)) : '',
          otherIncome: i.otherIncome ? displayAmount(String(i.otherIncome)) : '',
          monthlyDebts: i.monthlyDebts !== undefined ? displayAmount(String(i.monthlyDebts)) : '',
          downPayment: i.downPayment !== undefined ? displayAmount(String(i.downPayment)) : '',
          financingPreference: (i.financingPreference as Draft['financingPreference']) ?? 'NO_PREFERENCE',
          durationMode: i.desiredDurationMonths ? 'choose' : 'longest',
          durationYears: i.desiredDurationMonths ? Math.round(Number(i.desiredDurationMonths) / 12) : latest.current.durationYears,
          // SFA-011 — the property gone: the simulator opens without it, with the price of then.
          targetPrice: i.targetPrice ? displayAmount(String(i.targetPrice)) : '',
          targetCurrency: str(i.targetCurrency) || ref,
          targetPriceLinked: Boolean(i.targetPriceLinked && i.propertyId && !r.data.propertyGone),
          propertyId: r.data.propertyGone ? '' : str(i.propertyId),
          propertyReference: r.data.propertyGone ? '' : (r.data.property?.reference ?? ''),
        });
        setAccountNote(
          [
            t('ui.clientTools.simulator.redoBanner', { date }),
            r.data.productGone ? t('ui.clientTools.simulator.productGone', { date }) : null,
            r.data.propertyGone ? t('ui.clientTools.simulator.propertyGone') : null,
          ]
            .filter(Boolean)
            .join(' '),
        );
      });
    } else {
      void apiCall<SimulatorPrefill>('/client/simulations/prefill', { retryOnAuth: true }).then((r) => {
        if (!alive || !r.ok) return;
        const p = r.data;
        const cur = latest.current;
        const patch: Partial<Draft> = { accountApplied: tag };
        const fill = <K extends keyof Draft>(k: K, v: Draft[K] | null | undefined) => {
          if (v !== null && v !== undefined && v !== '' && !cur[k]) patch[k] = v;
        };
        if (p.propertyCountry && options.propertyCountries.some((c) => c.code === p.propertyCountry)) fill('propertyCountry', p.propertyCountry);
        fill('residencyStatus', p.residencyStatus ?? '');
        fill('countryOfResidence', p.countryOfResidence ?? '');
        fill('birthYear', p.birthYear ? String(p.birthYear) : '');
        fill('monthlyIncome', p.monthlyIncome ? displayAmount(p.monthlyIncome) : '');
        fill('otherIncome', p.otherIncome ? displayAmount(p.otherIncome) : '');
        fill('monthlyDebts', p.monthlyDebts ? displayAmount(p.monthlyDebts) : '');
        fill('downPayment', p.downPayment ? displayAmount(p.downPayment) : '');
        if (p.incomeCurrency && options.currencies.includes(p.incomeCurrency) && !cur.currencyTouched) Object.assign(patch, { incomeCurrency: p.incomeCurrency, currencyTouched: true });
        if (p.financingPreference && cur.financingPreference === 'NO_PREFERENCE') patch.financingPreference = p.financingPreference;
        set(patch);
        if (Object.keys(patch).length > 1) setAccountNote(t('ui.clientTools.simulator.prefilled'));
      });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, prefill.simulation]);
  // Prefill from the address (SIM-030 property, EDI-023 express, SIM-031 from EP-12) — once per address, after the
  // session draft is loaded (a reload keeps what the visitor changed since).
  useEffect(() => {
    const signature = JSON.stringify({ p: property?.reference ?? null, ...prefill });
    if (!property && !prefill.apport && !prefill.mensualite && !prefill.prix) return;
    const timer = window.setTimeout(() => applyPrefill(signature), 30);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const applyPrefill = (signature: string) => {
    if (latest.current.prefillApplied === signature) return;
    const patch: Partial<Draft> = { prefillApplied: signature, showResult: false };
    if (property?.priceRef) {
      Object.assign(patch, {
        targetPrice: displayAmount(property.priceRef.amount),
        targetCurrency: property.priceRef.currency,
        targetPriceLinked: true,
        propertyId: property.id,
        propertyReference: property.reference,
        propertyCountry: property.countryCode,
      });
    }
    if (prefill.apport && parseAmount(prefill.apport)) Object.assign(patch, { downPayment: displayAmount(parseAmount(prefill.apport)) });
    if (prefill.mensualite && parseAmount(prefill.mensualite)) patch.expressMonthly = parseAmount(prefill.mensualite)!;
    if (prefill.prix && parseAmount(prefill.prix)) {
      Object.assign(patch, { targetPrice: displayAmount(parseAmount(prefill.prix)), targetCurrency: prefill.devise && options.currencies.includes(prefill.devise) ? prefill.devise : ref, targetPriceLinked: Boolean(property) });
    }
    set(patch);
  };

  const wire = toWire(d);
  const parsed = schema.safeParse(wire);
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      if (errors[field]) continue;
      errors[field] =
        field === 'birthYear' && issue.message === 'OUT_OF_RANGE'
          ? t('ui.sim.elig.ageRange', { min: 18, max: 85 })
          : fieldMessage(issue.message, issue.code === 'too_big' ? { n: Number(issue.maximum) } : null);
    }
  }
  const err = (f: string) => (touched.has(f) ? (errors[f] ?? null) : null);
  const touch = (...f: string[]) => setTouched((x) => new Set([...x, ...f]));

  const currencies = options.currencies;
  const durationBounds = options.products.length ? [1, 40] : [Math.ceil(options.indicative.minDurationMonths / 12), Math.floor(options.indicative.maxDurationMonths / 12)];
  const sym = currencySymbol(d.incomeCurrency);

  // SIM-003 — the currency of the residence country is proposed, unless the visitor chose one.
  const onResidence = (code: string) => {
    const proposed = options.currencyByCountry[code];
    const patch: Partial<Draft> = { countryOfResidence: code };
    if (!d.currencyTouched) {
      const cur = proposed && currencies.includes(proposed) ? proposed : ref;
      patch.incomeCurrency = cur;
      if (!d.targetPriceLinked) patch.targetCurrency = cur;
    }
    set(patch);
  };

  const amountField = (key: 'monthlyIncome' | 'coBorrowerIncome' | 'otherIncome' | 'monthlyDebts' | 'downPayment' | 'targetPrice', label: string, extra: { hint?: string; optional?: boolean; suffix?: string; help?: string } = {}) => (
    <TextField
      id={`${uid}-${key}`}
      label={
        <>
          {label}
          {extra.help ? <HelpTip text={extra.help} /> : null}
        </>
      }
      optional={extra.optional}
      hint={extra.hint}
      inputMode="decimal"
      autoComplete="off"
      suffix={extra.suffix ?? sym}
      value={d[key]}
      onChange={(e) => set({ [key]: e.target.value, ...(key === 'targetPrice' ? { targetPriceLinked: false } : {}) } as Partial<Draft>)}
      onBlur={() => {
        touch(key);
        const w = parseAmount(d[key]);
        if (w) set({ [key]: displayAmount(w) } as Partial<Draft>);
      }}
      error={err(key)}
    />
  );

  const plausible = (raw: string, limit: number, above: boolean, currency: string) => {
    const w = parseAmount(raw);
    if (!w) return null;
    const n = Number(w);
    if (above ? n > limit : n < limit) {
      return (
        <p className={s.fieldWarn}>
          <Icon name="status-warning" size={16} />
          {t('ui.sim.common.plausibility', { montant: fmt({ amount: w, currency }) })}
        </p>
      );
    }
    return null;
  };

  const questions: Question[] = [
    ...(options.propertyCountries.length > 1
      ? [
          {
            key: 'propertyCountry',
            step: 1 as Step,
            fields: ['propertyCountry'] as (keyof EligibilityInputWire)[],
            render: () => (
              <SelectField id={`${uid}-propertyCountry`} label={t('ui.sim.elig.fields.propertyCountry')} value={d.propertyCountry} onChange={(e) => set({ propertyCountry: e.target.value })} onBlur={() => touch('propertyCountry')} error={err('propertyCountry')}>
                <option value="" />
                {options.propertyCountries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
            ),
          },
        ]
      : []),
    {
      key: 'residency',
      step: 1,
      fields: ['residencyStatus'],
      render: () => (
        <fieldset className={s.fieldset}>
          <legend className={s.legend}>{t('ui.sim.elig.fields.residencyStatus')}</legend>
          <div className={s.choiceList} role="radiogroup">
            {(['NON_RESIDENT', 'EXPATRIATE', 'RESIDENT', 'OTHER'] as const).map((r) => (
              <label key={r} className={s.choice}>
                <input type="radio" id={r === 'NON_RESIDENT' ? `${uid}-residencyStatus` : undefined} name={`${uid}-res`} value={r} checked={d.residencyStatus === r} onChange={() => (set({ residencyStatus: r }), touch('residencyStatus'))} />
                <span>{t(`ui.enum.ResidencyStatus.${r}`)}</span>
              </label>
            ))}
          </div>
          {err('residencyStatus') ? <span className={s.fieldWarn}>{err('residencyStatus')}</span> : null}
        </fieldset>
      ),
    },
    {
      key: 'residence',
      step: 1,
      fields: ['countryOfResidence'],
      render: () => <CountrySelect id={`${uid}-countryOfResidence`} label={t('ui.sim.elig.fields.countryOfResidence')} value={d.countryOfResidence} onChange={(v) => (onResidence(v), touch('countryOfResidence'))} error={err('countryOfResidence')} />,
    },
    {
      key: 'birthYear',
      step: 1,
      fields: ['birthYear'],
      render: () => (
        <TextField
          id={`${uid}-birthYear`}
          label={t('ui.sim.elig.fields.birthYear')}
          hint={t('ui.sim.elig.fields.birthYearHint')}
          inputMode="numeric"
          autoComplete="bday-year"
          placeholder={t('ui.common.placeholder.birthYear')}
          maxLength={4}
          value={d.birthYear}
          onChange={(e) => set({ birthYear: e.target.value.replace(/\D/g, '') })}
          onBlur={() => touch('birthYear')}
          error={err('birthYear')}
        />
      ),
    },
    {
      key: 'income',
      step: 2,
      fields: ['monthlyIncome', 'incomeCurrency'],
      render: () => (
        <div className={s.stack}>
          <div className={s.row}>
            {amountField('monthlyIncome', t('ui.sim.elig.fields.income'), { hint: t('ui.sim.elig.fields.incomeHint') })}
            {currencies.length > 1 ? (
              <SelectField
                id={`${uid}-cur`}
                label={t('ui.sim.elig.fields.currency')}
                hint={t('ui.sim.elig.fields.currencyHint')}
                value={d.incomeCurrency}
                onChange={(e) => set({ incomeCurrency: e.target.value, currencyTouched: true, ...(d.targetPriceLinked ? {} : { targetCurrency: e.target.value }) })}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {`${c} (${currencySymbol(c)})`}
                  </option>
                ))}
              </SelectField>
            ) : null}
          </div>
          {plausible(d.monthlyIncome, 100_000, true, d.incomeCurrency)}
        </div>
      ),
    },
    {
      key: 'coBorrower',
      step: 2,
      fields: ['coBorrowerIncome'],
      render: () => (
        <div className={s.stack}>
          <CheckboxField id={`${uid}-co`} label={t('ui.sim.elig.fields.coBorrower')} checked={d.coBorrower} onChange={(v) => set({ coBorrower: v })} />
          {d.coBorrower ? amountField('coBorrowerIncome', t('ui.sim.elig.fields.coBorrowerIncome')) : null}
        </div>
      ),
    },
    { key: 'other', step: 2, fields: ['otherIncome'], render: () => amountField('otherIncome', t('ui.sim.elig.fields.otherIncome'), { optional: true }) },
    { key: 'debts', step: 2, fields: ['monthlyDebts'], render: () => amountField('monthlyDebts', t('ui.sim.elig.fields.debts'), { hint: t('ui.sim.elig.fields.debtsHint') }) },
    {
      key: 'downPayment',
      step: 3,
      fields: ['downPayment'],
      render: () => amountField('downPayment', t('ui.sim.elig.fields.downPayment'), { hint: t('ui.sim.elig.fields.downPaymentHint'), help: t('ui.help.downPayment') }),
    },
    {
      key: 'duration',
      step: 3,
      fields: ['desiredDurationMonths'],
      render: () => (
        <fieldset className={s.fieldset}>
          <legend className={s.legend}>{t('ui.sim.elig.fields.duration')}</legend>
          <div className={s.segmented}>
            <label>
              <input type="radio" name={`${uid}-dm`} checked={d.durationMode === 'longest'} onChange={() => set({ durationMode: 'longest' })} />
              {t('ui.sim.elig.fields.durationLongest')}
            </label>
            <label>
              <input type="radio" name={`${uid}-dm`} checked={d.durationMode === 'choose'} onChange={() => set({ durationMode: 'choose' })} />
              {t('ui.sim.elig.fields.durationChoose')}
            </label>
          </div>
          {d.durationMode === 'choose' ? (
            <SliderField
              id={`${uid}-dur`}
              label={t('ui.sim.elig.fields.duration')}
              value={d.durationYears}
              min={durationBounds[0]!}
              max={durationBounds[1]!}
              step={1}
              fieldStep={1}
              onChange={(v) => set({ durationYears: v })}
              suffix={t('ui.sim.common.yearsSuffix')}
              valueText={(v) => t('ui.sim.common.years', { n: v })}
              boundsText={[t('ui.sim.common.years', { n: durationBounds[0]! }), t('ui.sim.common.years', { n: durationBounds[1]! })]}
            />
          ) : null}
        </fieldset>
      ),
    },
    {
      key: 'financing',
      step: 3,
      fields: ['financingPreference'],
      render: () => (
        <fieldset className={s.fieldset}>
          <legend className={s.legend}>
            {t('ui.sim.elig.fields.financingType')}
            {options.islamicFinance ? <HelpTip text={t('ui.help.islamicFinancing')} /> : null}
          </legend>
          <div className={s.segmented}>
            {(['CONVENTIONAL', ...(options.islamicFinance ? ['ISLAMIC'] : []), 'NO_PREFERENCE'] as Draft['financingPreference'][]).map((f) => (
              <label key={f}>
                <input type="radio" name={`${uid}-fin`} checked={d.financingPreference === f} onChange={() => set({ financingPreference: f })} />
                {t(`ui.sim.elig.financing.${f}`)}
              </label>
            ))}
          </div>
        </fieldset>
      ),
    },
    {
      key: 'target',
      step: 3,
      fields: ['targetPrice', 'targetCurrency'],
      render: () => (
        <div className={s.stack}>
          {property && d.targetPriceLinked ? <PropertyMini property={property} /> : null}
          <div className={s.row}>
            {amountField('targetPrice', t('ui.sim.elig.fields.targetPrice'), {
              optional: true,
              suffix: currencySymbol(d.targetCurrency || d.incomeCurrency),
              ...(d.targetPriceLinked ? { hint: t('ui.sim.elig.fields.targetFromProperty') } : {}),
            })}
            {currencies.length > 1 ? (
              <SelectField id={`${uid}-tcur`} label={t('ui.sim.elig.fields.targetCurrency')} value={d.targetCurrency || d.incomeCurrency} onChange={(e) => set({ targetCurrency: e.target.value, targetPriceLinked: false })}>
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {`${c} (${currencySymbol(c)})`}
                  </option>
                ))}
              </SelectField>
            ) : null}
          </div>
          {(d.targetCurrency || d.incomeCurrency) === ref ? plausible(d.targetPrice, 1000, false, ref) : null}
        </div>
      ),
    },
  ];

  const steps: Step[] = [1, 2, 3];
  const screens: Question[][] = simple ? questions.map((q) => [q]) : steps.map((st) => questions.filter((q) => q.step === st));
  const screen = Math.min(d.screen, screens.length - 1);
  const current = screens[screen] ?? [];
  const currentStep = current[0]?.step ?? 1;
  const screenFields = current.flatMap((q) => q.fields as string[]);
  const screenValid = screenFields.every((f) => !errors[f]);
  const last = screen === screens.length - 1;

  const go = (i: number) => {
    set({ screen: i, showResult: false });
    window.setTimeout(() => headRef.current?.focus(), 30);
  };
  const openStep = (st: Step) => go(Math.max(0, screens.findIndex((sc) => sc[0]?.step === st)));

  const compute = useCallback(
    async (draft: Draft) => {
      const w = toWire(draft);
      const ok = schema.safeParse(w);
      if (!ok.success) return;
      const sig = JSON.stringify(w);
      const key = draft.sig === sig && draft.key ? draft.key : newKey();
      set({ sig, key, showResult: true });
      setStatus('pending');
      const res = await postJson<EligibilityResponse>('/api/v1/public/simulations/eligibility', w, { key });
      if (res.ok) {
        setResult(res.data);
        setStatus('idle');
        // SIM-033 — only when the client ticked the box; without it, the record is not changed.
        if (draft.updateProfile && signedIn) {
          void apiCall(`/client/simulations/${res.data.id}/profile`, { body: {}, retryOnAuth: true }).then((r) => {
            if (r.ok) {
              set({ updateProfile: false });
              showToast({ message: t('ui.clientTools.simulator.profileUpdated'), tone: 'success' });
            }
          });
        }
        window.setTimeout(() => document.getElementById(`${uid}-resultat`)?.focus(), 50);
      } else if (res.status === 409 || res.status >= 500 || res.offline) {
        setStatus('unavailable');
      } else {
        setStatus('error');
      }
    },
    [schema, set, uid, signedIn],
  );

  // SIM-007 — inputs in session and a result obtained: the address reopens the result (recomputed).
  useEffect(() => {
    if (!firstLoad.current) return;
    const timer = window.setTimeout(() => {
      firstLoad.current = false;
      if (latest.current.showResult) void compute(latest.current);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [d, compute]);

  function next() {
    if (!screenValid) {
      touch(...screenFields);
      const first = screenFields.find((f) => errors[f]);
      if (first) document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    if (!last) return go(screen + 1);
    const invalid = Object.keys(errors);
    if (invalid.length) {
      touch(...invalid);
      const q = questions.find((x) => (x.fields as string[]).some((f) => errors[f]));
      if (q) openStep(q.step);
      return;
    }
    void compute(d);
  }

  function restart() {
    clear();
    set({ ...initial, prefillApplied: d.prefillApplied });
    setResult(null);
    setTouched(new Set());
    setStatus('idle');
  }

  const recap = (
    <Recap
      d={d}
      options={options}
      onOpen={openStep}
      hasResult={Boolean(result) && !d.showResult}
      onResult={() => set({ showResult: true })}
      onRestart={restart}
    />
  );
  const stepTitle = t(`ui.sim.elig.steps.${currentStep}` as 'ui.sim.elig.steps.1');

  return (
    <div className={s.wrap}>
      {d.showResult ? (
        <div className={s.layout}>
          <div className={s.result}>
            {d.expressMonthly ? (
              <p className={s.expressBanner}>
                <Icon name="calculator" size={20} />
                {t('ui.sim.elig.expressBanner', { montant: fmt({ amount: d.expressMonthly, currency: ref }) })}
              </p>
            ) : null}
            {status === 'pending' && !result ? <p className={s.info}>{t('ui.sim.common.computing')}</p> : null}
            {status === 'unavailable' || status === 'error' ? (
              <Unavailable settings={settings} onEdit={() => openStep(1)} />
            ) : result ? (
              <ResultView
                uid={uid}
                settings={settings}
                data={result}
                draft={d}
                property={property}
                onEdit={(st) => openStep(st)}
                onCallback={() => setCallbackSignal((n) => n + 1)}
                callbackSignal={callbackSignal}
              />
            ) : null}
          </div>
          {recap}
        </div>
      ) : (
        <div className={s.layout}>
          <form
            className={s.card}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
          >
            <div className={s.stepsHead} ref={headRef} tabIndex={-1}>
              <p className={s.stepOf}>{t('ui.common.stepOf', { n: screen + 1, total: screens.length })}</p>
              <ol className={s.progress} aria-hidden="true">
                {screens.map((_, i) => (
                  <li key={i} data-done={i <= screen} />
                ))}
              </ol>
              <h2 className={s.cardTitle}>{stepTitle}</h2>
            </div>
            {accountNote && screen === 0 ? (
              <p className={s.expressBanner} role="status">
                <Icon name="user" size={20} />
                {accountNote}
              </p>
            ) : null}
            <div className={s.stack} key={screen}>
              <div className={`${s.stack} ${s.stepBody}`}>{current.map((q) => <div key={q.key}>{q.render()}</div>)}</div>
            </div>
            {last && signedIn ? (
              <CheckboxField id={`${uid}-profile`} checked={d.updateProfile} onChange={(v) => set({ updateProfile: v })} label={t('ui.clientTools.simulator.updateProfile')} />
            ) : null}
            <div className={s.stepNav}>
              {screen > 0 ? (
                <Button type="button" variant="tertiary" size="M" icon="arrow-left" onClick={() => go(screen - 1)}>
                  {simple ? t('ui.sim.common.previous') : t('ui.common.back')}
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" variant="primary" size="L" chevron pending={status === 'pending'}>
                {last ? t('ui.sim.elig.seeResult') : t('ui.common.continue')}
              </Button>
            </div>
            {status === 'unavailable' ? <Unavailable settings={settings} /> : null}
          </form>
          {recap}
        </div>
      )}
    </div>
  );
}

// ─── Recap « Votre simulation » (SIM-007, TRV-122 recap before sending) ─────

function Recap({
  d,
  options,
  onOpen,
  hasResult,
  onResult,
  onRestart,
}: {
  d: Draft;
  options: SimulatorOptions;
  onOpen: (s: Step) => void;
  hasResult: boolean;
  onResult: () => void;
  onRestart: () => void;
}) {
  const cur = d.incomeCurrency;
  const amount = (raw: string, c = cur) => (parseAmount(raw) ? fmt({ amount: parseAmount(raw)!, currency: c }) : '—');
  const lines: [Step, string][] = [
    [1, [d.residencyStatus ? t(`ui.enum.ResidencyStatus.${d.residencyStatus as 'OTHER'}`).split(' :')[0]! : null, d.birthYear || null].filter(Boolean).join(' · ') || '—'],
    [2, d.monthlyIncome ? t('ui.sim.common.monthlyPlain', { montant: amount(d.monthlyIncome) }) : '—'],
    [
      3,
      [
        d.downPayment ? amount(d.downPayment) : null,
        d.durationMode === 'choose' ? t('ui.sim.common.years', { n: d.durationYears }) : null,
        d.targetPrice ? amount(d.targetPrice, d.targetCurrency || cur) : null,
      ]
        .filter(Boolean)
        .join(' · ') || '—',
    ],
  ];
  const any = d.residencyStatus || d.monthlyIncome || d.downPayment;
  if (!any && !hasResult) {
    return (
      <aside className={s.recap}>
        <span className={s.overline}>{t('ui.sim.elig.recap')}</span>
        <p className={s.muted}>{t('ui.sim.elig.subtitle')}</p>
        {options.products.length === 0 ? (
          <p className={s.muted}>
            {t('ui.sim.common.indicativeLabel')}
            <HelpTip text={t('ui.help.indicativeScale')} />
          </p>
        ) : null}
      </aside>
    );
  }
  return (
    <aside className={s.recap} aria-label={t('ui.sim.elig.recap')}>
      <span className={s.overline}>{t('ui.sim.elig.recap')}</span>
      <ul className={s.recapList}>
        {lines.map(([st, text]) => (
          <li key={st}>
            <button type="button" className={s.recapItem} onClick={() => onOpen(st)} aria-label={t('ui.sim.elig.recapStep', { n: st, titre: t(`ui.sim.elig.steps.${st}` as 'ui.sim.elig.steps.1') })}>
              <strong>{t(`ui.sim.elig.steps.${st}` as 'ui.sim.elig.steps.1')}</strong>
              <span>{text}</span>
            </button>
          </li>
        ))}
      </ul>
      {hasResult ? (
        <Button type="button" variant="secondary" size="M" chevron onClick={onResult}>
          {t('ui.sim.elig.seeResult')}
        </Button>
      ) : null}
      <button type="button" className={s.linkButton} onClick={onRestart}>
        {t('ui.sim.elig.restart')}
      </button>
    </aside>
  );
}

// ─── SIM-008 ────────────────────────────────────────────────────────────────

function Unavailable({ settings, onEdit }: { settings: PublicSettings; onEdit?: () => void }) {
  const href = settings['features.callbackRequest'] ? '?rappel=1' : '/contact?objet=rappel';
  return (
    <div className={s.block} role="alert">
      <p className={s.notice}>
        <Icon name="status-warning" size={20} />
        {t('ui.sim.common.unavailable')}
      </p>
      <div className={s.buttons}>
        <Link href={href} scroll={false} className={buttonClass('primary', 'M')}>
          <ButtonInner size="M" icon="phone">
            {t('ui.sim.common.callback')}
          </ButtonInner>
        </Link>
        {onEdit ? (
          <button type="button" className={s.linkButton} onClick={onEdit}>
            {t('ui.sim.elig.edit')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ─── Result (SIM-012 … SIM-014) ─────────────────────────────────────────────

function targetSentence(r: EligibilityResult): string {
  const tg = r.target!;
  const ax = r.approx.target;
  switch (tg.case) {
    case 'FINANCEABLE':
      return t('ui.sim.elig.target.FINANCEABLE', { montant: fmt(tg.monthlyPayment, 2, ax), duree: durationText(r.durationMonths ?? 0) });
    case 'DOWN_PAYMENT_SHORT':
      return tg.requiredMonthlyPayment
        ? t('ui.sim.elig.target.BOTH_SHORT', { montant: fmt(tg.missingDownPayment, 0, ax), x: fmt(tg.requiredMonthlyPayment, 2, ax), y: fmt(r.maxMonthlyPayment, 2, r.approx.figures) })
        : t('ui.sim.elig.target.DOWN_PAYMENT_SHORT', { montant: fmt(tg.missingDownPayment, 0, ax) });
    case 'PAYMENT_TOO_HIGH':
      return t('ui.sim.elig.target.PAYMENT_TOO_HIGH', { x: fmt(tg.requiredMonthlyPayment, 2, ax), y: fmt(r.maxMonthlyPayment, 2, r.approx.figures) });
    case 'AMOUNT_BELOW_MIN':
      return t('ui.sim.elig.target.AMOUNT_BELOW_MIN', { x: fmt(tg.loan, 0, ax) });
    default:
      return t(r.feesIncluded ? 'ui.sim.elig.target.NO_FINANCING_NEEDED_FEES' : 'ui.sim.elig.target.NO_FINANCING_NEEDED');
  }
}

/** SIM-031 — « Calculer mes mensualités »: the amount of the result, its duration, its solution, its currency. */
function creditHref(r: EligibilityResult, d: Draft): string | null {
  const down = parseAmount(d.downPayment) ?? '0';
  const q = new URLSearchParams();
  if (r.target && r.target.case !== 'NO_FINANCING_NEEDED' && Number(r.target.loan.amount) > 0) {
    q.set('montant', r.target.loan.amount);
    q.set('base', 'prix');
    q.set('ref', r.target.price.amount);
    q.set('frais', r.target.fees.amount);
  } else if (!r.target && r.shown.maxBudget && r.shown.maxLoan) {
    q.set('montant', r.shown.maxLoan.amount);
    q.set('base', 'budget');
    q.set('ref', r.shown.maxBudget.amount);
    q.set('frais', r.shown.fees?.amount ?? '0');
  } else {
    return null;
  }
  q.set('apport', down);
  if (r.durationMonths) q.set('mois', String(r.durationMonths));
  q.set('devise', r.displayCurrency);
  const product = r.target?.productId ?? r.bestProductId;
  if (product) q.set('produit', product);
  else if (r.rateBps !== null) q.set('taux', String(r.rateBps));
  if (r.pricingMethod === 'FLAT_MARGIN') q.set('methode', 'FLAT_MARGIN');
  if (d.propertyReference && d.targetPriceLinked) q.set('bien', d.propertyReference);
  return `/financements/simulateur-credit?${q.toString()}`;
}

function ResultView({
  uid,
  settings,
  data,
  draft,
  property,
  onEdit,
  onCallback,
  callbackSignal,
}: {
  uid: string;
  settings: PublicSettings;
  data: { id: string; result: EligibilityResult };
  draft: Draft;
  property: SimulatorProperty | null;
  onEdit: (s: Step) => void;
  onCallback: () => void;
  callbackSignal: number;
}) {
  const r = data.result;
  const ax = r.approx.figures;
  const down = { amount: parseAmount(draft.downPayment) ?? '0', currency: draft.incomeCurrency };
  const notEligible = r.status === 'NOT_ELIGIBLE';
  const budgetRef = r.shownRef.maxBudget ?? (r.shown.maxBudget ? null : r.shownRef.reachableBudget);
  const toCredit = notEligible ? null : creditHref(r, draft);
  const feesNote = r.feesIncluded ? t('ui.sim.common.feesIncluded', { pct: pctNum(r.acquisitionFeesPct) }) : settings['legal.feesExcludedNote'];
  const editStep = (r.reasons.map((x) => STEP_OF_REASON[x]).find(Boolean) ?? 1) as Step;
  const reasons = [...new Set(r.reasons.map((x) => t(`ui.sim.elig.reasons.${x}`)))];
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    const h = window.setTimeout(() => setAnnounce(t('ui.sim.elig.announce', { titre: t(`ui.sim.elig.titles.${r.status}`) })), 400);
    return () => window.clearTimeout(h);
  }, [r.status, data.id]);

  return (
    <>
      <section className={`${s.hero} ${r.status === 'CONDITIONAL' ? s.heroAdjust : ''}`} aria-labelledby={`${uid}-resultat`}>
        {r.indicative ? (
          <span className={s.heroBadge}>
            <Icon name="info" size={16} />
            {t('ui.sim.common.indicativeLabel')}
            <HelpTip text={t('ui.help.indicativeScale')} />
          </span>
        ) : null}
        <h2 id={`${uid}-resultat`} className={s.heroTitle} tabIndex={-1}>
          {t(`ui.sim.elig.titles.${r.status}`)}
        </h2>
        <span className={s.srOnly} aria-live="polite">
          {announce}
        </span>
        {notEligible ? (
          <>
            <ul className={s.reasons}>
              {reasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className={s.heroText}>{t('ui.sim.elig.notEligibleConclusion')}</p>
            <div className={s.buttons}>
              <Button type="button" variant="primary" size="L" icon="phone" onClick={onCallback}>
                {t('ui.sim.elig.callback')}
              </Button>
              <Button type="button" variant="secondary" size="L" onClick={() => onEdit(editStep)}>
                {t('ui.sim.elig.edit')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className={s.figures}>
              {r.shown.maxBudget ? (
                <div className={`${s.figure} ${s.figureMain}`}>
                  <span className={s.figureLabel}>{t('ui.sim.elig.budget')}</span>
                  <span className={s.figureValue}>
                    <Rolling value={r.shown.maxBudget} approx={ax} />
                  </span>
                  <span className={s.figureNote}>
                    {r.feesIncluded && r.shown.fees && Number(r.shown.fees.amount) > 0
                      ? t('ui.sim.elig.budgetDetailFees', { apport: fmt(down), financement: fmt(r.shown.maxLoan, 0, ax), frais: fmt(r.shown.fees, 0, ax) })
                      : t('ui.sim.elig.budgetDetail', { apport: fmt(down), financement: fmt(r.shown.maxLoan, 0, ax) })}
                  </span>
                </div>
              ) : null}
              <div className={s.figure}>
                <span className={s.figureLabel}>
                  {t('ui.sim.elig.capacity')}
                  <HelpTip text={t('ui.help.borrowingCapacity')} />
                </span>
                <span className={s.figureValue}>
                  <Rolling value={r.shown.capacity} approx={ax} />
                </span>
              </div>
              <div className={s.figure}>
                <span className={s.figureLabel}>{t('ui.sim.elig.maxMonthly')}</span>
                <span className={s.figureValue}>{t('ui.sim.common.monthly', { montant: fmt(r.maxMonthlyPayment, 2, ax) })}</span>
              </div>
              {r.durationMonths ? (
                <div className={s.figure}>
                  <span className={s.figureLabel}>{t('ui.sim.elig.duration')}</span>
                  <span className={s.figureValue}>{durationText(r.durationMonths)}</span>
                  {r.durationNote ? <span className={s.figureNote}>{t(`ui.sim.elig.durationNotes.${r.durationNote}`)}</span> : null}
                </div>
              ) : null}
            </div>
            {r.shown.maxBudget ? (
              <>
                <p className={s.heroText}>
                  {r.limitingFactor === 'DOWN_PAYMENT'
                    ? t('ui.sim.elig.limits.DOWN_PAYMENT', { pct: pctNum(r.minDownPaymentPct ?? 0), apport: fmt(r.advisedDownPayment, 0, ax), budget: fmt(r.shown.reachableBudget, 0, ax) })
                    : t('ui.sim.elig.limits.INCOME')}
                </p>
                {r.budgetMonthlyPayment ? <p className={s.heroText}>{t('ui.sim.elig.budgetMonthly', { montant: fmt(r.budgetMonthlyPayment, 2, ax) })}</p> : null}
              </>
            ) : r.advisedDownPayment ? (
              <p className={s.heroText}>{t('ui.sim.elig.conditional', { pct: pctNum(r.minDownPaymentPct ?? 0), apport: fmt(r.advisedDownPayment, 0, ax), budget: fmt(r.shown.reachableBudget, 0, ax) })}</p>
            ) : null}
            {r.indicative ? <p className={s.heroText}>{t('ui.sim.common.indicativeBanner')}</p> : null}
          </>
        )}
        <p className={s.heroLegal}>
          {settings['legal.simulatorDisclaimer']} {settings['legal.monthlyFootnote']}
          {r.rateDate ? ` ${t('ui.common.rateDate', { date: new Date(`${r.rateDate}T12:00:00Z`).toLocaleDateString('fr-FR') })}` : ''}
        </p>
      </section>

      {!notEligible ? (
        <div className={s.blocks}>
          <div className={s.block}>
            <p className={s.notice}>
              <Icon name="status-info" size={20} />
              {feesNote}
            </p>
            {r.missingTypeNote ? <p className={s.muted}>{t(`ui.sim.elig.missingType.${r.missingTypeNote}`)}</p> : null}
            {!r.indicative ? (
              <p className={s.muted}>
                {(['CONVENTIONAL', 'ISLAMIC'] as const)
                  .filter((k) => (r.solutions[k] ?? 0) > 0)
                  .map((k) => t(`ui.sim.elig.solutions.${k}`, { n: r.solutions[k]! }))
                  .join(' · ')}
              </p>
            ) : null}
          </div>
          {r.target ? (
            <div className={s.block}>
              <h3 className={s.subTitle}>{t('ui.sim.elig.target.title')}</h3>
              {property && draft.targetPriceLinked ? <PropertyMini property={property} /> : null}
              <p className={r.target.financeable ? s.success : s.notice}>
                <Icon name={r.target.financeable ? 'status-success' : 'status-info'} size={20} />
                {targetSentence(r)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {budgetRef && !notEligible ? <Within budget={budgetRef} reachable={!r.shown.maxBudget} country={draft.propertyCountry} settings={settings} /> : null}

      <ResultActions
        settings={settings}
        ensureId={async () => data.id}
        pdfBody={() => ({ type: 'ELIGIBILITY', inputs: toWire(draft) })}
        propertyReference={draft.targetPriceLinked ? draft.propertyReference : null}
        openCallback={callbackSignal}
      >
        {toCredit ? (
          <Link href={toCredit} className={buttonClass('tertiary', 'M')}>
            <ButtonInner size="M" icon="calculator" chevron>
              {t('ui.sim.elig.toCredit')}
            </ButtonInner>
          </Link>
        ) : null}
      </ResultActions>
    </>
  );
}

/**
 * SIM-012 « Biens à votre portée » — three published and available properties within the DISPLAYED budget (CAT-035).
 * `GET /public/properties/suggestions` does not exist yet: the catalogue route filtered by `priceMax` is used, three cards.
 */
function Within({ budget, reachable, country, settings }: { budget: { amount: string; currency: string }; reachable: boolean; country: string; settings: PublicSettings }) {
  const [list, setList] = useState<{ cards: Card[]; total: number; pct: string } | null>(null);
  const priceMax = String(Math.floor(Number(budget.amount)));
  useEffect(() => {
    const ctrl = new AbortController();
    const q = new URLSearchParams({ priceMax, sort: 'price_asc', ...(country ? { country } : {}) });
    fetch(`/api/v1/public/properties?${q.toString()}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<CatalogueResponse>) : null))
      .then((b) => b && setList({ cards: b.data.slice(0, 3), total: b.meta.total, pct: b.meta.referenceDownPaymentPct }))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [priceMax, country]);
  if (!list || list.cards.length === 0) return null;
  return (
    <section className={s.block} aria-label={t(reachable ? 'ui.sim.elig.properties.titleReachable' : 'ui.sim.elig.properties.title')}>
      <div className={s.inline} style={{ justifyContent: 'space-between' }}>
        <h3 className={s.cardTitle}>{t(reachable ? 'ui.sim.elig.properties.titleReachable' : 'ui.sim.elig.properties.title')}</h3>
        <Link href={`/programmes?priceMax=${priceMax}`} className={buttonClass('secondary', 'M')}>
          <ButtonInner size="M" chevron>
            {t('ui.sim.elig.properties.seeAll', { n: list.total })}
          </ButtonInner>
        </Link>
      </div>
      <div className={s.cards}>
        {list.cards.map((c) => (
          <PropertyCard
            key={c.id}
            card={c}
            downPaymentPct={list.pct}
            variant="home"
            monthlyEnabled={settings['features.monthlyBudgetSearch']}
            illustrationNote={settings['legal.illustrationNote']}
          />
        ))}
      </div>
    </section>
  );
}
