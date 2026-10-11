// Café display helpers (ACC-031, ACC-061, CYC-181). Dates in the time zone of the venue (TRV-031).
import type { PublicEventCard } from '@dp/contracts';

export function eventDateParts(e: PublicEventCard): { weekday: string; day: string; month: string; short: string; long: string } {
  const d = new Date(e.startsAt);
  const tz = e.timezone;
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: tz }).format(d);
  const weekdayShort = part({ weekday: 'short' }).replace('.', '');
  const shortWeekday = weekdayShort.charAt(0).toUpperCase() + weekdayShort.slice(1);
  return {
    weekday: part({ weekday: 'long' }),
    day: part({ day: 'numeric' }),
    month: part({ month: 'long' }),
    // « Sam. 17 octobre »
    short: `${shortWeekday}. ${part({ day: 'numeric', month: 'long' })}`,
    // « samedi 17 octobre »
    long: part({ weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

export function eventHours(e: PublicEventCard): { start: string; end: string } {
  const f = (iso: string) =>
    new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone: e.timezone })
      .format(new Date(iso))
      .replace(/:00$/, ' h')
      .replace(':', ' h ');
  return { start: f(e.startsAt), end: f(e.endsAt) };
}

export function shortDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: tz }).format(new Date(iso)).replace(/^1 /, '1er ');
}
