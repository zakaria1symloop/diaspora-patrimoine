'use client';
// DSN-072 « Dépliage » — height (through grid rows, DSN-074) and fade, motion.base; the chevron turns.
// The content stays in the page (found by in-page search, read by assistive tech once open).
import { useId, useState, type ReactNode } from 'react';
import { Icon } from '@dp/ui';
import s from './interactive.module.css';

export function Disclosure({
  label,
  openLabel,
  children,
  defaultOpen = false,
  variant = 'link',
}: {
  label: string;
  /** Label once open (« Réduire »); the closed label otherwise. */
  openLabel?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  variant?: 'link' | 'panel';
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={`${s.disclosure} ${variant === 'panel' ? s.disclosurePanel : ''}`} data-open={open || undefined}>
      <button type="button" className={s.disclosureButton} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span>{open && openLabel ? openLabel : label}</span>
        <Icon name="chevron-down" size={20} className={s.chevron} />
      </button>
      <div id={id} className={s.disclosureBody} inert={!open}>
        <div className={s.disclosureInner}>{children}</div>
      </div>
    </div>
  );
}
