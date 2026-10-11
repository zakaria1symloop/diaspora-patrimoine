'use client';
// EC-10 « adresse e-mail en erreur (bandeau) », AUT-071 — our e-mails bounce: « Mon adresse est correcte » clears the
// mark (`POST /client/me/email/confirm-valid`), « Modifier mon adresse » opens the profile (AUTH-080).
import Link from 'next/link';
import { useState } from 'react';
import { Button, Icon } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import { useSpace } from '../SpaceContext';
import s from './dashboard.module.css';

export function EmailBounced() {
  const { summary, refresh } = useSpace();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!summary.emailBounced || done) return null;
  async function confirm() {
    setBusy(true);
    const res = await apiCall('/client/me/email/confirm-valid', { method: 'POST', retryOnAuth: true });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      showToast({ message: t('ui.client.dashboard.emailBounced.done') });
      void refresh({ soft: true });
    }
  }
  return (
    <div className={`${s.banner} ${s.bannerHold}`} role="status">
      <Icon name="mail" size={24} />
      <div className={s.bannerBody}>
        <p>{t('ui.client.dashboard.emailBounced.text', { adresse: summary.email })}</p>
        <div className={s.bannerActions}>
          <Button variant="tool" size="S" pending={busy} onClick={() => void confirm()}>
            {t('ui.client.dashboard.emailBounced.valid')}
          </Button>
          <Link href="/espace-client/profil#adresse" className={s.ghostButton}>
            {t('ui.client.dashboard.emailBounced.change')}
          </Link>
        </div>
      </div>
    </div>
  );
}
