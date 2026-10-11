'use client';
// EA-00 — the sign-in of the staff (BO-002, BO-003, AUTH-022, AUTH-026): e-mail and password, then the code of the
// second factor (mandatory, D-033), or — for an invited account — the three steps of the first sign-in (password,
// second factor, charter). No « Se souvenir de moi », no sign-in by link. One message whatever the reason of a failure
// (BO-001: a client account that tries reads « E-mail ou mot de passe incorrect. »). A step in progress survives a
// reload (`GET /auth/step`). The same pieces serve the window « Votre session a expiré » of the shell (TRV-083).
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { loginRequestSchema, type LoginResponse, type SessionResponse, type StaffSetupStep, type StepResponse } from '@dp/contracts';
import { Banner, Button } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { checkSchema, errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { CodeInput, formStyles as f, PasswordInput, TextInput } from '../shell/forms';
import { StaffSetup } from './StaffSetup';
import s from './door.module.css';

type View = { kind: 'loading' } | { kind: 'password'; notice?: string | null } | { kind: 'two-factor'; remaining?: number } | { kind: 'setup'; steps: StaffSetupStep[] };

export interface SignInProps {
  /** Internal path asked for before the sign-in (AUTH-023), checked by the API. */
  next?: string | null;
  /** The window of the shell: the address is known and cannot be changed. */
  fixedEmail?: string;
  /** Called with the open session. */
  onSession: (session: SessionResponse) => void;
  /** Titles are rendered by the page of the door; the window of the shell has its own. */
  heading?: (view: View['kind']) => ReactNode;
  /** A notice shown above the form at the first display (« Votre mot de passe est enregistré… »). */
  notice?: string | null;
  /** The answer of a link page (reset, invitation) that already holds a step: start from it. */
  initial?: LoginResponse | null;
  compact?: boolean;
}

export function SignIn({ next, fixedEmail, onSession, heading, notice, initial, compact }: SignInProps) {
  const [view, setView] = useState<View>(initial ? fromResponse(initial) : fixedEmail ? { kind: 'password' } : { kind: 'loading' });

  const handle = useCallback(
    (r: LoginResponse) => {
      if (r.status === 'SESSION') return onSession(r);
      setView(fromResponse(r));
    },
    [onSession],
  );
  const expired = useCallback(() => setView({ kind: 'password', notice: t('ui.auth.common.sessionExpired') }), []);

  useEffect(() => {
    if (initial?.status === 'SESSION') onSession(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A step in progress (reload of the page).
  useEffect(() => {
    if (view.kind !== 'loading') return;
    let alive = true;
    void adminCall<LoginResponse>('/auth/step', { session: false }).then((r) => {
      if (!alive) return;
      setView(r.ok && r.data.status === 'STEP' ? fromResponse(r.data) : { kind: 'password' });
    });
    return () => {
      alive = false;
    };
  }, [view.kind]);

  if (view.kind === 'loading') {
    return (
      <p className={f.muted} role="status">
        {t('ui.auth.common.loading')}
      </p>
    );
  }
  return (
    <>
      {heading?.(view.kind)}
      {view.kind === 'password' ? <PasswordStep next={next ?? null} fixedEmail={fixedEmail} notice={view.notice ?? notice ?? null} onResult={handle} compact={compact} /> : null}
      {view.kind === 'two-factor' ? <TwoFactorStep remaining={view.remaining} onResult={handle} onExpired={expired} /> : null}
      {view.kind === 'setup' ? <StaffSetup steps={view.steps} onResult={handle} onExpired={expired} /> : null}
    </>
  );
}

function fromResponse(r: LoginResponse): View {
  if (r.status === 'SESSION') return { kind: 'loading' };
  const step = r as StepResponse;
  if (step.nextStep === 'TWO_FACTOR') return { kind: 'two-factor', remaining: step.remainingAttempts };
  if (step.nextStep === 'STAFF_SETUP') return { kind: 'setup', steps: step.remainingSteps ?? [] };
  return { kind: 'password' };
}

function PasswordStep({ next, fixedEmail, notice, onResult, compact }: { next: string | null; fixedEmail?: string; notice: string | null; onResult: (r: LoginResponse) => void; compact?: boolean }) {
  const [email, setEmail] = useState(fixedEmail ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const checked = checkSchema(loginRequestSchema, { email, password, rememberMe: false });
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    setPending(true);
    setError(null);
    const res = await adminCall<LoginResponse>('/auth/login', { session: false, body: { email, password, rememberMe: false, ...(next ? { next } : {}) } });
    setPending(false);
    if (res.ok) return onResult(res.data);
    setPassword('');
    setError(errorText(res));
  }

  return (
    <>
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <form className={f.form} onSubmit={submit} noValidate>
        <TextInput
          label={t('ui.auth.common.email')}
          name="username"
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          readOnly={Boolean(fixedEmail)}
          autoFocus={!fixedEmail}
        />
        <PasswordInput label={t('ui.auth.password.label')} autoComplete="current-password" value={password} onValue={setPassword} error={errors.password} autoFocus={Boolean(fixedEmail)} />
        <Button type="submit" variant="tool" size="M" fullWidth pending={pending}>
          {t('ui.auth.login.submit')}
        </Button>
      </form>
      {compact ? null : (
        <p className={s.links}>
          <Link href="/mot-de-passe-oublie" className={f.link}>
            {t('ui.auth.login.forgot')}
          </Link>
        </p>
      )}
    </>
  );
}

export function TwoFactorStep({ remaining, onResult, onExpired }: { remaining?: number; onResult: (r: LoginResponse) => void; onExpired: () => void }) {
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(remaining);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setError(t('ui.validation.REQUIRED'));
    setPending(true);
    setError(null);
    const res = await adminCall<LoginResponse>('/auth/login/two-factor', { session: false, body: recovery ? { recoveryCode: code } : { code } });
    setPending(false);
    if (res.ok) return onResult(res.data);
    if ((res.status === 401 && res.error?.code === 'UNAUTHENTICATED') || res.error?.code === 'ACCOUNT_LOCKED') return onExpired();
    if (res.error?.code === 'INVALID_CODE') setLeft(Number(res.error.params?.remaining ?? 0));
    setCode('');
    setError(res.error?.code === 'VALIDATION_ERROR' ? t('ui.auth.twoFactor.wrong') : errorText(res));
  }

  return (
    <>
      <p className={s.intro}>{recovery ? t('ui.auth.twoFactor.recoveryPrompt') : t('ui.auth.twoFactor.prompt')}</p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <form className={f.form} onSubmit={submit} noValidate>
        <CodeInput label={recovery ? t('ui.auth.twoFactor.recoveryLabel') : t('ui.auth.twoFactor.code')} value={code} onValue={setCode} recovery={recovery} autoFocus />
        <Button type="submit" variant="tool" size="M" fullWidth pending={pending}>
          {t('ui.auth.twoFactor.submit')}
        </Button>
      </form>
      {left !== undefined && left < 5 ? <p className={f.muted}>{t('ui.auth.twoFactor.remaining', { n: left })}</p> : null}
      <p className={s.links}>
        <button
          type="button"
          className={f.link}
          onClick={() => {
            setRecovery((v) => !v);
            setCode('');
            setError(null);
          }}
        >
          {recovery ? t('ui.auth.twoFactor.useApp') : t('ui.auth.twoFactor.useRecovery')}
        </button>
      </p>
      <p className={f.muted}>{t('ui.admin-shell.door.lostDevice')}</p>
    </>
  );
}
