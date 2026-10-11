'use client';
// Pages reached from an e-mail, with the token in their address (SEC-040): verification of the address (EC-03,
// AUTH-013, « Ce n'est pas moi »), new address (AUTH-080), new password (EC-05, AUTH-045), activation (EC-06, AUTH-040),
// sign-in by link (EC-07, AUTH-041). A dead link always offers a way out (« Recevoir un nouveau lien », the contact
// line, AUTH-098). A sign-in that still has a step goes on at the door's sign-in page, which resumes it.
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { activateRequestSchema, type ActivationCheckResponse, type EmailChangeConfirmResponse, type LoginResponse, type VerifyEmailResponse } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { apiCall, type DoorAudience } from '@/lib/auth-client';
import { refreshClientSession } from '@/lib/session-client';
import { bringOverAnonymousData } from '@/lib/after-sign-in';
import { t } from '@/lib/i18n';
import { CheckboxField } from '../forms/fields';
import { EmailRequestForm } from './EmailRequestForm';
import { Banner, checkSchema, ContactLine, errorMessage, fieldErrors, PasswordField, type ContactInfo } from './kit';
import s from './auth.module.css';

const loginPathOf = (audience: DoorAudience) => (audience === 'PARTNER' ? '/partenaires/connexion' : '/connexion');

/** After a link: the session (its page), or the step to finish at the door's sign-in page. */
function useAfterSignIn(audience: DoorAudience) {
  const router = useRouter();
  return useCallback(
    (r: LoginResponse) => {
      // A full navigation: the token page's no-referrer policy must not follow the sign-in page.
      if (r.status === 'STEP') return window.location.assign(loginPathOf(audience));
      if (audience === 'PARTNER') return router.replace('/partenaires/connexion');
      refreshClientSession();
      void bringOverAnonymousData().finally(() => router.replace(r.redirectTo || '/espace-client'));
    },
    [audience, router],
  );
}

function Dead({ title, contact, children }: { title: string; contact: ContactInfo; children?: React.ReactNode }) {
  return (
    <>
      <span className={s.eyebrow}>
        <Icon name="clock" size={16} />
        {title}
      </span>
      <h1 className={s.title}>{title}</h1>
      {children}
      <ContactLine {...contact} />
    </>
  );
}

function Checking({ text }: { text: string }) {
  return (
    <p className={s.muted} role="status" aria-live="polite">
      {text}
    </p>
  );
}

// ─── EC-03 — /verification/{jeton} and /partenaires/verification/{jeton} ───

export function VerifyEmailView({ token, audience, contact }: { token: string; audience: DoorAudience; contact: ContactInfo }) {
  const id = useId();
  const after = useAfterSignIn(audience);
  const [state, setState] = useState<'checking' | 'password' | 'already' | 'dead' | 'disowned'>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const started = useRef(false);

  const send = useCallback(
    async (pw?: string) => {
      const res = await apiCall<VerifyEmailResponse>('/auth/verify-email', { audience, body: pw ? { token, password: pw } : { token } });
      if (res.ok) {
        const d = res.data;
        if (d.status === 'PASSWORD_REQUIRED') return setState('password');
        if (d.status === 'ALREADY_VERIFIED') return setState('already');
        return after(d);
      }
      if (res.status === 410) return setState('dead');
      setError(errorMessage(res.error, res));
      if (state === 'checking') setState('password');
    },
    [audience, token, after, state],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void send();
  }, [send]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return setError(t('ui.validation.REQUIRED'));
    setPending(true);
    setError(null);
    await send(password);
    setPending(false);
    setPassword('');
  }

  async function disown() {
    setPending(true);
    const res = await apiCall('/auth/verify-email/disown', { audience, body: { token } });
    setPending(false);
    if (res.ok) return setState('disowned');
    if (res.status === 410) return setState('dead');
    setError(errorMessage(res.error, res));
  }

  if (state === 'checking') return <Checking text={t('ui.auth.verify.checking')} />;
  if (state === 'disowned') {
    return (
      <>
        <h1 className={s.title}>{t('ui.auth.verify.disowned')}</h1>
        <Link href="/" className={s.link}>
          {t('ui.auth.common.home')}
        </Link>
      </>
    );
  }
  if (state === 'already') {
    return (
      <>
        <h1 className={s.title}>{t('ui.auth.verify.alreadyVerified')}</h1>
        <Link href={loginPathOf(audience)} className={s.link}>
          {t('ui.auth.common.login')}
        </Link>
      </>
    );
  }
  if (state === 'dead') {
    return (
      <Dead title={t('ui.auth.common.linkExpired')} contact={contact}>
        <p className={s.intro}>{t('ui.auth.verify.resendEmail')}</p>
        <EmailRequestForm endpoint="/auth/verify-email/resend" audience={audience} submitLabel={t('ui.auth.common.newLink')} sentText={t('ui.auth.common.newLinkSent')} />
      </Dead>
    );
  }
  return (
    <>
      <span className={s.eyebrow}>
        <Icon name="shield" size={16} />
        {t('ui.auth.verifyWait.title')}
      </span>
      <h1 className={s.title}>{t('ui.auth.verify.passwordTitle')}</h1>
      <p className={s.intro}>{t('ui.auth.verify.passwordBody')}</p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <form className={s.form} onSubmit={submit} noValidate>
        <PasswordField id={`${id}-password`} label={t('ui.auth.password.label')} autoComplete="current-password" value={password} onChange={setPassword} autoFocus />
        <Button type="submit" size="L" fullWidth pending={pending} chevron>
          {t('ui.auth.verify.submit')}
        </Button>
      </form>
      {audience === 'WEB' ? (
        <>
          <hr className={s.divider} />
          <p className={s.muted}>{t('ui.auth.verify.notMe')}</p>
          <div className={s.links}>
            <Button variant="secondary" size="M" onClick={() => void disown()} disabled={pending}>
              {t('ui.auth.verify.notMeButton')}
            </Button>
            <Link href="/mot-de-passe-oublie" className={s.link}>
              {t('ui.auth.verify.newPassword')}
            </Link>
          </div>
        </>
      ) : (
        <Link href="/partenaires/mot-de-passe-oublie" className={s.link}>
          {t('ui.auth.verify.newPassword')}
        </Link>
      )}
      <ContactLine {...contact} />
    </>
  );
}

// ─── AUTH-080 — /nouvelle-adresse/{jeton} ───────────────────────────────────

export function EmailChangeView({ token, contact }: { token: string; contact: ContactInfo }) {
  const [state, setState] = useState<{ kind: 'checking' } | { kind: 'done'; data: EmailChangeConfirmResponse } | { kind: 'inUse' } | { kind: 'dead' } | { kind: 'error'; text: string }>({ kind: 'checking' });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void apiCall<EmailChangeConfirmResponse>('/auth/email-change/confirm', { body: { token } }).then((res) => {
      if (res.ok) return setState({ kind: 'done', data: res.data });
      if (res.status === 410) return setState({ kind: 'dead' });
      if (res.error?.reason === 'EMAIL_IN_USE') return setState({ kind: 'inUse' });
      setState({ kind: 'error', text: errorMessage(res.error, res) });
    });
  }, [token]);

  if (state.kind === 'checking') return <Checking text={t('ui.auth.emailChange.checking')} />;
  if (state.kind === 'done') {
    return (
      <>
        <h1 className={s.title}>{state.data.status === 'CHANGED' ? t('ui.auth.emailChange.changed') : t('ui.auth.emailChange.merge')}</h1>
        <Link href={state.data.signedIn ? '/espace-client' : '/connexion'} className={s.link}>
          {state.data.signedIn ? t('ui.auth.emailChange.toProfile') : t('ui.auth.common.login')}
        </Link>
      </>
    );
  }
  if (state.kind === 'inUse') {
    return (
      <Dead title={t('ui.error.reason.EMAIL_IN_USE')} contact={contact}>
        <p className={s.intro}>{t('ui.auth.emailChange.inUseHelp')}</p>
      </Dead>
    );
  }
  return (
    <Dead title={state.kind === 'dead' ? t('ui.auth.common.linkExpired') : state.text} contact={contact}>
      <p className={s.intro}>{t('ui.auth.emailChange.relogin')}</p>
      <Link href="/connexion" className={s.link}>
        {t('ui.auth.common.login')}
      </Link>
    </Dead>
  );
}

// ─── EC-05 — /reinitialisation/{jeton} ──────────────────────────────────────

export function ResetView({ token, audience, contact }: { token: string; audience: DoorAudience; contact: ContactInfo }) {
  const id = useId();
  const after = useAfterSignIn(audience);
  const [state, setState] = useState<'checking' | 'form' | 'dead'>('checking');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void apiCall('/auth/password/reset/check', { audience, body: { token } }).then((r) => setState(r.ok ? 'form' : 'dead'));
  }, [audience, token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return setErrors({ password: t('ui.validation.REQUIRED') });
    setPending(true);
    setError(null);
    setErrors({});
    const res = await apiCall<LoginResponse>('/auth/password/reset', { audience, body: { token, password } });
    setPending(false);
    if (res.ok) return after(res.data);
    if (res.status === 410) return setState('dead');
    const fe = fieldErrors(res.error);
    setErrors(fe);
    if (!Object.keys(fe).length) setError(errorMessage(res.error, res));
  }

  const forgot = audience === 'PARTNER' ? '/partenaires/mot-de-passe-oublie' : '/mot-de-passe-oublie';
  if (state === 'checking') return <Checking text={t('ui.auth.common.loading')} />;
  if (state === 'dead') {
    return (
      <Dead title={t('ui.auth.common.linkExpired')} contact={contact}>
        <Link href={forgot} className={s.link}>
          {t('ui.auth.reset.newLink')}
        </Link>
      </Dead>
    );
  }
  return (
    <>
      <span className={s.eyebrow}>
        <Icon name="key" size={16} />
        {t('ui.auth.forgot.title')}
      </span>
      <h1 className={s.title}>{t('ui.auth.reset.title')}</h1>
      <p className={s.intro}>{t('ui.auth.reset.intro')}</p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <form className={s.form} onSubmit={submit} noValidate>
        <PasswordField id={`${id}-password`} label={t('ui.auth.password.newLabel')} autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint={t('ui.auth.password.hint')} meter autoFocus />
        <Button type="submit" size="L" fullWidth pending={pending} chevron>
          {t('ui.auth.reset.submit')}
        </Button>
      </form>
      <ContactLine {...contact} />
    </>
  );
}

// ─── EC-06 — /activation/{jeton}?suite=… ────────────────────────────────────

export function ActivationView({ token, next, contact }: { token: string; next: string | null; contact: ContactInfo }) {
  const id = useId();
  const router = useRouter();
  const after = useAfterSignIn('WEB');
  const [check, setCheck] = useState<ActivationCheckResponse | 'checking' | 'dead'>('checking');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const query = next ? `?suite=${encodeURIComponent(next)}` : '';

  useEffect(() => {
    void apiCall<ActivationCheckResponse>(`/auth/activate/check${query}`, { body: { token } }).then((r) => {
      if (!r.ok) return setCheck('dead');
      // MOD-105 — the space is already active: sign in, then the page aimed at.
      if (r.data.status === 'ACTIVE') return router.replace(`/connexion?suite=${encodeURIComponent(r.data.next)}`);
      setCheck(r.data);
    });
  }, [token, query, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const checked = checkSchema(activateRequestSchema, { token, password, acceptTerms: terms, marketingOptIn: marketing });
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    setPending(true);
    setError(null);
    const res = await apiCall<LoginResponse>(`/auth/activate${query}`, { body: { token, password, acceptTerms: terms, marketingOptIn: marketing } });
    setPending(false);
    if (res.ok) return after(res.data);
    if (res.status === 410) return setCheck('dead');
    const fe = fieldErrors(res.error);
    setErrors(fe);
    if (!Object.keys(fe).length) setError(errorMessage(res.error, res));
  }

  if (check === 'checking') return <Checking text={t('ui.auth.common.loading')} />;
  if (check === 'dead' || check.status !== 'VALID') {
    return (
      <Dead title={t('ui.auth.common.linkInvalid')} contact={contact}>
        <Link href={next ? `/connexion?suite=${encodeURIComponent(next)}` : '/connexion'} className={s.link}>
          {t('ui.auth.common.login')}
        </Link>
        <EmailRequestForm endpoint="/auth/activate/resend" submitLabel={t('ui.auth.common.newLink')} sentText={t('ui.auth.common.newLinkSent')} next={next} compact />
      </Dead>
    );
  }
  return (
    <>
      <span className={s.eyebrow}>
        <Icon name="sparkles" size={16} />
        {t('ui.auth.space.eyebrow')}
      </span>
      <h1 className={s.title}>{check.firstName ? t('ui.auth.activation.title', { prenom: check.firstName }) : t('ui.auth.activation.titleNoName')}</h1>
      {check.fromSignup ? <p className={s.intro}>{t('ui.auth.activation.fromSignup')}</p> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <form className={s.form} onSubmit={submit} noValidate>
        <PasswordField id={`${id}-password`} label={t('ui.auth.password.label')} autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint={t('ui.auth.password.hint')} meter autoFocus />
        <CheckboxField
          id={`${id}-terms`}
          checked={terms}
          onChange={setTerms}
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
        <CheckboxField id={`${id}-marketing`} checked={marketing} onChange={setMarketing} label={t('ui.auth.signup.marketing')} />
        <Button type="submit" size="L" fullWidth pending={pending} chevron>
          {t('ui.auth.activation.submit')}
        </Button>
      </form>
      <ContactLine {...contact} />
    </>
  );
}

// ─── EC-07 — /connexion/lien/{jeton} ────────────────────────────────────────

export function MagicConsumeView({ token, contact }: { token: string; contact: ContactInfo }) {
  const after = useAfterSignIn('WEB');
  const [dead, setDead] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void apiCall<LoginResponse>('/auth/magic-link/consume', { body: { token } }).then((r) => {
      if (r.ok) return after(r.data);
      setDead(r.status === 410 ? t('ui.auth.common.linkExpired') : errorMessage(r.error, r));
    });
  }, [token, after]);
  if (!dead) return <Checking text={t('ui.auth.magic.consuming')} />;
  return (
    <Dead title={dead} contact={contact}>
      <EmailRequestForm endpoint="/auth/magic-link" submitLabel={t('ui.auth.common.newLink')} sentText={t('ui.auth.magic.sent')} compact />
    </Dead>
  );
}
