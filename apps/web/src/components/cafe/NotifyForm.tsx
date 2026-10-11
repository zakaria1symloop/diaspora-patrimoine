'use client';
// CAF-040 — « Me prévenir »: e-mail, and the place when there are several; one e-mail at the opening of registrations.
import { useId, useState, type FormEvent } from 'react';
import { Button, Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './cafe.module.css';

export function NotifyForm({ places, eventSlug }: { places: string[]; eventSlug?: string }) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [place, setPlace] = useState('');
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t('ui.validation.INVALID_EMAIL'));
      return;
    }
    setError(null);
    setState('pending');
    try {
      const res = await fetch('/api/v1/public/event-notify-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), eventSlug: eventSlug ?? null, locationLabel: place || null }),
      });
      if (res.status === 201) {
        setState('done');
        return;
      }
      setError(res.status === 429 ? t('ui.error.RATE_LIMITED') : res.status === 422 ? t('ui.validation.INVALID_EMAIL') : t('ui.error.BAD_REQUEST'));
    } catch {
      setError(t('ui.common.offline'));
    }
    setState('idle');
  }

  if (state === 'done') {
    return (
      <p className={s.done} role="status">
        <Icon name="status-success" size={20} />
        {t('ui.cafe.notify.done')}
      </p>
    );
  }

  return (
    <form className={s.notify} onSubmit={submit} noValidate>
      <div className={s.field}>
        <label htmlFor={`${id}-email`}>{t('ui.cafe.notify.label')}</label>
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
          placeholder={t('ui.common.placeholder.email')}
        />
        <span id={`${id}-help`} className={s.help}>
          {t('ui.cafe.notify.help')}
        </span>
        {error ? (
          <span id={`${id}-error`} className={s.error} role="alert">
            <Icon name="status-error" size={16} />
            {error}
          </span>
        ) : null}
      </div>
      {!eventSlug && places.length > 1 ? (
        <div className={s.field}>
          <label htmlFor={`${id}-place`}>{t('ui.cafe.notify.place')}</label>
          <select id={`${id}-place`} value={place} onChange={(e) => setPlace(e.target.value)}>
            <option value="">{t('ui.cafe.notify.allPlaces')}</option>
            {places.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <Button type="submit" variant="secondary" size="M" pending={state === 'pending'}>
        {t('ui.cafe.notify.submit')}
      </Button>
    </form>
  );
}
