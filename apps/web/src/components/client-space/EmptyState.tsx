// TRV-080 « Vide », TRV-126 point 3 — an empty list says why, what will come and when, and offers the useful action.
// A small line drawing (DSN-076 spirit) keeps the page alive (D-092) — it draws itself once, then rests.
import type { ReactNode } from 'react';
import type { IconName } from '@dp/ui';
import { Icon } from '@dp/ui';
import s from './space.module.css';

export interface EmptyStateProps {
  title: ReactNode;
  text?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  /** Compact variant inside a block. */
  compact?: boolean;
}

export function EmptyState({ title, text, icon = 'home', actions, compact }: EmptyStateProps) {
  return (
    <div className={[s.empty, compact && s.emptyCompact].filter(Boolean).join(' ')}>
      <div className={s.emptyArt} aria-hidden="true">
        <svg viewBox="0 0 120 120" className={s.emptyRing}>
          <circle cx="60" cy="60" r="52" pathLength={1} />
          <circle cx="60" cy="60" r="40" pathLength={1} />
        </svg>
        <span className={s.emptyIcon}>
          <Icon name={icon} size={32} />
        </span>
      </div>
      <p className={s.emptyTitle}>{title}</p>
      {text ? <p className={s.emptyText}>{text}</p> : null}
      {actions ? <div className={s.emptyActions}>{actions}</div> : null}
    </div>
  );
}
