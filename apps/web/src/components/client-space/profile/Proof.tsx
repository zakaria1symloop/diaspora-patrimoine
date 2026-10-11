'use client';
// AUTH-086 — proving again who one is for a sensitive action: the password when the account has one; otherwise a
// 6-digit code sent by e-mail (`POST /auth/action-code`, for that action only, 10 minutes, five tries), typed on the
// same screen. The proof travels in the request of the action itself (no trust window).
import { useId, useState } from 'react';
import type { SensitiveAction } from '@dp/contracts';
import { Button } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import { TextField } from '@/components/forms/fields';
import s from './profile.module.css';

export interface ProofValue {
  password?: string;
  actionCode?: string;
}

export function Proof({
  hasPassword,
  action,
  email,
  value,
  onChange,
  error,
}: {
  hasPassword: boolean;
  action: SensitiveAction;
  email: string;
  value: ProofValue;
  onChange: (v: ProofValue) => void;
  error?: string | null;
}) {
  const id = useId();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  if (hasPassword) {
    return (
      <TextField
        id={id}
        type="password"
        autoComplete="current-password"
        label={t('ui.client.security.proof.password')}
        value={value.password ?? ''}
        onChange={(e) => onChange({ password: e.target.value })}
        error={error}
      />
    );
  }
  async function send() {
    setSending(true);
    const r = await apiCall('/auth/action-code', { method: 'POST', body: { action }, retryOnAuth: true });
    setSending(false);
    if (r.ok) setSent(true);
  }
  return (
    <div className={s.proof}>
      <p className={s.help}>{t('ui.client.security.proof.noPasswordIntro')}</p>
      <Button variant="secondary" size="S" pending={sending} onClick={() => void send()}>
        {sent ? t('ui.client.security.proof.newCode') : t('ui.client.security.proof.sendCode')}
      </Button>
      {sent ? <p className={s.help}>{t('ui.client.security.proof.codeSent', { adresse: email })}</p> : null}
      <TextField
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        label={t('ui.client.security.proof.code')}
        value={value.actionCode ?? ''}
        onChange={(e) => onChange({ actionCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
        error={error}
      />
    </div>
  );
}

/** The field error of a proof answer (401 INVALID_CREDENTIALS / INVALID_CODE, 410 GONE, 422 REQUIRED). */
export function proofError(code: string | undefined, fallback: string): string | null {
  if (code === 'GONE') return t('ui.client.security.proof.gone');
  if (code === 'INVALID_CREDENTIALS') return t('ui.error.INVALID_CREDENTIALS');
  return code ? fallback : null;
}
