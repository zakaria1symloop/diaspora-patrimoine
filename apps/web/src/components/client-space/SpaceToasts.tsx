'use client';
// TRV-081, TRV-124 — the short messages of the client space: 8 seconds, paused under the pointer or the focus, an
// error stays until closed (TRV-114). Same event as the public site (`showToast` of lib/discovery), so a component
// shared with the site (a favourite button…) speaks the same way here. Above the phone's tabs.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@dp/ui';
import type { ToastInput } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import s from './shell.module.css';

const TOAST_MS = 8000;

export function SpaceToasts() {
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const hold = useRef(false);

  useEffect(() => {
    const onToast = (e: Event) => setToast({ ...(e as CustomEvent<ToastInput>).detail, id: Date.now() });
    window.addEventListener('dp:toast', onToast);
    return () => window.removeEventListener('dp:toast', onToast);
  }, []);

  useEffect(() => {
    if (!toast || toast.tone === 'error') return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      timer = setTimeout(() => (hold.current ? arm() : setToast(null)), TOAST_MS);
    };
    arm();
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className={s.toastZone} role="status" aria-live="polite">
      {toast ? (
        <div
          key={toast.id}
          className={[s.toast, toast.tone === 'error' && s.toastError].filter(Boolean).join(' ')}
          onMouseEnter={() => (hold.current = true)}
          onMouseLeave={() => (hold.current = false)}
          onFocus={() => (hold.current = true)}
          onBlur={() => (hold.current = false)}
        >
          <Icon name={toast.tone === 'error' ? 'status-error' : toast.tone === 'info' ? 'status-info' : 'status-success'} size={20} />
          <span className={s.toastText}>{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              className={s.toastAction}
              onClick={() => {
                toast.action!.onClick();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
          {toast.link ? (
            <Link href={toast.link.href} className={s.toastAction} onClick={() => setToast(null)}>
              {toast.link.label}
            </Link>
          ) : null}
          <button type="button" className={s.toastClose} onClick={() => setToast(null)} aria-label={t('ui.common.close')}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
