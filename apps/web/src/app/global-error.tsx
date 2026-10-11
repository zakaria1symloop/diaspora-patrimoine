'use client';
// Last-resort error page when the root layout itself fails (no header or footer available).
import { createTranslator } from '@dp/i18n';

const t = createTranslator('fr');

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem 1.25rem', color: '#0C1C47', background: '#FBF8F3' }}>
        <h1 style={{ color: '#06177A' }}>{t('ui.pages.error.server.title')}</h1>
        <p>
          <button type="button" onClick={reset} style={{ minHeight: 48, padding: '0 1.5rem', borderRadius: 999 }}>
            {t('ui.pages.error.server.retry')}
          </button>
        </p>
        {error.digest ? <p>{t('ui.pages.error.server.code', { identifiant: error.digest })}</p> : null}
      </body>
    </html>
  );
}
