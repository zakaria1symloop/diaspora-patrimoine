'use client';
// AUTH-023, TRV-083 — a server read answered 401 (access token expired while the refresh token lives): renew the
// session in the browser once, then re-render; if it cannot be renewed, the sign-in page brings the person back here.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { refreshSession } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import s from './space.module.css';

const KEY = 'dp_space_renewed_at';

export function SessionRenewal() {
  const router = useRouter();
  const pathname = usePathname() ?? '/espace-client';
  const search = useSearchParams()?.toString() ?? '';

  useEffect(() => {
    let alive = true;
    const back = () => router.replace(`/connexion?suite=${encodeURIComponent(pathname + (search ? `?${search}` : ''))}`);
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(KEY) ?? '0');
    } catch {
      /* storage unavailable */
    }
    // Renewed a moment ago and still refused: the session is really over (no loop).
    if (Date.now() - last < 15_000) {
      back();
      return;
    }
    void refreshSession('WEB').then((ok) => {
      if (!alive) return;
      if (!ok) return back();
      try {
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {
        /* storage unavailable */
      }
      router.refresh();
    });
    return () => {
      alive = false;
    };
  }, [router, pathname, search]);

  return (
    <div className={s.renewal} role="status" aria-live="polite">
      <span className={s.renewalDot} aria-hidden="true" />
      {t('ui.client.shell.renewing')}
    </div>
  );
}
