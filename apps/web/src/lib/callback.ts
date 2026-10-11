// DEM-008 — « Quand vous appeler ? »: the next five WORKED days of the team calendar (PAR-030), holidays excluded;
// the moments of the day are read in the visitor's time zone and offered only if at least one hour of the slot,
// converted into the calendar time zone, falls within the worked hours.
import type { PublicSettings } from '@dp/contracts';

export const SLOT_HOURS = {
  MORNING: [9, 12],
  NOON: [12, 14],
  AFTERNOON: [14, 18],
  EVENING: [18, 20],
} as const;
export type Slot = keyof typeof SLOT_HOURS;

function partsIn(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')), weekday: wd };
}

/** The next five worked days (YYYY-MM-DD, calendar time zone), from tomorrow. */
export function callbackDays(settings: PublicSettings, now = new Date()): string[] {
  const tz = settings['business.calendar.timezone'];
  const workdays = new Set(settings['business.calendar.workdays']);
  const holidays = new Set(settings.holidays);
  const out: string[] = [];
  for (let i = 1; out.length < 5 && i < 30; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const p = partsIn(d, tz);
    if (workdays.has(p.weekday) && !holidays.has(p.date)) out.push(p.date);
  }
  return out;
}

/** Slots offered to a visitor in `callerTz` (DEM-008): at least one hour of the slot inside the worked hours. */
export function callbackSlots(settings: PublicSettings, callerTz: string, now = new Date()): Slot[] {
  const tz = settings['business.calendar.timezone'];
  const start = Number(settings['business.calendar.start'].slice(0, 2));
  const end = Number(settings['business.calendar.end'].slice(0, 2));
  // Offset between the caller's zone and the calendar zone, in hours, at the current date.
  const caller = partsIn(now, callerTz);
  const team = partsIn(now, tz);
  let diff = team.hour - caller.hour;
  if (team.date > caller.date) diff += 24;
  if (team.date < caller.date) diff -= 24;
  return (Object.keys(SLOT_HOURS) as Slot[]).filter((slot) => {
    const [from, to] = SLOT_HOURS[slot];
    for (let h = from; h < to; h++) {
      const teamHour = h + diff;
      if (teamHour >= start && teamHour < end) return true;
    }
    return false;
  });
}

export function dayOptionLabel(isoDate: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}
