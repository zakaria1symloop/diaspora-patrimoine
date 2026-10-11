// EP-04, EP-05 read side: property page (FIC-001 … FIC-090), programme page (FIC-110 … FIC-112), similar (CAL-081),
// slug history (NAV-040), unpublished objects (NAV-041). Exact coordinates never leave the API (FIC-060, TRV-045).
import { Injectable } from '@nestjs/common';
import type {
  CommercialState,
  ConstructionProgress,
  DetailRedirect,
  PropertyCard,
  ProgramDetail,
  PropertyDetail,
  PublicListItem,
  PublicLocation,
  PublicMediaSet,
  PublicPromoter,
} from '@dp/contracts';
import {
  convert,
  pricePerSquareMetre,
  pricePerSquareMetreRange,
  roundConvertedPrice,
  roundDisplayedPricePerSquareMetre,
  similarProperties,
  type ConversionContext,
} from '@dp/domain';
import { ErrorCode } from '@dp/contracts';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { CatalogueIndex } from './catalogue-index.js';
import { CatalogueService } from './catalogue.service.js';
import { pickCover, toPublicImage, mediaBase, type MediaRow } from './media.js';

const money = (amount: { toFixed(n: number): string } | number | null, currency: string) =>
  amount === null ? null : { amount: typeof amount === 'number' ? amount.toFixed(2) : amount.toFixed(2), currency };

/** FIC-060 — rounded to 0.005° (≈ 500 m cell). */
const approx = (v: number) => Math.round(Math.round(v / 0.005) * 0.005 * 1e6) / 1e6;

@Injectable()
export class CatalogueDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly index: CatalogueIndex,
    private readonly catalogue: CatalogueService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  private async conversion(): Promise<ConversionContext> {
    const [rates, kind, ref, maxAge, today] = await Promise.all([
      this.prisma.exchangeRate.findMany({
        where: { voidedAt: null },
        select: { fromCurrency: true, toCurrency: true, rate: true, kind: true, asOf: true, createdAt: true },
      }),
      this.settings.get('finance.exchangeRateKind'),
      this.settings.get('display.referenceCurrency'),
      this.settings.get('finance.exchangeRateMaxAgeDays'),
      this.index.today(),
    ]);
    return {
      rates: rates.map((r) => ({
        base: r.fromCurrency,
        quote: r.toCurrency,
        rate: r.rate.toString(),
        kind: r.kind,
        asOf: r.asOf.toISOString().slice(0, 10),
        createdAt: r.createdAt.toISOString(),
      })),
      kind,
      referenceCurrency: ref,
      today,
      maxAgeDays: maxAge,
    };
  }

  private async listItems(key: 'catalogue.amenities' | 'catalogue.features', codes: string[]): Promise<PublicListItem[]> {
    const list = await this.settings.get(key);
    return list
      .filter((i) => i.isActive && codes.includes(i.code))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => ({ code: i.code, label: i.labelFr, icon: i.icon ?? null }));
  }

  private async media(ownerIds: { type: 'PROPERTY' | 'PROGRAM'; id: string }[], titleForAlt: string): Promise<PublicMediaSet> {
    const rows = await this.prisma.media.findMany({
      where: {
        OR: ownerIds.map((o) => ({ ownerType: o.type, ownerId: o.id })),
        processingStatus: 'READY',
        deletedAt: null,
        isPublic: true,
      },
      select: {
        id: true, ownerType: true, ownerId: true, kind: true, isCover: true, isIllustration: true, sortOrder: true,
        width: true, height: true, alt: true, roomLabel: true, renditions: true, caption: true, externalUrl: true,
        storageKey: true, sizeBytes: true, mimeType: true,
      },
    });
    const url = this.index.mediaUrl;
    const order = (ownerId: string) => ownerIds.findIndex((o) => o.id === ownerId);
    const sorted = [...rows].sort((a, b) => order(a.ownerId) - order(b.ownerId) || a.sortOrder - b.sortOrder);
    const images = sorted.filter((m) => m.kind === 'PHOTO' || m.kind === 'RENDER_3D');
    // FIC-011: the cover first (of the property, else of the programme), then display order.
    const firstOwner = ownerIds.find((o) => images.some((m) => m.ownerId === o.id));
    const cover = firstOwner ? pickCover(images.filter((m) => m.ownerId === firstOwner.id) as MediaRow[]) : null;
    const ordered = cover ? [images.find((m) => m.id === cover.id)!, ...images.filter((m) => m.id !== cover.id)] : images;
    return {
      images: ordered.map((m) => ({ ...toPublicImage(url, m as MediaRow, titleForAlt), caption: m.caption, roomLabel: m.roomLabel })),
      plans: sorted.filter((m) => m.kind === 'PLAN' && m.mimeType !== 'application/pdf').map((m) => ({ ...toPublicImage(url, m as MediaRow, titleForAlt), caption: m.caption })),
      panos: sorted
        .filter((m) => m.kind === 'PANO_360')
        .map((m) => ({ ...toPublicImage(url, m as MediaRow, titleForAlt), roomLabel: m.roomLabel, caption: m.caption })),
      videos: sorted.filter((m) => m.kind === 'VIDEO' && m.externalUrl).map((m) => ({ id: m.id, url: m.externalUrl!, caption: m.caption })),
      brochure: (() => {
        const b = sorted.find((m) => m.kind === 'BROCHURE');
        return b ? { id: b.id, url: `${mediaBase(url, b)}/original.pdf`, sizeBytes: b.sizeBytes === null ? null : Number(b.sizeBytes) } : null;
      })(),
    };
  }

  private async promoter(promoterId: string): Promise<PublicPromoter> {
    const p = await this.prisma.promoter.findUniqueOrThrow({
      where: { id: promoterId },
      select: { id: true, slug: true, brandName: true, legalName: true, referencesPublic: true, logoMediaId: true },
    });
    const [logo, programCount] = await Promise.all([
      p.logoMediaId
        ? this.prisma.media.findFirst({
            where: { id: p.logoMediaId, processingStatus: 'READY', deletedAt: null },
            select: { id: true, ownerType: true, ownerId: true, kind: true, isCover: true, isIllustration: true, sortOrder: true, width: true, height: true, alt: true, roomLabel: true, renditions: true },
          })
        : null,
      this.prisma.program.count({ where: { promoterId, publication: 'PUBLISHED', deletedAt: null } }),
    ]);
    const name = p.brandName ?? p.legalName;
    return {
      slug: p.slug,
      name,
      logo: logo ? toPublicImage(this.index.mediaUrl, logo as MediaRow, name) : null,
      referencesPublic: p.referencesPublic,
      programCount,
    };
  }

  private async location(
    region: { id: string; nameFr: string; slug: string; latitude?: { toNumber(): number } | null; longitude?: { toNumber(): number } | null },
    city: { nameFr: string; slug: string; latitude?: { toNumber(): number } | null; longitude?: { toNumber(): number } | null } | null,
    coords: { lat: number | null; lng: number | null },
    poiOwner: { programId?: string; propertyId?: string },
  ): Promise<PublicLocation> {
    const [pois, travel] = await Promise.all([
      this.prisma.propertyPoi.findMany({
        where: poiOwner.propertyId ? { propertyId: poiOwner.propertyId } : { programId: poiOwner.programId },
        orderBy: { sortOrder: 'asc' },
        take: 5,
        select: { label: true, category: true, minutes: true, mode: true },
      }),
      this.prisma.travelTime.findMany({
        where: { regionId: region.id },
        orderBy: { minutes: 'asc' },
        select: { originCity: true, minutes: true, isDirect: true, note: true },
      }),
    ]);
    return {
      region: { name: region.nameFr, slug: region.slug },
      city: city ? { name: city.nameFr, slug: city.slug } : null,
      approx: coords.lat !== null && coords.lng !== null ? { lat: approx(coords.lat), lng: approx(coords.lng) } : null,
      // FIC-060 — without coordinates: centred on the town (zoom 12), else on the region (zoom 9).
      area:
        city?.latitude && city.longitude
          ? { lat: city.latitude.toNumber(), lng: city.longitude.toNumber(), zoom: 12 }
          : region.latitude && region.longitude
            ? { lat: region.latitude.toNumber(), lng: region.longitude.toNumber(), zoom: 9 }
            : null,
      pois,
      travelTimes: travel.map((t) => ({ fromCity: t.originCity, minutes: t.minutes, via: t.isDirect ? null : t.note })),
    };
  }

  private async progress(programId: string | null): Promise<ConstructionProgress | null> {
    if (!programId || !(await this.settings.get('features.constructionProgress'))) return null;
    const updates = await this.prisma.programUpdate.findMany({
      where: { programId, deletedAt: null },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, stage: true, percent: true, note: true, publishedAt: true },
    });
    const last = updates[0];
    if (!last) return null;
    const photos = await this.prisma.media.findMany({
      where: { ownerType: 'PROGRAM_UPDATE', ownerId: last.id, processingStatus: 'READY', deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, ownerType: true, ownerId: true, kind: true, isCover: true, isIllustration: true, sortOrder: true, width: true, height: true, alt: true, roomLabel: true, renditions: true },
    });
    return {
      stage: last.stage,
      percent: last.percent,
      publishedAt: last.publishedAt.toISOString(),
      note: last.note,
      photos: photos.map((m) => toPublicImage(this.index.mediaUrl, m as MediaRow, '')),
      history: [...updates].reverse().map((u) => ({ stage: u.stage, publishedAt: u.publishedAt.toISOString() })),
    };
  }

  private async redirectFor(type: 'PROPERTY' | 'PROGRAM', slug: string): Promise<DetailRedirect | null> {
    const h = await this.prisma.slugHistory.findFirst({ where: { entityType: type, slug }, select: { entityId: true } });
    if (!h) return null;
    if (type === 'PROPERTY') {
      const p = await this.prisma.property.findFirst({ where: { id: h.entityId, deletedAt: null }, select: { slug: true } });
      return p ? { redirect: `/biens/${p.slug}` } : null;
    }
    const p = await this.prisma.program.findFirst({ where: { id: h.entityId, deletedAt: null }, select: { slug: true } });
    return p ? { redirect: `/programmes/${p.slug}` } : null;
  }

  // ---------- property ----------

  async property(slugOrReference: string): Promise<PropertyDetail | DetailRedirect> {
    const p = await this.prisma.property.findFirst({
      where: { deletedAt: null, OR: [{ slug: slugOrReference }, { reference: slugOrReference.toUpperCase() }] },
      include: {
        region: { select: { id: true, nameFr: true, slug: true, latitude: true, longitude: true } },
        city: { select: { nameFr: true, slug: true, latitude: true, longitude: true } },
        program: true,
        lots: { where: { deletedAt: null }, orderBy: [{ price: 'asc' }, { sortOrder: 'asc' }] },
      },
    });
    if (!p) {
      const redirect = await this.redirectFor('PROPERTY', slugOrReference);
      if (redirect) return redirect;
      throw AppError.notFound();
    }
    // A reference in the address answers with the canonical slug (SIM-030 accepts references).
    if (p.slug !== slugOrReference) return { redirect: `/biens/${p.slug}` };
    if (p.publication === 'ARCHIVED') {
      throw new AppError(ErrorCode.GONE, { params: { programSlug: p.program?.publication === 'PUBLISHED' ? p.program.slug : null, regionSlug: p.region.slug } });
    }
    if (p.publication !== 'PUBLISHED' || (p.program && p.program.publication !== 'PUBLISHED')) throw AppError.notFound();

    const [ctx, currency, reference, rows] = await Promise.all([
      this.conversion(),
      this.settings.get('display.referenceCurrency'),
      this.settings.get('finance.reference.default'),
      this.index.rows(),
    ]);
    const indexed = rows.find((r) => r.id === p.id);
    const available = p.lots.filter((l) => l.status === 'AVAILABLE');
    const convertedOf = (price: { toString(): string }) => convert(price.toString(), p.priceCurrency, currency, ctx);
    const lots = available.map((l) => {
      const conv = convertedOf(l.price);
      const perM2 = pricePerSquareMetre(l.price.toString(), l.surfaceM2.toString());
      const perM2Conv = convert(perM2, p.priceCurrency, currency, ctx);
      return {
        reference: l.reference,
        floor: l.floor,
        surfaceM2: l.surfaceM2.toFixed(2),
        terraceM2: l.terraceM2 ? l.terraceM2.toFixed(2) : null,
        orientation: l.orientation,
        priceRef: conv ? money(roundConvertedPrice(conv.amount), currency) : null,
        price: money(l.price, p.priceCurrency)!,
        pricePerM2Ref: perM2Conv ? money(roundDisplayedPricePerSquareMetre(perM2Conv.amount), currency) : null,
        parkingIncluded: l.parkingIncluded,
      };
    });
    const perM2Native = available.map((l) => pricePerSquareMetre(l.price.toString(), l.surfaceM2.toString()));
    const range = pricePerSquareMetreRange(perM2Native);
    const rangeRef = range
      ? (() => {
          const lo = convert(range.min, p.priceCurrency, currency, ctx);
          const hi = convert(range.max, p.priceCurrency, currency, ctx);
          return lo && hi
            ? { min: money(roundDisplayedPricePerSquareMetre(lo.amount), currency)!, max: money(roundDisplayedPricePerSquareMetre(hi.amount), currency)! }
            : null;
        })()
      : null;
    const priceConv = p.priceFrom ? convertedOf(p.priceFrom) : null;
    const floors = available.map((l) => l.floor).filter((f): f is number => f !== null);
    const title = p.title;
    const [media, promoter, location, progress, features, amenities] = await Promise.all([
      this.media([{ type: 'PROPERTY', id: p.id }, ...(p.programId ? [{ type: 'PROGRAM' as const, id: p.programId }] : [])], title),
      this.promoter(p.promoterId),
      this.location(
        p.region,
        p.city,
        {
          lat: p.latitude?.toNumber() ?? p.program?.latitude?.toNumber() ?? null,
          lng: p.longitude?.toNumber() ?? p.program?.longitude?.toNumber() ?? null,
        },
        p.programId ? { programId: p.programId } : { propertyId: p.id },
      ),
      p.deliveryStatus === 'DELIVERED' ? null : this.progress(p.programId),
      this.listItems('catalogue.features', p.features),
      p.program ? this.listItems('catalogue.amenities', p.program.amenities) : Promise.resolve([]),
    ]);
    const cards = indexed ? await this.catalogue.toCards([indexed]) : [];
    const card = cards[0];
    const others = p.programId ? rows.filter((r) => r.program?.id === p.programId && r.id !== p.id) : [];
    return {
      id: p.id,
      reference: p.reference,
      slug: p.slug,
      title,
      description: p.description ?? '',
      descriptionAuto: p.descriptionAuto,
      type: p.type,
      rooms: p.rooms,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      surfaceMin: p.surfaceMin?.toFixed(2) ?? null,
      surfaceMax: p.surfaceMax?.toFixed(2) ?? null,
      terraceM2: p.terraceM2?.toFixed(2) ?? null,
      landM2: p.landM2?.toFixed(2) ?? null,
      standing: p.standing,
      delivery: card?.delivery ?? {
        status: p.deliveryStatus,
        date: p.deliveryDate ? p.deliveryDate.toISOString().slice(0, 10) : null,
        precision: p.deliveryDatePrecision,
        overdue: false,
      },
      availability: p.availability,
      label: card?.label ?? null,
      features,
      priceFromRef: money(p.priceFromRef, currency),
      priceIsFrom: p.priceFrom !== null && p.priceTo !== null && !p.priceFrom.equals(p.priceTo),
      priceFrom: money(p.priceFrom, p.priceCurrency),
      pricePerM2Ref: rangeRef,
      pricePerM2: range ? { min: money(range.min, p.priceCurrency)!, max: money(range.max, p.priceCurrency)! } : null,
      rateDate: priceConv?.rateDate ?? null,
      convertible: p.priceCurrency === currency || priceConv !== null,
      downPaymentRef: money(p.downPaymentRef, currency),
      monthlyFromRef: p.availability === 'AVAILABLE' ? money(p.monthlyFromRef, currency) : null,
      referenceFinancing: {
        durationMonths: reference.durationMonths,
        downPaymentPct: reference.downPaymentPct.toFixed(2),
        annualRateBps: reference.annualRateBps,
      },
      financingEligible: p.financingEligible,
      islamicFinancingEligible: p.islamicFinancingEligible,
      has360Tour: p.has360Tour,
      lotsAvailable: p.lotsAvailable,
      // FIC-033: no lots table for a single-lot property.
      lots: p.lotsTotal > 1 ? lots : [],
      floors: floors.length ? { min: Math.min(...floors), max: Math.max(...floors) } : null,
      parkingIncludedAll: available.length > 0 && available.every((l) => l.parkingIncluded === true),
      media,
      program: p.program
        ? {
            slug: p.program.slug,
            name: p.program.name,
            tagline: p.program.tagline,
            descriptionStart: p.program.description ? p.program.description.slice(0, 280) : null,
            totalUnits: p.program.totalUnits,
            amenities,
            guarantees: p.program.guarantees,
            otherProperties: await this.catalogue.toCards(others),
          }
        : null,
      progress,
      promoter,
      location,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      firstPublishedAt: p.firstPublishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      isPreview: false,
    };
  }

  /** CAL-081 — up to three similar properties; fewer than two → none (FIC-070). */
  async similar(slug: string): Promise<{ data: PropertyCard[]; regionCount: number }> {
    const rows = await this.index.rows();
    const target = rows.find((r) => r.slug === slug);
    if (!target) return { data: [], regionCount: 0 };
    const toCandidate = (r: (typeof rows)[number]) => ({
      id: r.id,
      countryCode: r.countryCode,
      regionId: r.region.id,
      type: r.type,
      availability: r.availability,
      isPublished: true,
      priceFromRef: r.priceFromRef === null ? null : String(r.priceFromRef),
    });
    const picked = similarProperties(toCandidate(target), rows.map(toCandidate));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const regionCount = rows.filter((r) => r.region.id === target.region.id && r.availability === 'AVAILABLE').length;
    return { data: await this.catalogue.toCards(picked.map((c) => byId.get(c.id)!)), regionCount };
  }

  // ---------- programme ----------

  async program(slug: string): Promise<ProgramDetail | DetailRedirect> {
    const p = await this.prisma.program.findFirst({
      where: { slug, deletedAt: null },
      include: { region: { select: { id: true, nameFr: true, slug: true, latitude: true, longitude: true } }, city: { select: { nameFr: true, slug: true, latitude: true, longitude: true } } },
    });
    if (!p) {
      const redirect = await this.redirectFor('PROGRAM', slug);
      if (redirect) return redirect;
      throw AppError.notFound();
    }
    if (p.publication === 'ARCHIVED') throw new AppError(ErrorCode.GONE, { params: { regionSlug: p.region.slug } });
    if (p.publication !== 'PUBLISHED') throw AppError.notFound();
    const [rows, currency, amenities, media, promoter, location, progress] = await Promise.all([
      this.index.rows(),
      this.settings.get('display.referenceCurrency'),
      this.listItems('catalogue.amenities', p.amenities),
      this.media([{ type: 'PROGRAM', id: p.id }], p.name),
      this.promoter(p.promoterId),
      this.location(p.region, p.city, { lat: p.latitude?.toNumber() ?? null, lng: p.longitude?.toNumber() ?? null }, { programId: p.id }),
      p.deliveryStatus === 'DELIVERED' ? null : this.progress(p.id),
    ]);
    const mine = rows.filter((r) => r.program?.id === p.id).sort((a, b) => (a.priceFromRef ?? Infinity) - (b.priceFromRef ?? Infinity));
    // CYC-127 — commercial state.
    const state: CommercialState =
      p.listedPropertyCount === 0
        ? 'UPCOMING'
        : p.lotsAvailable > 0
          ? 'ON_SALE'
          : p.lotsHeld > 0
            ? 'ALL_RESERVED'
            : p.lotsSold > 0
              ? 'SOLD'
              : 'WITHDRAWN';
    const cheapest = mine.find((r) => r.availability === 'AVAILABLE' && r.monthlyFromRef !== null);
    const others = rows
      .filter((r) => r.region.id === p.regionId && r.program && r.program.id !== p.id)
      .reduce((m, r) => (m.has(r.program!.id) ? m : m.set(r.program!.id, r)), new Map<string, (typeof rows)[number]>());
    const card = mine[0] ? (await this.catalogue.toCards([mine[0]]))[0] : null;
    const today = await this.index.today();
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      standing: p.standing,
      delivery: card?.delivery ?? {
        status: p.deliveryStatus,
        date: p.deliveryDate ? p.deliveryDate.toISOString().slice(0, 10) : null,
        precision: p.deliveryDatePrecision,
        overdue: false,
      },
      label: p.highlightLabel && (!p.highlightUntil || p.highlightUntil.toISOString().slice(0, 10) >= today) ? p.highlightLabel : null,
      totalUnits: p.totalUnits,
      amenities,
      guarantees: p.guarantees,
      priceFromRef: state === 'UPCOMING' ? null : money(p.priceFromRef, currency),
      monthlyFromRef: cheapest ? money(cheapest.monthlyFromRef, currency) : null,
      lotsAvailable: p.lotsAvailable,
      state,
      properties: await this.catalogue.toCards(mine),
      media,
      progress,
      promoter,
      location,
      otherPrograms: [...others.values()].slice(0, 3).map((r) => ({
        slug: r.program!.slug,
        name: r.program!.name,
        region: r.region.name,
        priceFromRef: money(r.priceFromRef, currency),
        cover: r.cover ? toPublicImage(this.index.mediaUrl, r.cover, r.program!.name) : null,
      })),
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      isPreview: false,
    };
  }
}
