'use client';
// EC-51 — Sécurité (PRO-020, PRO-021, AUTH-081, AUTH-085, AUTH-086), on the routes of identity under `/client/me`:
// the password (other sessions closed), the optional second factor in four steps (proof · QR code and key · a code ·
// ten recovery codes with « Copier », « Télécharger » and the box « J'ai conservé mes codes de secours », only after
// which it is active), its deactivation and new recovery codes, and the connected devices.
import { useId, useState } from 'react';
import type { RecoveryCodesResponse, SessionItem, TwoFactorSetupResponse } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import { CheckboxField, TextField } from '@/components/forms/fields';
import { Banner, errorMessage, fieldErrors, PasswordField } from '@/components/auth/kit';
import { Proof, type ProofValue } from './Proof';
import { relativeTime } from '../texts';
import s from './profile.module.css';
import { copyText } from '@dp/ui';

type ApiErr = Parameters<typeof errorMessage>[0];

/** The proof's error (wrong password / code / dead code), else null. */
function proofMessage(err: ApiErr): string | null {
  if (!err) return null;
  if (err.code === 'INVALID_CREDENTIALS') return t('ui.client.security.proof.wrongPassword');
  if (err.code === 'GONE') return t('ui.client.security.proof.gone');
  if (err.code === 'INVALID_CODE') return errorMessage(err);
  const fe = fieldErrors(err);
  return fe.password ?? fe.actionCode ?? fe.currentPassword ?? null;
}

function Codes({ codes }: { codes: string[] }) {
  const copy = async () => {
    try {
      if (!(await copyText(codes.join('\n')))) return;
      showToast({ message: t('ui.client.security.twoFactor.copied') });
    } catch {
      /* clipboard refused */
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`${codes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = t('ui.client.security.twoFactor.fileName');
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <ol className={s.codes}>
        {codes.map((c) => (
          <li key={c}>
            <code>{c}</code>
          </li>
        ))}
      </ol>
      <div className={s.panelActions}>
        <Button variant="secondary" size="S" icon="copy" onClick={() => void copy()}>
          {t('ui.client.security.twoFactor.copy')}
        </Button>
        <Button variant="secondary" size="S" icon="download" onClick={download}>
          {t('ui.client.security.twoFactor.download')}
        </Button>
      </div>
    </>
  );
}

function PasswordSection({ hasPassword: initialHas, email }: { hasPassword: boolean; email: string }) {
  const id = useId();
  const [hasPassword, setHasPassword] = useState(initialHas);
  const [current, setCurrent] = useState('');
  const [proof, setProof] = useState<ProofValue>({});
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFailure(null);
    // Checked here first (the server checks again): an empty form never leaves the page.
    const local: Record<string, string> = {};
    if (hasPassword && !current) local.proof = t('ui.validation.REQUIRED');
    if (next.length < 10) local.newPassword = next ? t('ui.validation.TOO_SHORT', { n: 10 }) : t('ui.validation.REQUIRED');
    if (Object.keys(local).length) return setErrors(local);
    setPending(true);
    const body = hasPassword ? { currentPassword: current, newPassword: next } : { actionCode: proof.actionCode, newPassword: next };
    const res = await apiCall('/client/me/password', { method: 'PATCH', body, retryOnAuth: true });
    setPending(false);
    if (!res.ok) {
      const fe = fieldErrors(res.error);
      const pm = res.error?.code === 'VALIDATION_ERROR' ? (fe.currentPassword ?? fe.actionCode ?? null) : proofMessage(res.error);
      if (fe.newPassword || pm) setErrors({ ...(fe.newPassword ? { newPassword: fe.newPassword } : {}), ...(pm ? { proof: pm } : {}) });
      else setFailure(errorMessage(res.error, { offline: res.offline, status: res.status }));
      return;
    }
    setCurrent('');
    setNext('');
    setProof({});
    setHasPassword(true);
    showToast({ message: t('ui.client.security.password.done') });
  }

  return (
    <form className={s.section} onSubmit={(e) => void submit(e)} noValidate aria-labelledby={`${id}-t`}>
      <div className={s.sectionHead}>
        <h2 id={`${id}-t`} className={s.sectionTitle}>
          {t('ui.client.security.password.title')}
        </h2>
      </div>
      <p className={s.help}>{hasPassword ? t('ui.client.security.password.intro') : t('ui.client.security.password.introSet')}</p>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <div className={s.fieldsNarrow}>
        {hasPassword ? (
          <PasswordField id={`${id}-c`} label={t('ui.client.security.password.current')} value={current} onChange={setCurrent} autoComplete="current-password" error={errors.proof} />
        ) : (
          <Proof hasPassword={false} action="PASSWORD_SET" email={email} value={proof} onChange={setProof} error={errors.proof} />
        )}
        <PasswordField id={`${id}-n`} label={t('ui.auth.password.newLabel')} value={next} onChange={setNext} autoComplete="new-password" hint={t('ui.auth.password.hint')} meter error={errors.newPassword} />
      </div>
      <div className={s.sectionActions}>
        <Button type="submit" variant="tool" size="M" pending={pending}>
          {hasPassword ? t('ui.client.security.password.submit') : t('ui.client.security.password.submitSet')}
        </Button>
      </div>
    </form>
  );
}

type TwoFactorMode = 'idle' | 'proof' | 'scan' | 'codes' | 'disable' | 'regenerate' | 'newCodes';

function TwoFactorSection({ enabled: initial, hasPassword, email }: { enabled: boolean; hasPassword: boolean; email: string }) {
  const id = useId();
  const [enabled, setEnabled] = useState(initial);
  const [mode, setMode] = useState<TwoFactorMode>('idle');
  const [proof, setProof] = useState<ProofValue>({});
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [kept, setKept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const reset = () => {
    setMode('idle');
    setProof({});
    setSetup(null);
    setCode('');
    setCodes([]);
    setKept(false);
    setError(null);
  };
  const run = async <T,>(path: string, method: 'POST' | 'DELETE', body: unknown): Promise<T | null> => {
    setError(null);
    setPending(true);
    const res = await apiCall<T>(path, { method, body, retryOnAuth: true });
    setPending(false);
    if (!res.ok) {
      setError(res.error?.reason === 'CONFLICT_STATE' ? errorMessage(res.error) : (proofMessage(res.error) ?? errorMessage(res.error, { offline: res.offline, status: res.status })));
      return null;
    }
    return res.data ?? (true as T); // 204 answers have no body
  };
  const total = 4;
  const stepLine = (n: number) => <p className={s.stepOf}>{t('ui.client.security.twoFactor.step', { n, total })}</p>;

  return (
    <section className={s.section} aria-labelledby={`${id}-t`}>
      <div className={s.sectionHead}>
        <h2 id={`${id}-t`} className={s.sectionTitle}>
          {t('ui.client.security.twoFactor.title')}
        </h2>
        <span className={`${s.state} ${enabled ? s.stateOn : ''}`}>{enabled ? t('ui.client.security.twoFactor.on') : t('ui.client.security.twoFactor.off')}</span>
      </div>
      <p className={s.help}>{t('ui.client.security.twoFactor.intro')}</p>
      {error ? <Banner tone="error">{error}</Banner> : null}

      {mode === 'idle' ? (
        <div className={s.panelActions}>
          {enabled ? (
            <>
              <Button variant="secondary" size="M" onClick={() => setMode('regenerate')}>
                {t('ui.client.security.twoFactor.regenerate')}
              </Button>
              <Button variant="tertiary" size="M" onClick={() => setMode('disable')}>
                {t('ui.client.security.twoFactor.disable')}
              </Button>
            </>
          ) : (
            <Button variant="tool" size="M" icon="shield" onClick={() => setMode('proof')}>
              {t('ui.client.security.twoFactor.start')}
            </Button>
          )}
        </div>
      ) : null}

      {mode === 'proof' ? (
        <div className={s.inlinePanel}>
          {stepLine(1)}
          <p>{t('ui.client.security.twoFactor.step1')}</p>
          <Proof hasPassword={hasPassword} action="TWO_FACTOR" email={email} value={proof} onChange={setProof} />
          <div className={s.panelActions}>
            <Button
              variant="tool"
              size="M"
              pending={pending}
              onClick={async () => {
                const r = await run<TwoFactorSetupResponse>('/client/me/two-factor/setup', 'POST', proof);
                if (r) {
                  setSetup(r);
                  setMode('scan');
                }
              }}
            >
              {t('ui.client.security.twoFactor.continue')}
            </Button>
            <Button variant="tertiary" size="M" onClick={reset}>
              {t('ui.client.security.twoFactor.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'scan' && setup ? (
        <div className={s.inlinePanel}>
          {stepLine(2)}
          <p>{t('ui.client.security.twoFactor.step2')}</p>
          <div className={s.qrRow}>
            <img className={s.qr} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qrSvg)}`} alt={t('ui.client.security.twoFactor.qrAlt')} width={180} height={180} />
            <div>
              <p className={s.labelSmall}>{t('ui.client.security.twoFactor.key')}</p>
              <code className={s.secret}>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
            </div>
          </div>
          {stepLine(3)}
          <p>{t('ui.client.security.twoFactor.step3')}</p>
          <div className={s.fieldsNarrow}>
            <TextField id={`${id}-code`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} label={t('ui.client.security.twoFactor.code')} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          </div>
          <div className={s.panelActions}>
            <Button
              variant="tool"
              size="M"
              pending={pending}
              onClick={async () => {
                const r = await run<RecoveryCodesResponse>('/client/me/two-factor/confirm', 'POST', { code });
                if (r) {
                  setCodes(r.recoveryCodes);
                  setMode('codes');
                }
              }}
            >
              {t('ui.client.security.twoFactor.continue')}
            </Button>
            <Button variant="tertiary" size="M" onClick={reset}>
              {t('ui.client.security.twoFactor.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'codes' ? (
        <div className={s.inlinePanel}>
          {stepLine(4)}
          <p>{t('ui.client.security.twoFactor.step4')}</p>
          <Codes codes={codes} />
          <CheckboxField id={`${id}-kept`} label={t('ui.client.security.twoFactor.keep')} checked={kept} onChange={setKept} />
          <div className={s.panelActions}>
            <Button
              variant="tool"
              size="M"
              disabled={!kept}
              pending={pending}
              onClick={async () => {
                const ok = await run<unknown>('/client/me/two-factor/enable', 'POST', { saved: true });
                if (ok !== null) {
                  setEnabled(true);
                  reset();
                  showToast({ message: t('ui.client.security.twoFactor.enabled') });
                }
              }}
            >
              {t('ui.client.security.twoFactor.enable')}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'disable' ? (
        <div className={s.inlinePanel}>
          <p>{t('ui.client.security.twoFactor.disableIntro')}</p>
          <div className={s.fieldsNarrow}>
            <Proof hasPassword={hasPassword} action="TWO_FACTOR" email={email} value={proof} onChange={setProof} />
            <TextField id={`${id}-dcode`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} label={t('ui.client.security.twoFactor.code')} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          </div>
          <div className={s.panelActions}>
            <Button
              variant="danger"
              size="M"
              pending={pending}
              onClick={async () => {
                const ok = await run<unknown>('/client/me/two-factor', 'DELETE', { ...proof, code });
                if (ok !== null) {
                  setEnabled(false);
                  reset();
                  showToast({ message: t('ui.client.security.twoFactor.disabled') });
                }
              }}
            >
              {t('ui.client.security.twoFactor.disable')}
            </Button>
            <Button variant="tertiary" size="M" onClick={reset}>
              {t('ui.client.security.twoFactor.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'regenerate' ? (
        <div className={s.inlinePanel}>
          <p>{t('ui.client.security.twoFactor.regenerateIntro')}</p>
          <div className={s.fieldsNarrow}>
            <Proof hasPassword={hasPassword} action="TWO_FACTOR" email={email} value={proof} onChange={setProof} />
          </div>
          <div className={s.panelActions}>
            <Button
              variant="tool"
              size="M"
              pending={pending}
              onClick={async () => {
                const r = await run<RecoveryCodesResponse>('/client/me/two-factor/recovery-codes', 'POST', proof);
                if (r) {
                  setCodes(r.recoveryCodes);
                  setMode('newCodes');
                }
              }}
            >
              {t('ui.client.security.twoFactor.regenerate')}
            </Button>
            <Button variant="tertiary" size="M" onClick={reset}>
              {t('ui.client.security.twoFactor.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'newCodes' ? (
        <div className={s.inlinePanel}>
          <Banner tone="success">{t('ui.client.security.twoFactor.regenerated')}</Banner>
          <Codes codes={codes} />
          <div className={s.panelActions}>
            <Button variant="tool" size="M" onClick={reset}>
              {t('ui.common.tour.done')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SessionsSection({ initial, timeZone }: { initial: SessionItem[]; timeZone: string }) {
  const [sessions, setSessions] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const others = sessions.filter((x) => !x.current);

  async function revoke(id: string | null) {
    setBusy(id ?? 'all');
    setFailure(null);
    const res = await apiCall(id ? `/client/me/sessions/${id}` : '/client/me/sessions', { method: 'DELETE', retryOnAuth: true });
    setBusy(null);
    if (!res.ok) return setFailure(errorMessage(res.error, { offline: res.offline, status: res.status }));
    setSessions((list) => (id ? list.filter((x) => x.id !== id) : list.filter((x) => x.current)));
    showToast({ message: id ? t('ui.client.security.sessions.done') : t('ui.client.security.sessions.othersDone') });
  }

  return (
    <section className={s.section} aria-labelledby="appareils">
      <div className={s.sectionHead}>
        <h2 id="appareils" className={s.sectionTitle}>
          {t('ui.client.security.sessions.title')}
        </h2>
      </div>
      <p className={s.help}>{t('ui.client.security.sessions.intro')}</p>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <ul role="list" className={s.people}>
        {sessions.map((x) => (
          <li key={x.id} className={s.person}>
            <span className={s.personIcon} aria-hidden="true">
              <Icon name={/iphone|android|mobile/i.test(x.deviceLabel ?? '') ? 'phone' : 'globe'} size={20} />
            </span>
            <span className={s.personText}>
              <span className={s.personName}>{x.deviceLabel ?? t('ui.client.security.sessions.unknown')}</span>
              <span className={s.help} suppressHydrationWarning>{t('ui.client.security.sessions.lastUsed', { date: relativeTime(x.lastUsedAt, timeZone) })}</span>
              {x.current ? <span className={s.badgeSoft}>{t('ui.client.security.sessions.current')}</span> : null}
            </span>
            {!x.current ? (
              <span className={s.personActions}>
                <Button variant="secondary" size="S" pending={busy === x.id} onClick={() => void revoke(x.id)}>
                  {t('ui.client.security.sessions.logout')}
                </Button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {others.length ? (
        <Button variant="secondary" size="M" icon="logout" pending={busy === 'all'} onClick={() => void revoke(null)}>
          {t('ui.client.security.sessions.logoutOthers')}
        </Button>
      ) : (
        <p className={s.help}>{t('ui.client.security.sessions.none')}</p>
      )}
    </section>
  );
}

export function SecurityPanel(props: { email: string; hasPassword: boolean; twoFactorEnabled: boolean; sessions: SessionItem[]; timeZone: string }) {
  return (
    <div className={s.profile}>
      <PasswordSection hasPassword={props.hasPassword} email={props.email} />
      <TwoFactorSection enabled={props.twoFactorEnabled} hasPassword={props.hasPassword} email={props.email} />
      <SessionsSection initial={props.sessions} timeZone={props.timeZone} />
    </div>
  );
}
