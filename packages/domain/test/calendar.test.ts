import { describe, expect, test } from 'vitest';
import {
  addBusinessDays,
  addBusinessMinutes,
  businessDaysFromMinutes,
  businessMinutesBetween,
  firstContactDueAt,
  isBusinessInstant,
  isHoliday,
  isLate,
  stageDueAt,
  workdayMinutes,
  type BusinessCalendar,
} from '../src/index.js';

// PAR-030 defaults and PAR-031 holidays (recurring ones stored with the year 2000).
const CAL: BusinessCalendar = {
  timeZone: 'Europe/Paris',
  workdays: [1, 2, 3, 4, 5],
  start: '09:00',
  end: '18:00',
  holidays: [
    ...['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].map((md) => ({ date: `2000-${md}`, recurring: true })),
    ...['2026-04-06', '2026-05-14', '2026-05-25', '2027-03-29', '2027-05-06', '2027-05-17'].map((date) => ({ date, recurring: false })),
  ],
};
// October 2026 before the 25th: Paris = UTC+2.
const paris = (local: string, offset = '+02:00') => new Date(`${local}${offset}`);

describe('CAL-060 business calendar', () => {
  test('CAL-060 example: Friday 16:00 + 2 business days → Tuesday 16:00', () => {
    expect(addBusinessDays(paris('2026-10-09T16:00:00'), 2, CAL)).toEqual(paris('2026-10-13T16:00:00'));
  });

  test('CAL-060 example: Saturday 11:00 + 2 business days → Wednesday 09:00', () => {
    expect(addBusinessDays(paris('2026-10-10T11:00:00'), 2, CAL)).toEqual(paris('2026-10-14T09:00:00'));
  });

  test('CAL-060 example: Thursday 17:30 + 60 business minutes → Friday 09:30', () => {
    expect(addBusinessMinutes(paris('2026-10-08T17:30:00'), 60, CAL)).toEqual(paris('2026-10-09T09:30:00'));
  });

  test('CAL-060 negative minutes go back in business time: Friday 09:30 − 60 → Thursday 17:30', () => {
    expect(addBusinessMinutes(paris('2026-10-09T09:30:00'), -60, CAL)).toEqual(paris('2026-10-08T17:30:00'));
    expect(addBusinessMinutes(paris('2026-10-12T10:00:00'), -120, CAL)).toEqual(paris('2026-10-09T17:00:00'));
  });

  test('CAL-060 a non-business instant is first pushed to the next opening (before 09:00, after 18:00)', () => {
    expect(addBusinessDays(paris('2026-10-08T07:00:00'), 0, CAL)).toEqual(paris('2026-10-08T09:00:00'));
    expect(addBusinessDays(paris('2026-10-08T18:00:00'), 1, CAL)).toEqual(paris('2026-10-12T09:00:00'));
    expect(addBusinessMinutes(paris('2026-10-10T11:00:00'), 30, CAL)).toEqual(paris('2026-10-12T09:30:00'));
  });

  test('CAL-060 recurring holidays (stored with year 2000) and movable ones are skipped', () => {
    expect(isHoliday('2026-11-11', CAL.holidays)).toBe(true);
    expect(isHoliday('2026-05-14', CAL.holidays)).toBe(true);
    expect(isHoliday('2027-05-14', CAL.holidays)).toBe(false);
    // Tue 10 Nov 16:00 + 2 → Wed 11 Nov is a holiday → Fri 13 Nov 16:00 (UTC+1 in November)
    expect(addBusinessDays(paris('2026-11-10T16:00:00', '+01:00'), 2, CAL)).toEqual(paris('2026-11-13T16:00:00', '+01:00'));
    // Wed 13 May 2026 + 1 → Thu 14 May (Ascension) skipped → Fri 15 May
    expect(addBusinessDays(paris('2026-05-13T10:00:00'), 1, CAL)).toEqual(paris('2026-05-15T10:00:00'));
  });

  test('CAL-060 same wall-clock time across a DST change (25 October 2026)', () => {
    expect(addBusinessDays(paris('2026-10-23T16:00:00'), 2, CAL)).toEqual(paris('2026-10-27T16:00:00', '+01:00'));
  });

  test('CAL-060 business instant: working day, not holiday, between start (included) and end (excluded)', () => {
    expect(isBusinessInstant(paris('2026-10-08T09:00:00'), CAL)).toBe(true);
    expect(isBusinessInstant(paris('2026-10-08T18:00:00'), CAL)).toBe(false);
    expect(isBusinessInstant(paris('2026-10-10T11:00:00'), CAL)).toBe(false);
    expect(isBusinessInstant(paris('2026-11-11T11:00:00', '+01:00'), CAL)).toBe(false);
  });

  test('CAL-060 other time zone (Africa/Algiers, UTC+1)', () => {
    const alg = { ...CAL, timeZone: 'Africa/Algiers', holidays: [] };
    expect(addBusinessDays(new Date('2026-10-09T15:00:00Z'), 2, alg)).toEqual(new Date('2026-10-13T15:00:00Z'));
  });
});

describe('CAL-061 / CAL-062 deadlines', () => {
  test('CAL-061 first contact: createdAt + 2 business days (« sous 48 h ouvrées »)', () => {
    expect(firstContactDueAt(paris('2026-10-08T10:00:00'), CAL)).toEqual({ dueAt: paris('2026-10-12T10:00:00'), byCallback: false });
  });

  test('CAL-061 a later callback day replaces the deadline with the end of that day (18:00)', () => {
    expect(firstContactDueAt(paris('2026-10-08T10:00:00'), CAL, 2, '2026-10-15')).toEqual({ dueAt: paris('2026-10-15T18:00:00'), byCallback: true });
    expect(firstContactDueAt(paris('2026-10-08T10:00:00'), CAL, 2, '2026-10-12')).toEqual({ dueAt: paris('2026-10-12T10:00:00'), byCallback: false });
  });

  test('CAL-062 stage deadline: QUALIFICATION 5 business days, late once passed', () => {
    const due = stageDueAt(paris('2026-10-08T10:00:00'), 'QUALIFICATION', CAL);
    expect(due).toEqual(paris('2026-10-15T10:00:00'));
    expect(isLate(due, paris('2026-10-15T10:00:01'))).toBe(true);
    expect(isLate(due, paris('2026-10-15T09:59:59'))).toBe(false);
    expect(isLate(null, paris('2030-01-01T00:00:00'))).toBe(false);
  });
});

describe('CAL-063 measured durations', () => {
  test('CAL-063 business minutes between two instants (Thu 17:30 → Fri 09:30 = 60)', () => {
    expect(businessMinutesBetween(paris('2026-10-08T17:30:00'), paris('2026-10-09T09:30:00'), CAL)).toBe(60);
    expect(businessMinutesBetween(paris('2026-10-09T09:30:00'), paris('2026-10-08T17:30:00'), CAL)).toBe(-60);
  });

  test('CAL-063 a working day is 540 minutes; a full week = 5 business days', () => {
    expect(workdayMinutes(CAL)).toBe(540);
    const m = businessMinutesBetween(paris('2026-10-05T09:00:00'), paris('2026-10-12T09:00:00'), CAL);
    expect(m).toBe(2700);
    expect(businessDaysFromMinutes(m, CAL)).toBe(5);
  });

  test('CAL-063 inverse of addBusinessMinutes', () => {
    const from = paris('2026-10-08T15:12:00');
    const to = addBusinessMinutes(from, 1234, CAL);
    expect(businessMinutesBetween(from, to, CAL)).toBe(1234);
  });
});
