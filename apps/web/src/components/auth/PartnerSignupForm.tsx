'use client';
// EP-32 — partner sign-up in two short steps, without any document (ACP-081): « Étape {n} sur 2 », « Continuer »,
// « Retour »; the next step only when the current one is valid (TRV-061); values kept on reload, never the password
// (TRV-092). After sending, ALWAYS « Vérifiez votre boîte e-mail » (ACP-082, TRV-112).
import { useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AUDIENCE_HEADER,
  CURRENT_CONTACT_CONSENT_KEY,
  LEAD_HONEYPOT_FIELD,
  LeadConsentWording,
  partnerSignupRequestSchema,
  type PartnerKind,
  type SentResponse,
} from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { usePublicForm, useDraft } from '@/lib/public-form';
import { t } from '@/lib/i18n';
import { CheckboxField, ErrorSummary, Honeypot, TextField } from '../forms/fields';
import { CountrySelect, PhoneField } from '../forms/lead-parts';
import { Banner, checkSchema, ContactLine, errorMessage, fieldErrors, PasswordField, type ContactInfo } from './kit';
import s from './auth.module.css';

interface Draft {
  partnerKind: PartnerKind | '';
  companyName: string;
  country: string;
  city: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
  acceptCharter: boolean;
  consent: boolean;
}

const EMPTY: Draft = { partnerKind: '', companyName: '', country: '', city: '', firstName: '', lastName: '', jobTitle: '', email: '', phone: '', acceptCharter: false, consent: false };
const STEP2 = ['companyName', 'country', 'city', 'firstName', 'lastName', 'jobTitle', 'email', 'phone', 'password', 'acceptCharter', 'consent'];
/** The consent sentence without its link marker (the link is drawn next to it). */
const consentText = LeadConsentWording[CURRENT_CONTACT_CONSENT_KEY].text.replace(' [Politique de confidentialité]', '');

export function PartnerSignupForm({ contact }: { contact: ContactInfo }) {
  const id = useId();
  const [draft, update, clear] = useDraft<Draft>('partner-signup', EMPTY);
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const form = usePublicForm('PARTNER_SIGNUP', { headers: { [AUDIENCE_HEADER]: 'PARTNER' } });

  function next() {
    if (!draft.partnerKind) return setError(t('ui.auth.partner.signup.chooseKind'));
    setError(null);
    setStep(2);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload = { ...draft, password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: 'fr', [LEAD_HONEYPOT_FIELD]: honeypot };
    const checked = checkSchema(partnerSignupRequestSchema, payload);
    if (!checked.ok) {
      setErrors(checked.errors);
      if (checked.errors.partnerKind) setStep(1);
      requestAnimationFrame(() => document.getElementById('resume-erreurs')?.focus());
      return;
    }
    setErrors({});
    setPending(true);
    setError(null);
    const res = await form.submit<SentResponse>('/api/v1/auth/partner-signup', payload);
    setPending(false);
    if (res.ok) {
      clear();
      setPassword('');
      return setSent(draft.email.trim().toLowerCase());
    }
    const fe = fieldErrors(res.error);
    setErrors(fe);
    if (!Object.keys(fe).length) setError(errorMessage(res.error, res));
  }

  if (sent) {
    return (
      <>
        <span className={s.eyebrow}>
          <Icon name="mail" size={16} />
          {t('ui.auth.partner.eyebrow')}
        </span>
        <h1 className={s.title}>{t('ui.auth.signup.sentTitle')}</h1>
        <p className={s.intro}>{t('ui.auth.partner.signup.sentBody', { email: sent })}</p>
        <p className={s.muted}>{contact.email ? t('ui.auth.verifyWait.spamContact', { email: contact.email }) : t('ui.auth.verifyWait.spam')}</p>
        <ContactLine {...contact} />
      </>
    );
  }

  const labels: Record<string, string> = {
    partnerKind: t('ui.auth.partner.signup.step1'),
    companyName: t('ui.auth.partner.signup.companyName'),
    country: t('ui.auth.partner.signup.country'),
    city: t('ui.auth.partner.signup.city'),
    firstName: t('ui.auth.signup.firstName'),
    lastName: t('ui.auth.signup.lastName'),
    jobTitle: t('ui.auth.partner.signup.jobTitle'),
    email: t('ui.auth.partner.signup.email'),
    phone: t('ui.auth.signup.phone'),
    password: t('ui.auth.password.label'),
    acceptCharter: t('ui.auth.partner.signup.charterLink'),
    consent: t('ui.lead.fields.privacy'),
  };
  const visibleErrors = Object.fromEntries(Object.entries(errors).filter(([k]) => (step === 2 ? STEP2.includes(k) : k === 'partnerKind')));

  return (
    <>
      <span className={s.eyebrow}>
        <Icon name="partners" size={16} />
        {t('ui.auth.partner.eyebrow')}
      </span>
      <h1 className={s.title}>{t('ui.auth.partner.signup.title')}</h1>
      <p className={s.intro}>{t('ui.auth.partner.signup.intro')}</p>
      <p className={s.steps} aria-live="polite">
        {t('ui.auth.partner.signup.stepOf', { n: step })} · {step === 1 ? t('ui.auth.partner.signup.step1') : t('ui.auth.partner.signup.step2')}
      </p>
      <div className={s.progress} aria-hidden="true">
        <span style={{ width: step === 1 ? '50%' : '100%' }} />
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <ErrorSummary errors={visibleErrors} labels={labels} />
      {step === 1 ? (
        <div className={s.form}>
          <div className={s.cards} role="group" aria-label={t('ui.auth.partner.signup.step1')}>
            {(['PROMOTER', 'BANK'] as const).map((kind) => (
              <button key={kind} type="button" className={s.choice} aria-pressed={draft.partnerKind === kind} onClick={() => update({ partnerKind: kind })}>
                <span className={s.choiceTitle}>
                  <Icon name={kind === 'PROMOTER' ? 'building' : 'bank'} size={24} />
                  {kind === 'PROMOTER' ? t('ui.auth.partner.signup.promoter') : t('ui.auth.partner.signup.bank')}
                </span>
                <span className={s.muted}>{kind === 'PROMOTER' ? t('ui.auth.partner.signup.promoterText') : t('ui.auth.partner.signup.bankText')}</span>
              </button>
            ))}
          </div>
          <ul className={s.reassure}>
            {(['free', 'convention', 'contact'] as const).map((k) => (
              <li key={k}>
                <Icon name="check" size={16} />
                {t(`ui.auth.partner.signup.${k}`)}
              </li>
            ))}
          </ul>
          <Button size="L" fullWidth chevron onClick={next}>
            {t('ui.auth.partner.signup.continue')}
          </Button>
        </div>
      ) : (
        <form className={s.form} onSubmit={submit} noValidate>
          <TextField id="companyName" label={labels.companyName} autoComplete="organization" value={draft.companyName} onChange={(e) => update({ companyName: e.target.value })} error={errors.companyName} />
          <div className={s.row}>
            <CountrySelect id="country" label={labels.country} value={draft.country} onChange={(v) => update({ country: v })} error={errors.country} />
            <TextField id="city" label={labels.city} autoComplete="address-level2" value={draft.city} onChange={(e) => update({ city: e.target.value })} error={errors.city} />
          </div>
          <div className={s.row}>
            <TextField id="firstName" label={labels.firstName} autoComplete="given-name" value={draft.firstName} onChange={(e) => update({ firstName: e.target.value })} error={errors.firstName} />
            <TextField id="lastName" label={labels.lastName} autoComplete="family-name" value={draft.lastName} onChange={(e) => update({ lastName: e.target.value })} error={errors.lastName} />
          </div>
          <TextField id="jobTitle" label={labels.jobTitle} autoComplete="organization-title" value={draft.jobTitle} onChange={(e) => update({ jobTitle: e.target.value })} error={errors.jobTitle} />
          <TextField id="email" name="username" label={labels.email} type="email" inputMode="email" autoComplete="username" value={draft.email} onChange={(e) => update({ email: e.target.value })} error={errors.email} icon={<Icon name="mail" size={20} />} />
          <PhoneField id="phone" value={draft.phone} onChange={(v) => update({ phone: v })} error={errors.phone} defaultCountry={draft.country || 'DZ'} />
          <PasswordField id="password" label={labels.password!} autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint={t('ui.auth.password.hint')} meter />
          <CheckboxField
            id="acceptCharter"
            checked={draft.acceptCharter}
            onChange={(v) => update({ acceptCharter: v })}
            error={errors.acceptCharter}
            label={
              <>
                {t('ui.auth.partner.signup.charterBefore')}{' '}
                <Link href="/charte-partenaires" target="_blank" rel="noopener">
                  {t('ui.auth.partner.signup.charterLink')}
                </Link>
              </>
            }
          />
          <CheckboxField
            id="consent"
            checked={draft.consent}
            onChange={(v) => update({ consent: v })}
            error={errors.consent}
            label={
              <>
                {consentText}{' '}
                <Link href="/confidentialite" target="_blank" rel="noopener">
                  {t('ui.lead.fields.privacy')}
                </Link>
              </>
            }
          />
          <Honeypot name={LEAD_HONEYPOT_FIELD} value={honeypot} onChange={setHoneypot} />
          <Button type="submit" size="L" fullWidth pending={pending} chevron>
            {t('ui.auth.partner.signup.submit')}
          </Button>
          <button type="button" className={s.link} onClick={() => setStep(1)}>
            <Icon name="arrow-left" size={16} />
            {t('ui.auth.partner.signup.back')}
          </button>
        </form>
      )}
      <p className={s.door}>
        {t('ui.auth.partner.signup.already')}
        <Link href="/partenaires/connexion" className={s.link}>
          {t('ui.auth.partner.signup.login')}
        </Link>
      </p>
      <ContactLine {...contact} />
      <span hidden>{id}</span>
    </>
  );
}
