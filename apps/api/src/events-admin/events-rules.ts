// Le Café — pure rules: EVT-003 reference, slug and default title; CYC-180 publication conditions; zoned times.
import { slugify } from '../platform/slug.js';

/** Parts of an instant in a time zone. */
export function zonedParts(instant: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) };
}

/** The instant of a wall-clock time (YYYY-MM-DD, HH:MM) in a time zone (DST-aware). */
export function zonedTimeToUtc(isoDate: string, time: string, timeZone: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const p = zonedParts(new Date(guess), timeZone);
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - guess;
  const first = new Date(guess - offset);
  const p2 = zonedParts(first, timeZone);
  const offset2 = Date.UTC(p2.year, p2.month - 1, p2.day, p2.hour, p2.minute) - first.getTime();
  return new Date(guess - offset2);
}

/** TRV-051, EVT-003 — `CAF-{année}-{mois}-{code du lieu}` (`CAF-2026-10-PAR`), from the local start date. */
export function eventReference(startsAt: Date, timeZone: string, locationCode: string): string {
  const p = zonedParts(startsAt, timeZone);
  return `CAF-${p.year}-${String(p.month).padStart(2, '0')}-${locationCode.toUpperCase()}`;
}

/** Default code of the place: its first three letters, unaccented, upper case (EVT-003). */
export function defaultLocationCode(locationLabel: string): string {
  return slugify(locationLabel).replace(/-/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
}

/** EVT-003 — `{lieu}-{jour}-{mois}-{année}`: `paris-17-octobre-2026`. */
export function eventSlug(locationLabel: string, startsAt: Date, timeZone: string): string {
  const long = new Intl.DateTimeFormat('fr-FR', { timeZone, day: 'numeric', month: 'long', year: 'numeric' }).format(startsAt);
  return slugify(`${locationLabel} ${long}`, 80);
}

/** EVT-003 — « Le Café – {lieu} – {date longue} »: « Le Café – Paris – samedi 17 octobre 2026 ». */
export function eventTitle(brandName: string, locationLabel: string, startsAt: Date, timeZone: string): string {
  const long = new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(startsAt);
  return `${brandName} – ${locationLabel} – ${long}`.slice(0, 120);
}

export interface EventPublicationFacts {
  locationLabel: string | null;
  cityName: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  capacity: number | null;
  venueAddress: string | null;
  now: Date;
}

/**
 * CYC-180 DRAFT → PUBLISHED — public place, city, dates, capacity and venue address filled; `startsAt` in the future.
 * Condition codes (to be added to API-102's closed list): VENUE_PUBLIC, CITY, DATES, CAPACITY, VENUE_ADDRESS,
 * STARTS_IN_FUTURE.
 */
export function eventPublicationMissing(f: EventPublicationFacts): string[] {
  const missing: string[] = [];
  if (!f.locationLabel?.trim()) missing.push('VENUE_PUBLIC');
  if (!f.cityName?.trim()) missing.push('CITY');
  if (!f.startsAt || !f.endsAt || f.endsAt <= f.startsAt) missing.push('DATES');
  if (!f.capacity || f.capacity < 1) missing.push('CAPACITY');
  if (!f.venueAddress?.trim()) missing.push('VENUE_ADDRESS');
  if (f.startsAt && f.startsAt <= f.now) missing.push('STARTS_IN_FUTURE');
  return missing;
}
