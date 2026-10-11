'use client';
// BO-003 — first sign-in of an invited account, three mandatory steps in this order: the password (AUTH-002), the
// second factor (PRO-020 steps), the charter (`admin.charter`). No screen of the back office before the three: only
// the step token `STAFF_SETUP`. An interrupted setup resumes where it stopped (the API answers the steps that remain).
import { useEffect, useState, type FormEvent } from 'react';
import type { LoginResponse, RecoveryCodesResponse, StaffSetupStateResponse, StaffSetupStep, TwoFactorSetupResponse } from '@dp/contracts';
import { Banner, Button } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { Checkbox, formStyles as f, PasswordInput } from '../shell/forms';
import { RichText } from '../shell/RichText';
import { TwoFactorEnrol } from './TwoFactorEnrol';
import s from './door.module.css';

const ORDER: StaffSetupStep[] = ['PASSWORD', 'TWO_FACTOR', 'CHARTER'];

export function StaffSetup({ steps, onResult, onExpired }: { steps: StaffSetupStep[]; onResult: (r: LoginResponse) => void; onExpired: () => void }) {
  const [remaining, setRemaining] = useState<StaffSetupStep[]>(steps);
  const [state, setState] = useState<StaffSetupStateResponse | null>(null);
  const current = ORDER.find((x) => remaining.includes(x)) ?? null;

  useEffect(() => setRemaining(steps), [steps]);

  // The first name, the role and — when that step remains — the text of the charter.
  useEffect(() => {
    let alive = true;
    void adminCall<StaffSetupStateResponse>('/auth/staff-setup', { session: false }).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setState(r.data);
        setRemaining(r.data.remainingSteps);
      } else if (r.status === 401) onExpired();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const advance = (r: LoginResponse) => {
    if (r.status === 'STEP' && r.nextStep === 'STAFF_SETUP') return setRemaining(r.remainingSteps ?? []);
    onResult(r);
  };

  if (!current) return null;
  const index = ORDER.indexOf(current) + 1;
  return (
    <>
      <ol className={s.steps} aria-label={t('ui.common.stepOf', { n: index, total: ORDER.length })}>
        {ORDER.map((step, i) => (
          <li key={step} className={s.step} data-state={i + 1 < index ? 'done' : i + 1 === index ? 'current' : 'todo'} aria-current={i + 1 === index ? 'step' : undefined}>
            <span className={s.stepDot} aria-hidden="true">
              {i + 1}
            </span>
            {t(`ui.admin-shell.setup.step.${step}`)}
          </li>
        ))}
      </ol>
      <h2 className={s.stepTitle}>{t(`ui.admin-shell.setup.title.${current}`)}</h2>
      {current === 'PASSWORD' ? <PasswordStep onResult={advance} onExpired={onExpired} /> : null}
      {current === 'TWO_FACTOR' ? (
        <TwoFactorEnrol<LoginResponse>
          start={() => adminCall<TwoFactorSetupResponse>('/auth/staff-setup/two-factor', { session: false, body: { action: 'SETUP' } })}
          confirm={(code) => adminCall<RecoveryCodesResponse>('/auth/staff-setup/two-factor', { session: false, body: { action: 'CONFIRM', code } })}
          enable={() => adminCall<LoginResponse>('/auth/staff-setup/two-factor', { session: false, body: { action: 'ENABLE', saved: true } })}
          onDone={advance}
          onExpired={onExpired}
        />
      ) : null}
      {current === 'CHARTER' ? <CharterStep charter={state?.charter ?? null} onResult={advance} onExpired={onExpired} /> : null}
    </>
  );
}

function PasswordStep({ onResult, onExpired }: { onResult: (r: LoginResponse) => void; onExpired: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return setFieldError(t('ui.validation.REQUIRED'));
    setPending(true);
    setError(null);
    setFieldError(null);
    const res = await adminCall<LoginResponse>('/auth/staff-setup/password', { session: false, body: { password } });
    setPending(false);
    if (res.ok) return onResult(res.data);
    if (res.status === 401) return onExpired();
    const fields = fieldErrors(res.error);
    if (fields.password) return setFieldError(fields.password);
    setError(errorText(res));
  }

  return (
    <form className={f.form} onSubmit={submit} noValidate>
      <p className={s.intro}>{t('ui.admin-shell.setup.passwordIntro')}</p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {/* TRV-116 — the rules of a password are written before the typing */}
      <PasswordInput label={t('ui.auth.password.newLabel')} hint={t('ui.auth.password.hint')} autoComplete="new-password" value={password} onValue={setPassword} error={fieldError} meter autoFocus />
      <Button type="submit" variant="tool" size="M" fullWidth pending={pending}>
        {t('ui.common.continue')}
      </Button>
    </form>
  );
}

function CharterStep({ charter, onResult, onExpired }: { charter: string | null; onResult: (r: LoginResponse) => void; onExpired: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!accepted) return setCheckError(t('ui.validation.MUST_ACCEPT'));
    setPending(true);
    setError(null);
    const res = await adminCall<LoginResponse>('/auth/staff-setup/charter', { session: false, body: { accept: true } });
    setPending(false);
    if (res.ok) return onResult(res.data);
    if (res.status === 401) return onExpired();
    setError(errorText(res));
  }

  return (
    <form className={f.form} onSubmit={submit} noValidate>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {charter ? (
        <RichText html={charter} className={s.charter} />
      ) : (
        <p className={f.muted} role="status">
          {t('ui.auth.common.loading')}
        </p>
      )}
      <Checkbox
        label={t('ui.admin-shell.setup.charterAccept')}
        checked={accepted}
        onChange={(v) => {
          setAccepted(v);
          setCheckError(null);
        }}
        error={checkError}
      />
      <Button type="submit" variant="tool" size="M" fullWidth pending={pending} disabled={!charter}>
        {t('ui.common.continue')}
      </Button>
    </form>
  );
}
