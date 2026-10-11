'use client';
// CAT-070 … CAT-072 — the alert block: the criteria as chips (« Tous les nouveaux biens » without criteria), the e-mail
// address, the frequency (« Une fois par jour » by default), « Créer l'alerte », and the mention « Sans créer de compte.
// Désinscription en un clic. … ». After sending (CAT-071): « Vérifiez votre boîte : … ». The address is never shown in
// the page address (TRV-053) and is kept only in the session draft (TRV-092).
import { useRef, useState, type FormEvent } from 'react';
import { ALERT_FREQUENCIES, alertCriteriaOf, criteriaToSearch, type AlertSendFrequency, type CatalogueCriteria, type CreateAlertResult } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { TextField } from '@/components/forms/fields';
import { useDraft } from '@/lib/public-form';
import { errorText, newIdempotencyKey, publicCall } from '@/lib/public-call';
import { useClientSession } from '@/lib/session-client';
import { t } from '@/lib/i18n';
import s from './alerts.module.css';

export interface AlertFormProps {
  criteria: CatalogueCriteria;
  /** CAT-022 chips of the criteria (already labelled by the page). */
  chips: string[];
  summary: string;
  variant?: 'dialog' | 'inline';
  onClose?: () => void;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function AlertForm({ criteria, chips, summary, variant = 'dialog', onClose }: AlertFormProps) {
  const [draft, update, clear] = useDraft<{ email: string; frequency: AlertSendFrequency }>('alert', { email: '', frequency: 'DAILY' });
  const [state, setState] = useState<'idle' | 'sending' | CreateAlertResult['outcome']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const key = useRef<string>('');
  // CAT-071 — a signed-in client: his account's address, the alert active at once (the server uses the session)
  const session = useClientSession();
  const accountEmail = session.status === 'authenticated' ? session.me.email : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = (accountEmail ?? draft.email).trim();
    if (!email) return setFieldError(t('ui.validation.REQUIRED'));
    if (!EMAIL.test(email)) return setFieldError(t('ui.validation.INVALID_EMAIL'));
    setFieldError(null);
    if (!key.current) key.current = newIdempotencyKey();
    setState('sending');
    const params = Object.fromEntries(new URLSearchParams(criteriaToSearch(alertCriteriaOf(criteria))));
    const r = await publicCall<CreateAlertResult>('POST', '/alerts', { email, frequency: draft.frequency, criteria: params }, key.current);
    if (r.ok) {
      clear();
      key.current = '';
      setState(r.data.outcome);
      return;
    }
    setState('idle');
    if (r.status > 0 && r.status < 500) key.current = '';
    if (r.error?.reason === 'ALERT_LIMIT') return setError(t('ui.alerts.dialog.limit'));
    const emailIssue = r.error?.details?.find((d) => d.field === 'email');
    if (emailIssue) return setFieldError(t('ui.validation.INVALID_EMAIL'));
    setError(errorText(r));
  };

  if (state === 'CONFIRMATION_SENT' || state === 'ACTIVE' || state === 'ALREADY_EXISTS') {
    return (
      <div className={s.done} role="status">
        <span className={s.doneIcon} aria-hidden="true">
          <Icon name={state === 'ALREADY_EXISTS' ? 'status-info' : 'mail'} size={32} />
        </span>
        <p className={s.doneTitle}>
          {state === 'CONFIRMATION_SENT' ? t('ui.alerts.dialog.sentTitle') : state === 'ACTIVE' ? t('ui.alerts.dialog.activeTitle') : t('ui.alerts.dialog.exists')}
        </p>
        {state === 'CONFIRMATION_SENT' ? <p>{t('ui.alerts.dialog.sentText')}</p> : null}
        {state === 'ACTIVE' ? <p>{t('ui.alerts.dialog.activeText', { libelle: summary })}</p> : null}
        {onClose ? (
          <Button variant="secondary" size="M" onClick={onClose}>
            {t('ui.alerts.dialog.done')}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form className={[s.form, variant === 'inline' && s.inline].filter(Boolean).join(' ')} onSubmit={submit} noValidate>
      {variant === 'inline' ? <h3 className={s.inlineTitle}>{t('ui.alerts.dialog.inlineTitle')}</h3> : <p className={s.intro}>{t('ui.alerts.dialog.intro')}</p>}
      <div>
        <p className={s.label}>{t('ui.alerts.dialog.criteria')}</p>
        <ul className={s.chips} role="list">
          {(chips.length ? chips : [t('ui.alerts.dialog.allNew')]).map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
      <TextField
        id={`alert-email-${variant}`}
        label={t('ui.alerts.dialog.email')}
        type="email"
        autoComplete="email"
        inputMode="email"
        value={accountEmail ?? draft.email}
        readOnly={accountEmail !== null}
        onChange={(e) => update({ email: e.target.value })}
        error={fieldError}
        placeholder={t('ui.common.placeholder.email')}
        maxLength={254}
      />
      <fieldset className={s.frequencies}>
        <legend className={s.label}>{t('ui.alerts.dialog.frequency')}</legend>
        {ALERT_FREQUENCIES.map((f) => (
          <label key={f} className={[s.frequency, draft.frequency === f && s.frequencyOn].filter(Boolean).join(' ')}>
            <input type="radio" name={`alert-frequency-${variant}`} value={f} checked={draft.frequency === f} onChange={() => update({ frequency: f })} />
            {t(`ui.alerts.dialog.frequencies.${f}`)}
          </label>
        ))}
      </fieldset>
      {error ? (
        <p className={s.error} role="alert">
          <Icon name="status-error" size={16} />
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="L" pending={state === 'sending'} icon="bell" fullWidth={variant === 'dialog'}>
        {state === 'sending' ? t('ui.alerts.dialog.sending') : t('ui.alerts.dialog.submit')}
      </Button>
      <p className={s.mention}>
        <Icon name="shield" size={16} />
        {t('ui.alerts.dialog.mention')}
      </p>
    </form>
  );
}
