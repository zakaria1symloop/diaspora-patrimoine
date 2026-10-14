'use client';
// Pieces shared by the list (EA-10) and the record (EA-11) of the requests: the column « Premier contact » (CRM-002),
// the labels and values of a form as it was sent (CRM-010), the wished moment in the visitor's time zone then in the
// reader's.
import type { LeadFieldValue, LeadFirstContact } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Icon } from '@dp/ui';
import { businessDuration, DASH, longDay, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import s from './leads.module.css';

/** CRM-002 — « dans 1 j 4 h » (green) · « dans 3 h » (orange, less than a business day) · « en retard de 5 h » (red) · « Contacté en 6 h » · « rappel demandé jeudi » · « — ». Never colour alone: the words say it. */
export function FirstContact({ value, workdayMinutes }: { value: LeadFirstContact; workdayMinutes: number }) {
  if (value.state === 'NONE') return <span className={s.fcNone}>{DASH}</span>;
  if (value.state === 'DONE') {
    return (
      <span className={`${s.fc} ${s.fcDone}`}>
        <Icon name="check" size={16} />
        {t('ui.admin-leads.firstContact.done', { duree: businessDuration(value.businessMinutes, workdayMinutes) })}
      </span>
    );
  }
  if (value.state === 'CALLBACK') {
    return (
      <span className={`${s.fc} ${s.fcCallback}`}>
        <Icon name="phone" size={16} />
        {t('ui.admin-leads.firstContact.callback', { jour: longDay(value.day) })}
      </span>
    );
  }
  if (value.state === 'LATE') {
    return (
      <span className={`${s.fc} ${s.fcLate}`}>
        <Icon name="status-error" size={16} />
        {t('ui.admin-leads.firstContact.late', { duree: businessDuration(value.businessMinutes, workdayMinutes) })}
      </span>
    );
  }
  return (
    <span className={`${s.fc} ${value.soon ? s.fcSoon : s.fcOk}`}>
      <Icon name="clock" size={16} />
      {t('ui.admin-leads.firstContact.due', { duree: businessDuration(value.businessMinutes, workdayMinutes) })}
    </span>
  );
}

/** Enumeration of a form key, for the label of its value (`enum.{Énumération}.{VALEUR}`). */
const FIELD_ENUM: Record<string, string> = {
  residencyStatus: 'ResidencyStatus',
  purchaseTimeframe: 'PurchaseTimeframe',
  financingPreference: 'FinancingPreference',
  budgetKind: 'BudgetKind',
  preferredSlot: 'ContactTimeSlot',
  subject: 'ContactSubject',
  preferredChannel: 'Channel',
  propertyType: 'PropertyType',
  type: 'PropertyType',
  purpose: 'PurchasePurpose',
};

/** ASS-010, D-108 — a guided search's answers, each under the question the client answered (never under its code). */
const ANSWER_LABEL: Record<string, string> = {
  'answers.region': 'answerRegion',
  'answers.type': 'answerType',
  'answers.rooms': 'answerRooms',
  'answers.budget': 'answerBudget',
  'answers.budget.kind': 'answerBudgetKind',
  'answers.budget.max': 'answerBudgetMax',
  'answers.delivery': 'answerDelivery',
  'answers.purpose': 'answerPurpose',
};
/** The key without its list positions (« answers.region.2 » → « answers.region »). */
const pathOf = (key: string) => key.split('.').filter((p) => !/^\d+$/.test(p)).join('.');

let countries: Intl.DisplayNames | null = null;
function countryName(code: string): string {
  try {
    countries ??= new Intl.DisplayNames(['fr'], { type: 'region' });
    return countries.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The label of a form key: its own text when there is one, else the last part of the key, spelled out. */
export function fieldLabel(key: string): string {
  const answer = ANSWER_LABEL[pathOf(key)];
  if (answer) return t(`ui.admin-leads.field.${answer}` as MessageKey);
  const leaf = key.split('.').filter((p) => !/^\d+$/.test(p)).pop() ?? key;
  for (const candidate of [`ui.admin-leads.field.${key}`, `ui.admin-leads.field.${leaf}`]) if (hasMessage(candidate)) return t(candidate as MessageKey);
  const words = leaf.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function fieldValue(field: LeadFieldValue): string {
  const leaf = field.key.split('.').pop() ?? field.key;
  const path = pathOf(field.key);
  const own = (key: string) => (hasMessage(key) ? t(key as MessageKey) : null);
  const one = (v: string | number | boolean): string => {
    if (typeof v === 'boolean') return v ? t('ui.common.yes') : t('ui.common.no');
    if (typeof v === 'number') return new Intl.NumberFormat('fr-FR').format(v);
    if (v === '•••') return t('ui.admin-leads.masked');
    if (leaf === 'prefilledFrom' && hasMessage(`ui.admin-leads.origin.${v}`)) return t(`ui.admin-leads.origin.${v}` as MessageKey);
    // D-108 — a guided search's answers in the client's words, a partner's kind
    if (path.startsWith('answers.')) {
      const word = v === 'ANY' ? 'any' : v === 'UNKNOWN' ? 'unknown' : v === 'NO_ANSWER' ? 'noAnswer' : null;
      if (word) return t(`ui.admin-leads.value.${word}` as MessageKey);
      const said =
        (path === 'answers.rooms' && own(`ui.admin-leads.value.rooms.${v}`)) ||
        (path === 'answers.delivery' && own(`ui.admin-leads.value.delivery.${v}`)) ||
        (path === 'answers.budget.kind' && own(`ui.admin-leads.value.budgetKind.${v}`));
      if (said) return said;
    }
    if (leaf === 'partnerKind') return own(`ui.admin-leads.value.partnerKind.${v}`) ?? v;
    const enumName = FIELD_ENUM[leaf];
    // the assistant sends a type as a slug (« apartment »), the enum is in capitals (« APARTMENT »)
    for (const value of enumName ? [v, v.toUpperCase()] : []) if (hasMessage(`ui.enum.${enumName}.${value}`)) return t(`ui.enum.${enumName}.${value}` as MessageKey);
    if (/country/i.test(leaf) && /^[A-Z]{2}$/.test(v)) return countryName(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return shortDay(v);
    if (/^\d+(\.\d+)?$/.test(v) && /budget|amount|price|payment/i.test(leaf)) return new Intl.NumberFormat('fr-FR').format(Number(v));
    return v;
  };
  if (field.value === null) return DASH;
  return Array.isArray(field.value) ? field.value.map(one).join(', ') : one(field.value);
}

const SLOT_HOURS: Record<string, [number, number]> = { MORNING: [9, 12], NOON: [12, 14], AFTERNOON: [14, 18], EVENING: [18, 20] };

function zonedInstant(day: string, hour: number, timeZone: string): Date {
  const guess = new Date(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

const cityOf = (timeZone: string) => (timeZone.split('/').pop() ?? timeZone).replace(/_/g, ' ');
const hourIn = (d: Date, timeZone: string) => new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone }).format(d).replace(':00', ' h').replace(':', ' h ');

/**
 * CRM-010 — the wished slot: in the visitor's time zone, then in mine — « Le matin, 9 h – 12 h, heure de Montreal
 * (15 h – 18 h à Paris) »; without `callerTimezone`, the label alone; `ANYTIME`: « Peu importe ».
 */
export function callbackSlotLabel(slot: string | null, day: string | null, callerTimezone: string | null, readerTimezone: string): string | null {
  if (!slot) return null;
  const label = hasMessage(`ui.enum.ContactTimeSlot.${slot}`) ? t(`ui.enum.ContactTimeSlot.${slot}` as MessageKey) : slot;
  const hours = SLOT_HOURS[slot];
  if (!hours || !callerTimezone) return label;
  try {
    const ref = day ?? new Intl.DateTimeFormat('en-CA', { timeZone: callerTimezone }).format(new Date());
    const from = zonedInstant(ref, hours[0], callerTimezone);
    const to = zonedInstant(ref, hours[1], callerTimezone);
    if (callerTimezone === readerTimezone) return label;
    return t('ui.admin-leads.sent.slotZones', { creneau: label, villeVisiteur: cityOf(callerTimezone), debut: hourIn(from, readerTimezone), fin: hourIn(to, readerTimezone), villeLecteur: cityOf(readerTimezone) });
  } catch {
    return label;
  }
}
