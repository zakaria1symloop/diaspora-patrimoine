// FIC-100 — view signal: one view per visitor (IP + browser fingerprint, hashed, kept 24 h in memory), per property and
// per day; known robots ignored; accumulated in memory and flushed every 5 minutes (task `stats.flush`) into
// PropertyDailyStat and Property.viewCount — a system write that does not touch `version` (MOD-007).
// SEC-070: 120 signals per IP per minute; beyond, ignored without error.
import { Controller, HttpCode, Injectable, Param, Post, Req, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { Clock } from '../platform/clock.js';
import { localDate } from '../platform/holidays.service.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp, RateLimiter } from '../platform/rate-limit.js';
import { log } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';

const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python-requests/i;
const FLUSH_MS = 5 * 60_000;

@Injectable()
export class ViewCounter implements OnModuleInit, OnModuleDestroy {
  private seen = new Map<string, number>(); // key → expiry ms
  private pending = new Map<string, number>(); // `${propertyId}|${day}` → views
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), FLUSH_MS);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  async record(reference: string, visitor: string): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: { reference: reference.toUpperCase(), publication: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!property) return;
    const now = this.clock.now();
    const day = localDate(now, await this.settings.get('business.calendar.timezone'));
    const key = `${visitor}|${property.id}|${day}`;
    const exp = this.seen.get(key);
    if (exp && exp > now.getTime()) return;
    this.seen.set(key, now.getTime() + 86_400_000);
    const pk = `${property.id}|${day}`;
    this.pending.set(pk, (this.pending.get(pk) ?? 0) + 1);
  }

  async flush(): Promise<void> {
    const now = this.clock.now();
    for (const [k, exp] of this.seen) if (exp <= now.getTime()) this.seen.delete(k);
    if (this.pending.size === 0) return;
    const batch = [...this.pending.entries()];
    this.pending.clear();
    for (const [pk, views] of batch) {
      const [propertyId, day] = pk.split('|') as [string, string];
      try {
        await this.prisma.$transaction([
          this.prisma.$executeRaw`
            INSERT INTO property_daily_stats (property_id, day, views, interests, created_at, updated_at)
            VALUES (${propertyId}::uuid, ${day}::date, ${views}, 0, ${now}, ${now})
            ON CONFLICT (property_id, day) DO UPDATE SET views = property_daily_stats.views + ${views}, updated_at = ${now}`,
          this.prisma.$executeRaw`UPDATE properties SET view_count = view_count + ${views} WHERE id = ${propertyId}::uuid`,
        ]);
      } catch (e) {
        // Counted again at the next flush rather than lost.
        this.pending.set(pk, (this.pending.get(pk) ?? 0) + views);
        log('warn', 'stats.flush.failed', { message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' });
      }
    }
  }
}

@Controller('public/properties')
export class ViewController {
  constructor(
    private readonly counter: ViewCounter,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
  ) {}

  @Post(':reference/view')
  @HttpCode(204)
  async view(@Param('reference') reference: string, @Req() req: Request): Promise<void> {
    const ua = req.headers['user-agent'] ?? '';
    if (BOTS.test(ua)) return;
    const ipHash = this.ip.hash(req);
    if (this.limiter.wouldExceed(`view:${ipHash}`, { limit: 120, windowSeconds: 60 })) return;
    this.limiter.hit(`view:${ipHash}`, { limit: 120, windowSeconds: 60 });
    const visitor = createHash('sha256').update(`${ipHash}|${ua}`).digest('hex').slice(0, 24);
    await this.counter.record(reference, visitor);
  }
}
