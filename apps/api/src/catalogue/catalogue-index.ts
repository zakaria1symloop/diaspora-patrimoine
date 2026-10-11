// The listable catalogue, kept in memory for the public filters, counters and sorts (TRV-100: on the server).
// Refreshed at most every 30 s and invalidated by every catalogue write (ARC-075). No business decision reads it:
// a reservation or an interest always re-reads the database.
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { localDate } from '../platform/holidays.service.js';
import { deliveryBucket, isOverdue, type DatePrecision, type DeliveryStatus } from './delivery.js';
import { pickCover, type MediaRow } from './media.js';
import { mediaUrlOf } from '../files/public-media.controller.js';

export interface IndexedProperty {
  id: string;
  reference: string;
  slug: string;
  title: string;
  type: 'APARTMENT' | 'STUDIO' | 'DUPLEX' | 'VILLA' | 'LAND' | 'COMMERCIAL';
  rooms: number | null;
  standing: 'COMFORT' | 'STANDING' | 'PREMIUM';
  countryCode: string;
  region: { id: string; slug: string; name: string };
  city: { id: string; slug: string; name: string } | null;
  program: { id: string; slug: string; name: string; label: string | null; labelUntil: Date | null; lat: number | null; lng: number | null } | null;
  promoter: { id: string; slug: string; name: string };
  surfaceMin: number | null;
  surfaceMax: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  priceFromRef: number | null;
  downPaymentRef: number | null;
  monthlyFromRef: number | null;
  availability: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'WITHDRAWN';
  availabilityChangedAt: Date;
  delivery: { status: DeliveryStatus; date: Date | null; precision: DatePrecision; overdue: boolean; bucket: string };
  financingEligible: boolean;
  islamicFinancingEligible: boolean;
  has360Tour: boolean;
  firstPublishedAt: Date | null;
  featuredRank: number | null;
  relevanceScore: number;
  highlightLabel: string | null;
  highlightUntil: Date | null;
  lotsAvailable: number;
  lotsTaken: number;
  lat: number | null;
  lng: number | null;
  cover: MediaRow | null;
}

const TTL_MS = 30_000;

@Injectable()
export class CatalogueIndex {
  private cache: { at: number; rows: IndexedProperty[]; today: string } | null = null;
  private loading: Promise<IndexedProperty[]> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  invalidate(): void {
    this.cache = null;
  }

  async today(): Promise<string> {
    return localDate(this.clock.now(), await this.settings.get('business.calendar.timezone'));
  }

  /** Published, not deleted, in a catalogue country, and not WITHDRAWN (CAT-020). */
  async rows(): Promise<IndexedProperty[]> {
    const today = await this.today();
    if (this.cache && Date.now() - this.cache.at < TTL_MS && this.cache.today === today) return this.cache.rows;
    this.loading ??= this.load(today).finally(() => (this.loading = null));
    return this.loading;
  }

  private async load(today: string): Promise<IndexedProperty[]> {
    const soldVisibleDays = await this.settings.get('catalogue.soldVisibleDays');
    const soldSince = new Date(this.clock.now().getTime() - soldVisibleDays * 86_400_000);
    const props = await this.prisma.property.findMany({
      where: {
        deletedAt: null,
        publication: 'PUBLISHED',
        availability: { in: ['AVAILABLE', 'RESERVED', 'SOLD'] },
        country: { isCatalogueActive: true },
        promoter: { deletedAt: null, status: 'ACTIVE' },
        OR: [{ availability: { not: 'SOLD' } }, { availabilityChangedAt: { gte: soldSince } }],
      },
      select: {
        id: true, reference: true, slug: true, title: true, type: true, rooms: true, standing: true, countryCode: true,
        surfaceMin: true, surfaceMax: true, priceFrom: true, priceTo: true, priceFromRef: true, downPaymentRef: true,
        monthlyFromRef: true, availability: true, availabilityChangedAt: true, deliveryStatus: true, deliveryDate: true,
        deliveryDatePrecision: true, financingEligible: true, islamicFinancingEligible: true, has360Tour: true,
        firstPublishedAt: true, featuredRank: true, relevanceScore: true, highlightLabel: true, highlightUntil: true,
        lotsAvailable: true, lotsTaken: true, latitude: true, longitude: true,
        region: { select: { id: true, slug: true, nameFr: true } },
        city: { select: { id: true, slug: true, nameFr: true } },
        promoter: { select: { id: true, slug: true, brandName: true, legalName: true } },
        program: {
          select: {
            id: true, slug: true, name: true, highlightLabel: true, highlightUntil: true, latitude: true, longitude: true,
            publication: true, deletedAt: true,
          },
        },
      },
    });
    const ownerIds = [...new Set(props.flatMap((p) => [p.id, p.program?.id].filter((x): x is string => Boolean(x))))];
    const media = ownerIds.length
      ? await this.prisma.media.findMany({
          where: {
            ownerId: { in: ownerIds },
            ownerType: { in: ['PROPERTY', 'PROGRAM'] },
            kind: { in: ['PHOTO', 'RENDER_3D'] },
            processingStatus: 'READY',
            deletedAt: null,
            isPublic: true,
          },
          select: {
            id: true, ownerType: true, ownerId: true, kind: true, isCover: true, isIllustration: true, sortOrder: true,
            width: true, height: true, alt: true, roomLabel: true, renditions: true,
          },
        })
      : [];
    const byOwner = new Map<string, MediaRow[]>();
    for (const m of media) {
      const list = byOwner.get(m.ownerId) ?? [];
      list.push(m as MediaRow);
      byOwner.set(m.ownerId, list);
    }
    const num = (d: { toNumber(): number } | null) => (d === null ? null : d.toNumber());
    const rows: IndexedProperty[] = props
      // A property of an unpublished programme is not listable (CYC-126).
      .filter((p) => !p.program || (p.program.publication === 'PUBLISHED' && !p.program.deletedAt))
      .map((p) => {
        const precision = p.deliveryDatePrecision as DatePrecision;
        const status = p.deliveryStatus as DeliveryStatus;
        const cover = pickCover(byOwner.get(p.id) ?? []) ?? (p.program ? pickCover(byOwner.get(p.program.id) ?? []) : null);
        return {
          id: p.id,
          reference: p.reference,
          slug: p.slug,
          title: p.title,
          type: p.type,
          rooms: p.rooms,
          standing: p.standing,
          countryCode: p.countryCode,
          region: { id: p.region.id, slug: p.region.slug, name: p.region.nameFr },
          city: p.city ? { id: p.city.id, slug: p.city.slug, name: p.city.nameFr } : null,
          program: p.program
            ? {
                id: p.program.id,
                slug: p.program.slug,
                name: p.program.name,
                label: p.program.highlightLabel,
                labelUntil: p.program.highlightUntil,
                lat: num(p.program.latitude),
                lng: num(p.program.longitude),
              }
            : null,
          promoter: { id: p.promoter.id, slug: p.promoter.slug, name: p.promoter.brandName ?? p.promoter.legalName },
          surfaceMin: num(p.surfaceMin),
          surfaceMax: num(p.surfaceMax),
          priceFrom: num(p.priceFrom),
          priceTo: num(p.priceTo),
          priceFromRef: num(p.priceFromRef),
          downPaymentRef: num(p.downPaymentRef),
          monthlyFromRef: num(p.monthlyFromRef),
          availability: p.availability,
          availabilityChangedAt: p.availabilityChangedAt,
          delivery: {
            status,
            date: p.deliveryDate,
            precision,
            overdue: isOverdue(status, p.deliveryDate, precision, today),
            bucket: deliveryBucket(status, p.deliveryDate, precision, today),
          },
          financingEligible: p.financingEligible,
          islamicFinancingEligible: p.islamicFinancingEligible,
          has360Tour: p.has360Tour,
          firstPublishedAt: p.firstPublishedAt,
          featuredRank: p.featuredRank,
          relevanceScore: p.relevanceScore,
          highlightLabel: p.highlightLabel,
          highlightUntil: p.highlightUntil,
          lotsAvailable: p.lotsAvailable,
          lotsTaken: p.lotsTaken,
          lat: num(p.latitude) ?? num(p.program?.latitude ?? null),
          lng: num(p.longitude) ?? num(p.program?.longitude ?? null),
          cover,
        };
      });
    this.cache = { at: Date.now(), rows, today };
    return rows;
  }

  get mediaUrl(): string {
    return mediaUrlOf(this.env);
  }
}
