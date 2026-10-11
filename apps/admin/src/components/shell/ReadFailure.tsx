'use client';
// What a server page renders when its read failed (`adminGet` answered `ok: false`):
//   401 → the access token expired while the refresh token lives: the session is renewed in the browser once, then the
//         page is rendered again; if it cannot be renewed, the sign-in page brings the person back here (AUTH-023);
//   403 → « Vous n'avez pas accès à cette page. » · 404 → « Cet élément est introuvable. » (BO-015);
//   anything else → the error state with « Réessayer » and, for an unexpected error, its « Détails » (TRV-117).
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { Button, EmptyState, ErrorDetails } from '@dp/ui';
import { refreshSession } from '@/lib/admin-client';
import { errorText, isUnexpected, type Failure } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { Forbidden, NotFoundState, pageStyles as s } from './Page';

const KEY = 'dp_admin_renewed_at';

function Renewal() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const search = useSearchParams()?.toString() ?? '';
  useEffect(() => {
    let alive = true;
    const back = () => window.location.assign(`/connexion?suite=${encodeURIComponent(pathname + (search ? `?${search}` : ''))}`);
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(KEY) ?? '0');
    } catch {
      /* storage unavailable */
    }
    // renewed a moment ago and still refused: the session is really over (no loop)
    if (Date.now() - last < 15_000) {
      back();
      return;
    }
    void refreshSession().then((session) => {
      if (!alive) return;
      if (!session) return back();
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
      {t('ui.admin-shell.session.renewing')}
    </div>
  );
}

/** TRV-117 — the labels of « Détails », shared by every error of the back office. */
export function errorDetailsLabels() {
  return {
    details: t('ui.common.error.details'),
    copy: t('ui.common.error.copyDetails'),
    copied: t('ui.common.error.detailsCopied'),
    code: t('ui.admin-shell.error.code'),
    requestId: t('ui.admin-shell.error.requestId'),
    time: t('ui.admin-shell.error.time'),
  };
}

export function FailureDetails({ failure }: { failure: Failure }) {
  if (!isUnexpected(failure)) return null;
  return (
    <ErrorDetails
      code={failure.error?.code ?? failure.code ?? `HTTP ${failure.status}`}
      requestId={failure.error?.requestId ?? failure.requestId ?? null}
      time={new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date())}
      labels={errorDetailsLabels()}
    />
  );
}

export function ReadFailure({ result }: { result: { ok: false; status: number; code: string | null; reason: string | null; requestId: string | null } }) {
  const router = useRouter();
  if (result.status === 401) return <Renewal />;
  if (result.status === 403) return <Forbidden />;
  if (result.status === 404) return <NotFoundState />;
  const failure: Failure = { status: result.status, code: result.code, reason: result.reason, requestId: result.requestId };
  return (
    <div className={s.state}>
      <EmptyState
        icon="status-error"
        title={t('ui.common.error.block')}
        text={
          <>
            {errorText(failure)}
            <FailureDetails failure={failure} />
          </>
        }
        actions={
          <Button variant="tool" size="M" onClick={() => router.refresh()}>
            {t('ui.common.retry')}
          </Button>
        }
      />
    </div>
  );
}
