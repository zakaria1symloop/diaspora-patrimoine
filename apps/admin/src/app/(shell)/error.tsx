'use client';
// TRV-118 — an exception inside a page gives the error state of the work zone; the frame keeps working.
import { Button, EmptyState } from '@dp/ui';
import { t } from '@/lib/i18n';

export default function ShellError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', border: '1px solid var(--bo-ligne-bleue)', borderRadius: 'var(--ui-radius-surface)', background: 'var(--bo-fond-blanc)' }}>
      <EmptyState
        icon="status-error"
        title={t('ui.common.error.block')}
        text={t('ui.error.INTERNAL_ERROR', { identifiant: error.digest ?? '—' })}
        actions={
          <Button variant="tool" size="M" onClick={reset}>
            {t('ui.common.retry')}
          </Button>
        }
      />
    </div>
  );
}
