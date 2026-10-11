// Business calendar and deadlines (CAL-060…CAL-063, PAR-030, PAR-031). Pure: the current instant is always passed in
// (Clock, ARC-070); instants are UTC `Date`s, wall-clock arithmetic happens in the calendar time zone.

/** A row of the `Holiday` table: recurring holidays are stored with the year 2000 and match every year (PAR-031). */
export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  recurring: boolean;
}

/** PAR-030 — `business.calendar.*` and the `Holiday` table. */
export interface BusinessCalendar {
  /** IANA time zone (`Europe/Paris`). */
  timeZone: string;
  /** 1 = Monday … 7 = Sunday. */
  workdays: readonly number[];
  /** `HH:MM` */
  start: string;
  /** `HH:MM` */
  end: string;
  holidays: readonly Holiday[];
}

export type DossierStage = 'INTEREST' | 'QUALIFICATION' | 'MATCHING' | 'DOCUMENTS' | 'BANK_REVIEW' | 'APPROVED' | 'ACQUISITION';

/** CAL-062 / PAR-033 — default stage deadlines, in business days (Q-038). */
export const DEFAULT_STAGE_SLA_DAYS: Readonly<Record<DossierStage, number>> = {
  INTEREST: 1,
  QUALIFICATION: 5,
  MATCHING: 20,
  DOCUMENTS: 30,
  BANK_REVIEW: 45,
  APPROVED: 10,
  ACQUISITION: 90,
};

const MINUTE = 60_000;
const DAY_MS = 86_400_000;
const MAX_SCAN_DAYS = 3_700;

interface LocalDay {
  y: number;
  m: number;
  d: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Wall-clock date and milliseconds since local midnight of an instant in a time zone. */
function toLocal(instant: number, timeZone: string): { day: LocalDay; ms: number } {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(new Date(instant))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const ms = ((parts.hour! % 24) * 3600 + parts.minute! * 60 + parts.second!) * 1000 + (((instant % 1000) + 1000) % 1000);
  return { day: { y: parts.year!, m: parts.month!, d: parts.day! }, ms };
}

function offsetAt(instant: number, timeZone: string): number {
  const { day, ms } = toLocal(instant, timeZone);
  return Date.UTC(day.y, day.m - 1, day.d) + ms - instant;
}

/** Instant of a wall-clock time in a time zone (DST-aware). */
function toInstant(day: LocalDay, ms: number, timeZone: string): number {
  const wall = Date.UTC(day.y, day.m - 1, day.d) + ms;
  const first = wall - offsetAt(wall, timeZone);
  return wall - offsetAt(first, timeZone);
}

function shiftDay(day: LocalDay, delta: number): LocalDay {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d) + delta * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function iso(day: LocalDay): string {
  return `${String(day.y).padStart(4, '0')}-${String(day.m).padStart(2, '0')}-${String(day.d).padStart(2, '0')}`;
}

function parseIsoDay(s: string): LocalDay {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return { y, m, d };
}

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return (h * 60 + m) * MINUTE;
}

/** PAR-031 — a date is a holiday if listed, or if a recurring holiday has the same month and day. */
export function isHoliday(isoDate: string, holidays: readonly Holiday[]): boolean {
  const md = isoDate.slice(5);
  return holidays.some((h) => (h.recurring ? h.date.slice(5) === md : h.date === isoDate));
}

/** CAL-060 — a working day: listed in `workdays` and not a holiday. */
export function isWorkingDay(isoDate: string, cal: BusinessCalendar): boolean {
  const day = parseIsoDay(isoDate);
  const wd = ((new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay() + 6) % 7) + 1;
  return cal.workdays.includes(wd) && !isHoliday(isoDate, cal.holidays);
}

function working(day: LocalDay, cal: BusinessCalendar): boolean {
  return isWorkingDay(iso(day), cal);
}

function nextWorking(day: LocalDay, cal: BusinessCalendar, step = 1): LocalDay {
  let d = day;
  for (let i = 0; i < MAX_SCAN_DAYS; i++) {
    d = shiftDay(d, step);
    if (working(d, cal)) return d;
  }
  throw new RangeError('CAL-060: the calendar has no working day');
}

/** CAL-060 — an instant is a business instant if it falls on a working day, between the start (included) and the end (excluded). */
export function isBusinessInstant(instant: Date, cal: BusinessCalendar): boolean {
  const { day, ms } = toLocal(instant.getTime(), cal.timeZone);
  return working(day, cal) && ms >= parseTime(cal.start) && ms < parseTime(cal.end);
}

/**
 * CAL-060 — `ajouterJoursOuvrés(instant, j)`: a non-business instant is first pushed to the next opening; then `j`
 * working days are added, at the same wall-clock time. Fri 16:00 + 2 → Tue 16:00 · Sat 11:00 + 2 → Wed 09:00.
 */
export function addBusinessDays(instant: Date, days: number, cal: BusinessCalendar): Date {
  if (!Number.isInteger(days) || days < 0) throw new RangeError('CAL-060: days must be a non-negative integer');
  const start = parseTime(cal.start);
  const end = parseTime(cal.end);
  let { day, ms } = toLocal(instant.getTime(), cal.timeZone);
  if (!working(day, cal) || ms >= end) {
    day = nextWorking(day, cal);
    ms = start;
  } else if (ms < start) {
    ms = start;
  }
  for (let i = 0; i < days; i++) day = nextWorking(day, cal);
  return new Date(toInstant(day, ms, cal.timeZone));
}

/**
 * CAL-060 — `ajouterMinutesOuvrées(instant, m)`: consumes `m` minutes counting business time only; with a negative
 * `m`, goes back as many business minutes (CYC-032). Thu 17:30 + 60 → Fri 09:30.
 */
export function addBusinessMinutes(instant: Date, minutes: number, cal: BusinessCalendar): Date {
  const start = parseTime(cal.start);
  const end = parseTime(cal.end);
  let { day, ms } = toLocal(instant.getTime(), cal.timeZone);
  let remaining = Math.abs(minutes) * MINUTE;
  if (minutes >= 0) {
    if (!working(day, cal) || ms >= end) {
      day = nextWorking(day, cal);
      ms = start;
    } else if (ms < start) {
      ms = start;
    }
    for (;;) {
      const available = end - ms;
      if (remaining <= available) return new Date(toInstant(day, ms + remaining, cal.timeZone));
      remaining -= available;
      day = nextWorking(day, cal);
      ms = start;
    }
  }
  if (!working(day, cal) || ms <= start) {
    day = nextWorking(day, cal, -1);
    ms = end;
  } else if (ms > end) {
    ms = end;
  }
  for (;;) {
    const available = ms - start;
    if (remaining <= available) return new Date(toInstant(day, ms - remaining, cal.timeZone));
    remaining -= available;
    day = nextWorking(day, cal, -1);
    ms = end;
  }
}

/**
 * CAL-063 — business minutes between two instants (negative when `to` < `from`), as used for
 * `businessMinutesInPreviousStage`. Exact value; the caller stores it rounded as it needs.
 */
export function businessMinutesBetween(from: Date, to: Date, cal: BusinessCalendar): number {
  if (to.getTime() < from.getTime()) return -businessMinutesBetween(to, from, cal);
  const start = parseTime(cal.start);
  const end = parseTime(cal.end);
  const a = toLocal(from.getTime(), cal.timeZone);
  const b = toLocal(to.getTime(), cal.timeZone);
  const last = iso(b.day);
  let total = 0;
  let day = a.day;
  for (let i = 0; i < 100 * MAX_SCAN_DAYS; i++) {
    const key = iso(day);
    if (working(day, cal)) {
      const lo = Math.max(start, key === iso(a.day) ? a.ms : 0);
      const hi = Math.min(end, key === last ? b.ms : DAY_MS);
      if (hi > lo) total += hi - lo;
    }
    if (key === last) return total / MINUTE;
    day = shiftDay(day, 1);
  }
  throw new RangeError('CAL-063: interval too long');
}

/** CAL-063 — minutes of a working day (540 with the default calendar). */
export function workdayMinutes(cal: BusinessCalendar): number {
  return (parseTime(cal.end) - parseTime(cal.start)) / MINUTE;
}

/** CAL-063 — business minutes expressed in business days, to compare with the CAL-062 targets. */
export function businessDaysFromMinutes(minutes: number, cal: BusinessCalendar): number {
  return minutes / workdayMinutes(cal);
}

/** Closing instant of a local date (end of the business day), e.g. for a callback date (CAL-061). */
export function endOfBusinessDay(isoDate: string, cal: BusinessCalendar): Date {
  return new Date(toInstant(parseIsoDay(isoDate), parseTime(cal.end), cal.timeZone));
}

/** Local date (YYYY-MM-DD) of an instant in the calendar time zone. */
export function localDate(instant: Date, cal: BusinessCalendar): string {
  return iso(toLocal(instant.getTime(), cal.timeZone).day);
}

/**
 * CAL-061 — first-contact deadline: `ajouterJoursOuvrés(createdAt, sla.firstContactBusinessDays)` (default 2). A chosen
 * callback day later than that deadline replaces it with the end of that day (calendar closing time).
 */
export function firstContactDueAt(
  createdAt: Date,
  cal: BusinessCalendar,
  businessDays = 2,
  preferredCallbackDate?: string | null,
): { dueAt: Date; byCallback: boolean } {
  const due = addBusinessDays(createdAt, businessDays, cal);
  if (preferredCallbackDate && preferredCallbackDate > localDate(due, cal)) {
    return { dueAt: endOfBusinessDay(preferredCallbackDate, cal), byCallback: true };
  }
  return { dueAt: due, byCallback: false };
}

/** CAL-062 — stage deadline: `ajouterJoursOuvrés(stageEnteredAt, sla.stage.{STAGE})`. */
export function stageDueAt(
  stageEnteredAt: Date,
  stage: DossierStage,
  cal: BusinessCalendar,
  slaDays: Readonly<Record<DossierStage, number>> = DEFAULT_STAGE_SLA_DAYS,
): Date {
  return addBusinessDays(stageEnteredAt, slaDays[stage], cal);
}

/** CAL-062 — a dossier whose `slaDueAt` has passed is late. */
export function isLate(slaDueAt: Date | null, now: Date): boolean {
  return slaDueAt !== null && slaDueAt.getTime() < now.getTime();
}
