'use client';
// EP-07, DEM-011, DEM-012 — « Exprimer mon intérêt », opened by ?interet=1 (&lot=, &visio=1). Optional section folded
// behind « Ajouter des précisions (facultatif) » so that the button is visible early on phones (D-095).
// FIC-054 — after sending, the page remembers it for the session: « Demande envoyée » + « Envoyer une autre demande ».
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import type { LeadSubmitResponse, PublicSettings } from '@dp/contracts';
import { callbackLabel } from '@dp/i18n';
import { Button, Icon, buttonClass, ButtonInner } from '@dp/ui';
import { browserTimeZone } from '@/lib/callback';
import { formatPhone } from '@/lib/contact';
import { useDraft } from '@/lib/public-form';
import { recordOrigin } from '@/lib/tracking';
import { t } from '@/lib/i18n';
import { CheckboxField, Honeypot, SelectField, TextArea, TextField } from './fields';
import { CallbackWhen, ConsentBlock, CountrySelect, PhoneField, consentWire, useLeadSubmit } from './lead-parts';
import { LeadDone } from './LeadDone';
import { QueryDialog, useQueryFlag } from './QueryDialog';
import l from './lead.module.css';

const SENT_KEY = (ref: string) => `dp_sent_${ref}`;

export interface InterestTarget {
  /** Property: its reference; programme: its slug. */
  key: string;
  kind: 'property' | 'program';
  title: string;
  summary: string;
  propertyReference?: string;
  programSlug?: string;
  priceShown?: string;
  monthlyShown?: string;
  currencyShown?: string;
  lots?: string[];
  /** DEM-012 — the programme's properties still offered (« Appartement T3 · à partir de 150 000 € »). */
  choices?: { reference: string; label: string }[];
}

export function InterestButton({ target, label, href }: { target: InterestTarget; label: string; href: string }) {
  const [sent, setSent] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        setSent(sessionStorage.getItem(SENT_KEY(target.key)) === '1');
      } catch {
        /* storage unavailable */
      }
    };
    read();
    window.addEventListener('dp:lead-sent', read);
    return () => window.removeEventListener('dp:lead-sent', read);
  }, [target.key]);
  if (sent) {
    return (
      <div className={l.consents}>
        <button type="button" className={buttonClass('primary', 'L', true)} disabled aria-disabled="true">
          <ButtonInner size="L" icon="check">
            {t('ui.property.actions.sent')}
          </ButtonInner>
        </button>
        <Link href={href} scroll={false} className={l.toggle}>
          {t('ui.property.actions.sendAnother')}
        </Link>
      </div>
    );
  }
  return (
    <Link href={href} scroll={false} className={buttonClass('primary', 'L', true)}>
      <ButtonInner chevron size="L">
        {label}
      </ButtonInner>
    </Link>
  );
}

export function InterestDialog({ settings, target, available }: { settings: PublicSettings; target: InterestTarget; available: boolean }) {
  const [open, close] = useQueryFlag('interet');
  useEffect(() => recordOrigin(), []);
  // FIC-052: a property that is no longer available ignores ?interet=1.
  return (
    <QueryDialog open={open && available} onClose={close} title={t('ui.lead.interest.title')} closeLabel={t('ui.lead.interest.close')}>
      <InterestForm settings={settings} target={target} onClose={close} />
    </QueryDialog>
  );
}

function InterestForm({ settings, target, onClose }: { settings: PublicSettings; target: InterestTarget; onClose: () => void }) {
  const id = useId();
  const params = useSearchParams();
  const lotParam = params.get('lot');
  const lot = lotParam && target.lots?.includes(lotParam) ? lotParam : null;
  const [v, set, clear] = useDraft(`interest_${target.key}`, {
    choice: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    whatsapp: false,
    country: '',
    channel: 'CALL',
    residency: '',
    timeframe: '',
    budget: '',
    budgetKind: 'TOTAL',
    financing: '',
    day: '',
    slot: '',
    visio: params.get('visio') === '1',
    message: '',
    consent: false,
    marketing: false,
    createAccount: false,
  });
  const [more, setMore] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<LeadSubmitResponse | null>(null);
  const send = useLeadSubmit('PROPERTY_INTEREST', settings);
  const monthlyOn = settings['features.monthlyBudgetSearch'];

  useEffect(() => {
    if (params.get('visio') === '1') set({ visio: true });
  }, [params, set]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!v.firstName.trim()) local.firstName = t('ui.validation.REQUIRED');
    if (!v.lastName.trim()) local.lastName = t('ui.validation.REQUIRED');
    if (!v.email.trim()) local.email = t('ui.validation.REQUIRED');
    if (!v.phone) local.phone = t('ui.validation.REQUIRED');
    if (!v.country) local.countryOfResidence = t('ui.validation.REQUIRED');
    if (!v.consent) local.consentContact = t('ui.validation.MUST_ACCEPT');
    setErrors(local);
    if (Object.keys(local).length) {
      document.getElementById(`${id}-${Object.keys(local)[0]}`)?.focus();
      return;
    }
    setPending(true);
    setBanner(null);
    const chosen = target.kind === 'program' && v.choice ? v.choice : undefined;
    const res = await send(
      {
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        phone: v.phone,
        whatsappOptIn: v.whatsapp,
        countryOfResidence: v.country,
        preferredChannel: v.channel,
        residencyStatus: v.residency || null,
        purchaseTimeframe: v.timeframe || null,
        budget: v.budget ? v.budget.replace(/[\s  ]/g, '').replace(',', '.') : null,
        budgetKind: monthlyOn ? v.budgetKind : 'TOTAL',
        financingPreference: v.financing || null,
        preferredCallbackDate: v.day || null,
        preferredSlot: v.slot || null,
        wantsVideoVisit: v.visio,
        message: v.message || null,
        ...consentWire(v.consent, v.marketing),
        createAccount: v.createAccount,
      },
      {
        propertyReference: chosen ?? target.propertyReference,
        programSlug: chosen ? undefined : target.programSlug,
        propertyTitle: target.kind === 'property' ? target.title : undefined,
        programName: target.kind === 'program' ? target.title : undefined,
        lotReference: lot ?? undefined,
        priceShown: target.priceShown,
        monthlyShown: target.monthlyShown,
        currencyShown: target.currencyShown,
      },
      honeypot,
    );
    setPending(false);
    if (res.ok) {
      clear();
      try {
        sessionStorage.setItem(SENT_KEY(target.key), '1');
      } catch {
        /* storage unavailable */
      }
      window.dispatchEvent(new Event('dp:lead-sent'));
      setDone(res.data);
    } else {
      setErrors(res.errors.fields);
      setBanner(res.errors.banner);
    }
  }

  if (done) {
    return (
      <LeadDone
        result={done}
        channel={v.channel as 'CALL' | 'WHATSAPP' | 'EMAIL'}
        firstContactBusinessDays={settings['sla.firstContactBusinessDays']}
        contactEmail={settings['contact.email']}
        contactPhone={settings['contact.phone'] ? formatPhone(settings['contact.phone']) : ''}
        onContinue={onClose}
      />
    );
  }

  const quand = callbackLabel({
    preferredCallbackDate: v.day || null,
    preferredSlot: (v.slot || null) as never,
    firstContactBusinessDays: settings['sla.firstContactBusinessDays'],
    timeZone: browserTimeZone(),
  });

  return (
    <form className={l.form} onSubmit={submit} noValidate>
      <p>{t('ui.lead.interest.intro')}</p>
      <div className={l.notice}>
        <strong>{target.title}</strong>
        <br />
        <span>{target.summary}</span>
        {lot ? (
          <>
            <br />
            <span>{t('ui.lead.interest.lot', { reference: lot })}</span>
          </>
        ) : null}
      </div>
      {banner ? (
        <p className={l.banner} role="alert">
          <Icon name="status-error" size={20} />
          {banner}
        </p>
      ) : null}
      {target.kind === 'program' && target.choices?.length ? (
        <SelectField id={`${id}-choice`} label={t('ui.lead.interest.which')} value={v.choice} onChange={(e) => set({ choice: e.target.value })}>
          <option value="">{t('ui.lead.interest.whichUnsure')}</option>
          {target.choices.map((c) => (
            <option key={c.reference} value={c.reference}>
              {c.label}
            </option>
          ))}
        </SelectField>
      ) : null}
      <div className={l.row}>
        <TextField id={`${id}-firstName`} label={t('ui.lead.fields.firstName')} autoComplete="given-name" value={v.firstName} onChange={(e) => set({ firstName: e.target.value })} error={errors.firstName} />
        <TextField id={`${id}-lastName`} label={t('ui.lead.fields.lastName')} autoComplete="family-name" value={v.lastName} onChange={(e) => set({ lastName: e.target.value })} error={errors.lastName} />
      </div>
      <TextField id={`${id}-email`} type="email" inputMode="email" autoComplete="email" label={t('ui.lead.fields.email')} placeholder={t('ui.common.placeholder.email')} value={v.email} onChange={(e) => set({ email: e.target.value })} error={errors.email} />
      <PhoneField id={`${id}-phone`} value={v.phone} onChange={(phone) => set({ phone })} error={errors.phone} onCountryDetected={(c) => !v.country && set({ country: c })} />
      {v.phone ? <CheckboxField id={`${id}-wa`} label={t('ui.lead.fields.whatsapp')} checked={v.whatsapp} onChange={(whatsapp) => set({ whatsapp })} /> : null}
      <CountrySelect id={`${id}-countryOfResidence`} value={v.country} onChange={(country) => set({ country })} error={errors.countryOfResidence} />

      <button type="button" className={l.toggle} aria-expanded={more} onClick={() => setMore((m) => !m)}>
        <Icon name={more ? 'chevron-up' : 'chevron-down'} size={16} />
        {t('ui.lead.interest.more')}
      </button>
      {more ? (
        <div className={l.form}>
          <SelectField id={`${id}-channel`} label={t('ui.lead.interest.channel')} optional value={v.channel} onChange={(e) => set({ channel: e.target.value })}>
            {(['CALL', 'WHATSAPP', 'EMAIL'] as const)
              .filter((c) => c !== 'WHATSAPP' || Boolean(settings['contact.whatsapp']))
              .map((c) => (
                <option key={c} value={c}>
                  {t(`ui.lead.interest.channels.${c}`)}
                </option>
              ))}
          </SelectField>
          <SelectField id={`${id}-res`} label={t('ui.lead.interest.residency')} optional value={v.residency} onChange={(e) => set({ residency: e.target.value })}>
            <option value="" />
            {(['NON_RESIDENT', 'EXPATRIATE', 'RESIDENT', 'OTHER'] as const).map((r) => (
              <option key={r} value={r}>
                {t(`ui.enum.ResidencyStatus.${r}`)}
              </option>
            ))}
          </SelectField>
          <SelectField id={`${id}-tf`} label={t('ui.lead.interest.timeframe')} optional value={v.timeframe} onChange={(e) => set({ timeframe: e.target.value })}>
            <option value="" />
            {(['LT_6M', 'M6_12', 'GT_12M', 'UNDEFINED'] as const).map((r) => (
              <option key={r} value={r}>
                {t(`ui.enum.PurchaseTimeframe.${r}`)}
              </option>
            ))}
          </SelectField>
          <div>
            <TextField
              id={`${id}-budget`}
              label={monthlyOn ? t('ui.lead.interest.budget') : t('ui.lead.interest.budgetTotalOnly')}
              optional
              inputMode="decimal"
              suffix="€"
              value={v.budget}
              onChange={(e) => set({ budget: e.target.value })}
              error={errors.budget}
            />
            {monthlyOn ? (
              <div className={l.segmented} role="radiogroup" aria-label={t('ui.lead.interest.budget')}>
                {(['TOTAL', 'MONTHLY'] as const).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={v.budgetKind === k} onClick={() => set({ budgetKind: k })}>
                    {k === 'TOTAL' ? t('ui.lead.interest.budgetTotal') : t('ui.lead.interest.budgetMonthly')}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <SelectField id={`${id}-fin`} label={t('ui.lead.interest.financing')} optional value={v.financing} onChange={(e) => set({ financing: e.target.value })}>
            <option value="" />
            {(['CONVENTIONAL', 'ISLAMIC', 'NO_PREFERENCE', 'CASH'] as const)
              .filter((f) => settings['features.islamicFinance'] || f !== 'ISLAMIC')
              .map((f) => (
                <option key={f} value={f}>
                  {t(`ui.enum.FinancingPreference.${f}`)}
                </option>
              ))}
          </SelectField>
          <CallbackWhen settings={settings} day={v.day} slot={v.slot} idPrefix={id} onChange={(p) => set(p)} />
          <CheckboxField id={`${id}-visio`} label={t('ui.lead.interest.visio')} checked={v.visio} onChange={(visio) => set({ visio })} />
          <TextArea id={`${id}-msg`} label={t('ui.lead.fields.message')} optional hint={t('ui.lead.fields.messageHint')} maxLength={2000} counter value={v.message} onChange={(e) => set({ message: e.target.value })} error={errors.message} />
        </div>
      ) : null}

      <ConsentBlock idPrefix={id} consent={v.consent} marketing={v.marketing} createAccount={v.createAccount} error={errors.consentContact} onChange={(p) => set({ ...(p.consent !== undefined ? { consent: p.consent } : {}), ...(p.marketing !== undefined ? { marketing: p.marketing } : {}), ...(p.createAccount !== undefined ? { createAccount: p.createAccount } : {}) })} />
      <Honeypot name="homepageUrl" value={honeypot} onChange={setHoneypot} />
      <Button type="submit" variant="primary" size="L" fullWidth chevron pending={pending}>
        {t('ui.lead.interest.submit')}
      </Button>
      <p className={l.under}>
        {t('ui.lead.interest.under', { quand })}
        {settings['contact.whatsapp'] ? ` ${t('ui.lead.interest.underWhatsapp')}` : null}
      </p>
    </form>
  );
}
