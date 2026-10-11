'use client';
// EC-04 (forgotten password, AUTH-045), EC-07 (sign-in link, AUTH-041), « Recevoir un nouveau lien » (AUTH-013, AUTH-040)
// and the partner's forgotten password (EP-33): one e-mail field, then — in every case — the same sentence (TRV-112).
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { emailSchema, type SentResponse } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { apiCall, type DoorAudience } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import { TextField } from '../forms/fields';
import { Banner, errorMessage } from './kit';
import s from './auth.module.css';

export function EmailRequestForm({
  endpoint,
  audience = 'WEB',
  submitLabel,
  sentText,
  next,
  compact,
  after,
}: {
  endpoint: '/auth/password/forgot' | '/auth/magic-link' | '/auth/verify-email/resend' | '/auth/activate/resend';
  audience?: DoorAudience;
  submitLabel: string;
  sentText: string;
  next?: string | null;
  compact?: boolean;
  after?: ReactNode;
}) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setFieldError(t(email.trim() ? 'ui.validation.INVALID_EMAIL' : 'ui.validation.REQUIRED'));
    setFieldError(null);
    setError(null);
    setPending(true);
    const body: Record<string, unknown> = { email: parsed.data };
    if (next && endpoint !== '/auth/verify-email/resend') body.next = next;
    const res = await apiCall<SentResponse>(endpoint, { audience, body });
    setPending(false);
    if (res.ok) return setSent(true);
    setError(errorMessage(res.error, res));
  }

  if (sent) {
    return (
      <>
        <Banner tone="success">{sentText}</Banner>
        {after}
      </>
    );
  }
  return (
    <>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <form className={s.form} onSubmit={submit} noValidate>
        <TextField
          id={`${id}-email`}
          name="username"
          label={t('ui.auth.common.email')}
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError}
          icon={<Icon name="mail" size={20} />}
          autoFocus={!compact}
        />
        <Button type="submit" size={compact ? 'M' : 'L'} fullWidth={!compact} variant={compact ? 'secondary' : 'primary'} pending={pending} chevron={!compact}>
          {submitLabel}
        </Button>
      </form>
      {after}
    </>
  );
}
