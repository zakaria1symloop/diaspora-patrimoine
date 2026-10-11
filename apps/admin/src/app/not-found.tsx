// An address that does not exist, outside the frame (the frame has its own, with the menu).
import Link from 'next/link';
import { EmptyState, buttonClass, ButtonInner } from '@dp/ui';
import { t } from '@/lib/i18n';

export default function NotFound() {
  return (
    <main id="contenu" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
      <EmptyState
        icon="search"
        title={t('ui.admin-shell.page.notFound')}
        text={t('ui.error.NOT_FOUND')}
        actions={
          <Link href="/" className={buttonClass('tool', 'M')}>
            <ButtonInner size="M">{t('ui.admin-shell.page.home')}</ButtonInner>
          </Link>
        }
      />
    </main>
  );
}
