'use client';
// FIC-031 — six lines, then « Lire la suite » unfolds in place; line breaks kept, no HTML interpreted.
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n';
import s from './property.module.css';

export function ReadMore({ text, collapsible }: { text: string; collapsible: boolean }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [text]);
  return (
    <>
      <p ref={ref} className={[s.prewrap, collapsible && !open && s.clamp].filter(Boolean).join(' ')}>
        {text}
      </p>
      {collapsible && (overflows || open) ? (
        <button type="button" className={s.linkButton} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? t('ui.property.description.less') : t('ui.property.description.more')}
        </button>
      ) : null}
    </>
  );
}
