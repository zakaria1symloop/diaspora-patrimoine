'use client';
// CRM-030, CRM-031, COM-020, COM-030 — the buttons « Appel », « Échange », « E-mail », « E-mail reçu » of the quick-add
// bar of a timeline (BO-051), each with its window, tied to the object they are opened from (a request, a client).
// A button the role may not use is absent (BO-047). After each exchange noted or e-mail sent, `onDone` lets the record
// read itself again (timeline, first contact).
import { useState, type ReactNode } from 'react';
import { Button } from '@dp/ui';
import { t } from '@/lib/i18n';
import { useShell } from '../shell/ShellContext';
import { CallDialog, ReceivedEmailDialog } from './ExchangeDialogs';
import { EmailComposer } from './EmailComposer';
import s from './exchanges.module.css';

export interface ExchangeTarget {
  /** The request the exchange is noted on (EA-11); absent from a client record. */
  leadId?: string | null;
  /** The client record, when there is one (a partner application has none). */
  clientId?: string | null;
  dossierId?: string | null;
  /** CTL-006 — « Écrire au promoteur »: the e-mail goes to one of his contacts (from his record, or a dossier of his). */
  promoterId?: string | null;
  /** How the person is named in the windows: « NOM Prénom ». */
  personName: string | null;
}

export interface ExchangeActionsProps {
  target: ExchangeTarget;
  /** Called after each exchange noted or e-mail sent: the record reads itself again (timeline, first contact). */
  onDone?: () => void;
}

type Open = { kind: 'call' } | { kind: 'exchange' } | { kind: 'email' } | { kind: 'received' } | null;

export function ExchangeActions({ target, onDone }: ExchangeActionsProps): ReactNode {
  const { can } = useShell();
  const [open, setOpen] = useState<Open>(null);
  const log = can('communication.log');
  const send = can('email.send');
  if (!log && !send) return null;
  const done = () => {
    setOpen(null);
    onDone?.();
  };
  return (
    <>
      {log ? (
        <>
          <Button variant="secondary" size="S" icon="phone" onClick={() => setOpen({ kind: 'call' })}>
            {t('ui.admin-exchanges.button.call')}
          </Button>
          <Button variant="secondary" size="S" icon="chat" onClick={() => setOpen({ kind: 'exchange' })}>
            {t('ui.admin-exchanges.button.exchange')}
          </Button>
        </>
      ) : null}
      {send ? (
        <Button variant="secondary" size="S" icon="mail" onClick={() => setOpen({ kind: 'email' })}>
          {t('ui.admin-exchanges.button.email')}
        </Button>
      ) : null}
      {log ? (
        <Button variant="tertiary" size="S" icon="download" className={s.quiet} onClick={() => setOpen({ kind: 'received' })}>
          {t('ui.admin-exchanges.button.received')}
        </Button>
      ) : null}
      <CallDialog open={open?.kind === 'call' || open?.kind === 'exchange'} mode={open?.kind === 'exchange' ? 'exchange' : 'call'} target={target} close={() => setOpen(null)} done={done} />
      <ReceivedEmailDialog open={open?.kind === 'received'} target={target} close={() => setOpen(null)} done={done} />
      <EmailComposer open={open?.kind === 'email'} target={target} close={() => setOpen(null)} done={done} />
    </>
  );
}

/** TRV-041, COM-080, COM-081 — a phone as a `tel:` link; « Ouvrir WhatsApp » only when the person is reachable there. */
export function PhoneLinks({ phone, whatsapp }: { phone: string | null; whatsapp: boolean }) {
  if (!phone) return null;
  return (
    <span className={s.phoneLinks}>
      <a href={`tel:${phone}`} className={s.phoneLink}>
        {phone}
      </a>
      {whatsapp ? (
        <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className={s.whatsapp}>
          {t('ui.admin-exchanges.openWhatsapp')}
        </a>
      ) : null}
    </span>
  );
}
