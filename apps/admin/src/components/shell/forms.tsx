'use client';
// Form pieces of the back office (register « Outil »: 40 px fields, radius 8, visible labels — TRV-121): a labelled
// field with its hint, its counter (TRV-063) and its message (DSN-056), the password field with « Afficher » and
// « Les majuscules sont activées. » (TRV-116), a one-time code field (TRV-116: one field, numeric keypad, paste
// allowed), and the guard of unsaved changes (TRV-093).
import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { FieldMessage, HelpTip } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './forms.module.css';

interface FieldShell {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  optional?: boolean;
  /** TRV-126 — a « ? » next to the label. */
  help?: { label: string; text: ReactNode };
}

function Field({ id, label, error, hint, optional, help, counter, children }: FieldShell & { id: string; counter?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.field}>
      <span className={s.labelRow}>
        <label htmlFor={id} className={s.label}>
          {label}
          {optional ? <span className={s.optional}> {t('ui.common.optional')}</span> : null}
        </label>
        {help ? <HelpTip label={help.label}>{help.text}</HelpTip> : null}
        {counter ? <span className={s.counter}>{counter}</span> : null}
      </span>
      {children}
      {hint && !error ? (
        <span id={`${id}-hint`} className={s.hint}>
          {hint}
        </span>
      ) : null}
      {error ? <FieldMessage id={`${id}-error`}>{error}</FieldMessage> : null}
    </div>
  );
}

const describedBy = (id: string, error?: string | null, hint?: ReactNode) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export function TextInput({ label, error, hint, optional, help, id: given, className, ...rest }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const id = given ?? auto;
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} help={help}>
      <input id={id} className={[s.input, error && s.invalid, className].filter(Boolean).join(' ')} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...rest} />
    </Field>
  );
}

export function SelectInput({ label, error, hint, optional, help, id: given, children, className, ...rest }: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const id = given ?? auto;
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} help={help}>
      <select id={id} className={[s.input, s.select, error && s.invalid, className].filter(Boolean).join(' ')} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...rest}>
        {children}
      </select>
    </Field>
  );
}

export function TextArea({ label, error, hint, optional, help, id: given, maxLength, value, className, ...rest }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const id = given ?? auto;
  const length = typeof value === 'string' ? value.length : 0;
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} help={help} counter={maxLength ? `${length} / ${maxLength}` : undefined}>
      <textarea id={id} value={value} maxLength={maxLength} className={[s.input, s.textarea, error && s.invalid, className].filter(Boolean).join(' ')} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...rest} />
    </Field>
  );
}

/** AUTH-002 — an indicative strength (0 to 4): length first, then variety. The server decides. */
export function passwordStrength(pw: string, minLength = 10): 0 | 1 | 2 | 3 | 4 {
  const len = [...pw].length;
  if (len < minLength) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/, /\s/].filter((r) => r.test(pw)).length;
  let score = len >= 20 ? 3 : len >= 14 ? 2 : 1;
  if (classes >= 3) score += 1;
  if (/^(.)\1+$/.test(pw)) score = 1;
  return Math.min(4, score) as 1 | 2 | 3 | 4;
}

export function PasswordInput({
  label,
  error,
  hint,
  value,
  onValue,
  autoComplete,
  meter,
  id: given,
  ...rest
}: FieldShell & { value: string; onValue: (v: string) => void; autoComplete: 'current-password' | 'new-password'; meter?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'autoComplete'>) {
  const auto = useId();
  const id = given ?? auto;
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);
  const score = passwordStrength(value);
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <span className={[s.passwordWrap, error && s.invalid].filter(Boolean).join(' ')}>
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          className={s.passwordInput}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock') ?? false)}
          onBlur={() => setCaps(false)}
          autoComplete={autoComplete}
          maxLength={128}
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          {...rest}
        />
        <button type="button" className={s.reveal} onClick={() => setShown((v) => !v)} aria-pressed={shown} aria-controls={id}>
          {shown ? t('ui.common.password.hide') : t('ui.common.password.show')}
        </button>
      </span>
      {caps ? (
        <span className={s.caps} role="status">
          {t('ui.common.capsLock')}
        </span>
      ) : null}
      {meter && value ? (
        <span className={s.meter} aria-live="polite">
          <span className={s.bars} aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={s.bar} data-on={i <= score ? String(score) : undefined} />
            ))}
          </span>
          {`${t('ui.auth.password.strength.label')} : ${t(`ui.auth.password.strength.${score}`)}`}
        </span>
      ) : null}
    </Field>
  );
}

/** A 6-digit code in ONE field: numeric keypad, `one-time-code`, paste allowed (TRV-116). */
export function CodeInput({ label, error, hint, value, onValue, recovery, autoFocus }: FieldShell & { value: string; onValue: (v: string) => void; recovery?: boolean; autoFocus?: boolean }) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        className={[s.input, !recovery && s.code, error && s.invalid].filter(Boolean).join(' ')}
        value={value}
        onChange={(e) => onValue(recovery ? e.target.value.slice(0, 11) : e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode={recovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
      />
    </Field>
  );
}

export function Checkbox({ label, checked, onChange, error, id: given }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; error?: string | null; id?: string }) {
  const auto = useId();
  const id = given ?? auto;
  return (
    <div className={s.field}>
      <label className={s.check} htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
        <span>{label}</span>
      </label>
      {error ? <FieldMessage id={`${id}-error`}>{error}</FieldMessage> : null}
    </div>
  );
}

/**
 * TRV-093 — leaving a modified, unsaved form: the browser asks before a reload or a close; the shell asks before a
 * navigation inside the application (it listens to `dp:unsaved`).
 */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBefore);
    document.documentElement.dataset.unsaved = '1';
    return () => {
      window.removeEventListener('beforeunload', onBefore);
      delete document.documentElement.dataset.unsaved;
    };
  }, [dirty]);
}

export { s as formStyles };
