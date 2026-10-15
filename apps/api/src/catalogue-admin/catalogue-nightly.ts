// The scheduled task `catalogue.nightly` (3 h 30, 08-automatisations), each step idempotent:
//   · CYC-123 — a published property SOLD for `catalogue.soldVisibleDays` days (from `availabilityChangedAt`) is archived
//     (the same transition as the button, by the system: its page then answers 410, CYC-121);
//   · CAL-080 — the relevance score of every published property is recomputed (it depends on the date: freshness);
//   · AUT-074 — a published programme, isolated property or property with its own delivery, whose announced period has
//     ended (MOD-202) without `DELIVERED`, emits `program.delivery_overdue` (→ R_DELIVERY_OVERDUE), once per day;
//   · AUT-078 — a programme « Vendu » (CYC-127), still published, 180 days after its last sale, emits
//     `program.sold_out_review` (→ R_PROGRAM_SOLD_OUT), once;
//   · NAV-042 — the pages whose display depends on today's date are revalidated (« Nouveau », overdue delivery…).
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { SYSTEM_ACTOR } from '../admin/actor.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { emitFact } from '../automation/automation-jobs.js';
import { Scheduler, type JobContext } from '../automation/scheduler.js';
import { isOverdue } from '../catalogue/delivery.js';
import { log } from '../platform/request-context.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { localDate } from '../platform/holidays.service.js';
import { CatalogueCaches } from './catalogue-caches.js';
import { PropertiesAdminService } from './properties-admin.service.js';

const DAY = 86_400_000;
const SOLD_REVIEW_DAYS = 180;

@Injectable()
export class CatalogueNightly implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly scheduler: Scheduler,
    private readonly caches: CatalogueCaches,
    private readonly properties: PropertiesAdminService,
    private readonly notifier: ChangeNotifier,
  ) {}

  onModuleInit(): void {
    this.scheduler.register({ name: 'catalogue.nightly', schedule: { dailyAt: '03:30' }, run: (ctx) => this.run(ctx) });
  }

  async run(ctx: Pick<JobContext, 'now' | 'jobRunId'>): Promise<Record<string, number>> {
    const now = ctx.now;
    const today = localDate(now, await this.settings.get('business.calendar.timezone'));
    const out = { archived: 0, relevance: 0, overdue: 0, soldOut: 0 };

    // CYC-123 — sold long enough: archived
    const soldDays = await this.settings.get('catalogue.soldVisibleDays');
    const sold = await this.prisma.property.findMany({ where: { deletedAt: null, publication: 'PUBLISHED', availability: 'SOLD', availabilityChangedAt: { lte: new Date(now.getTime() - soldDays * DAY) } }, select: { id: true } });
    for (const p of sold) {
      try {
        await this.properties.archive(p.id, SYSTEM_ACTOR);
        out.archived++;
      } catch (err) {
        log('warn', 'catalogue.nightly.archive_failed', { propertyId: p.id, error: String(err) });
      }
    }

    // CAL-080 — the relevance of every published property (one short transaction each)
    const published = await this.prisma.property.findMany({ where: { deletedAt: null, publication: 'PUBLISHED' }, select: { id: true } });
    for (const p of published) {
      await this.prisma.$transaction((tx) => this.caches.recalcProperty(tx, p.id));
      out.relevance++;
    }

    // AUT-074 — overdue deliveries, programmes then properties that carry their own delivery
    const programs = await this.prisma.program.findMany({ where: { deletedAt: null, publication: 'PUBLISHED', deliveryDate: { not: null }, deliveryStatus: { not: 'DELIVERED' } }, select: { id: true, name: true, deliveryStatus: true, deliveryDate: true, deliveryDatePrecision: true } });
    for (const p of programs) {
      if (!isOverdue(p.deliveryStatus, p.deliveryDate, p.deliveryDatePrecision, today)) continue;
      if (await emitFact(this.prisma, now, { type: 'program.delivery_overdue', aggregate: { type: 'Program', id: p.id }, data: { id: p.id, label: p.name }, jobRunId: ctx.jobRunId, dedupeKey: `program.delivery_overdue:${p.id}:${today}` })) out.overdue++;
    }
    const own = await this.prisma.property.findMany({
      where: { deletedAt: null, publication: 'PUBLISHED', deliveryDate: { not: null }, deliveryStatus: { not: 'DELIVERED' }, OR: [{ programId: null }, { deliveryOverridden: true }] },
      select: { id: true, reference: true, title: true, deliveryStatus: true, deliveryDate: true, deliveryDatePrecision: true },
    });
    for (const p of own) {
      if (!isOverdue(p.deliveryStatus, p.deliveryDate, p.deliveryDatePrecision, today)) continue;
      if (await emitFact(this.prisma, now, { type: 'program.delivery_overdue', aggregate: { type: 'Property', id: p.id }, data: { id: p.id, label: `${p.title} (${p.reference})` }, jobRunId: ctx.jobRunId, dedupeKey: `program.delivery_overdue:${p.id}:${today}` })) out.overdue++;
    }

    // AUT-078, CYC-127 — « Vendu » (no lot free nor held, at least one sold), still published, 180 days after its last sale
    const soldOut = await this.prisma.program.findMany({
      where: { deletedAt: null, publication: 'PUBLISHED', lotsSold: { gt: 0 }, lotsAvailable: 0, lotsHeld: 0, lastSoldAt: { lte: new Date(now.getTime() - SOLD_REVIEW_DAYS * DAY) } },
      select: { id: true, name: true, lastSoldAt: true },
    });
    for (const p of soldOut) {
      if (await emitFact(this.prisma, now, { type: 'program.sold_out_review', aggregate: { type: 'Program', id: p.id }, data: { id: p.id, label: p.name }, jobRunId: ctx.jobRunId, dedupeKey: `program.sold_out_review:${p.id}:${p.lastSoldAt!.toISOString().slice(0, 10)}` })) out.soldOut++;
    }

    // NAV-042 — what depends on the date of the day
    await this.notifier.committed(['catalogue', 'home']);
    return out;
  }
}
