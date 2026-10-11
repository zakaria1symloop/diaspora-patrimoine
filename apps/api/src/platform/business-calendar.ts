// CAL-060, PAR-030, PAR-031 — the business calendar of @dp/domain, filled from the settings and the Holiday table.
import { Injectable } from '@nestjs/common';
import type { BusinessCalendar } from '@dp/domain';
import { PrismaService } from './prisma.service.js';
import { SettingsService } from './settings.service.js';
import type { Tx } from './tx.js';

@Injectable()
export class BusinessCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async load(db: Tx | PrismaService = this.prisma): Promise<BusinessCalendar> {
    const [timeZone, workdays, start, end, rows] = await Promise.all([
      this.settings.get('business.calendar.timezone'),
      this.settings.get('business.calendar.workdays'),
      this.settings.get('business.calendar.start'),
      this.settings.get('business.calendar.end'),
      db.holiday.findMany({ select: { date: true, recurring: true } }),
    ]);
    return {
      timeZone,
      workdays,
      start,
      end,
      holidays: rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), recurring: r.recurring })),
    };
  }
}

/** FIA-030, TRV-051 — next number of a reference counter, under the row lock of the upsert; never reused. */
export async function nextSequenceValue(tx: Tx, name: string, scope: string, now: Date): Promise<number> {
  const rows = await tx.$queryRawUnsafe<{ last_value: number }[]>(
    `INSERT INTO sequences (name, scope, last_value, created_at, updated_at) VALUES ($1, $2, 1, $3, $3)
     ON CONFLICT (name, scope) DO UPDATE SET last_value = sequences.last_value + 1, updated_at = $3
     RETURNING last_value`,
    name,
    scope,
    now,
  );
  return Number(rows[0]!.last_value);
}

/** TRV-051 — `DEM-{année}-{5 chiffres}` · `DOS-{année}-{4 chiffres}`; the year of creation in the calendar time zone. */
export const ReferenceFormat = {
  LEAD: { sequence: 'lead', prefix: 'DEM', digits: 5 },
  DOSSIER: { sequence: 'dossier', prefix: 'DOS', digits: 4 },
} as const;

export async function nextReference(tx: Tx, kind: keyof typeof ReferenceFormat, now: Date, timeZone: string): Promise<string> {
  const f = ReferenceFormat[kind];
  const year = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' }).format(now);
  const n = await nextSequenceValue(tx, f.sequence, year, now);
  return `${f.prefix}-${year}-${String(n).padStart(f.digits, '0')}`;
}
