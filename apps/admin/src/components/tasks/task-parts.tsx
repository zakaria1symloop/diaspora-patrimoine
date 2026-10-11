'use client';
// TAC-001 — the small pieces of a task: the due date in words, its group, the attached objects as links (only when
// their screen is delivered), the abilities of the API turned into « absent / greyed with its reason » (BO-047).
import Link from 'next/link';
import type { TaskAbility, TaskAttachment, TaskItem } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Icon, type IconName, type MenuItem, type StatusTone } from '@dp/ui';
import { shortDate, shortDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { isDeliveredPath } from '../shell/menu';
import s from './tasks.module.css';

export const enumLabel = (name: string, value: string | null | undefined): string | null =>
  value ? (hasMessage(`ui.enum.${name}.${value}`) ? t(`ui.enum.${name}.${value}` as MessageKey) : value) : null;

export const PRIORITY_TONE: Record<string, StatusTone> = { LOW: 'inactive', NORMAL: 'neutral', HIGH: 'warning', URGENT: 'error' };

export const TYPE_ICON: Record<string, IconName> = { CALL: 'phone', FOLLOW_UP: 'arrow-right', DOC_REVIEW: 'file', BANK_FOLLOW_UP: 'bank', VISIT: 'home', MEETING: 'calendar', CONTENT: 'edit', OTHER: 'check' };
const ATTACH_ICON: Record<string, IconName> = { DOSSIER: 'folder', CLIENT: 'user', LEAD: 'mail', APPOINTMENT: 'calendar', PROPERTY: 'key', PROMOTER: 'partners', EVENT: 'cafe-cup', SUBMISSION: 'send', BANK: 'bank', RESERVATION: 'key', FEEDBACK: 'heart' };

/** The due date as the list reads it: « Aujourd'hui · 14 h 30 », « Demain », « 12/10/2026 » — and late in red. */
export function DueLabel({ task, timeZone }: { task: Pick<TaskItem, 'dueAt' | 'dueHasTime' | 'group' | 'status'>; timeZone: string }) {
  if (!task.dueAt) return <span className={s.muted}>{t('ui.admin-tasks.due.none')}</span>;
  const time = task.dueHasTime ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(task.dueAt)).replace(':', ' h ') : null;
  const day = task.group === 'TODAY' ? t('ui.admin-tasks.due.today') : task.group === 'TOMORROW' ? t('ui.admin-tasks.due.tomorrow') : shortDate(task.dueAt, timeZone);
  const late = task.status === 'OPEN' && task.group === 'OVERDUE';
  return (
    <span className={[s.due, late && s.dueLate].filter(Boolean).join(' ')} title={shortDateTime(task.dueAt, timeZone)}>
      {late ? <Icon name="status-warning" size={16} /> : <Icon name="clock" size={16} />}
      {time ? `${day} · ${time}` : day}
    </span>
  );
}

export function Attachments({ items }: { items: TaskAttachment[] }) {
  if (!items.length) return <span className={s.muted}>{t('ui.admin-tasks.attached.none')}</span>;
  return (
    <span className={s.attachments}>
      {items.map((a) => {
        const label = a.kind === 'APPOINTMENT' ? (enumLabel('AppointmentType', a.label) ?? a.label) : a.label;
        const content = (
          <>
            <Icon name={ATTACH_ICON[a.kind] ?? 'folder'} size={16} />
            {label}
          </>
        );
        return a.path && isDeliveredPath(a.path) ? (
          <Link key={`${a.kind}-${a.label}`} href={a.path} className={s.attachLink} onClick={(e) => e.stopPropagation()}>
            {content}
          </Link>
        ) : (
          <span key={`${a.kind}-${a.label}`} className={s.attach}>
            {content}
          </span>
        );
      })}
    </span>
  );
}

export const allowed = (a: TaskAbility | undefined) => a === true;
export const shown = (a: TaskAbility | undefined) => a !== undefined && a !== false;
export function whyNot(a: TaskAbility | undefined): string | null {
  if (!a || a === true) return null;
  const key = `ui.admin-tasks.why.${a.reason}`;
  return hasMessage(key) ? t(key as MessageKey) : t('ui.admin-tasks.why.generic');
}
export function item(a: TaskAbility | undefined, m: Omit<MenuItem, 'disabledReason'>): MenuItem[] {
  return shown(a) ? [{ ...m, disabledReason: whyNot(a) }] : [];
}
