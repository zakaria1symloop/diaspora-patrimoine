'use client';
// EA-00 and the pages around it (BO-002, BO-003): `/connexion`, `/invitation/{jeton}`, `/mot-de-passe-oublie`,
// `/reinitialisation/{jeton}`. Each leads somewhere: to the back office once the session is open, back to the sign-in
// page otherwise; a dead link says what to do next (BO-003, TRV-125).
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { emailOnlyRequestSchema, isSafeNextPath, type LoginResponse, type SentResponse, type SessionResponse } from '@dp/contracts';
import { Banner, Button, buttonClass, ButtonInner } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { checkSchema, errorText, fieldErrors } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { formStyles as f, PasswordInput, TextInput } from '../shell/forms';
import { DoorHeading } from './DoorFrame';
import { SignIn } from './SignIn';
import s from './door.module.css';

/** AUTH-023 — once signed in: the page asked for (an internal path), else the landing page of the role. */
function enter(session: SessionResponse, next: string | null): void {
  const target = next && isSafeNextPath(next) ? next : isSafeNextPath(session.redirectTo) && session.redirectTo !== '/espace-client' ? session.redirectTo : '/';
  window.location.assign(target);
}

const headingOf = (kind: 'loading' | 'password' | 'two-factor' | 'setup') =>
  kind === 'two-factor' ? (
    <DoorHeading eyebrow={t('ui.admin-shell.door.eyebrow')} title={t('ui.auth.twoFactor.title')} />
  ) : kind === 'setup' ? (
    <DoorHeading eyebrow={t('ui.admin-shell.door.eyebrow')} title={t('ui.admin-shell.setup.heading')} intro={t('ui.admin-shell.setup.intro')} />
  ) : (
    <DoorHeading eyebrow={t('ui.admin-shell.door.eyebrow')} title={t('ui.admin-shell.door.title')} intro={t('ui.admin-shell.door.intro')} />
  );

export function LoginDoor({ next }: { next: string | null }) {
  const onSession = useCallback((session: SessionResponse) => enter(session, next), [next]);
  return <SignIn next={next} onSession={onSession} heading={headingOf} />;
}

function BackToLogin() {
  return (
    <Link href="/connexion" className={buttonClass('secondary', 'M', true)}>
      <ButtonInner size="M">{t('ui.auth.common.backToLogin')}</ButtonInner>
    </Link>
  );
}

/** BO-003 — the invitation link: `POST /auth/staff-setup/start`; unknown, expired or consumed: 410. */
export function InvitationDoor({ token }: { token: string }) {
  const [state, setState] = useState<{ kind: 'checking' } | { kind: 'dead' } | { kind: 'error'; text: string } | { kind: 'ready'; response: LoginResponse }>({ kind: 'checking' });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // the link is exchanged once, even when React mounts twice in development
    started.current = true;
    void adminCall<LoginResponse>('/auth/staff-setup/start', { session: false, body: { token } }).then((r) => {
      if (r.ok) setState({ kind: 'ready', response: r.data });
      else if (r.status === 410 || r.status === 422 || r.status === 404) setState({ kind: 'dead' });
      else setState({ kind: 'error', text: errorText(r) });
    });
  }, [token]);
  const onSession = useCallback((session: SessionResponse) => enter(session, null), []);

  if (state.kind === 'checking') {
    return (
      <>
        <DoorHeading eyebrow={t('ui.admin-shell.door.eyebrow')} title={t('ui.admin-shell.setup.heading')} />
        <p className={f.muted} role="status">
          {t('ui.auth.common.loading')}
        </p>
      </>
    );
  }
  if (state.kind === 'dead') {
    return (
      <>
        <DoorHeading eyebrow={t('ui.admin-shell.door.eyebrow')} title={t('ui.admin-shell.invitation.deadTitle')} />
        <Banner tone="warning">{t('ui.admin-shell.invitation.dead')}</Banner>
        <BackToLogin />
      </>
    );
  }
  if (state.kind === 'error') {
    return (
      <>
        <DoorHeading eyebrow={t('ui.admin-shell.door.eyebrow')} title={t('ui.admin-shell.setup.heading')} />
        <Banner tone="error" action={<Button variant="secondary" size="S" onClick={() => window.location.reload()}>{t('ui.common.retry')}</Button>}>
          {state.text}
        </Banner>
      </>
    );
  }
  return <SignIn initial={state.response} onSession={onSession} heading={headingOf} />;
}

/** AUTH-045 with the `S_` templates — the same answer whatever the address (TRV-112). */
export function ForgotDoor() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const checked = checkSchema(emailOnlyRequestSchema, { email });
    if (!checked.ok) return setFieldError(checked.errors.email ?? t('ui.validation.INVALID_EMAIL'));
    setFieldError(null);
    setPending(true);
    setError(null);
    const res = await adminCall<SentResponse>('/auth/password/forgot', { session: false, body: { email } });
    setPending(false);
    if (res.ok) return setSent(true);
    const fields = fieldErrors(res.error);
    if (fields.email) return setFieldError(fields.email);
    setError(errorText(res));
  }

  if (sent) {
    return (
      <>
        <DoorHeading eyebrow={t('ui.admin-shell.door.eyebrow')} title={t('ui.auth.forgot.title')} />
        <Banner tone="success">{t('ui.admin-shell.forgot.sent')}</Banner>
        <p className={f.muted}>{t('ui.admin-shell.forgot.validity')}</p>
        <BackToLogin />
      </>
    );
  }
  return (
    <>
      <DoorHeading eyebrow={t('ui.admin-shell.door.eyebrow')} title={t('ui.auth.forgot.title')} intro={t('ui.auth.forgot.intro')} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <form className={f.form} onSubmit={submit} noValidate>
        <TextInput label={t('ui.auth.common.email')} type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError} autoFocus />
        <Button type="submit" variant="tool" size="M" fullWidth pending={pending}>
          {t('ui.auth.forgot.submit')}
        </Button>
      </form>
      <p className={s.links}>
        <Link href="/connexion" className={f.link}>
          {t('ui.auth.common.backToLogin')}
        </Link>
      </p>
    </>
  );
}

/** AUTH-045 — the link of `S_PASSWORD_RESET`: one hour, once. The new password, then the second factor as usual. */
export function ResetDoor({ token }: { token: string }) {
  const [state, setState] = useState<'checking' | 'form' | 'dead'>('checking');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [next, setNext] = useState<LoginResponse | null>(null);
  const onSession = useCallback((session: SessionResponse) => enter(session, null), []);

  useEffect(() => {
    let alive = true;
    void adminCall('/auth/password/reset/check', { session: false, body: { token } }).then((r) => {
      if (alive) setState(r.ok ? 'form' : 'dead');
    });
    return () => {
      alive = false;
    };
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return setFieldError(t('ui.validation.REQUIRED'));
    setPending(true);
    setError(null);
    setFieldError(null);
    const res = await adminCall<LoginResponse>('/auth/password/reset', { session: false, body: { token, password } });
    setPending(false);
    if (res.ok) return setNext(res.data);
    if (res.status === 410) return setState('dead');
    const fields = fieldErrors(res.error);
    if (fields.password) return setFieldError(fields.password);
    setError(errorText(res));
  }

  if (next) return <SignIn initial={next} onSession={onSession} heading={headingOf} notice={t('ui.admin-shell.reset.saved')} />;
  if (state === 'checking') {
    return (
      <>
        <DoorHeading eyebrow={t('ui.admin-shell.door.eyebrow')} title={t('ui.auth.reset.title')} />
        <p className={f.muted} role="status">
          {t('ui.auth.common.loading')}
        </p>
      </>
    );
  }
  if (state === 'dead') {
    return (
      <>
        <DoorHeading eyebrow={t('ui.admin-shell.door.eyebrow')} title={t('ui.auth.reset.title')} />
        <Banner tone="warning">{t('ui.auth.common.linkExpired')}</Banner>
        <Link href="/mot-de-passe-oublie" className={buttonClass('tool', 'M', true)}>
          <ButtonInner size="M">{t('ui.auth.reset.newLink')}</ButtonInner>
        </Link>
      </>
    );
  }
  return (
    <>
      <DoorHeading eyebrow={t('ui.admin-shell.door.eyebrow')} title={t('ui.auth.reset.title')} intro={t('ui.auth.reset.intro')} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <form className={f.form} onSubmit={submit} noValidate>
        <PasswordInput label={t('ui.auth.password.newLabel')} hint={t('ui.auth.password.hint')} autoComplete="new-password" value={password} onValue={setPassword} error={fieldError} meter autoFocus />
        <Button type="submit" variant="tool" size="M" fullWidth pending={pending}>
          {t('ui.admin-shell.reset.submit')}
        </Button>
      </form>
    </>
  );
}
