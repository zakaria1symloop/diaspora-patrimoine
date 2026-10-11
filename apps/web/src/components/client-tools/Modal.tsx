'use client';
// DSN-050 Modal for actions of the client space that have no address of their own (confirmations, renaming, the deposit
// panel): native <dialog> (focus trapped and returned, Escape closes, TRV-121), centred on a computer, full screen on a
// phone — the same look as the site's windows.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '@dp/ui';
import s from '@/components/forms/dialog.module.css';

export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      style={{ ['--w' as string]: `${width / 16}rem` }}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={s.frame}>
        <header className={s.header}>
          <h2 id={titleId} className={s.title}>
            {title}
          </h2>
          <button type="button" className={s.close} onClick={onClose}>
            <Icon name="close" label={closeLabel} />
          </button>
        </header>
        <div className={s.body}>{open ? children : null}</div>
      </div>
    </dialog>
  );
}
