'use client';
// NAV-064 — « Accès réservé »: password → POST /public/gate → the visitor lands on the address requested.
// 401 GATE_PASSWORD_INVALID under the field; 429: « Trop de tentatives. Réessayez dans {n} minutes. »
// The field is never prefilled nor kept (TRV-092).
import { useId, useRef, useState, type FormEvent } from 'react';
import { Button, Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './page.module.css';

export function GateForm({ next }: { next: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = input.current?.value ?? '';
    if (!password) {
      setError(t('ui.validation.REQUIRED'));
      input.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/public/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'same-origin',
      });
      if (res.status === 204) {
        window.location.assign(next);
        return;
      }
      if (res.status === 429) {
        const seconds = Number(res.headers.get('Retry-After') ?? '900');
        setError(t('ui.pages.waiting.tooMany', { n: Math.max(1, Math.ceil(seconds / 60)) }));
      } else if (res.status === 401) {
        setError(t('ui.error.GATE_PASSWORD_INVALID'));
      } else if (res.status === 422) {
        setError(t('ui.validation.REQUIRED'));
      } else {
        setError(t('ui.error.BAD_REQUEST'));
      }
    } catch {
      setError(t('ui.common.offline'));
    } finally {
      setPending(false);
      if (input.current) input.current.value = '';
      input.current?.focus();
    }
  }

  if (!open) {
    return (
      <button type="button" className={s.reserved} onClick={() => setOpen(true)}>
        {t('ui.pages.waiting.reserved')}
      </button>
    );
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate>
      <h2 className={s.formTitle}>{t('ui.pages.waiting.reserved')}</h2>
      <label htmlFor={id} className={s.label}>
        {t('ui.pages.waiting.passwordLabel')}
      </label>
      <input
        ref={input}
        id={id}
        name="password"
        type="password"
        autoComplete="current-password"
        className={s.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        autoFocus
      />
      {error ? (
        <p id={`${id}-error`} className={s.error} role="alert">
          <Icon name="status-error" size={16} />
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="tool" size="L" pending={pending} fullWidth>
        {t('ui.pages.waiting.submit')}
      </Button>
    </form>
  );
}
