'use client';
// MSG-021 — « Écrire à mon conseiller » before the messaging: « Écrire à {conseiller} » (or « à l'équipe »), the
// message (10 to 2 000 characters, prefilled when the button of origin says so — MSG-017: nothing leaves without the
// click on « Envoyer »), « À propos de » (MSG-001: the dossier the dashboard shows, else « Autre sujet »), the promise
// « {conseiller} vous répond {quand}, par e-mail ou par téléphone. » (NOT-053, CAL-061). TRV-081: a confirmation that
// says what comes next. MSG-011: an idempotency key prevents a double sending; the text is never lost on failure.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useId, useMemo, useRef, useState } from 'react';
import {
  CLIENT_MESSAGE_MAX,
  CLIENT_MESSAGE_MIN,
  clientMessageRequestSchema,
  type ClientMessageContext,
  type ClientMessageOrigin,
  type ClientMessageResponse,
} from '@dp/contracts';
import { callbackLabel } from '@dp/i18n';
import { Button, buttonClass, ButtonInner, Icon } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import { SelectField, TextArea } from '@/components/forms/fields';
import { Banner, checkSchema, errorMessage, fieldErrors } from '@/components/auth/kit';
import { Avatar } from '../Avatar';
import { signalSpaceChanged, useSpace } from '../SpaceContext';
import { advisorName } from '../texts';
import sp from '../space.module.css';
import s from './message.module.css';
import { newUuid } from '@dp/ui';

export interface MessageFormProps {
  context: ClientMessageContext;
  prefill: string;
  origin: ClientMessageOrigin | null;
  dossier: string | null;
}

export function AdvisorMessageForm({ context, prefill, origin, dossier }: MessageFormProps) {
  const { summary, settings } = useSpace();
  const pathname = usePathname() ?? '/espace-client/messages';
  const router = useRouter();
  const ids = { message: useId(), about: useId() };
  const [message, setMessage] = useState(prefill);
  const initialAbout = dossier && context.dossiers.some((d) => d.reference === dossier) ? dossier : (context.defaultDossierReference ?? '');
  const [about, setAbout] = useState(initialAbout);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<ClientMessageResponse | null>(null);
  const key = useRef<string | null>(null);
  const name = advisorName(context.advisor);
  const quand = useMemo(
    () => callbackLabel({ firstContactBusinessDays: settings.firstContactBusinessDays, timeZone: summary.timeZone }),
    [settings.firstContactBusinessDays, summary.timeZone],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFailure(null);
    const body = { message, prefilledFrom: origin, dossierReference: about || null, submittedFromPath: pathname.split('?')[0] };
    const check = checkSchema(clientMessageRequestSchema, body);
    if (!check.ok) {
      setErrors(check.errors.message ? { message: message.trim().length < CLIENT_MESSAGE_MIN ? t('ui.validation.TOO_SHORT', { n: CLIENT_MESSAGE_MIN }) : check.errors.message } : check.errors);
      document.getElementById(ids.message)?.focus();
      return;
    }
    setErrors({});
    setPending(true);
    key.current ??= newUuid();
    const res = await apiCall<ClientMessageResponse>('/client/leads', { method: 'POST', body, retryOnAuth: true, extraHeaders: { 'Idempotency-Key': key.current } });
    setPending(false);
    if (!res.ok) {
      const fe = fieldErrors(res.error);
      if (Object.keys(fe).length) setErrors(fe);
      else setFailure(errorMessage(res.error, { offline: res.offline, status: res.status }));
      return;
    }
    key.current = null;
    setSent(res.data);
    const to = advisorName(res.data.advisor);
    showToast({ message: to ? t('ui.client.message.sent', { conseiller: to }) : t('ui.client.message.sentTeam') });
    signalSpaceChanged();
    router.refresh(); // D-107 — « Demandes en cours » beside the form shows the message just sent
  }

  if (sent) {
    const to = advisorName(sent.advisor);
    return (
      <div className={`${sp.block} ${s.done}`} role="status">
        <span className={s.doneIcon} aria-hidden="true">
          <Icon name="send" size={32} />
        </span>
        <p className={s.doneTitle}>{to ? t('ui.client.message.sent', { conseiller: to }) : t('ui.client.message.sentTeam')}</p>
        <p>{to ? t('ui.client.message.promise', { conseiller: to, quand }) : t('ui.client.message.promiseTeam', { quand })}</p>
        <p className={sp.help}>{t('ui.client.message.sentNext')}</p>
        <div className={s.doneActions}>
          <Link href={`/espace-client/interets#demande-${sent.reference}`} className={buttonClass('tool', 'M')}>
            <ButtonInner chevron size="M">
              {t('ui.client.message.seeRequests')}
            </ButtonInner>
          </Link>
          <Button
            variant="secondary"
            size="M"
            onClick={() => {
              setSent(null);
              setMessage('');
            }}
          >
            {t('ui.client.message.another')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className={`${sp.block} ${s.form}`} onSubmit={(e) => void submit(e)} noValidate>
      <div className={s.to}>
        <Avatar advisor={context.advisor} />
        <div>
          <h2 className={s.toTitle}>{name ? t('ui.client.message.title', { conseiller: name }) : t('ui.client.message.titleTeam')}</h2>
          <p className={sp.help}>{name ? t('ui.client.message.promise', { conseiller: name, quand }) : t('ui.client.message.promiseTeam', { quand })}</p>
        </div>
      </div>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      {context.dossiers.length > 0 ? (
        <SelectField id={ids.about} label={t('ui.client.message.about')} value={about} onChange={(e) => setAbout(e.target.value)}>
          {context.dossiers.map((d) => (
            <option key={d.reference} value={d.reference}>
              {d.propertyTitle ? t('ui.client.message.dossierProperty', { reference: d.reference, bien: d.propertyTitle }) : t('ui.client.message.dossier', { reference: d.reference })}
            </option>
          ))}
          <option value="">{t('ui.client.message.aboutOther')}</option>
        </SelectField>
      ) : null}
      <TextArea
        id={ids.message}
        label={t('ui.client.message.label')}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={CLIENT_MESSAGE_MAX}
        rows={8}
        counter
        error={errors.message}
        autoFocus={Boolean(prefill)}
      />
      <div className={s.submit}>
        <Button type="submit" variant="tool" size="L" icon="send" pending={pending}>
          {t('ui.client.message.send')}
        </Button>
      </div>
    </form>
  );
}
