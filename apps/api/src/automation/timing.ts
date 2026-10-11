// AUT-004 (delay and new tries), AUT-006 (quiet hours), AUT-008 (ceiling) — the time arithmetic of the engine. Pure.
import { addBusinessDays, addBusinessMinutes, type BusinessCalendar } from '@dp/domain';
import { createTranslator } from '@dp/i18n';
import type { DelayUnit } from './rule-definition.js';

const MINUTE = 60_000;
const t = createTranslator('fr');

/** AUT-004 point 2 — `scheduledFor` = date of the event + delay of the rule; « 3 jours ouvrés » has one meaning (CAL-060). */
export function scheduledFor(occurredAt: Date, delayValue: number, delayUnit: DelayUnit, cal: BusinessCalendar): Date {
  if (delayValue <= 0) return new Date(occurredAt);
  switch (delayUnit) {
    case 'MINUTES':
      return new Date(occurredAt.getTime() + delayValue * MINUTE);
    case 'HOURS':
      return new Date(occurredAt.getTime() + delayValue * 60 * MINUTE);
    case 'DAYS':
      return new Date(occurredAt.getTime() + delayValue * 24 * 60 * MINUTE);
    case 'BUSINESS_HOURS':
      return addBusinessMinutes(occurredAt, delayValue * 60, cal);
    case 'BUSINESS_DAYS':
      return addBusinessDays(occurredAt, delayValue, cal);
  }
}

/** AUT-036 `{{rule.delayLabel}}` — « 4 heures ouvrées »; follows the delay set on the rule. */
export function delayLabel(delayValue: number, delayUnit: DelayUnit): string {
  return t(`ui.automation.delay.${delayUnit}`, { n: delayValue });
}

/** AUT-004 point 4 — a failed action is replayed three times: after 1 minute, 10 minutes, 1 hour. */
export const ACTION_RETRY_MS = [MINUTE, 10 * MINUTE, 60 * MINUTE] as const;

/** Date of the next try after the `failures`-th failure, or null when the tries are used up (the execution is FAILED). */
export function nextAttemptAt(failures: number, now: Date): Date | null {
  const wait = ACTION_RETRY_MS[failures - 1];
  return wait === undefined ? null : new Date(now.getTime() + wait);
}

function localParts(instant: Date, timeZone: string): { date: string; hm: string } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hm: `${get('hour')}:${get('minute')}` };
}

/** The UTC instant of a wall time (`YYYY-MM-DD`, `HH:MM`) in a time zone (a non-existent hour moves to the next one, AUT-081). */
export function zonedInstant(date: string, hm: string, timeZone: string): Date {
  const guess = new Date(`${date}T${hm}:00Z`);
  // Offset of the zone at the guessed instant, applied twice to settle around a change of hour.
  let instant = guess;
  for (let i = 0; i < 2; i++) {
    const local = localParts(instant, timeZone);
    const asUtc = new Date(`${local.date}T${local.hm}:00Z`);
    instant = new Date(instant.getTime() + (guess.getTime() - asUtc.getTime()));
  }
  return instant;
}

export function localDay(instant: Date, timeZone: string): string {
  return localParts(instant, timeZone).date;
}

/** `YYYY-MM-DD` plus a number of calendar days. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export interface QuietHours {
  start: string;
  end: string;
}

/** AUT-006 — inside the quiet hours (`start` › `end`, possibly over midnight). */
export function isQuiet(now: Date, quiet: QuietHours, timeZone: string): boolean {
  const { hm } = localParts(now, timeZone);
  return quiet.start > quiet.end ? hm >= quiet.start || hm < quiet.end : hm >= quiet.start && hm < quiet.end;
}

/** AUT-006 — the end of the current quiet period (8:00 by default), in the recipient's time zone. */
export function quietEnd(now: Date, quiet: QuietHours, timeZone: string): Date {
  const { date, hm } = localParts(now, timeZone);
  // Over midnight and still before midnight: the period ends tomorrow.
  const day = quiet.start > quiet.end && hm >= quiet.start ? addDays(date, 1) : date;
  return zonedInstant(day, quiet.end, timeZone);
}

/** AUT-008 — a reminder beyond the daily ceiling is put off to the next day, at the end of the quiet hours. */
export function nextDayStart(now: Date, quiet: QuietHours, timeZone: string): Date {
  return zonedInstant(addDays(localParts(now, timeZone).date, 1), quiet.end, timeZone);
}

/** Start of the recipient's day (for the count of AUT-008). */
export function dayStart(now: Date, timeZone: string): Date {
  return zonedInstant(localParts(now, timeZone).date, '00:00', timeZone);
}
