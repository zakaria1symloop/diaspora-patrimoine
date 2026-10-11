// CYC-181 public state, ACC-030 next Café, ACC-061 next three Cafés. Seats are re-read on each display (NAV-042).
import { Injectable } from '@nestjs/common';
import type { PublicEventCard, PublicEventState } from '@dp/contracts';
import { Clock } from '../platform/clock.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';

const CANCELLED_VISIBLE_DAYS = 7;

interface EventRow {
  slug: string;
  title: string;
  locationLabel: string;
  cityName: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  status: string;
  capacity: number;
  seatsTaken: number;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date;
  cancelledAt: Date | null;
  eventPartners: { promoterId: string | null; bankId: string | null }[];
}

@Injectable()
export class EventsPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
  ) {}

  state(e: EventRow, now: Date, showSeatsBelow: number): PublicEventState {
    if (e.status === 'CANCELLED') return { kind: 'CANCELLED' };
    if (e.status === 'CLOSED' || e.registrationClosesAt <= now) return { kind: 'CLOSED' };
    if (e.registrationOpensAt && e.registrationOpensAt > now) return { kind: 'OPENING', opensAt: e.registrationOpensAt.toISOString() };
    const left = Math.max(0, e.capacity - e.seatsTaken);
    if (left === 0) return { kind: 'FULL' };
    if (left <= showSeatsBelow) return { kind: 'FEW', seatsLeft: left };
    return { kind: 'OPEN' };
  }

  private toCard(e: EventRow, now: Date, showSeatsBelow: number): PublicEventCard {
    const visible = e.eventPartners;
    return {
      slug: e.slug,
      title: e.title,
      locationLabel: e.locationLabel,
      cityName: e.cityName,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      timezone: e.timezone,
      state: this.state(e, now, showSeatsBelow),
      hasPromoter: visible.some((p) => p.promoterId),
      hasBank: visible.some((p) => p.bankId),
    };
  }

  /** Published (or closed) Cafés still to come, plus cancelled ones for 7 days, by start date. */
  async upcoming(limit = 12): Promise<PublicEventCard[]> {
    if (!(await this.settings.get('features.cafe'))) return [];
    const now = this.clock.now();
    const showSeatsBelow = await this.settings.get('events.showSeatsBelow');
    const rows = await this.prisma.event.findMany({
      where: {
        deletedAt: null,
        startsAt: { gt: now },
        OR: [
          { status: { in: ['PUBLISHED', 'CLOSED'] } },
          { status: 'CANCELLED', cancelledAt: { gte: new Date(now.getTime() - CANCELLED_VISIBLE_DAYS * 86_400_000) } },
        ],
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        slug: true, title: true, locationLabel: true, cityName: true, startsAt: true, endsAt: true, timezone: true,
        status: true, capacity: true, seatsTaken: true, registrationOpensAt: true, registrationClosesAt: true,
        cancelledAt: true,
        eventPartners: { where: { isPublic: true }, select: { promoterId: true, bankId: true } },
      },
    });
    return rows.map((r) => this.toCard(r, now, showSeatsBelow));
  }

  /** ACC-030 — next Café: open with seats › open and full › not yet open › none. */
  nextCafe(cards: PublicEventCard[]): PublicEventCard | null {
    const live = cards.filter((c) => c.state.kind !== 'CANCELLED' && c.state.kind !== 'CLOSED');
    return (
      live.find((c) => c.state.kind === 'OPEN' || c.state.kind === 'FEW') ??
      live.find((c) => c.state.kind === 'FULL') ??
      live.find((c) => c.state.kind === 'OPENING') ??
      null
    );
  }
}
