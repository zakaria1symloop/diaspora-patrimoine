'use client';
// PRO-020 steps 2 to 4, BO-003, BO-070, SEC-011 — enrolment of an authenticator application: the QR code and the key
// (for an application that cannot scan), a first code that proves the application works, then the ten recovery codes
// shown ONCE (copy, download) and « J'ai conservé mes codes » before the second factor becomes active. Shared by the
// first sign-in of an invited account and by « Reconfigurer » in « Mes préférences »: the caller gives the three calls.
import { useEffect, useState, type FormEvent } from 'react';
import { RECOVERY_CODES_FILENAME, type RecoveryCodesResponse, type TwoFactorSetupResponse } from '@dp/contracts';
import { Banner, Button, Icon } from '@dp/ui';
import type { CallResult } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { Checkbox, CodeInput, formStyles as f } from '../shell/forms';
import s from './door.module.css';
import { copyText } from '@dp/ui';

export interface EnrolCalls<Done> {
  /** Absent when the caller already holds the key (reconfiguration: the password was asked first). */
  start?: () => Promise<CallResult<TwoFactorSetupResponse>>;
  initial?: TwoFactorSetupResponse | null;
  confirm: (code: string) => Promise<CallResult<RecoveryCodesResponse>>;
  enable: () => Promise<CallResult<Done>>;
  onDone: (result: Done) => void;
  onExpired?: () => void;
}

export function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');
  return (
    <div className={s.codesBox}>
      <ol className={s.codes}>
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className={f.actions}>
        <Button
          variant="secondary"
          size="S"
          icon={copied ? 'check' : 'copy'}
          onClick={() => {
            void copyText(text).then((ok) => {
              if (!ok) return;
              setCopied(true);
              setTimeout(() => setCopied(false), 3000);
            });
          }}
        >
          <span aria-live="polite">{copied ? t('ui.admin-shell.twoFactor.copied') : t('ui.admin-shell.twoFactor.copy')}</span>
        </Button>
        <a className={s.download} href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download={RECOVERY_CODES_FILENAME}>
          <Icon name="download" size={16} />
          {t('ui.common.download')}
        </a>
      </div>
    </div>
  );
}

export function TwoFactorEnrol<Done>({ start, initial, confirm, enable, onDone, onExpired }: EnrolCalls<Done>) {
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(initial ?? null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const fail = (res: CallResult<unknown>) => {
    if (res.ok) return;
    if (res.status === 401 && onExpired) return onExpired();
    setError(errorText(res));
  };

  useEffect(() => {
    if (setup || !start) return;
    let alive = true;
    void start().then((res) => {
      if (!alive) return;
      if (res.ok) setSetup(res.data);
      else fail(res);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return setError(t('ui.auth.twoFactor.wrong'));
    setPending(true);
    setError(null);
    const res = await confirm(code);
    setPending(false);
    if (res.ok) return setCodes(res.data.recoveryCodes);
    setCode('');
    if (res.error?.code === 'INVALID_CODE' || res.error?.code === 'VALIDATION_ERROR') return setError(t('ui.auth.twoFactor.wrong'));
    fail(res);
  }

  async function finish(e: FormEvent) {
    e.preventDefault();
    if (!saved) return setSavedError(t('ui.admin-shell.twoFactor.mustSave'));
    setPending(true);
    setError(null);
    const res = await enable();
    setPending(false);
    if (res.ok) return onDone(res.data);
    fail(res);
  }

  if (codes) {
    return (
      <form className={f.form} onSubmit={finish} noValidate>
        <p className={s.intro}>{t('ui.admin-shell.twoFactor.codesIntro')}</p>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <RecoveryCodes codes={codes} />
        <Checkbox
          label={t('ui.admin-shell.twoFactor.saved')}
          checked={saved}
          onChange={(v) => {
            setSaved(v);
            setSavedError(null);
          }}
          error={savedError}
        />
        <Button type="submit" variant="tool" size="M" fullWidth pending={pending}>
          {t('ui.admin-shell.twoFactor.activate')}
        </Button>
      </form>
    );
  }

  return (
    <form className={f.form} onSubmit={check} noValidate>
      <p className={s.intro}>{t('ui.admin-shell.twoFactor.scanIntro')}</p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {setup ? (
        <div className={s.qrRow}>
          <div className={s.qr} role="img" aria-label={t('ui.admin-shell.twoFactor.qrLabel')} dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
          <div className={s.secret}>
            <span className={f.muted}>{t('ui.admin-shell.twoFactor.manualKey')}</span>
            <code>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
          </div>
        </div>
      ) : (
        <div className={s.qrRow} role="status">
          <span className={s.qrWaiting} aria-hidden="true" />
          <span className={f.muted}>{t('ui.auth.common.loading')}</span>
        </div>
      )}
      <CodeInput label={t('ui.auth.twoFactor.code')} hint={t('ui.admin-shell.twoFactor.codeHint')} value={code} onValue={setCode} />
      <Button type="submit" variant="tool" size="M" fullWidth pending={pending} disabled={!setup}>
        {t('ui.admin-shell.twoFactor.verify')}
      </Button>
    </form>
  );
}
