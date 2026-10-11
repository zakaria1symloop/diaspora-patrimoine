'use client';
// TRV-080 « Erreur » — a clear sentence and « Réessayer »; the error of a block never breaks the rest of the page.
import { useRouter } from 'next/navigation';
import { Button } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './space.module.css';

export function BlockError({ message }: { message?: string }) {
  const router = useRouter();
  return (
    <div className={s.blockError} role="alert">
      <p>{message ?? t('ui.common.error.block')}</p>
      <Button variant="secondary" size="S" icon="spinner" onClick={() => router.refresh()}>
        {t('ui.common.retry')}
      </Button>
    </div>
  );
}
