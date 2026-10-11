'use client';
// NAV-001 — windows without their own address are opened by a URL parameter (?rappel=1, ?interet=1): the link can be
// shared, and « Retour » closes the window. DSN-050 Modal: centred 720px on desktop, full screen on phones,
// focus trapped and returned (native <dialog>), Escape closes (TRV-121).
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '@dp/ui';
import s from './dialog.module.css';

export function useQueryFlag(param: string): [boolean, () => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const open = params.get(param) === '1';
  const close = useCallback(() => {
    const qs = new URLSearchParams(params.toString());
    qs.delete(param);
    for (const extra of ['lot', 'visio']) if (param === 'interet') qs.delete(extra);
    const rest = qs.toString();
    router.replace(`${pathname}${rest ? `?${rest}` : ''}`, { scroll: false });
  }, [params, param, pathname, router]);
  return [open, close];
}

export function QueryDialog({
  open,
  onClose,
  title,
  closeLabel,
  children,
  width = 720,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  width?: 480 | 720 | 800;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // several windows live on one page (callback, interest, sign-in of the hearts): each is named by its own title
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
          <button type="button" className={s.close} onClick={onClose} aria-label={closeLabel}>
            <Icon name="close" />
          </button>
        </header>
        <div className={s.body}>{open ? children : null}</div>
      </div>
    </dialog>
  );
}

/** Context left by a page for the windows it can open (property or programme concerned). */
export function readLeadContext(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const el = document.querySelector<HTMLElement>('[data-lead-context]');
  try {
    return el?.dataset.leadContext ? (JSON.parse(el.dataset.leadContext) as Record<string, string>) : {};
  } catch {
    return {};
  }
}
