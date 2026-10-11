'use client';
// CRM-075, ROL-017 — « Voir comme le client »: opens the client's space, read only, in a new tab, for 30 minutes.
// Renders nothing when the role does not hold `client.impersonate`; greyed with its reason when the client has no
// active account (BO-047). A small window says what will happen (read only, nothing marked read, traced) and takes an
// optional reason; the tab is opened at the click (no pop-up blocker), then pointed at the one-minute code.
import { useState, type FormEvent } from 'react';
import type { ClientPreviewCode } from '@dp/contracts';
import { Banner, Button, Modal } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { useShell } from '../../shell/ShellContext';
import { TextInput, formStyles as f } from '../../shell/forms';
import s from './account.module.css';

export interface PreviewButtonProps {
  clientId: string;
  clientName: string | null;
  /** The client has an ACTIVE account. */
  accountActive: boolean;
  /** Button size: M in the header of the record (default), S elsewhere. */
  size?: 'M' | 'S';
}

/** The site seen from where the back office is opened: on a local network, the same machine as the back office. */
function sameHost(url: string): string {
  try {
    const u = new URL(url);
    const here = window.location.hostname;
    if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && here !== 'localhost' && here !== '127.0.0.1') u.hostname = here;
    return u.toString();
  } catch {
    return url;
  }
}

export function PreviewButton({ clientId, clientName, accountActive, size = 'M' }: PreviewButtonProps) {
  const { can } = useShell();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  if (!can('client.impersonate')) return null;

  if (!accountActive) {
    return (
      <span className={s.disabledWrap} title={t('ui.admin-client-account.preview.noAccount')}>
        <Button variant="secondary" size={size} icon="eye" disabled aria-describedby={`preview-why-${clientId}`}>
          {t('ui.admin-client-account.preview.button')}
        </Button>
        <span id={`preview-why-${clientId}`} className={s.srOnly}>
          {t('ui.admin-client-account.preview.noAccount')}
        </span>
      </span>
    );
  }

  const close = () => {
    setOpen(false);
    setFailure(null);
    setReason('');
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    // opened at the click itself, so that the browser does not take it for a pop-up
    const tab = window.open('about:blank', '_blank');
    setPending(true);
    setFailure(null);
    const r = await adminCall<ClientPreviewCode>(`/admin/clients/${clientId}/preview-code`, { body: { reason: reason.trim() || null } });
    setPending(false);
    if (!r.ok) {
      tab?.close();
      return setFailure(errorText(r));
    }
    const url = sameHost(r.data.url);
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else if (!window.open(url, '_blank', 'noopener')) {
      return setFailure(t('ui.admin-client-account.preview.popup'));
    }
    close();
  }

  return (
    <>
      <Button variant="secondary" size={size} icon="eye" onClick={() => setOpen(true)}>
        {t('ui.admin-client-account.preview.button')}
      </Button>
      <Modal open={open} onClose={close} title={t('ui.admin-client-account.preview.title', { nom: clientName ?? '' })} closeLabel={t('ui.common.close')}>
        <form className={f.form} onSubmit={submit} noValidate>
          <p className={f.muted}>{t('ui.admin-client-account.preview.text')}</p>
          {failure ? <Banner tone="error">{failure}</Banner> : null}
          <TextInput label={t('ui.admin-client-account.preview.reason')} optional value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} hint={t('ui.admin-client-account.preview.reasonHint')} autoComplete="off" />
          <div className={`${f.actions} ${f.actionsEnd}`}>
            <Button variant="secondary" size="M" onClick={close}>
              {t('ui.common.cancel')}
            </Button>
            <Button type="submit" variant="tool" size="M" icon="external-link" pending={pending}>
              {t('ui.admin-client-account.preview.open')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
