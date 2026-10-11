// Display helpers of the client's tools pages (TRV-020: Intl only, French). A date-only value (`YYYY-MM-DD`) is read
// in UTC (it is a calendar day); an instant is shown in the business calendar time zone (TRV-030).
import type { Money } from '@dp/contracts';
import { formatMoney } from '@dp/i18n';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const zoneOf = (iso: string, tz: string) => (DAY.test(iso) ? 'UTC' : tz);
const dateOf = (iso: string) => new Date(DAY.test(iso) ? `${iso}T00:00:00Z` : iso);

/** « 9 octobre 2026 ». */
export function longDate(iso: string, tz = 'Europe/Paris'): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: zoneOf(iso, tz) }).format(dateOf(iso));
}

/** « 10 oct. » — the year only when it is not the current one. */
export function shortDate(iso: string, tz = 'Europe/Paris'): string {
  const d = dateOf(iso);
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: zoneOf(iso, tz) }).format(d);
}

/** `YYYY-MM-DD` of an instant in a zone (for « Au sujet de ma simulation du {date} »). */
export function isoDay(iso: string, tz = 'Europe/Paris'): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zoneOf(iso, tz) }).format(dateOf(iso));
}

/** True when the calendar day `day` is before today. */
export function isPast(day: string): boolean {
  return dateOf(day).getTime() < Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
}

/** SFA-010 — amounts « au centime » for a monthly payment, whole units otherwise; « ≈ » only before a converted amount. */
export function amount(m: Money, cents = false, approx = false): string {
  const v = formatMoney(cents ? Number(m.amount) : Math.round(Number(m.amount)), m.currency, 'fr-FR', cents ? 2 : 0);
  return approx ? `≈ ${v}` : v;
}

/** « 20 ans », « 20 ans et 6 mois », « 18 mois ». */
export function durationLabel(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y) return `${m} mois`;
  return m ? `${y} ${y > 1 ? 'ans' : 'an'} et ${m} mois` : `${y} ${y > 1 ? 'ans' : 'an'}`;
}

/** « 6,50 % ». */
export const rateLabel = (bps: number) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bps / 100)} %`;

/** « 1,2 Mo », « 340 Ko ». */
export function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}
