'use client';
// CRM-075, ROL-017 — `/apercu/{code}`: the tab opened by « Voir comme le client » exchanges its one-minute code for the
// read-only session, then lands on the client's space (the band says it is a preview). A dead code says why and what
// to do; `/apercu/termine` is where « Quitter l'aperçu » lands when the tab cannot close itself.
import { useEffect, useRef, useState } from 'react';
import type { SessionResponse } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import s from '../auth/auth.module.css';

export function PreviewOpen({ code }: { code: string }) {
  const ended = code === 'termine';
  const [dead, setDead] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (ended || started.current) return;
    started.current = true;
    void apiCall<SessionResponse>('/auth/preview/exchange', { body: { code } }).then((r) => {
      // a full navigation: the no-referrer policy of this page must not follow, and the space reads the new cookies
      if (r.ok) return window.location.replace(r.data.redirectTo || '/espace-client');
      setDead(true);
    });
  }, [code, ended]);

  if (!ended && !dead) {
    return (
      <>
        <span className={s.eyebrow}>
          <Icon name="eye" size={16} />
          {t('ui.preview.page.eyebrow')}
        </span>
        <p className={s.muted} role="status" aria-live="polite">
          {t('ui.preview.page.opening')}
        </p>
      </>
    );
  }
  return (
    <>
      <span className={s.eyebrow}>
        <Icon name={ended ? 'check' : 'clock'} size={16} />
        {t('ui.preview.page.eyebrow')}
      </span>
      <h1 className={s.title}>{ended ? t('ui.preview.page.ended') : t('ui.preview.page.expired')}</h1>
      <p className={s.muted}>{ended ? t('ui.preview.page.endedText') : t('ui.preview.page.expiredText')}</p>
      <Button variant="secondary" size="L" onClick={() => window.close()}>
        {t('ui.preview.page.close')}
      </Button>
    </>
  );
}
