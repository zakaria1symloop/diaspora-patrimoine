'use client';
// EC-02 — sign-up (AUTH-001): first name, last name, e-mail, phone, password (« Afficher », strength), terms box (links to
// both texts), news box; « Créer mon espace ». After sending, ALWAYS the same screen (AUTH-003, TRV-112): « Vérifiez
// votre boîte e-mail », and « Renvoyer l'e-mail », which replays the sign-up with a NEW idempotency key (API-040).
// The form keeps its values on reload, never the password (TRV-092). Protection: form token + honeypot (DEM-030).
import { useEffect, useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LEAD_HONEYPOT_FIELD, signupRequestSchema, type SentResponse } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { usePublicForm, useDraft } from '@/lib/public-form';
import { useClientSession } from '@/lib/session-client';
import { trackingPayload } from '@/lib/tracking';
import { t } from '@/lib/i18n';
import { CheckboxField, ErrorSummary, Honeypot, TextField } from '../forms/fields';
import { PhoneField } from '../forms/lead-parts';
import { Banner, checkSchema, ContactLine, errorMessage, fieldErrors, PasswordField, type ContactInfo } from './kit';
import s from './auth.module.css';

interface Draft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  acceptTerms: boolean;
  marketingOptIn: boolean;
}

const EMPTY: Draft = { firstName: '', lastName: '', email: '', phone: '', acceptTerms: false, marketingOptIn: false };

export function SignupForm({ next, simulationId, contact }: { next: string | null; simulationId: string | null; contact: ContactInfo }) {
  const id = useId();
  const router = useRouter();
  const session = useClientSession();
  const [draft, update, clear] = useDraft<Draft>('signup', EMPTY);
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<{ email: string; body: Record<string, unknown> } | null>(null);
  const [resent, setResent] = useState(false);
  const form = usePublicForm('SIGNUP');
  const resendForm = usePublicForm('SIGNUP');

  // AUTH-025 — a signed-in client goes to his space.
  useEffect(() => {
    if (session.status === 'authenticated') router.replace(next ?? '/espace-client');
  }, [session.status, router, next]);

  function body(): Record<string, unknown> {
    const tracking = trackingPayload();
    return {
      ...draft,
      password,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: 'fr',
      ...(next ? { next } : {}),
      ...(simulationId ? { simulationId } : {}),
      ...(tracking.utm ? { utm: tracking.utm } : {}),
      [LEAD_HONEYPOT_FIELD]: honeypot,
    };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload = body();
    const checked = checkSchema(signupRequestSchema, payload);
    if (!checked.ok) {
      setErrors(checked.errors);
      requestAnimationFrame(() => document.getElementById('resume-erreurs')?.focus());
      return;
    }
    setErrors({});
    setPending(true);
    setError(null);
    const res = await form.submit<SentResponse>('/api/v1/auth/signup', payload);
    setPending(false);
    if (res.ok) {
      clear();
      setPassword('');
      setSent({ email: draft.email.trim().toLowerCase(), body: payload });
      return;
    }
    const fe = fieldErrors(res.error);
    setErrors(fe);
    if (!Object.keys(fe).length) setError(errorMessage(res.error, res));
  }

  /** AUTH-003 — « Renvoyer l'e-mail »: the same sign-up again, with a new key; the screen does not change. */
  async function resend() {
    if (!sent) return;
    setPending(true);
    const res = await resendForm.submit<SentResponse>('/api/v1/auth/signup', sent.body);
    setPending(false);
    if (res.ok) setResent(true);
    else setError(errorMessage(res.error, res));
  }

  if (sent) {
    return (
      <>
        <span className={s.eyebrow}>
          <Icon name="mail" size={16} />
          {t('ui.auth.signup.title')}
        </span>
        <h1 className={s.title}>{t('ui.auth.signup.sentTitle')}</h1>
        <p className={s.intro}>{t('ui.auth.signup.sentBody', { email: sent.email })}</p>
        <p className={s.muted}>{contact.email ? t('ui.auth.verifyWait.spamContact', { email: contact.email }) : t('ui.auth.verifyWait.spam')}</p>
        {resent ? <Banner tone="success">{t('ui.auth.signup.resent')}</Banner> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Button size="L" variant="secondary" fullWidth pending={pending} onClick={() => void resend()}>
          {t('ui.auth.signup.resend')}
        </Button>
        <ContactLine {...contact} />
      </>
    );
  }

  const labels: Record<string, string> = {
    firstName: t('ui.auth.signup.firstName'),
    lastName: t('ui.auth.signup.lastName'),
    email: t('ui.auth.common.email'),
    phone: t('ui.auth.signup.phone'),
    password: t('ui.auth.password.label'),
    acceptTerms: `${t('ui.auth.signup.termsLink')} · ${t('ui.auth.signup.privacyLink')}`,
  };

  return (
    <>
      <span className={s.eyebrow}>
        <Icon name="user" size={16} />
        {t('ui.auth.signup.title')}
      </span>
      <h1 className={s.title}>{t('ui.auth.signup.title')}</h1>
      <p className={s.intro}>{t('ui.auth.signup.intro')}</p>
      {simulationId ? <Banner tone="info">{t('ui.auth.signup.simulationNote')}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <ErrorSummary errors={errors} labels={labels} />
      <form className={s.form} onSubmit={submit} noValidate>
        <div className={s.row}>
          <TextField id="firstName" label={labels.firstName} autoComplete="given-name" value={draft.firstName} onChange={(e) => update({ firstName: e.target.value })} error={errors.firstName} />
          <TextField id="lastName" label={labels.lastName} autoComplete="family-name" value={draft.lastName} onChange={(e) => update({ lastName: e.target.value })} error={errors.lastName} />
        </div>
        <TextField
          id="email"
          name="username"
          label={labels.email}
          type="email"
          inputMode="email"
          autoComplete="username"
          value={draft.email}
          onChange={(e) => update({ email: e.target.value })}
          error={errors.email}
          icon={<Icon name="mail" size={20} />}
        />
        <PhoneField id="phone" value={draft.phone} onChange={(v) => update({ phone: v })} error={errors.phone} />
        <PasswordField id="password" label={labels.password!} autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint={t('ui.auth.password.hint')} meter />
        <CheckboxField
          id="acceptTerms"
          checked={draft.acceptTerms}
          onChange={(v) => update({ acceptTerms: v })}
          error={errors.acceptTerms}
          label={
            <>
              {t('ui.auth.signup.termsBefore')}{' '}
              <Link href="/conditions-generales" target="_blank" rel="noopener">
                {t('ui.auth.signup.termsLink')}
              </Link>{' '}
              {t('ui.auth.signup.termsAnd')}{' '}
              <Link href="/confidentialite" target="_blank" rel="noopener">
                {t('ui.auth.signup.privacyLink')}
              </Link>
              .
            </>
          }
        />
        <CheckboxField id={`${id}-marketing`} checked={draft.marketingOptIn} onChange={(v) => update({ marketingOptIn: v })} label={t('ui.auth.signup.marketing')} />
        <Honeypot name={LEAD_HONEYPOT_FIELD} value={honeypot} onChange={setHoneypot} />
        <Button type="submit" size="L" fullWidth pending={pending} chevron>
          {t('ui.auth.signup.submit')}
        </Button>
      </form>
      <p className={s.door}>
        {t('ui.auth.signup.alreadyPrompt')}
        <Link href={next || simulationId ? `/connexion?${new URLSearchParams({ ...(next ? { suite: next } : {}), ...(simulationId ? { simulation: simulationId } : {}) })}` : '/connexion'} className={s.link}>
          {t('ui.auth.signup.already')}
        </Link>
      </p>
      <ContactLine {...contact} />
    </>
  );
}
