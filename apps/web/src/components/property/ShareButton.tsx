'use client';
// NAV-037 — on phones the system share sheet; elsewhere a menu: Copier le lien · WhatsApp · E-mail · Facebook.
// The shared link is the canonical address; « Lien copié. » confirms the copy.
// « E-mail » unfolds the ways to write it: the mail application of the device (a `mailto:` link — it does nothing on a
// computer where no application is set up, which is why it is not the only way) and the mailboxes people read in their
// browser (Gmail, Outlook, Yahoo), each opened on a new message already filled with the title and the link.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './property.module.css';
import { copyText } from '@dp/ui';

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mail, setMail] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setMail(false);
      return;
    }
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
  // RFC 6068: a line break of the body is CRLF, percent-encoded like the rest.
  const subject = enc(title);
  const body = enc(`${title}\r\n${url}`);
  const mailboxes = [
    { key: 'gmail', href: `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}` },
    { key: 'outlook', href: `https://outlook.live.com/mail/0/deeplink/compose?subject=${subject}&body=${body}` },
    { key: 'yahoo', href: `https://compose.mail.yahoo.com/?subject=${subject}&body=${body}` },
  ] as const;
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
            <button type="button" role="menuitem" aria-expanded={mail} onClick={() => setMail((v) => !v)}>
              <Icon name="mail" size={20} />
              <span className={s.shareGrow}>{t('ui.common.shareTo.email')}</span>
              <Icon name={mail ? 'chevron-up' : 'chevron-down'} size={16} />
            </button>
            {mail ? (
              <ul className={s.shareSub} role="group" aria-label={t('ui.common.shareTo.email')}>
                <li role="none">
                  <a role="menuitem" href={`mailto:?subject=${subject}&body=${body}`} onClick={() => setOpen(false)}>
                    {t('ui.common.shareTo.mailApp')}
                  </a>
                </li>
                {mailboxes.map((m) => (
                  <li key={m.key} role="none">
                    <a role="menuitem" href={m.href} target="_blank" rel="noopener" onClick={() => setOpen(false)}>
                      {t(`ui.common.shareTo.${m.key}`)}
                      <Icon name="external-link" size={16} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
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
