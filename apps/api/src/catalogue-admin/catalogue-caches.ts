// MOD-220 — every cache of a property and of its programme, recalculated INSIDE the transaction of the change.
// All calculations come from @dp/domain (CAL-010…CAL-031 card values, CAL-050 completeness, CAL-080 relevance,
// CAL-028 programme price); this file only gathers the facts and writes the results.
import { Injectable } from '@nestjs/common';
import { referenceFinancingSchema, type ReferenceFinancing } from '@dp/contracts';
import {
  programPriceFrom,
  propertyCompleteness,
  referenceCardValues,
  relevanceScore,
  type ConversionContext,
  type ExchangeRate as DomainRate,
  type PropertyCompleteness,
} from '@dp/domain';
import { Clock } from '../platform/clock.js';
import { newId } from '../platform/ids.js';
import { localDate } from '../platform/holidays.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { generateDescription, generateTitle, searchText, type DatePrecisionCode, type DeliveryStatusCode, type PropertyTypeCode } from './catalogue-texts.js';
import { lotAggregates, programCounters, type AvailabilityCode, type LotStatusCode, type PublicationCode } from './catalogue-rules.js';

export interface CacheContext {
  now: Date;
  today: string;
  conversion: ConversionContext & { referenceCurrency: string };
  financingDefault: ReferenceFinancing;
  financingByCountry: Map<string, ReferenceFinancing | null>;
  features: { tour360: boolean; poi: boolean };
  thresholds: { publishMinScore: number; completeScore: number };
  roomsPrefix: string;
  featureLabels: Map<string, string>;
}

export interface PropertyCacheResult {
  availabilityBefore: AvailabilityCode;
  availability: AvailabilityCode;
  completeness: PropertyCompleteness;
  /** CYC-120 condition 3 — a ready PHOTO, RENDER_3D or PLAN on the property or its lots, else on its programme. */
  hasReadyMedia: boolean;
  hasPricedLot: boolean;
}

const IMAGE = new Set(['PHOTO', 'RENDER_3D']);

export function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

@Injectable()
export class CatalogueCaches {
  constructor(
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  /** Settings and exchange rates read once per transaction. */
  async context(tx: Tx): Promise<CacheContext> {
    const s = await this.settings.all();
    const now = this.clock.now();
    const today = localDate(now, s['business.calendar.timezone']);
    const rates = await tx.exchangeRate.findMany({ where: { voidedAt: null } });
    const domainRates: DomainRate[] = rates.map((r) => ({
      base: r.fromCurrency,
      quote: r.toCurrency,
      rate: r.rate.toString(),
      kind: r.kind,
      asOf: r.asOf.toISOString().slice(0, 10),
      createdAt: r.createdAt.toISOString(),
    }));
    return {
      now,
      today,
      conversion: {
        rates: domainRates,
        kind: s['finance.exchangeRateKind'],
        referenceCurrency: s['display.referenceCurrency'],
        today,
        maxAgeDays: s['finance.exchangeRateMaxAgeDays'],
      },
      financingDefault: s['finance.reference.default'],
      financingByCountry: new Map(),
      features: { tour360: s['features.tour360'], poi: s['features.poi'] },
      thresholds: { publishMinScore: s['catalogue.publishMinScore'], completeScore: s['catalogue.completeScore'] },
      roomsPrefix: s['display.roomsPrefix'],
      featureLabels: new Map(s['catalogue.features'].map((f) => [f.code, f.labelFr])),
    };
  }

  /** CAL-030 step 1 — `finance.reference.{country}`, otherwise `finance.reference.default`. */
  private async financing(tx: Tx, ctx: CacheContext, countryCode: string): Promise<ReferenceFinancing> {
    if (!ctx.financingByCountry.has(countryCode)) {
      const row = await tx.setting.findUnique({ where: { key: `finance.reference.${countryCode}` } });
      const parsed = row ? referenceFinancingSchema.safeParse(row.value) : null;
      ctx.financingByCountry.set(countryCode, parsed?.success ? parsed.data : null);
    }
    return ctx.financingByCountry.get(countryCode) ?? ctx.financingDefault;
  }

  /** MOD-236 — ready media counts per family, own first, programme as fallback. */
  private async mediaFacts(tx: Tx, propertyId: string, lotIds: string[], programId: string | null) {
    const ready = { processingStatus: 'READY' as const, deletedAt: null };
    const own = await tx.media.findMany({ where: { ownerType: 'PROPERTY', ownerId: propertyId, ...ready }, select: { kind: true } });
    const lotPlans = lotIds.length
      ? await tx.media.count({ where: { ownerType: 'LOT', ownerId: { in: lotIds }, kind: 'PLAN', ...ready } })
      : 0;
    const prog = programId
      ? await tx.media.findMany({ where: { ownerType: 'PROGRAM', ownerId: programId, ...ready }, select: { kind: true } })
      : [];
    const count = (list: { kind: string }[], pred: (k: string) => boolean) => list.filter((m) => pred(m.kind)).length;
    return {
      ownImages: count(own, (k) => IMAGE.has(k)),
      programImages: count(prog, (k) => IMAGE.has(k)),
      ownPlans: count(own, (k) => k === 'PLAN') + lotPlans,
      programPlans: count(prog, (k) => k === 'PLAN'),
      ownVideos: count(own, (k) => k === 'VIDEO'),
      programVideos: count(prog, (k) => k === 'VIDEO'),
      panos: count(own, (k) => k === 'PANO_360'),
    };
  }

  /** MOD-240 — the row on the property wins over the programme's; an ACTIVE bank that accepts makes it eligible. */
  private async financingEligibility(tx: Tx, propertyId: string, programId: string | null) {
    const rows = await tx.financingEligibility.findMany({
      where: { OR: [{ propertyId }, ...(programId ? [{ programId }] : [])] },
      select: {
        bankId: true,
        propertyId: true,
        accepted: true,
        bank: {
          select: {
            status: true,
            deletedAt: true,
            bankProducts: { where: { financingType: 'ISLAMIC', isActive: true, deletedAt: null }, select: { id: true } },
          },
        },
      },
    });
    const byBank = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const current = byBank.get(r.bankId);
      if (!current || (r.propertyId && !current.propertyId)) byBank.set(r.bankId, r);
    }
    const accepting = [...byBank.values()].filter((r) => r.accepted && r.bank.status === 'ACTIVE' && !r.bank.deletedAt);
    return { financingEligible: accepting.length > 0, islamicFinancingEligible: accepting.some((r) => r.bank.bankProducts.length > 0) };
  }

  /** All the caches of one property (MOD-220), its auto title and description (MOD-210, MOD-211) included. */
  async recalcProperty(tx: Tx, propertyId: string, ctx?: CacheContext): Promise<PropertyCacheResult> {
    ctx ??= await this.context(tx);
    const p = await tx.property.findUniqueOrThrow({
      where: { id: propertyId },
      include: {
        program: { select: { id: true, name: true, latitude: true, longitude: true } },
        promoter: { select: { brandName: true, legalName: true } },
        region: { select: { nameFr: true } },
        city: { select: { nameFr: true } },
      },
    });
    const lots = await tx.lot.findMany({
      where: { propertyId, deletedAt: null },
      select: { id: true, status: true, price: true, surfaceM2: true },
    });
    const agg = lotAggregates(lots.map((l) => ({ status: l.status as LotStatusCode, price: l.price.toString(), surfaceM2: l.surfaceM2.toString() })));
    const financing = await this.financing(tx, ctx, p.countryCode);
    const card = referenceCardValues({ priceFrom: agg.priceFrom?.toString() ?? null, currency: p.priceCurrency }, financing, ctx.conversion);
    const media = await this.mediaFacts(tx, p.id, lots.map((l) => l.id), p.programId);
    const pois = await tx.propertyPoi.count({ where: { OR: [{ propertyId: p.id }, ...(p.programId ? [{ programId: p.programId }] : [])] } });
    const elig = await this.financingEligibility(tx, p.id, p.programId);

    const textInput = {
      type: p.type as PropertyTypeCode,
      rooms: p.rooms,
      surfaceM2: p.surfaceM2.toString(),
      cityName: p.city?.nameFr ?? null,
      regionName: p.region.nameFr,
      roomsPrefix: ctx.roomsPrefix,
    };
    const title = p.titleAuto ? generateTitle({ ...textInput, programName: p.program?.name ?? null }) : p.title;
    const description = p.descriptionAuto
      ? generateDescription({
          ...textInput,
          delivery: { status: p.deliveryStatus as DeliveryStatusCode, date: isoDate(p.deliveryDate), precision: p.deliveryDatePrecision as DatePrecisionCode },
          featureLabels: p.features.map((f) => ctx.featureLabels.get(f)).filter((l): l is string => Boolean(l)),
        })
      : p.description;

    const completeness = propertyCompleteness(
      {
        title,
        type: p.type,
        rooms: p.rooms,
        surface: p.surfaceM2.toString(),
        hasPricedLot: lots.length > 0,
        regionId: p.regionId,
        developerId: p.promoterId,
        deliveryStatus: p.deliveryStatus,
        deliveryDate: isoDate(p.deliveryDate),
        photoCount: media.ownImages,
        programPhotoCount: media.programImages,
        hasPlan: media.ownPlans > 0,
        programHasPlan: media.programPlans > 0,
        panoCount: media.panos,
        descriptionLength: description?.length ?? 0,
        descriptionAutoGenerated: p.descriptionAuto,
        featureCount: p.features.length,
        hasCoordinates: Boolean((p.latitude && p.longitude) || (p.program?.latitude && p.program?.longitude)),
        poiCount: pois,
      },
      ctx.features,
      ctx.thresholds,
    );
    const availabilityChanged = agg.availability !== p.availability;
    const relevance = relevanceScore(
      { availability: agg.availability, firstPublishedAt: p.firstPublishedAt, completenessScore: completeness.score, financingEligible: elig.financingEligible },
      ctx.now,
    );
    await tx.property.update({
      where: { id: p.id },
      data: {
        title,
        description,
        lotsTotal: agg.lotsTotal,
        lotsAvailable: agg.lotsAvailable,
        lotsTaken: agg.lotsTaken,
        availability: agg.availability,
        availabilityChangedAt: availabilityChanged ? ctx.now : p.availabilityChangedAt,
        priceFrom: agg.priceFrom?.toFixed(2) ?? null,
        priceTo: agg.priceTo?.toFixed(2) ?? null,
        surfaceMin: agg.surfaceMin?.toFixed(2) ?? null,
        surfaceMax: agg.surfaceMax?.toFixed(2) ?? null,
        priceFromRef: card.priceFromRef?.toFixed(2) ?? null,
        downPaymentRef: card.downPaymentRef?.toFixed(2) ?? null,
        monthlyFromRef: card.monthlyFromRef?.toFixed(2) ?? null,
        financingEligible: elig.financingEligible,
        islamicFinancingEligible: elig.islamicFinancingEligible,
        has360Tour: media.panos > 0,
        hasPlan: media.ownPlans > 0 || media.programPlans > 0,
        hasVideo: media.ownVideos > 0 || media.programVideos > 0,
        photoCount: media.ownImages > 0 ? media.ownImages : media.programImages,
        completenessScore: completeness.score,
        relevanceScore: relevance,
        searchText: searchText([title, p.program?.name, p.promoter.brandName ?? p.promoter.legalName, p.city?.nameFr, p.region.nameFr, p.reference]),
      },
    });
    // AUT-010 — `property.price_changed` (the price in the property's currency, never a rate move) and
    // `property.availability_changed` (also when the number of available lots moves): favourites listen (AUT-062).
    const priceBefore = p.priceFrom?.toFixed(2) ?? null;
    const priceAfter = agg.priceFrom?.toFixed(2) ?? null;
    const events: { type: string; payload: Record<string, unknown> }[] = [];
    if (p.firstPublishedAt && priceBefore !== priceAfter && priceBefore && priceAfter) {
      events.push({ type: 'property.price_changed', payload: { from: priceBefore, to: priceAfter, currency: p.priceCurrency } });
    }
    if (p.firstPublishedAt && (availabilityChanged || agg.lotsAvailable !== p.lotsAvailable)) {
      events.push({ type: 'property.availability_changed', payload: { from: p.availability, to: agg.availability, lotsAvailable: agg.lotsAvailable, lotsAvailableBefore: p.lotsAvailable } });
    }
    for (const e of events) {
      await tx.outboxEvent.create({
        data: { id: newId(), type: e.type, aggregateType: 'property', aggregateId: p.id, payload: e.payload as never, occurredAt: ctx.now, availableAt: ctx.now, createdAt: ctx.now, updatedAt: ctx.now },
      });
    }
    const ownReady = media.ownImages + media.ownPlans;
    const programReady = media.programImages + media.programPlans;
    return {
      availabilityBefore: p.availability,
      availability: agg.availability,
      completeness,
      hasReadyMedia: ownReady > 0 || programReady > 0,
      hasPricedLot: lots.length > 0,
    };
  }

  /** Program § 1 caches (CYC-127, CAL-028), from its non-deleted properties and their lots. */
  async recalcProgram(tx: Tx, programId: string): Promise<void> {
    const props = await tx.property.findMany({
      where: { programId, deletedAt: null },
      select: {
        publication: true,
        availability: true,
        priceFromRef: true,
        monthlyFromRef: true,
        lots: { where: { deletedAt: null }, select: { status: true, price: true, surfaceM2: true, statusChangedAt: true } },
      },
    });
    const counters = programCounters(
      props.map((p) => ({
        publication: p.publication as PublicationCode,
        lots: p.lots.map((l) => ({ status: l.status as LotStatusCode, price: l.price.toString(), surfaceM2: l.surfaceM2.toString(), statusChangedAt: l.statusChangedAt })),
      })),
    );
    const best = programPriceFrom(
      props.map((p) => ({
        priceFromRef: p.priceFromRef?.toString() ?? null,
        monthlyFromRef: p.monthlyFromRef?.toString() ?? null,
        isPublished: p.publication === 'PUBLISHED',
        isAvailable: p.availability === 'AVAILABLE',
      })),
    );
    await tx.program.update({
      where: { id: programId },
      data: {
        lotsTotal: counters.lotsTotal,
        lotsAvailable: counters.lotsAvailable,
        lotsHeld: counters.lotsHeld,
        lotsSold: counters.lotsSold,
        listedPropertyCount: counters.listedPropertyCount,
        lastSoldAt: counters.lastSoldAt,
        priceFrom: counters.priceFrom?.toFixed(2) ?? null,
        priceFromRef: best?.priceFromRef.toFixed(2) ?? null,
      },
    });
  }

  /** A property change: its caches, then its programme's (which read them). */
  async recalcPropertyAndProgram(tx: Tx, propertyId: string, ctx?: CacheContext): Promise<PropertyCacheResult> {
    const result = await this.recalcProperty(tx, propertyId, ctx);
    const p = await tx.property.findUniqueOrThrow({ where: { id: propertyId }, select: { programId: true } });
    if (p.programId) await this.recalcProgram(tx, p.programId);
    return result;
  }

  /** A programme change (media, rename, inherited fields): every property, then the programme. */
  async recalcProgramTree(tx: Tx, programId: string): Promise<void> {
    const ctx = await this.context(tx);
    const props = await tx.property.findMany({ where: { programId, deletedAt: null }, select: { id: true } });
    for (const p of props) await this.recalcProperty(tx, p.id, ctx);
    await this.recalcProgram(tx, programId);
  }
}
