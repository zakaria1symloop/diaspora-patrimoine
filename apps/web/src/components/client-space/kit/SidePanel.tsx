'use client';
// D-098 — secondary work (deposit a piece, look at a file, rename, read a result) opens in a PANEL on the right that
// leaves the page visible and usable beside it, not in a centred window; a centred window stays for a short
// confirmation only. On a computer the content of the space moves aside (the frame reads `--space-panel`); on a phone
// the panel is the whole screen. Not modal: no veil, the focus goes to the panel and comes back to where it was,
// Escape closes it (TRV-121). `beforeClose` may refuse (an upload in progress, DOS-012).
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './kit.module.css';

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  /** 480 (default) or 720 for a viewer. */
  width?: 480 | 720;
  children: ReactNode;
}

export function SidePanel({ open, onClose, title, eyebrow, width = 480, children }: SidePanelProps) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = document.querySelector<HTMLElement>('[data-space-frame]');
    frame?.style.setProperty('--space-panel', `${width / 16}rem`);
    frame?.setAttribute('data-panel', '');
    // On a phone the panel covers the page: the page behind does not scroll.
    const phone = window.matchMedia('(max-width: 1023px)').matches;
    const overflow = document.body.style.overflow;
    if (phone) document.body.style.overflow = 'hidden';
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // A window opened above the panel (a confirmation) takes Escape first.
      if (document.querySelector('dialog[open]')) return;
      closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      frame?.style.removeProperty('--space-panel');
      frame?.removeAttribute('data-panel');
      if (phone) document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, width]);

  if (!open) return null;
  return (
    <aside ref={ref} className={s.panel} style={{ ['--panel-w' as string]: `${width / 16}rem` }} role="dialog" aria-modal="false" aria-labelledby={titleId} tabIndex={-1} data-side-panel>
      <header className={s.panelHead}>
        <div>
          {eyebrow ? <p className={s.panelEyebrow}>{eyebrow}</p> : null}
          <h2 id={titleId} className={s.panelTitle}>
            {title}
          </h2>
        </div>
        <button type="button" className={s.panelClose} onClick={onClose} aria-label={t('ui.common.close')}>
          <Icon name="close" size={20} />
        </button>
      </header>
      <div className={s.panelBody}>{children}</div>
    </aside>
  );
}
