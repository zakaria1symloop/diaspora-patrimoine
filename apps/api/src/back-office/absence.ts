// CRM-021 — the absence of a member of the team: `Membership.absentUntil` is the LAST day of the absence (a date). It
// is read against « today » in the time zone of the business calendar; the return is automatic the next day at
// `business.calendar.start` (`leads/assignment.ts` `returnAt`). A date already past therefore means « present »
// everywhere without any clean-up: it is simply not shown any more.
import { STAFF_ABSENCE_MAX_DAYS } from '@dp/contracts';
import { AppError } from '../platform/errors.js';

/** The calendar day of an instant in a time zone (`AAAA-MM-JJ`). */
export function dayIn(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/** The last day of the absence while it is today or later, else null. */
export function currentAbsence(absentUntil: Date | null | undefined, today: string): string | null {
  if (!absentUntil) return null;
  const last = absentUntil.toISOString().slice(0, 10);
  return last >= today ? last : null;
}

/**
 * The value to store for a day typed by a person: a real calendar day, today or later (422 `DATE_NOT_FUTURE`), at most
 * a year ahead (422 `INVALID_DATE`); null empties the absence (« Je suis de retour »).
 */
export function absenceToStore(day: string | null, today: string, field = 'absentUntil'): Date | null {
  if (day === null) return null;
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw AppError.validation([{ field, code: 'INVALID_DATE' }]);
  if (day < today) throw AppError.validation([{ field, code: 'DATE_NOT_FUTURE' }]);
  const max = new Date(new Date(`${today}T00:00:00Z`).getTime() + STAFF_ABSENCE_MAX_DAYS * 86_400_000).toISOString().slice(0, 10);
  if (day > max) throw AppError.validation([{ field, code: 'INVALID_DATE' }]);
  return date;
}
