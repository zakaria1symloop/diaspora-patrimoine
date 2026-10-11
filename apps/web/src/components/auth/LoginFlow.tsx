'use client';
// EC-01 (and EP-33 « Connexion ») — e-mail, password (« Afficher »), « Se souvenir de moi » (client door only); one
// message whatever the reason of a failure, with the sign-in link offered under it (AUTH-021); then the steps of
// AUTH-022 (EC-08, EC-03, EC-09) or the session, back to the page asked for (AUTH-023). A step in progress survives a
// reload (`GET /auth/step`). A signed-in client who opens the page goes to his space (AUTH-025).
import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginRequestSchema, type LoginResponse, type StepResponse } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { apiCall, type DoorAudience } from '@/lib/auth-client';
import { refreshClientSession, useClientSession } from '@/lib/session-client';
import { bringOverAnonymousData } from '@/lib/after-sign-in';
import { t } from '@/lib/i18n';
import { CheckboxField, TextField } from '../forms/fields';
import { Banner, checkSchema, ContactLine, errorMessage, PasswordField, type ContactInfo } from './kit';
import { DeclinedView, TermsStep, TwoFactorStep, VerifyWaitStep } from './Steps';
import s from './auth.module.css';

type View = { kind: 'loading' } | { kind: 'form'; notice?: string | null } | { kind: 'step'; step: StepResponse } | { kind: 'declined' };

export interface LoginFlowProps {
  audience: DoorAudience;
  next: string | null;
  simulationId: string | null;
  contact: ContactInfo;
  /** The partner door shows the application once signed in (EP-33). */
  onSession?: () => void;
  /** Links under the form (forgot, sign-up, other door). */
  footer: ReactNode;
  forgotHref: string;
  magicHref?: string;
  title: string;
  intro: string;
  eyebrow: string;
}

export function LoginFlow(props: LoginFlowProps) {
  const { audience } = props;
  const router = useRouter();
  const session = useClientSession();
  const [view, setView] = useState<View>({ kind: 'loading' });

  const expired = useCallback(() => setView({ kind: 'form', notice: t('ui.auth.common.sessionExpired') }), []);

  const handle = useCallback(
    (r: LoginResponse) => {
      if (r.status === 'STEP') return setView({ kind: 'step', step: r });
      if (audience === 'WEB') {
        refreshClientSession();
        void bringOverAnonymousData().finally(() => router.replace(r.redirectTo || '/espace-client'));
      } else {
        props.onSession?.();
      }
    },
    [audience, router, props],
  );

  // A step in progress (reload, or a link page that answered with a step).
  useEffect(() => {
    let alive = true;
    void apiCall<LoginResponse>('/auth/step', { audience }).then((r) => {
      if (!alive) return;
      setView(r.ok && r.data.status === 'STEP' ? { kind: 'step', step: r.data } : { kind: 'form' });
    });
    return () => {
      alive = false;
    };
  }, [audience]);

  // AUTH-025 — already signed in: the space.
  useEffect(() => {
    if (audience === 'WEB' && session.status === 'authenticated' && view.kind === 'form') router.replace(props.next ?? '/espace-client');
  }, [audience, session.status, view.kind, router, props.next]);

  if (view.kind === 'loading') return <p className={s.muted}>{t('ui.auth.common.loading')}</p>;
  if (view.kind === 'declined') return <DeclinedView contact={props.contact} />;
  if (view.kind === 'step') {
    const st = view.step;
    if (st.nextStep === 'TWO_FACTOR') return <TwoFactorStep audience={audience} remaining={st.remainingAttempts} onResult={handle} onExpired={expired} contact={props.contact} />;
    if (st.nextStep === 'EMAIL_VERIFICATION') return <VerifyWaitStep audience={audience} email={st.email ?? ''} onExpired={expired} contact={props.contact} />;
    if (st.nextStep === 'TERMS') return <TermsStep onResult={handle} onDeclined={() => setView({ kind: 'declined' })} onExpired={expired} contact={props.contact} />;
    return <LoginForm {...props} onResult={handle} />;
  }
  return <LoginForm {...props} notice={view.notice ?? null} onResult={handle} />;
}

function LoginForm({
  audience,
  next,
  simulationId,
  contact,
  footer,
  forgotHref,
  magicHref,
  title,
  intro,
  eyebrow,
  notice,
  onResult,
}: LoginFlowProps & { notice?: string | null; onResult: (r: LoginResponse) => void }) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ text: string; help: boolean } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const checked = checkSchema(loginRequestSchema, { email, password, rememberMe: remember });
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setPending(true);
    setError(null);
    const body = { email, password, rememberMe: audience === 'WEB' ? remember : false, ...(simulationId ? { simulationId } : {}), ...(next ? { next } : {}) };
    const res = await apiCall<LoginResponse>('/auth/login', { audience, body });
    setPending(false);
    if (res.ok) return onResult(res.data);
    setPassword('');
    // AUTH-021 — one message; the sign-in link is offered whatever the reason.
    setError({ text: errorMessage(res.error, res), help: res.error?.code === 'INVALID_CREDENTIALS' || res.error?.code === 'ACCOUNT_LOCKED' });
  }

  return (
    <>
      <span className={s.eyebrow}>
        <Icon name="key" size={16} />
        {eyebrow}
      </span>
      <h1 className={s.title}>{title}</h1>
      <p className={s.intro}>{intro}</p>
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      {error ? (
        <Banner
          tone="error"
          action={
            error.help && magicHref ? (
              <Link href={magicHref} className={s.link}>
                {t('ui.auth.login.failedHelp')}
              </Link>
            ) : error.help ? (
              <Link href={forgotHref} className={s.link}>
                {t('ui.auth.login.forgot')}
              </Link>
            ) : null
          }
        >
          {error.text}
        </Banner>
      ) : null}
      <form className={s.form} onSubmit={submit} noValidate>
        <TextField
          id={`${id}-email`}
          name="username"
          label={t('ui.auth.common.email')}
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          icon={<Icon name="mail" size={20} />}
          autoFocus
        />
        <PasswordField id={`${id}-password`} label={t('ui.auth.password.label')} autoComplete="current-password" value={password} onChange={setPassword} error={errors.password} />
        {audience === 'WEB' ? <CheckboxField id={`${id}-remember`} label={t('ui.auth.login.rememberMe')} checked={remember} onChange={setRemember} /> : null}
        <Button type="submit" size="L" fullWidth pending={pending} chevron>
          {t('ui.auth.login.submit')}
        </Button>
      </form>
      <div className={s.links}>
        <Link href={forgotHref} className={s.link}>
          {t('ui.auth.login.forgot')}
        </Link>
        {magicHref ? (
          <Link href={magicHref} className={s.link}>
            {t('ui.auth.login.magic')}
          </Link>
        ) : null}
      </div>
      <hr className={s.divider} />
      {footer}
      <ContactLine {...contact} />
    </>
  );
}
