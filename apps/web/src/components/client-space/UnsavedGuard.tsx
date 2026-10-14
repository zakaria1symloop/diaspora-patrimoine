'use client';
// TRV-093 — leaving a modified, unsaved form: the browser asks before a reload or a close (`beforeunload`), and this
// guard asks before a navigation inside the site — a link of the menu, of the header, of the page (D-107: the client's
// profile used to lose its changes silently on such a click). « Vous avez des modifications non enregistrées. Quitter
// sans enregistrer ? » — « Rester » / « Quitter ». The same guard as the back office's (AdminFrame).
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Modal } from '@dp/ui';
import { t } from '@/lib/i18n';

export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBefore);
    document.documentElement.dataset.unsaved = '1';
    return () => {
      window.removeEventListener('beforeunload', onBefore);
      delete document.documentElement.dataset.unsaved;
    };
  }, [dirty]);
}

export function UnsavedGuard() {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!document.documentElement.dataset.unsaved || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      // an anchor of the same page (the profile's section links) is not a departure
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return (
    <Modal
      open={target !== null}
      onClose={() => setTarget(null)}
      title={t('ui.common.unsaved.title')}
      closeLabel={t('ui.common.close')}
      footer={
        <>
          <Button
            variant="secondary"
            size="M"
            onClick={() => {
              const to = target;
              delete document.documentElement.dataset.unsaved;
              setTarget(null);
              if (to) router.push(to);
            }}
          >
            {t('ui.common.unsaved.leave')}
          </Button>
          <Button variant="tool" size="M" onClick={() => setTarget(null)} autoFocus>
            {t('ui.common.unsaved.stay')}
          </Button>
        </>
      }
    >
      <p>{t('ui.common.unsaved.text')}</p>
    </Modal>
  );
}
