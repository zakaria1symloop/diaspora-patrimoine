// CAL-070, CYC-060 — the cached score and status of a client record stay true:
//   · `client.status` (3 h, AUT-083 table): every record recomputed — a client becomes « Inactif » with time alone, and
//     a score that lagged (a change made where no refresh was written) is caught up;
//   · « son compte » (CAL-070): the account created (`client.account_invited`) and activated (`client.account_activated`,
//     e-mail verified) change the score — recomputed as soon as the event leaves the outbox.
// The other changes CAL-070 names (the record, an eligibility simulation, a request, a Café) refresh in their own
// transaction (`refreshClientCaches`).
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Scheduler, type JobContext } from '../automation/scheduler.js';
import { refreshClientCaches } from '../leads/lead-records.js';
import { Clock } from '../platform/clock.js';
import { OutboxHandlers, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';

const PAGE = 200;

@Injectable()
export class ClientCachesJobs implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly scheduler: Scheduler,
    private readonly handlers: OutboxHandlers,
  ) {}

  onModuleInit(): void {
    this.scheduler.register({ name: 'client.status', schedule: { dailyAt: '03:00' }, run: (ctx) => this.nightly(ctx) });
    this.handlers.register({ name: 'client.account-score', types: ['client.account_invited', 'client.account_activated'], handle: (e) => this.onAccount(e) });
  }

  /** CYC-060 — every live record, page by page; each in its own short transaction. */
  async nightly(ctx: Pick<JobContext, 'now'>): Promise<Record<string, number>> {
    const inactiveDays = await this.settings.get('clients.inactiveAfterDays');
    let cursor: string | undefined;
    let seen = 0;
    for (;;) {
      const page = await this.prisma.client.findMany({
        where: { deletedAt: null, mergedIntoId: null, gdprErasedAt: null },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: PAGE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      for (const c of page) await this.prisma.$transaction((tx) => refreshClientCaches(tx, c.id, ctx.now, inactiveDays));
      seen += page.length;
      if (page.length < PAGE) break;
      cursor = page[page.length - 1]!.id;
    }
    return { clients: seen };
  }

  /** CAL-070 « son compte » — the record of the event (`aggregateId`). */
  private async onAccount(e: OutboxRecord): Promise<void> {
    const client = await this.prisma.client.findFirst({ where: { id: e.aggregateId, deletedAt: null }, select: { id: true } });
    if (!client) return;
    const inactiveDays = await this.settings.get('clients.inactiveAfterDays');
    await this.prisma.$transaction((tx) => refreshClientCaches(tx, client.id, this.clock.now(), inactiveDays));
  }
}
