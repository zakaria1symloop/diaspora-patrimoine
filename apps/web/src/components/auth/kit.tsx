'use client';
// Pieces shared by the account pages: the password field with « Afficher » and its strength meter (AUTH-002, AUTH-095),
// banners (TRV-113), the messages of the API codes (TRV-110, 07-design/03 § 4), the field errors (TRV-064) — the same
// schema as the API decides them (ARC-030).
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import type { ApiErrorBody, ApiErrorDetail } from '@dp/contracts';
import { hasMessage } from '@dp/i18n';
import { Icon } from '@dp/ui';
import type { z } from 'zod';
import { t } from '@/lib/i18n';
import fs from '../forms/forms.module.css';
import s from './auth.module.css';

type ApiError = ApiErrorBody['error'];

/** TRV-064 — the message of one field code. */
export function fieldMessage(detail: Pick<ApiErrorDetail, 'code' | 'params'>): string {
  const p = (detail.params ?? {}) as Record<string, string | number>;
  if (detail.code === 'WEAK_PASSWORD') return p.reason === 'PERSONAL' ? t('ui.auth.password.personal') : t('ui.auth.password.common');
  if (detail.code === 'TOO_SHORT' && p.n) return t('ui.auth.password.tooShort', { n: p.n });
  const key = `ui.validation.${detail.code}`;
  return hasMessage(key) ? t(key, p) : t('ui.validation.INVALID_CHOICE');
}

/** Field errors of a 422, keyed by field path. */
export function fieldErrors(error: ApiError | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (error?.code !== 'VALIDATION_ERROR') return out;
  for (const d of error.details) if (!out[d.field]) out[d.field] = fieldMessage(d);
  return out;
}

/** ARC-030 — the shared schema checks in the browser before sending: same codes, same messages. */
export function checkSchema<S extends z.ZodType>(schema: S, value: unknown): { ok: true; data: z.infer<S> } | { ok: false; errors: Record<string, string> } {
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const field = issue.path.join('.');
    if (errors[field]) continue;
    const known = hasMessage(`ui.validation.${issue.message}`) || issue.message === 'WEAK_PASSWORD';
    const code = known ? issue.message : issue.code === 'too_big' ? 'TOO_LONG' : 'REQUIRED';
    errors[field] = fieldMessage({ code, params: issue.code === 'too_big' ? { n: Number(issue.maximum) } : null });
  }
  return { ok: false, errors };
}

/** TRV-110 — the sentence of an error answer (the reason first, then the code). */
export function errorMessage(error: ApiError | null | undefined, opts: { offline?: boolean; status?: number } = {}): string {
  if (opts.offline) return t('ui.common.offline');
  if (!error) return t('ui.error.INTERNAL_ERROR', { identifiant: '—' });
  const p = (error.params ?? {}) as Record<string, number | string>;
  switch (error.code) {
    case 'ACCOUNT_LOCKED':
      return t('ui.error.ACCOUNT_LOCKED', { n: p.minutes ?? p.n ?? 15 });
    case 'ACCOUNT_SUSPENDED':
      return error.reason === 'DELETION_PENDING' ? t('ui.auth.login.suspended.DELETION_PENDING') : t('ui.auth.login.suspended.STAFF_DECISION');
    case 'INVALID_CODE':
      return typeof p.remaining === 'number' ? t('ui.auth.twoFactor.invalid', { n: p.remaining }) : t('ui.auth.twoFactor.wrong');
    case 'GONE':
      return t('ui.auth.common.linkExpired');
    case 'UNAUTHENTICATED':
      return t('ui.auth.common.sessionExpired');
    case 'INTERNAL_ERROR':
      return t('ui.error.INTERNAL_ERROR', { identifiant: error.requestId });
    default:
      break;
  }
  if (error.reason) {
    if (hasMessage(`ui.auth.reason.${error.reason}`)) return t(`ui.auth.reason.${error.reason}` as never);
    if (hasMessage(`ui.error.reason.${error.reason}`)) return t(`ui.error.reason.${error.reason}` as never, p);
  }
  if (hasMessage(`ui.error.${error.code}`)) return t(`ui.error.${error.code}` as never, { ...p, n: p.n ?? '', identifiant: error.requestId });
  return t('ui.error.INTERNAL_ERROR', { identifiant: error.requestId });
}

export function Banner({ tone, children, action }: { tone: 'error' | 'info' | 'success'; children: ReactNode; action?: ReactNode }) {
  const icon = tone === 'error' ? 'status-error' : tone === 'success' ? 'status-success' : 'status-info';
  return (
    <div className={`${s.banner} ${s[tone]}`} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
      <Icon name={icon} size={20} />
      <div className={s.bannerBody}>
        {typeof children === 'string' ? <p>{children}</p> : children}
        {action}
      </div>
    </div>
  );
}

/** AUTH-002 — a strength indicator (0 to 4): length first, then variety. Indicative; the server decides. */
export function passwordStrength(pw: string, minLength = 10): 0 | 1 | 2 | 3 | 4 {
  if ([...pw].length < minLength) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/, /\s/].filter((r) => r.test(pw)).length;
  const len = [...pw].length;
  let score = len >= 20 ? 3 : len >= 14 ? 2 : 1;
  if (classes >= 3) score += 1;
  if (/^(.)\1+$/.test(pw)) score = 1;
  return Math.min(4, score) as 1 | 2 | 3 | 4;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  hint,
  meter,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  autoComplete: 'current-password' | 'new-password';
  hint?: string;
  meter?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'id'>) {
  const [shown, setShown] = useState(false);
  const meterId = useId();
  const score = passwordStrength(value);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null, meter && value ? meterId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={fs.field}>
      <label htmlFor={id} className={fs.label}>
        {label}
      </label>
      <span className={[fs.control, error && fs.invalid].filter(Boolean).join(' ')}>
        <Icon name="lock" size={20} className={fs.icon} />
        <input
          id={id}
          name={id}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          maxLength={128}
          spellCheck={false}
          autoCapitalize="none"
          {...rest}
        />
        <button type="button" className={s.reveal} onClick={() => setShown((v) => !v)} aria-pressed={shown} aria-controls={id}>
          {shown ? t('ui.auth.common.hide') : t('ui.auth.common.show')}
        </button>
      </span>
      {meter && value ? (
        <span className={s.meter} id={meterId} aria-live="polite">
          <span className={s.bars} aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={s.bar} data-on={i <= score ? String(score) : undefined} />
            ))}
          </span>
          {`${t('ui.auth.password.strength.label')} : ${t(`ui.auth.password.strength.${score}` as never)}`}
        </span>
      ) : null}
      {hint ? (
        <span id={`${id}-hint`} className={fs.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className={fs.error}>
          <Icon name="status-error" size={16} />
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** AUTH-020, AUTH-098 — « Une difficulté pour vous connecter ? {téléphone} · {e-mail} », each only when set. */
export function ContactLine({ phone, phoneLabel, email }: { phone: string | null; phoneLabel: string | null; email: string | null }) {
  if (!phone && !email) return null;
  return (
    <p className={s.contact}>
      <span>{t('ui.auth.common.contactLine')}</span>
      {phone ? <a href={`tel:${phone}`}>{phoneLabel ?? phone}</a> : null}
      {phone && email ? <span aria-hidden="true">·</span> : null}
      {email ? <a href={`mailto:${email}`}>{email}</a> : null}
    </p>
  );
}

export interface ContactInfo {
  phone: string | null;
  phoneLabel: string | null;
  email: string | null;
}
