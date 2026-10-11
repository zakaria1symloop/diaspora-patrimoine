'use client';
// BO-004, BO-005, SEC-023, TRV-083 — the session of a staff member, kept by the frame:
//   · the access token (15 minutes) is renewed silently; only the person's gestures (click, typing, navigation) extend
//     the idle deadline — neither a screen that refreshes itself nor this renewal do (`userActive`);
//   · two minutes before the idle close: « Votre session va se fermer. » · « Rester connecté »;
//   · after the close: sign in again IN PLACE, without losing what is being typed, then the interrupted call is
//     replayed (`adminCall` waits for this window);
//   · a sensitive action asked more than 15 minutes after the last password: « Confirmez votre mot de passe pour
//     continuer. », then the action is replayed (403 REAUTH_REQUIRED).
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { SessionResponse } from '@dp/contracts';
import { Banner, Button, Modal } from '@dp/ui';
import { adminCall, lastGestureAt, lastRefreshAt, refreshSession, setSessionGates, signOut } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { SignIn } from '../door/SignIn';
import { formStyles as f, PasswordInput } from './forms';

const WARN_BEFORE_MS = 120_000;
const RENEW_EVERY_MS = 9 * 60_000;

export function SessionKeeper({ email }: { email: string }) {
  const [warning, setWarning] = useState(false);
  const [relogin, setRelogin] = useState(false);
  const [reauth, setReauth] = useState(false);
  const idleAt = useRef<number | null>(null);
  const waiters = useRef<{ relogin: ((ok: boolean) => void)[]; reauth: ((ok: boolean) => void)[] }>({ relogin: [], reauth: [] });

  const settle = useCallback((kind: 'relogin' | 'reauth', ok: boolean) => {
    const list = waiters.current[kind];
    waiters.current[kind] = [];
    list.forEach((resolve) => resolve(ok));
    if (kind === 'relogin') setRelogin(false);
    else setReauth(false);
  }, []);

  // The gates `adminCall` waits on.
  useEffect(() => {
    setSessionGates({
      relogin: () =>
        new Promise<boolean>((resolve) => {
          waiters.current.relogin.push(resolve);
          setWarning(false);
          setRelogin(true);
        }),
      reauth: () =>
        new Promise<boolean>((resolve) => {
          waiters.current.reauth.push(resolve);
          setReauth(true);
        }),
    });
    return () => setSessionGates({ relogin: null, reauth: null });
  }, []);

  // Deadlines of the session, as the API gives them at each renewal.
  useEffect(() => {
    const onRenewed = (e: Event) => {
      const s = (e as CustomEvent<SessionResponse>).detail;
      idleAt.current = Math.min(new Date(s.idleExpiresAt).getTime(), new Date(s.absoluteExpiresAt).getTime());
    };
    window.addEventListener('dp:session-renewed', onRenewed);
    void refreshSession(true); // arriving on a page is a gesture: it gives the deadlines
    return () => window.removeEventListener('dp:session-renewed', onRenewed);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (relogin) return;
      const now = Date.now();
      const active = lastGestureAt() > lastRefreshAt();
      const deadline = idleAt.current;
      if (deadline !== null && now >= deadline) {
        // the session closed while the screen was open: sign in again in place (nothing typed is lost)
        setWarning(false);
        setRelogin(true);
        return;
      }
      if (deadline !== null && deadline - now <= WARN_BEFORE_MS) {
        if (active) void refreshSession().then((s) => s && setWarning(false));
        else setWarning(true);
        return;
      }
      if (now - lastRefreshAt() >= RENEW_EVERY_MS && document.visibilityState === 'visible') void refreshSession();
    }, 15_000);
    return () => clearInterval(timer);
  }, [relogin]);

  const stay = async () => {
    const s = await refreshSession(true);
    if (s) setWarning(false);
    else {
      setWarning(false);
      setRelogin(true);
    }
  };

  return (
    <>
      <Modal
        open={warning && !relogin}
        onClose={() => void stay()}
        title={t('ui.admin-shell.session.warningTitle')}
        closeLabel={t('ui.common.close')}
        footer={
          <>
            <Button variant="secondary" size="M" onClick={() => void signOut()}>
              {t('ui.admin-shell.account.signOut')}
            </Button>
            <Button variant="tool" size="M" onClick={() => void stay()} autoFocus>
              {t('ui.admin-shell.session.stay')}
            </Button>
          </>
        }
      >
        <p>{t('ui.admin-shell.session.warningText')}</p>
      </Modal>

      <Modal open={relogin} onClose={() => undefined} locked title={t('ui.common.sessionExpired.title')} closeLabel={t('ui.common.close')}>
        <div className={f.form}>
          <p>{t('ui.common.sessionExpired.text')}</p>
          {relogin ? (
            <SignIn
              fixedEmail={email}
              compact
              onSession={(s) => {
                idleAt.current = Math.min(new Date(s.idleExpiresAt).getTime(), new Date(s.absoluteExpiresAt).getTime());
                settle('relogin', true);
              }}
            />
          ) : null}
          <button type="button" className={f.link} onClick={() => void signOut()}>
            {t('ui.admin-shell.session.otherAccount')}
          </button>
        </div>
      </Modal>

      <ConfirmPassword open={reauth} onDone={(ok) => settle('reauth', ok)} />
    </>
  );
}

/** BO-005 — `POST /auth/confirm-password`; a wrong password counts as a failed sign-in (AUTH-032). */
function ConfirmPassword({ open, onDone }: { open: boolean; onDone: (ok: boolean) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (open) {
      setPassword('');
      setError(null);
    }
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return setError(t('ui.validation.REQUIRED'));
    setPending(true);
    setError(null);
    const res = await adminCall('/auth/confirm-password', { body: { password } });
    setPending(false);
    if (res.ok) return onDone(true);
    setPassword('');
    setError(res.error?.code === 'INVALID_CREDENTIALS' ? t('ui.admin-shell.reauth.wrong') : errorText(res));
  }

  return (
    <Modal open={open} onClose={() => onDone(false)} title={t('ui.admin-shell.reauth.title')} closeLabel={t('ui.common.close')}>
      <form className={f.form} onSubmit={submit} noValidate>
        <p>{t('ui.error.reason.REAUTH_REQUIRED')}</p>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <PasswordInput label={t('ui.auth.password.label')} autoComplete="current-password" value={password} onValue={setPassword} autoFocus />
        <div className={`${f.actions} ${f.actionsEnd}`}>
          <Button variant="secondary" size="M" onClick={() => onDone(false)}>
            {t('ui.common.cancel')}
          </Button>
          <Button type="submit" variant="tool" size="M" pending={pending}>
            {t('ui.common.continue')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
