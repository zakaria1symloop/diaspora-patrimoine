'use client';
// TRV-084, TRV-118 — an exception outside any block of a page: the 500 page of the back office, with « Réessayer ».
import { t } from '@/lib/i18n';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', background: '#f4f5f8', color: '#0c1c47' }}>
        <main style={{ maxWidth: '32rem', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem' }}>{t('ui.common.error.block')}</h1>
          <p>{t('ui.error.INTERNAL_ERROR', { identifiant: error.digest ?? '—' })}</p>
          <button type="button" onClick={reset} style={{ height: '2.875rem', padding: '0 1.25rem', border: 0, borderRadius: 8, background: '#06177a', color: '#fff', fontWeight: 600 }}>
            {t('ui.common.retry')}
          </button>
        </main>
      </body>
    </html>
  );
}
