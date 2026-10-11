'use client';
// AUTH-026 — the intermediate steps of a sign-in, each with its own routes: the two-factor code (EC-08, AUTH-050), the
// address to confirm (EC-03, AUTH-012), the new terms (EC-09, AUTH-090). A step answers with the next step, or the session.
import { useEffect, useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { emailSchema, type LegalStepResponse, type LoginResponse, type SentResponse } from '@dp/contracts';
import { Button } from '@dp/ui';
import { apiCall, type DoorAudience } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import { CheckboxField, TextField } from '../forms/fields';
import { Banner, ContactLine, errorMessage, fieldErrors, PasswordField, type ContactInfo } from './kit';
import s from './auth.module.css';

type OnResult = (r: LoginResponse) => void;

// ─── EC-08 ──────────────────────────────────────────────────────────────────

export function TwoFactorStep({ audience, remaining, onResult, onExpired, contact }: { audience: DoorAudience; remaining?: number; onResult: OnResult; onExpired: () => void; contact: ContactInfo }) {
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(remaining);
  const id = useId();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setError(t('ui.validation.REQUIRED'));
    setPending(true);
    setError(null);
    const res = await apiCall<LoginResponse>('/auth/login/two-factor', { audience, body: recovery ? { recoveryCode: code } : { code } });
    setPending(false);
    if (res.ok) return onResult(res.data);
    if (res.status === 401 && res.error?.code === 'UNAUTHENTICATED') return onExpired();
    if (res.error?.code === 'INVALID_CODE') setLeft(Number(res.error.params?.remaining ?? 0));
    if (res.error?.code === 'ACCOUNT_LOCKED') return onExpired();
    setCode('');
    setError(res.error?.code === 'VALIDATION_ERROR' ? t('ui.auth.twoFactor.wrong') : errorMessage(res.error, res));
  }

  return (
    <>
      <span className={s.eyebrow}>{t('ui.auth.twoFactor.title')}</span>
      <h1 className={s.title}>{recovery ? t('ui.auth.twoFactor.recoveryLabel') : t('ui.auth.twoFactor.title')}</h1>
      <p className={s.intro}>{recovery ? t('ui.auth.twoFactor.recoveryPrompt') : t('ui.auth.twoFactor.prompt')}</p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <form className={s.form} onSubmit={submit} noValidate>
        <TextField
          id={`${id}-code`}
          label={recovery ? t('ui.auth.twoFactor.recoveryLabel') : t('ui.auth.twoFactor.code')}
          value={code}
          onChange={(e) => setCode(recovery ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode={recovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          className={recovery ? undefined : s.code}
          autoFocus
          maxLength={recovery ? 11 : 6}
        />
        <Button type="submit" size="L" fullWidth pending={pending} chevron>
          {t('ui.auth.twoFactor.submit')}
        </Button>
      </form>
      {left !== undefined && left < 5 ? <p className={s.muted}>{t('ui.auth.twoFactor.remaining', { n: left })}</p> : null}
      <div className={s.links}>
        <button
          type="button"
          className={s.link}
          onClick={() => {
            setRecovery((v) => !v);
            setCode('');
            setError(null);
          }}
        >
          {recovery ? t('ui.auth.twoFactor.useApp') : t('ui.auth.twoFactor.useRecovery')}
        </button>
      </div>
      <p className={s.muted}>{t('ui.auth.twoFactor.lost')}</p>
      <ContactLine {...contact} />
    </>
  );
}

// ─── EC-03 (waiting) ────────────────────────────────────────────────────────

export function VerifyWaitStep({ audience, email, onExpired, contact }: { audience: DoorAudience; email: string; onExpired: () => void; contact: ContactInfo }) {
  const [address, setAddress] = useState(email);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const id = useId();

  async function resend() {
    setPending(true);
    setError(null);
    const res = await apiCall<SentResponse>('/auth/verify-email/resend', { audience, body: {} });
    setPending(false);
    if (res.ok) return setNotice(t('ui.auth.verifyWait.resent', { email: address }));
    if (res.error?.code === 'UNAUTHENTICATED') return onExpired();
    setError(errorMessage(res.error, res));
  }

  async function change(e: FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(newEmail);
    const errs: Record<string, string> = {};
    if (!parsed.success) errs.email = t(newEmail ? 'ui.validation.INVALID_EMAIL' : 'ui.validation.REQUIRED');
    if (!password) errs.password = t('ui.validation.REQUIRED');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setPending(true);
    setError(null);
    const res = await apiCall<SentResponse & { email: string }>('/auth/signup/email', { method: 'PATCH', audience, body: { email: newEmail, password } });
    setPending(false);
    setPassword('');
    if (res.ok) {
      setAddress(res.data.email);
      setChanging(false);
      setNewEmail('');
      return setNotice(t('ui.auth.verifyWait.resent', { email: res.data.email }));
    }
    if (res.error?.code === 'UNAUTHENTICATED' && res.error.reason === 'STEP_EXPIRED') return onExpired();
    setErrors(fieldErrors(res.error));
    if (res.error?.code !== 'VALIDATION_ERROR') setError(errorMessage(res.error, res));
  }

  return (
    <>
      <span className={s.eyebrow}>{audience === 'PARTNER' ? t('ui.auth.partner.eyebrow') : t('ui.auth.login.title')}</span>
      <h1 className={s.title}>{t('ui.auth.verifyWait.title')}</h1>
      <p className={s.intro}>{audience === 'PARTNER' ? t('ui.auth.partner.verifyWait') : t('ui.auth.verifyWait.body', { email: address })}</p>
      {audience === 'PARTNER' ? <p className={s.muted}>{t('ui.auth.verifyWait.resent', { email: address })}</p> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {changing ? (
        <form className={s.form} onSubmit={change} noValidate>
          <TextField id={`${id}-email`} label={t('ui.auth.verifyWait.newEmail')} type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} error={errors.email} />
          <PasswordField id={`${id}-password`} label={t('ui.auth.verifyWait.currentPassword')} autoComplete="current-password" value={password} onChange={setPassword} error={errors.password} />
          <Button type="submit" size="L" fullWidth pending={pending}>
            {t('ui.auth.verifyWait.changeSubmit')}
          </Button>
          <button type="button" className={s.link} onClick={() => setChanging(false)}>
            {t('ui.auth.verifyWait.cancel')}
          </button>
        </form>
      ) : (
        <div className={s.form}>
          <Button size="L" fullWidth pending={pending} onClick={() => void resend()}>
            {audience === 'PARTNER' ? t('ui.auth.partner.resend') : t('ui.auth.verifyWait.resend')}
          </Button>
          <button type="button" className={s.link} onClick={() => setChanging(true)}>
            {t('ui.auth.verifyWait.change')}
          </button>
        </div>
      )}
      <p className={s.muted}>{contact.email ? t('ui.auth.verifyWait.spamContact', { email: contact.email }) : t('ui.auth.verifyWait.spam')}</p>
      <ContactLine {...contact} />
    </>
  );
}

// ─── EC-09 ──────────────────────────────────────────────────────────────────

const dateFr = (iso: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(iso));

export function TermsStep({ onResult, onDeclined, onExpired, contact }: { onResult: OnResult; onDeclined: () => void; onExpired: () => void; contact: ContactInfo }) {
  const [legal, setLegal] = useState<LegalStepResponse | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const id = useId();

  useEffect(() => {
    void apiCall<LegalStepResponse>('/auth/legal').then((r) => {
      if (r.ok) setLegal(r.data);
      else if (r.error?.code === 'UNAUTHENTICATED') onExpired();
      else setError(errorMessage(r.error, r));
    });
  }, [onExpired]);

  async function accept(e: FormEvent) {
    e.preventDefault();
    if (!checked) return setError(t('ui.validation.MUST_ACCEPT'));
    setPending(true);
    const res = await apiCall<LoginResponse>('/auth/legal/accept', { body: { accept: true } });
    setPending(false);
    if (res.ok) return onResult(res.data);
    if (res.error?.code === 'UNAUTHENTICATED') return onExpired();
    setError(errorMessage(res.error, res));
  }

  async function decline() {
    await apiCall('/auth/legal/decline', { method: 'POST' });
    onDeclined();
  }

  const latest = legal?.documents.reduce<string | null>((acc, d) => (!acc || d.effectiveAt > acc ? d.effectiveAt : acc), null);
  return (
    <>
      <span className={s.eyebrow}>{t('ui.auth.login.title')}</span>
      <h1 className={s.title}>{legal?.firstAcceptance ? t('ui.auth.terms.titleFirst') : t('ui.auth.terms.title')}</h1>
      {latest ? <p className={s.intro}>{t('ui.auth.terms.version', { date: dateFr(latest) })}</p> : null}
      {legal?.documents.some((d) => d.changeSummary) ? (
        <div className={s.legal}>
          <ul>
            {legal.documents.filter((d) => d.changeSummary).map((d) => (
              <li key={d.type}>{d.changeSummary}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {legal ? (
        <ul className={s.links} style={{ justifyContent: 'flex-start' }}>
          {legal.documents.map((d) => (
            <li key={d.type} style={{ listStyle: 'none' }}>
              <Link href={d.url} className={s.link} target="_blank" rel="noopener">
                {d.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <form className={s.form} onSubmit={accept} noValidate>
        <CheckboxField id={`${id}-accept`} label={t('ui.auth.terms.accept')} checked={checked} onChange={setChecked} />
        <Button type="submit" size="L" fullWidth pending={pending} chevron>
          {t('ui.auth.terms.continue')}
        </Button>
        <Button variant="tertiary" size="M" onClick={() => void decline()}>
          {t('ui.auth.terms.decline')}
        </Button>
      </form>
      <ContactLine {...contact} />
    </>
  );
}

export function DeclinedView({ contact }: { contact: ContactInfo }) {
  return (
    <>
      <h1 className={s.title}>{t('ui.auth.terms.declinedTitle')}</h1>
      <p className={s.intro}>{t('ui.auth.terms.declinedBody')}</p>
      <div className={s.links}>
        <Link href="/contact" className={s.link}>
          {t('ui.auth.terms.contactUs')}
        </Link>
        <Link href="/" className={s.link}>
          {t('ui.auth.common.home')}
        </Link>
      </div>
      <ContactLine {...contact} />
    </>
  );
}
