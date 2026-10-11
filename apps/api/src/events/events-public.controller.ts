// API-100 `GET /public/events`, `GET /public/events/{slug}` — CAF-002 (listed Cafés), CAF-010 … CAF-012 (one Café),
// NAV-041 (a past Café stays online 30 days, then 410). Seats are re-read on each display (NAV-042): no cache.
import { Controller, Get, Header, Param } from '@nestjs/common';
import { ErrorCode, type CafeDetail, type CafeListResponse, type CafePartner } from '@dp/contracts';
import { toPublicImage, type MediaRow } from '../catalogue/media.js';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { EventsPublicService } from './events-public.service.js';

const PAST_VISIBLE_DAYS = 30;
const MEDIA_SELECT = {
  id: true, ownerType: true, ownerId: true, kind: true, isCover: true, isIllustration: true, sortOrder: true,
  width: true, height: true, alt: true, roomLabel: true, renditions: true,
} as const;

@Controller('public/events')
export class EventsPublicController {
  constructor(
    private readonly events: EventsPublicService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
    private readonly index: CatalogueIndex,
  ) {}

  private async enabled(): Promise<void> {
    // NAV-003 / PAR-010: a feature switched off answers 404.
    if (!(await this.settings.get('features.cafe'))) throw AppError.notFound();
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(): Promise<CafeListResponse> {
    await this.enabled();
    const data = await this.events.upcoming(50);
    return { data, places: [...new Set(data.map((e) => e.locationLabel))] };
  }

  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  async detail(@Param('slug') slug: string): Promise<CafeDetail> {
    await this.enabled();
    const now = this.clock.now();
    const e = await this.prisma.event.findFirst({
      where: { slug, deletedAt: null, status: { in: ['PUBLISHED', 'CLOSED', 'DONE', 'CANCELLED'] } },
      include: {
        coverMedia: { select: MEDIA_SELECT },
        eventPartners: {
          where: { isPublic: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            promoter: { select: { slug: true, brandName: true, legalName: true, isPublic: true, status: true, logoMedia: { select: MEDIA_SELECT } } },
            bank: { select: { name: true, logoMedia: { select: MEDIA_SELECT } } },
            partner: { select: { name: true, logoMedia: { select: MEDIA_SELECT } } },
          },
        },
      },
    });
    if (!e) throw AppError.notFound();
    const past = e.endsAt <= now || e.status === 'DONE';
    if (past && now.getTime() - e.endsAt.getTime() > PAST_VISIBLE_DAYS * 86_400_000) throw new AppError(ErrorCode.GONE);
    const showSeatsBelow = await this.settings.get('events.showSeatsBelow');
    const url = this.index.mediaUrl;
    const img = (m: MediaRow | null | undefined, alt: string) => (m ? toPublicImage(url, m, alt) : null);
    const partners: CafePartner[] = e.eventPartners.flatMap((p): CafePartner[] => {
      if (p.promoter) {
        const name = p.promoter.brandName ?? p.promoter.legalName;
        const linkable = p.promoter.isPublic && p.promoter.status === 'ACTIVE';
        return [{ kind: 'PROMOTER', name, slug: linkable ? p.promoter.slug : null, logo: img(p.promoter.logoMedia as MediaRow | null, name) }];
      }
      if (p.bank) return [{ kind: 'BANK', name: p.bank.name, slug: null, logo: img(p.bank.logoMedia as MediaRow | null, p.bank.name) }];
      if (p.partner) return [{ kind: 'OTHER', name: p.partner.name, slug: null, logo: img(p.partner.logoMedia as MediaRow | null, p.partner.name) }];
      return [];
    });
    const upcoming = (await this.events.upcoming(4)).filter((c) => c.slug !== e.slug).slice(0, 3);
    return {
      slug: e.slug,
      title: e.title,
      locationLabel: e.locationLabel,
      cityName: e.cityName,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      timezone: e.timezone,
      state: past ? { kind: 'PAST' } : this.events.state(e, now, showSeatsBelow),
      hasPromoter: partners.some((p) => p.kind === 'PROMOTER'),
      hasBank: partners.some((p) => p.kind === 'BANK'),
      description: e.description,
      cancelReason: e.status === 'CANCELLED' ? e.cancelReason : null,
      maxSeatsPerRegistration: e.maxSeatsPerRegistration,
      seatsLeft: Math.max(0, e.capacity - e.seatsTaken),
      cover: img(e.coverMedia as MediaRow | null, e.title),
      partners,
      upcoming,
    };
  }
}
