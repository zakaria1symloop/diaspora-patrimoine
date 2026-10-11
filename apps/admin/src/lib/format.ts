// BO-082, TRV-020 … TRV-025 — the short formats of the back office, through `Intl`, in the staff member's time zone.
// A missing value reads « — » in a table (TRV-025).
import { t } from './i18n';

export const DASH = '—';

/** `12/09/2026`. */
export function shortDate(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return DASH;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone }).format(new Date(iso));
}

/** `12/09/2026 à 14 h 30`. */
export function shortDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone }).format(d).replace(':', ' h ');
  return t('ui.admin-shell.format.dateTime', { date: shortDate(iso, timeZone), heure: time });
}

/** An ISO calendar day (`2026-10-15`) as `15/10/2026`, without any time zone shift. */
export function shortDay(day: string | null | undefined): string {
  if (!day) return DASH;
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

/** « jeudi 15 octobre » — a calendar day in full. */
export function longDay(day: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}

/** Relative date of a timeline or a notification (« il y a 5 min », « hier »); the exact date is shown on hover. */
export function relativeTime(iso: string, now: number, timeZone: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return t('ui.common.time.now');
  if (minutes < 60) return t('ui.common.time.minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('ui.common.time.hours', { n: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('ui.common.time.yesterday');
  if (days < 7) return t('ui.common.time.days', { n: days });
  return shortDate(iso, timeZone);
}

/** CRM-002 — a duration in business time: « 1 j 4 h », « 3 h », « 25 min ». */
export function businessDuration(minutes: number, workdayMinutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const perDay = workdayMinutes > 0 ? workdayMinutes : 540;
  const days = Math.floor(m / perDay);
  const hours = Math.floor((m - days * perDay) / 60);
  if (days > 0) return hours > 0 ? t('ui.admin-shell.format.daysHours', { j: days, h: hours }) : t('ui.admin-shell.format.days', { j: days });
  if (hours > 0) return t('ui.admin-shell.format.hours', { h: hours });
  return t('ui.admin-shell.format.minutes', { n: Math.max(1, m) });
}

/** TRV-021 — an amount is always followed by its currency. */
export function money(amount: string | number, currency: string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  const symbols: Record<string, string> = { EUR: '€', DZD: 'DA', USD: '$', CAD: '$ CA', GBP: '£', CHF: 'CHF' };
  const digits = Number.isInteger(value) ? 0 : 2;
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)} ${symbols[currency] ?? currency}`;
}

/** « Prénom Nom » of a staff member; « Utilisateur supprimé » when the account is gone (MOD-100). */
export function staffLabel(name: string | null | undefined): string {
  return name || t('ui.common.deletedUser');
}

/** « NOM Prénom » of a staff member in a list sorted by name. */
export function memberName(m: { firstName: string | null; lastName: string | null; email?: string }): string {
  return [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || DASH;
}
