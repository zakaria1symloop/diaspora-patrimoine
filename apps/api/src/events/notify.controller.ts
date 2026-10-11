// CAF-040 — « Me prévenir »: one e-mail at the opening of registrations (CAF-041). An identical request already
// recorded gives the same confirmation, without duplicate (MOD-019: unique (email, eventId, locationLabel) NULLS NOT
// DISTINCT). SEC-070: 10 per IP per hour. The answer is the same in every case (SEC-071).
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { AppError } from '../platform/errors.js';
import { Clock } from '../platform/clock.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp, RateLimiter } from '../platform/rate-limit.js';
import { SettingsService } from '../platform/settings.service.js';
import { parseOrThrow } from '../platform/validation.js';

const body = z.object({
  email: z.email({ error: 'INVALID_EMAIL' }).max(254),
  eventSlug: z.string().max(80).nullish(),
  locationLabel: z.string().max(80).nullish(),
});

@Controller('public/event-notify-requests')
export class NotifyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
    private readonly settings: SettingsService,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() raw: unknown, @Req() req: Request): Promise<Record<string, never>> {
    if (!(await this.settings.get('features.cafe'))) throw AppError.notFound();
    const input = parseOrThrow(body, raw);
    const wait = this.limiter.hit(`notify:${this.ip.hash(req)}`, { limit: 10, windowSeconds: 3600 });
    if (wait) throw AppError.rateLimited(wait);
    const email = input.email.trim().toLowerCase();
    let eventId: string | null = null;
    if (input.eventSlug) {
      const e = await this.prisma.event.findFirst({ where: { slug: input.eventSlug, deletedAt: null }, select: { id: true } });
      eventId = e?.id ?? null;
    }
    const locationLabel = eventId ? null : (input.locationLabel?.trim() || null);
    const existing = await this.prisma.eventNotifyRequest.findFirst({
      where: { email, eventId, locationLabel, notifiedAt: null },
      select: { id: true },
    });
    if (!existing) {
      const now = this.clock.now();
      const token = randomBytes(24).toString('base64url');
      await this.prisma.eventNotifyRequest.create({
        data: {
          id: newId(),
          email,
          eventId,
          locationLabel,
          unsubscribeTokenHash: createHash('sha256').update(token).digest('hex'),
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    return {};
  }
}
