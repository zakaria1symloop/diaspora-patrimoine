// PAR-101 — public holidays of the next 60 days (business calendar, CAL-060), for the slots of DEM-008.
import { Injectable } from '@nestjs/common';
import { Clock } from './clock.js';
import { PrismaService } from './prisma.service.js';
import { SettingsService } from './settings.service.js';

/** YYYY-MM-DD of an instant in a time zone. */
export function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
  ) {}

  async next60Days(): Promise<string[]> {
    const tz = await this.settings.get('business.calendar.timezone');
    const from = localDate(this.clock.now(), tz);
    const to = addDays(from, 60);
    const rows = await this.prisma.holiday.findMany({ select: { date: true, recurring: true } });
    const out = new Set<string>();
    const years = [Number(from.slice(0, 4)), Number(to.slice(0, 4))];
    for (const row of rows) {
      const iso = row.date.toISOString().slice(0, 10);
      const candidates = row.recurring ? years.map((y) => `${y}${iso.slice(4)}`) : [iso];
      for (const c of candidates) if (c >= from && c <= to) out.add(c);
    }
    return [...out].sort();
  }
}
