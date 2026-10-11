'use client';
// ECL-004, ROL-017 — « Vous consultez l'espace de {prénom nom} en lecture seule » · « Quitter l'aperçu »: the fixed band
// of a preview opened by the team (CRM-075). Rendered by the root layout, it asks the API only inside the client space;
// for a client's own session the answer is `active: false` and nothing shows. The server refuses every write of a
// preview (403 PREVIEW_READ_ONLY) and marks nothing read or seen; leaving ends the session, traced as such.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ClientPreviewState } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import s from './preview.module.css';

export function PreviewBand() {
  const pathname = usePathname();
  const inSpace = pathname === '/espace-client' || pathname.startsWith('/espace-client/');
  const [state, setState] = useState<ClientPreviewState | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!inSpace || state) return;
    let alive = true;
    void apiCall<ClientPreviewState>('/client/preview').then((r) => {
      if (alive && r.ok && r.data.active) setState(r.data);
    });
    return () => {
      alive = false;
    };
  }, [inSpace, state]);

  const active = inSpace && state?.active;
  useEffect(() => {
    if (!active) return;
    document.documentElement.dataset.preview = '1';
    return () => {
      delete document.documentElement.dataset.preview;
    };
  }, [active]);

  if (!active || !state) return null;

  const quit = async () => {
    setLeaving(true);
    await apiCall('/auth/logout', { method: 'POST' });
    window.dispatchEvent(new Event('dp:session'));
    // the tab was opened by the back office: it closes; else the page that says the consultation is over
    window.close();
    window.location.replace('/apercu/termine');
  };

  const until = state.expiresAt ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(state.expiresAt)) : null;

  return (
    <div className={s.band} role="status">
      <span className={s.mark} aria-hidden="true">
        <Icon name="eye" size={20} />
      </span>
      <p className={s.text}>
        <strong>{t('ui.preview.band', { nom: state.clientName ?? '' })}</strong>
        {until ? <span className={s.until}>{t('ui.preview.until', { heure: until })}</span> : null}
      </p>
      <button type="button" className={s.quit} onClick={() => void quit()} disabled={leaving}>
        <Icon name="logout" size={16} />
        {t('ui.preview.quit')}
      </button>
    </div>
  );
}
