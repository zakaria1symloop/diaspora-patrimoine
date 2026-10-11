'use client';
// EP-26 (SFA-035) — the alert page reached from the e-mails. A confirmation link (`ac…`) activates the alert, an
// extension link (`ax…`) extends it — done here, in the browser, so that a mail scanner opening the link does nothing.
// Then the management view: frequency and pause saved at once (« Préférence enregistrée. »), « Supprimer l'alerte » at
// once with a short message and « Annuler » (TRV-081), « En pause depuis le {date} · Reprendre ».
// `StopAlert` is the one-click way out of an alert (`/alertes/{jeton}/arreter`), open even in maintenance (NAV-061).
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ALERT_FREQUENCIES, type AlertActionResult, type AlertView } from '@dp/contracts';
import { Button, Icon, buttonClass, ButtonInner } from '@dp/ui';
import { formatDate } from '@dp/i18n';
import { TextField } from '@/components/forms/fields';
import { showToast } from '@/lib/discovery';
import { errorText, publicCall } from '@/lib/public-call';
import { t } from '@/lib/i18n';
import p from './pages.module.css';

type Phase = { kind: 'working'; text: string } | { kind: 'ready'; banner: string | null } | { kind: 'stopped' } | { kind: 'error'; text: string };

export function AlertManage({ token, initial }: { token: string; initial: AlertView }) {
  const [view, setView] = useState(initial);
  const purpose = token.slice(0, 2);
  const [phase, setPhase] = useState<Phase>(
    purpose === 'ac' ? { kind: 'working', text: t('ui.alerts.page.confirming') } : purpose === 'ax' ? { kind: 'working', text: t('ui.alerts.page.extending') } : { kind: 'ready', banner: null },
  );
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || (purpose !== 'ac' && purpose !== 'ax')) return;
    ran.current = true;
    void (async () => {
      const r = await publicCall<AlertActionResult>('POST', `/alerts/${token}/${purpose === 'ac' ? 'confirm' : 'extend'}`);
      if (!r.ok) return setPhase({ kind: 'error', text: errorText(r) });
      setView(r.data.view);
      setPhase({
        kind: 'ready',
        banner:
          r.data.done === 'CONFIRMED'
            ? t('ui.alerts.page.confirmed', { libelle: r.data.view.label })
            : r.data.done === 'EXTENDED'
              ? t('ui.alerts.page.extended', { date: formatDate(r.data.view.expiresAt, 'long') })
              : t('ui.alerts.page.alreadyConfirmed'),
      });
    })();
  }, [purpose, token]);

  const patch = async (body: Record<string, unknown>) => {
    const r = await publicCall<AlertActionResult>('PATCH', `/alerts/${view.token}`, body);
    if (!r.ok) return showToast({ message: errorText(r), tone: 'error' });
    setView(r.data.view);
    showToast({ message: r.data.done === 'RESTORED' ? t('ui.alerts.page.restored') : t('ui.alerts.page.saved') });
    if (r.data.done === 'RESTORED') setPhase({ kind: 'ready', banner: null });
  };

  const stop = async () => {
    const r = await publicCall<{ done: string }>('DELETE', `/alerts/${view.token}`);
    if (!r.ok) return showToast({ message: errorText(r), tone: 'error' });
    setPhase({ kind: 'stopped' });
    showToast({ message: t('ui.alerts.page.deleted'), action: { label: t('ui.alerts.page.undo'), onClick: () => void patch({ restore: true }) } });
  };

  if (phase.kind === 'working') {
    return (
      <p className={p.loading} role="status">
        <span className={p.dot} aria-hidden="true" />
        {phase.text}
      </p>
    );
  }
  if (phase.kind === 'error') {
    return (
      <div className={p.notice} role="alert">
        <Icon name="status-error" size={20} />
        {phase.text}
      </div>
    );
  }
  if (phase.kind === 'stopped') {
    return (
      <div className={p.panel}>
        <p className={p.doneTitle}>
          <Icon name="status-success" size={24} />
          {t('ui.alerts.page.deleted')}
        </p>
        <p>{t('ui.alerts.page.stoppedText')}</p>
        <Link href="/programmes" className={buttonClass('secondary', 'M')}>
          <ButtonInner size="M">{t('ui.alerts.page.backToCatalogue')}</ButtonInner>
        </Link>
      </div>
    );
  }

  const stateText =
    view.state === 'ACTIVE'
      ? t('ui.alerts.page.state.ACTIVE', { date: formatDate(view.expiresAt, 'long') })
      : view.state === 'PAUSED'
        ? t('ui.alerts.page.state.PAUSED', { date: view.pausedAt ? formatDate(view.pausedAt, 'long') : '' })
        : t(`ui.alerts.page.state.${view.state}`);

  return (
    <div className={p.stack}>
      {phase.banner ? (
        <p className={p.success} role="status">
          <Icon name="status-success" size={24} />
          {phase.banner}
        </p>
      ) : null}
      <section className={p.panel} aria-labelledby="mon-alerte">
        <h2 id="mon-alerte" className={p.h2}>
          {t('ui.alerts.page.manageTitle')}
        </h2>
        <p className={p.alertLabel}>{view.label}</p>
        <ul className={p.metaList} role="list">
          <li data-state={view.state}>
            <span className={p.stateDot} aria-hidden="true" />
            {stateText}
            {view.state === 'PAUSED' ? (
              <>
                {' · '}
                <button type="button" className={p.linkButton} onClick={() => void patch({ paused: false })}>
                  {t('ui.alerts.page.resume')}
                </button>
              </>
            ) : null}
          </li>
          <li>{view.lastSentAt ? t('ui.alerts.page.lastSent', { date: formatDate(view.lastSentAt, 'long') }) : t('ui.alerts.page.neverSent')}</li>
          <li>{t('ui.alerts.page.sentTo', { email: view.emailMasked })}</li>
        </ul>
        <Link href={view.resultsPath} className={p.cta}>
          {t('ui.alerts.page.seeProperties')}
          <Icon name="chevron-right" size={16} />
        </Link>
      </section>

      <section className={p.panel} aria-labelledby="frequence">
        <h2 id="frequence" className={p.h3}>
          {t('ui.alerts.page.frequency')}
        </h2>
        <div className={p.choices} role="radiogroup" aria-labelledby="frequence">
          {ALERT_FREQUENCIES.map((f) => (
            <label key={f} className={[p.choice, view.frequency === f && p.choiceOn].filter(Boolean).join(' ')}>
              <input type="radio" name="frequence" checked={view.frequency === f} onChange={() => void patch({ frequency: f })} />
              {t(`ui.alerts.dialog.frequencies.${f}`)}
            </label>
          ))}
        </div>
        <div className={p.rowButtons}>
          {view.state === 'ACTIVE' ? (
            <Button variant="secondary" size="M" icon="pause" onClick={() => void patch({ paused: true })}>
              {t('ui.alerts.page.pause')}
            </Button>
          ) : null}
          {view.state === 'EXPIRED' ? (
            <Button variant="primary" size="M" onClick={async () => {
              const r = await publicCall<AlertActionResult>('POST', `/alerts/${view.token}/extend`);
              if (!r.ok) return showToast({ message: errorText(r), tone: 'error' });
              setView(r.data.view);
              setPhase({ kind: 'ready', banner: t('ui.alerts.page.extended', { date: formatDate(r.data.view.expiresAt, 'long') }) });
            }}>
              {t('ui.alerts.page.extend')}
            </Button>
          ) : null}
          <Button variant="tertiary" size="M" icon="trash" onClick={() => void stop()}>
            {t('ui.alerts.page.delete')}
          </Button>
        </div>
      </section>
      {!view.hasAccount ? (
        <p className={p.muted}>
          <Link href="/inscription?suite=%2Fespace-client%2Falertes">{t('ui.alerts.page.createSpace')}</Link>
        </p>
      ) : null}
    </div>
  );
}

export function StopAlert({ token }: { token: string }) {
  const [state, setState] = useState<'working' | 'done' | 'gone' | 'error'>('working');
  const ran = useRef(false);
  const run = async () => {
    setState('working');
    const r = await publicCall<{ done: string }>('DELETE', `/alerts/${token}`);
    setState(r.ok ? 'done' : r.status === 410 ? 'gone' : 'error');
  };
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (state === 'working') {
    return (
      <p className={p.loading} role="status">
        <span className={p.dot} aria-hidden="true" />
        {t('ui.alerts.page.stopping')}
      </p>
    );
  }
  if (state === 'error') {
    return (
      <div className={p.notice} role="alert">
        <Icon name="status-error" size={20} />
        {t('ui.alerts.page.error')}
        <button type="button" className={p.linkButton} onClick={() => void run()}>
          {t('ui.alerts.page.retry')}
        </button>
      </div>
    );
  }
  return (
    <div className={p.panel} role="status">
      <p className={p.doneTitle}>
        <Icon name={state === 'done' ? 'status-success' : 'status-info'} size={24} />
        {state === 'done' ? t('ui.alerts.page.stopped') : t('ui.alerts.page.goneTitle')}
      </p>
      <p>{t('ui.alerts.page.stoppedText')}</p>
      <Link href="/programmes" className={buttonClass('secondary', 'M')}>
        <ButtonInner size="M">{t('ui.alerts.page.backToCatalogue')}</ButtonInner>
      </Link>
    </div>
  );
}

/** « Recevoir un nouveau lien » — alerts or preferences; the same answer whatever the address (TRV-112). */
export function NewLinkForm({ path, sentText, label }: { path: '/alerts/links' | '/preferences/links'; sentText: string; label: string }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  if (state === 'sent') {
    return (
      <p className={p.success} role="status">
        <Icon name="mail" size={24} />
        {sentText}
      </p>
    );
  }
  return (
    <form
      className={p.linkForm}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError(email.trim() ? t('ui.validation.INVALID_EMAIL') : t('ui.validation.REQUIRED'));
        setError(null);
        setState('sending');
        const r = await publicCall('POST', path, { email: email.trim() });
        if (r.ok) return setState('sent');
        setState('idle');
        setError(errorText(r));
      }}
    >
      <TextField id="nouveau-lien" label={label} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} placeholder={t('ui.common.placeholder.email')} />
      <Button type="submit" variant="primary" size="M" pending={state === 'sending'}>
        {t('ui.alerts.page.newLink')}
      </Button>
    </form>
  );
}
