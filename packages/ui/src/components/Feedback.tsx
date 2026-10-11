// DSN-015, DSN-056, TRV-080, TRV-113, TRV-114, TRV-117 — what an application says about a state: the status tag, the
// banner, the error summary of a form, the message under a field, the « Détails » of an unexpected error, the empty
// state and the skeleton. Texts come from the application (this package holds no interface text).
'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import s from './Feedback.module.css';
import { copyText } from '../browser';

// ─── StatusTag (DSN-015) ────────────────────────────────────────────────────

export type StatusTone = 'info' | 'pending' | 'success' | 'warning' | 'error' | 'neutral' | 'inactive';

/** Always with its label: a state is never carried by colour alone (TRV-121). */
export function StatusTag({ tone, children, icon, title }: { tone: StatusTone; children: ReactNode; icon?: IconName; title?: string }) {
  return (
    <span className={`${s.tag} ${s[`tag-${tone}`]}`} title={title}>
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </span>
  );
}

// ─── Banner (TRV-113, TRV-114) ──────────────────────────────────────────────

export type BannerTone = 'error' | 'warning' | 'info' | 'success';

const BANNER_ICON: Record<BannerTone, IconName> = { error: 'status-error', warning: 'status-warning', info: 'status-info', success: 'status-success' };

export interface BannerProps {
  tone: BannerTone;
  title?: ReactNode;
  children?: ReactNode;
  /** The button that does what the message asks (« Réessayer »). */
  action?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  /** A blocking error is announced at once; the rest politely. */
  assertive?: boolean;
  className?: string;
}

export function Banner({ tone, title, children, action, onClose, closeLabel, assertive, className }: BannerProps) {
  const loud = assertive ?? tone === 'error';
  return (
    <div className={[s.banner, s[`banner-${tone}`], className].filter(Boolean).join(' ')} role={loud ? 'alert' : 'status'} aria-live={loud ? 'assertive' : 'polite'}>
      <Icon name={BANNER_ICON[tone]} size={20} className={s.bannerIcon} />
      <div className={s.bannerBody}>
        {title ? <p className={s.bannerTitle}>{title}</p> : null}
        {typeof children === 'string' ? <p>{children}</p> : children}
        {action ? <div className={s.bannerAction}>{action}</div> : null}
      </div>
      {onClose ? (
        <button type="button" className={s.bannerClose} onClick={onClose}>
          <Icon name="close" size={16} label={closeLabel} />
        </button>
      ) : null}
    </div>
  );
}

// ─── ErrorSummary (DSN-056) ─────────────────────────────────────────────────

export interface ErrorSummaryItem {
  /** Id of the field: the link leads to it. */
  fieldId: string;
  label: string;
  message: string;
}

/** From two errors on: the list of points to correct, each a link to its field; it takes the focus (TRV-114). */
export function ErrorSummary({ title, items }: { title: string; items: ErrorSummaryItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const signature = items.map((i) => i.fieldId + i.message).join('|');
  useEffect(() => {
    if (items.length >= 2) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  if (items.length < 2) return null;
  return (
    <div ref={ref} className={`${s.banner} ${s['banner-error']} ${s.summary}`} role="alert" tabIndex={-1}>
      <Icon name="status-error" size={20} className={s.bannerIcon} />
      <div className={s.bannerBody}>
        <p className={s.bannerTitle}>{title}</p>
        <ul className={s.summaryList}>
          {items.map((i) => (
            <li key={i.fieldId}>
              <a
                href={`#${i.fieldId}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(i.fieldId);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el?.focus({ preventScroll: true });
                }}
              >
                {i.label}
              </a>
              {' : '}
              {i.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── FieldMessage (DSN-056) ─────────────────────────────────────────────────

/** Under a field: 16 px icon, small text, 6 px below; `id` is the one named by `aria-describedby`. */
export function FieldMessage({ id, tone = 'error', children }: { id?: string; tone?: 'error' | 'success'; children: ReactNode }) {
  return (
    <span id={id} className={`${s.fieldMessage} ${tone === 'success' ? s.fieldSuccess : s.fieldError}`}>
      <Icon name={tone === 'success' ? 'status-success' : 'status-error'} size={16} />
      <span>{children}</span>
    </span>
  );
}

// ─── ErrorDetails (TRV-117, TRV-111) ────────────────────────────────────────

export interface ErrorDetailsProps {
  code: string | null;
  requestId: string | null;
  /** Shown as given (the application formats it). */
  time: string;
  labels: { details: string; copy: string; copied: string; code: string; requestId: string; time: string };
}

/** Back office: under a 5xx or unexpected error, « Détails » unfolds the code, the request id and the time. */
export function ErrorDetails({ code, requestId, time, labels }: ErrorDetailsProps) {
  const [copied, setCopied] = useState(false);
  const text = [`${labels.code} : ${code ?? '—'}`, `${labels.requestId} : ${requestId ?? '—'}`, `${labels.time} : ${time}`].join('\n');
  return (
    <details className={s.details}>
      <summary>{labels.details}</summary>
      <dl className={s.detailsList}>
        <dt>{labels.code}</dt>
        <dd>{code ?? '—'}</dd>
        <dt>{labels.requestId}</dt>
        <dd>{requestId ?? '—'}</dd>
        <dt>{labels.time}</dt>
        <dd>{time}</dd>
      </dl>
      <button
        type="button"
        className={s.detailsCopy}
        onClick={() => {
          void copyText(text).then((ok) => {
            if (!ok) return;
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
          });
        }}
      >
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        <span aria-live="polite">{copied ? labels.copied : labels.copy}</span>
      </button>
    </details>
  );
}

// ─── EmptyState, Skeleton (TRV-080) ─────────────────────────────────────────

export function EmptyState({ icon = 'folder', title, text, actions, compact }: { icon?: IconName; title: string; text?: ReactNode; actions?: ReactNode; compact?: boolean }) {
  return (
    <div className={[s.empty, compact && s.emptyCompact].filter(Boolean).join(' ')}>
      <span className={s.emptyIcon} aria-hidden="true">
        <Icon name={icon} size={24} />
      </span>
      <p className={s.emptyTitle}>{title}</p>
      {text ? <p className={s.emptyText}>{text}</p> : null}
      {actions ? <div className={s.emptyActions}>{actions}</div> : null}
    </div>
  );
}

/** Takes the shape of the content; appears only when the answer is late (300 ms, TRV-080) through its own fade-in delay. */
export function Skeleton({ width, height = '1rem', radius }: { width?: string; height?: string; radius?: string }) {
  return <span className={s.skeleton} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 6, columns = 5, label }: { rows?: number; columns?: number; label: string }) {
  return (
    <div className={s.skeletonRows} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className={s.skeletonRow}>
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} width={c === 0 ? '30%' : `${12 + ((r + c) % 3) * 4}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}
