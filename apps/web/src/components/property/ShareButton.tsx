'use client';
// NAV-037 — on phones the system share sheet; elsewhere a menu: Copier le lien · WhatsApp · E-mail · Facebook.
// The shared link is the canonical address; « Lien copié. » confirms the copy.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './property.module.css';
import { copyText } from '@dp/ui';

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const share = async () => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (coarse && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* cancelled: fall back to the menu */
      }
    }
    setOpen((o) => !o);
  };

  const copy = async () => {
    try {
      if (!(await copyText(url))) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 8000); // TRV-124: a short message stays 8 s
    } catch {
      /* clipboard refused */
    }
  };

  const enc = encodeURIComponent;
  return (
    <div className={s.shareWrap} ref={wrap}>
      <button type="button" className={s.headerAction} aria-expanded={open} aria-haspopup="menu" onClick={share}>
        <Icon name="external-link" size={20} />
        {t('ui.common.share')}
      </button>
      {open ? (
        <ul className={s.shareMenu} role="menu">
          <li role="none">
            <button type="button" role="menuitem" onClick={copy}>
              <Icon name="copy" size={20} />
              {t('ui.common.copyLink')}
            </button>
          </li>
          <li role="none">
            <a role="menuitem" href={`https://wa.me/?text=${enc(`${title} ${url}`)}`} target="_blank" rel="noopener">
              <Icon name="chat" size={20} />
              {t('ui.common.shareTo.whatsapp')}
            </a>
          </li>
          <li role="none">
            <a role="menuitem" href={`mailto:?subject=${enc(title)}&body=${enc(url)}`}>
              <Icon name="mail" size={20} />
              {t('ui.common.shareTo.email')}
            </a>
          </li>
          <li role="none">
            <a role="menuitem" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener">
              <Icon name="globe" size={20} />
              {t('ui.common.shareTo.facebook')}
            </a>
          </li>
        </ul>
      ) : null}
      <span className={s.toast} role="status" aria-live="polite">
        {copied ? t('ui.common.linkCopied') : ''}
      </span>
    </div>
  );
}
