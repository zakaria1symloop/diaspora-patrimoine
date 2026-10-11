'use client';
// EA-21, EA-22 — the small pieces the list and the record of a dossier share: the stage deadline in words (CAL-062), what
// the dossier waits for and from whom (`next`), the priority, an ability of the API turned into « absent / greyed with
// its reason » (BO-047), a link to another agent's record only when that record is delivered.
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Ability, AdminTimelineEntry, DossierNext, DossierSla, Money, PublicImage } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Icon, StatusTag, type IconName, type MenuItem, type StatusTone } from '@dp/ui';
import { DASH, money, shortDate, shortDateTime, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { isDeliveredPath } from '../shell/menu';
import s from './dossiers.module.css';

export const dossierPath = (reference: string) => `/dossiers/${reference.toLowerCase()}`;

export const PRIORITY_TONE: Record<string, StatusTone> = { LOW: 'inactive', NORMAL: 'neutral', HIGH: 'warning', URGENT: 'error' };
export const STAGE_TONE: Record<string, StatusTone> = { INTEREST: 'info', QUALIFICATION: 'info', MATCHING: 'pending', DOCUMENTS: 'pending', BANK_REVIEW: 'pending', APPROVED: 'success', ACQUISITION: 'success' };

export const enumLabel = (name: string, value: string | null | undefined): string | null =>
  value ? (hasMessage(`ui.enum.${name}.${value}`) ? t(`ui.enum.${name}.${value}` as MessageKey) : value) : null;

export const amount = (m: Money | null | undefined): string | null => (m ? money(m.amount, m.currency) : null);

/** CAL-062 — « dans 3 j ouvrés », « en retard de 2 j », « gelée » : the words say it, the colour only helps. */
export function Sla({ value }: { value: DossierSla }) {
  if (value.state === 'NONE') return <span className={s.slaNone}>{DASH}</span>;
  if (value.state === 'PAUSED')
    return (
      <span className={`${s.sla} ${s.slaPaused}`}>
        <Icon name="pause" size={16} />
        {t('ui.admin-dossiers.sla.paused')}
      </span>
    );
  if (value.state === 'LATE')
    return (
      <span className={`${s.sla} ${s.slaLate}`}>
        <Icon name="status-warning" size={16} />
        {t('ui.admin-dossiers.sla.late', { n: Math.max(1, value.businessDaysLate) })}
      </span>
    );
  const soon = value.businessDaysLeft <= 1;
  return (
    <span className={`${s.sla} ${soon ? s.slaSoon : s.slaOk}`}>
      <Icon name="clock" size={16} />
      {value.businessDaysLeft <= 0 ? t('ui.admin-dossiers.sla.today') : t('ui.admin-dossiers.sla.due', { n: value.businessDaysLeft })}
    </span>
  );
}

/** What the dossier waits for, and who must move: the team (to do), the client (waiting), nobody. */
export function NextStep({ next, timeZone, compact }: { next: DossierNext; timeZone: string; compact?: boolean }) {
  if (next.code === 'NONE') return <span className={s.slaNone}>{DASH}</span>;
  const date = next.at ? (/^\d{4}-\d{2}-\d{2}$/.test(next.at) ? shortDay(next.at) : shortDateTime(next.at, timeZone)) : null;
  const params = { bien: next.property ?? '', date: date ?? '' };
  const withDate = date && hasMessage(`ui.admin-dossiers.next.${next.code}_date`);
  const text = t((withDate ? `ui.admin-dossiers.next.${next.code}_date` : `ui.admin-dossiers.next.${next.code}`) as MessageKey, params);
  return (
    <span className={[s.next, compact && s.nextCompact].filter(Boolean).join(' ')}>
      <span className={`${s.who} ${next.waitingOn === 'TEAM' ? s.whoTeam : next.waitingOn === 'CLIENT' ? s.whoClient : s.whoNone}`}>{t(`ui.admin-dossiers.waiting.${next.waitingOn}`)}</span>
      <span className={s.nextText}>{text}</span>
    </span>
  );
}

export function PriorityTag({ value }: { value: string }) {
  if (value === 'NORMAL' || value === 'LOW') return <span className={value === 'LOW' ? s.slaNone : undefined}>{enumLabel('Priority', value)}</span>;
  return (
    <StatusTag tone={PRIORITY_TONE[value] ?? 'neutral'} icon={value === 'URGENT' ? 'status-error' : 'status-warning'}>
      {enumLabel('Priority', value)}
    </StatusTag>
  );
}

// ─── Abilities (BO-047) ─────────────────────────────────────────────────────

export const allowed = (a: Ability | undefined): boolean => a === true;
export const shown = (a: Ability | undefined): boolean => a !== false && a !== undefined;

/** The sentence of a reason an action is impossible in this state. */
export function whyNot(a: Ability | undefined): string | null {
  if (!a || a === true) return null;
  for (const ns of ['ui.admin-dossiers.why', 'ui.admin-shell.reason', 'ui.error.reason']) {
    const key = `${ns}.${a.reason}`;
    if (hasMessage(key)) return t(key as MessageKey, { n: '', reference: '', date: '' });
  }
  return t('ui.admin-dossiers.why.generic');
}

/** A menu item from an ability: absent when the role may not, greyed with its reason when the state forbids it. */
export function abilityItem(a: Ability | undefined, item: Omit<MenuItem, 'disabledReason'>): MenuItem[] {
  if (!shown(a)) return [];
  return [{ ...item, disabledReason: whyNot(a) }];
}

// ─── Links to the screens of other packages ─────────────────────────────────

/** A link when the target screen is delivered (`menu.ts`), plain text otherwise: nothing leads to what is not there. */
export function RecordLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  if (!isDeliveredPath(href)) return <span className={className}>{children}</span>;
  return (
    <Link href={href} className={[s.recordLink, className].filter(Boolean).join(' ')}>
      {children}
    </Link>
  );
}

// ─── Images of the catalogue ────────────────────────────────────────────────

export function Photo({ image, className }: { image: PublicImage | null; className?: string }) {
  if (!image) {
    return (
      <span className={[s.photo, s.photoEmpty, className].filter(Boolean).join(' ')} aria-hidden="true">
        <Icon name="home" size={24} />
      </span>
    );
  }
  const rendition = image.renditions.includes('card') ? 'card' : image.renditions.includes('thumb') ? 'thumb' : (image.renditions[0] ?? 'card');
  const format = image.formats.includes('jpg') ? 'jpg' : (image.formats[image.formats.length - 1] ?? 'jpg');
  return (
    <span className={[s.photo, className].filter(Boolean).join(' ')}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${image.base}/${rendition}.${format}`} alt="" loading="lazy" decoding="async" />
    </span>
  );
}

// ─── Timeline sentence (same keys as the shell timeline) ────────────────────

const TYPE_ICON: Record<string, IconName> = { EMAIL: 'mail', MESSAGE: 'chat', CALL: 'phone', NOTE: 'edit', DOCUMENT: 'file', STAGE: 'arrow-right', PROPERTY: 'home', FINANCING: 'bank', ACTIVITY: 'calendar', LEAD: 'mail', SYSTEM: 'sparkles', RECORD: 'sliders' };
export const timelineIcon = (type: string): IconName => TYPE_ICON[type] ?? 'sparkles';

export function timelineSentence(entry: AdminTimelineEntry): string {
  if (entry.code.startsWith('email.')) return t('ui.admin-shell.timeline.event.email');
  const key = `ui.admin-shell.timeline.event.${entry.code}`;
  if (hasMessage(key)) {
    const params: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(entry.params)) if (v !== null) params[k] = v;
    if (typeof params.kind === 'string') params.nature = (enumLabel('LeadKind', params.kind) ?? params.kind).toLocaleLowerCase('fr');
    if (typeof params.source === 'string') params.origine = enumLabel('LeadSource', params.source) ?? params.source;
    for (const [param, enumName] of [['stage', 'DossierStage'], ['fromStage', 'DossierStage'], ['toStage', 'DossierStage'], ['status', 'CandidateStatus'], ['holdReason', 'HoldReason'], ['lostReason', 'LostReason']] as const) {
      const v = params[param];
      if (typeof v === 'string') params[`${param}Label`] = enumLabel(enumName, v) ?? v;
    }
    try {
      return t(key as MessageKey, params);
    } catch {
      return t(`ui.admin-shell.timeline.type.${entry.type}` as MessageKey);
    }
  }
  return t(`ui.admin-shell.timeline.type.${entry.type}` as MessageKey);
}

export { shortDate, shortDateTime, shortDay, DASH };
