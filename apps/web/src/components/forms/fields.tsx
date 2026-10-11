'use client';
// DSN-050 TextField / Select / Checkbox, DSN-056 field messages, TRV-061 (label above, error under the field),
// TRV-062 « (facultatif) », TRV-121 (visible label linked to the field, errors linked and announced).
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './forms.module.css';

interface FieldShell {
  id: string;
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
}

function Shell({ id, label, optional, hint, error, className, children }: FieldShell & { children: ReactNode }) {
  return (
    <div className={[s.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={s.label}>
        {label}
        {optional ? <span className={s.optional}> {t('ui.common.optional')}</span> : null}
      </label>
      {children}
      {hint ? (
        <span id={`${id}-hint`} className={s.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className={s.error}>
          <Icon name="status-error" size={16} />
          {error}
        </span>
      ) : null}
    </div>
  );
}

function described(id: string, hint?: ReactNode, error?: string | null): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

export type TextFieldProps = FieldShell & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { suffix?: string; icon?: ReactNode };

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, optional, hint, error, className, suffix, icon, ...input },
  ref,
) {
  return (
    <Shell id={id} label={label} optional={optional} hint={hint} error={error} className={className}>
      <span className={[s.control, error && s.invalid].filter(Boolean).join(' ')}>
        {icon ? <span className={s.icon}>{icon}</span> : null}
        <input ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={described(id, hint, error)} {...input} />
        {suffix ? <span className={s.suffix}>{suffix}</span> : null}
      </span>
    </Shell>
  );
});

export type TextAreaProps = FieldShell & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & { counter?: boolean };

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { id, label, optional, hint, error, className, counter, maxLength, value, ...rest },
  ref,
) {
  return (
    <Shell id={id} label={label} optional={optional} hint={hint} error={error} className={className}>
      <span className={[s.control, s.area, error && s.invalid].filter(Boolean).join(' ')}>
        <textarea
          ref={ref}
          id={id}
          maxLength={maxLength}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={described(id, hint, error)}
          {...rest}
        />
      </span>
      {counter && maxLength ? (
        <span className={s.counter} aria-live="polite">
          {`${String(value ?? '').length} / ${maxLength}`}
        </span>
      ) : null}
    </Shell>
  );
});

export type SelectFieldProps = FieldShell & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>;

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { id, label, optional, hint, error, className, children, ...rest },
  ref,
) {
  return (
    <Shell id={id} label={label} optional={optional} hint={hint} error={error} className={className}>
      <span className={[s.control, s.select, error && s.invalid].filter(Boolean).join(' ')}>
        <select ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={described(id, hint, error)} {...rest}>
          {children}
        </select>
        <Icon name="chevron-down" size={16} className={s.chevron} />
      </span>
    </Shell>
  );
});

export function CheckboxField({
  id,
  label,
  error,
  checked,
  onChange,
  name,
}: {
  id: string;
  label: ReactNode;
  error?: string | null;
  checked: boolean;
  onChange: (v: boolean) => void;
  name?: string;
}) {
  return (
    <div className={s.checkField}>
      <label className={s.check} htmlFor={id}>
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span>{label}</span>
      </label>
      {error ? (
        <span id={`${id}-error`} className={s.error}>
          <Icon name="status-error" size={16} />
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** DSN-056 — the summary of points to fix, focused and announced (role="alert"); each item links to its field. */
export function ErrorSummary({ errors, labels }: { errors: Record<string, string>; labels: Record<string, string> }) {
  const entries = Object.entries(errors);
  if (entries.length === 0) return null;
  return (
    <div className={s.summary} role="alert" tabIndex={-1} id="resume-erreurs">
      <p className={s.summaryTitle}>
        <Icon name="status-error" size={20} />
        {t('ui.common.error.summary', { n: entries.length })}
      </p>
      <ul>
        {entries.map(([field, message]) => (
          <li key={field}>
            <a href={`#${field}`}>{`${labels[field] ?? field} : ${message}`}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Honeypot (DEM-030): invisible to people, filled by naive robots. */
export function Honeypot({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className={s.honeypot} aria-hidden="true">
      <label>
        {name}
        <input type="text" name={name} tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}
