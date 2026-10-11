// Pure catalogue rules: CYC-110 availability, MOD-220 lot aggregates, CYC-100 manual lot transitions,
// CYC-120 / CYC-125 publication conditions (API-102 condition codes), CYC-127 programme counters.
import { dec, type Decimal } from '@dp/domain';

export type LotStatusCode = 'AVAILABLE' | 'OPTIONED' | 'RESERVED' | 'SOLD' | 'WITHDRAWN';
export type AvailabilityCode = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'WITHDRAWN';
export type PublicationCode = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface LotFacts {
  status: LotStatusCode;
  price: Decimal | string | number;
  surfaceM2: Decimal | string | number;
  statusChangedAt?: Date;
}

/** CYC-110 — availability of a property from its non-deleted lots. */
export function availabilityOf(statuses: readonly LotStatusCode[]): AvailabilityCode {
  if (statuses.some((s) => s === 'AVAILABLE')) return 'AVAILABLE';
  if (statuses.some((s) => s === 'OPTIONED' || s === 'RESERVED')) return 'RESERVED';
  const remaining = statuses.filter((s) => s !== 'WITHDRAWN');
  if (remaining.length > 0 && remaining.every((s) => s === 'SOLD')) return 'SOLD';
  return 'WITHDRAWN';
}

export interface LotAggregates {
  lotsTotal: number;
  lotsAvailable: number;
  lotsTaken: number;
  availability: AvailabilityCode;
  priceFrom: Decimal | null;
  priceTo: Decimal | null;
  surfaceMin: Decimal | null;
  surfaceMax: Decimal | null;
}

/**
 * MOD-220 / 01-domaine/03 § 2 — counters, availability, and the price and surface ranges of the AVAILABLE lots;
 * without any, of the lots not withdrawn.
 */
export function lotAggregates(lots: readonly LotFacts[]): LotAggregates {
  const available = lots.filter((l) => l.status === 'AVAILABLE');
  const basis = available.length ? available : lots.filter((l) => l.status !== 'WITHDRAWN');
  const prices = basis.map((l) => dec(l.price.toString()));
  const surfaces = basis.map((l) => dec(l.surfaceM2.toString()));
  const min = (xs: Decimal[]) => (xs.length ? xs.reduce((a, b) => (b.lt(a) ? b : a)) : null);
  const max = (xs: Decimal[]) => (xs.length ? xs.reduce((a, b) => (b.gt(a) ? b : a)) : null);
  return {
    lotsTotal: lots.length,
    lotsAvailable: available.length,
    lotsTaken: lots.filter((l) => l.status === 'OPTIONED' || l.status === 'RESERVED' || l.status === 'SOLD').length,
    availability: availabilityOf(lots.map((l) => l.status)),
    priceFrom: min(prices),
    priceTo: max(prices),
    surfaceMin: min(surfaces),
    surfaceMax: max(surfaces),
  };
}

export interface ManualTransitionContext {
  externalSale: boolean;
  referencePending: boolean;
  /** A reservation `OPTION` or `RESERVED` is active on the lot (MOD-330). */
  hasActiveReservation: boolean;
}

/**
 * CYC-100 — transitions made by hand (off-platform sale or reservation, withdrawal, back on sale, sale correction).
 * Returns `null` when allowed, otherwise the refusal reason of API-102 / 07-design/03 § 4.
 */
export function manualLotTransitionRefusal(from: LotStatusCode, to: LotStatusCode, ctx: ManualTransitionContext): string | null {
  if (ctx.hasActiveReservation) return 'LOT_HAS_ACTIVE_RESERVATION';
  if (from === to) return 'TRANSITION_NOT_ALLOWED';
  if (from === 'AVAILABLE' && (to === 'RESERVED' || to === 'SOLD' || to === 'WITHDRAWN')) return null;
  if (from === 'WITHDRAWN' && to === 'AVAILABLE') return ctx.referencePending ? 'LOT_REFERENCE_PENDING' : null;
  if (from === 'RESERVED' && (to === 'AVAILABLE' || to === 'SOLD')) return ctx.externalSale ? null : 'LOT_HAS_ACTIVE_RESERVATION';
  if (from === 'SOLD' && to === 'AVAILABLE') return ctx.externalSale ? null : 'SALE_NOT_EXTERNAL';
  return 'TRANSITION_NOT_ALLOWED';
}

export interface PropertyPublicationFacts {
  /** Missing mandatory fields other than the price (CAL-050), from `propertyCompleteness`. */
  missingRequiredFields: readonly string[];
  hasPricedLot: boolean;
  /** Ready PHOTO, RENDER_3D or PLAN on the property (or its lots), else on its programme (MOD-236). */
  hasReadyMedia: boolean;
  completenessScore: number;
  publishMinScore: number;
  promoterActive: boolean;
  /** `null` for a standalone property. */
  programPublished: boolean | null;
  countryActive: boolean;
}

/** CYC-120 — every missing condition, in the order of API-102. */
export function propertyPublicationMissing(f: PropertyPublicationFacts): string[] {
  const missing: string[] = [];
  if (f.missingRequiredFields.length) missing.push('REQUIRED_FIELDS');
  if (!f.hasPricedLot) missing.push('LOT_WITH_PRICE');
  if (!f.hasReadyMedia) missing.push('READY_MEDIA');
  if (f.completenessScore < f.publishMinScore) missing.push('COMPLETENESS_SCORE');
  if (!f.promoterActive) missing.push('PROMOTER_ACTIVE');
  if (f.programPublished === false) missing.push('PROGRAM_PUBLISHED');
  if (!f.countryActive) missing.push('COUNTRY_ACTIVE');
  return missing;
}

export interface ProgramPublicationFacts {
  name: string | null;
  regionId: string | null;
  standing: string | null;
  deliveryStatus: string | null;
  deliveryDate: Date | string | null;
  descriptionLength: number;
  promoterActive: boolean;
  hasReadyMedia: boolean;
  countryActive: boolean;
}

/** CYC-125 — description of at least 100 characters (the 300 of CAL-050 are completeness points only). */
export function programPublicationMissing(f: ProgramPublicationFacts): string[] {
  const missing: string[] = [];
  const delivery = Boolean(f.deliveryStatus) && (f.deliveryStatus === 'DELIVERED' || Boolean(f.deliveryDate));
  if (!f.name?.trim() || !f.regionId || !f.standing || !delivery) missing.push('REQUIRED_FIELDS');
  if (f.descriptionLength < 100) missing.push('DESCRIPTION_LENGTH');
  if (!f.promoterActive) missing.push('PROMOTER_ACTIVE');
  if (!f.hasReadyMedia) missing.push('READY_MEDIA');
  if (!f.countryActive) missing.push('COUNTRY_ACTIVE');
  return missing;
}

export interface ProgramPropertyFacts {
  publication: PublicationCode;
  lots: readonly LotFacts[];
}

export interface ProgramCounters {
  lotsTotal: number;
  lotsAvailable: number;
  lotsHeld: number;
  lotsSold: number;
  listedPropertyCount: number;
  lastSoldAt: Date | null;
  priceFrom: Decimal | null;
}

/**
 * Program § 1 caches, CYC-127: lots of PUBLISHED properties, plus the SOLD lots of ARCHIVED ones; draft properties do
 * not count. `priceFrom` = smallest price of an AVAILABLE lot of a published property.
 */
export function programCounters(properties: readonly ProgramPropertyFacts[]): ProgramCounters {
  let lotsTotal = 0;
  let lotsAvailable = 0;
  let lotsHeld = 0;
  let lotsSold = 0;
  let listed = 0;
  let lastSoldAt: Date | null = null;
  let priceFrom: Decimal | null = null;
  for (const p of properties) {
    if (p.publication === 'DRAFT') continue;
    listed++;
    for (const l of p.lots) {
      const sold = l.status === 'SOLD';
      if (sold && l.statusChangedAt && (!lastSoldAt || l.statusChangedAt > lastSoldAt)) lastSoldAt = l.statusChangedAt;
      if (p.publication === 'ARCHIVED') {
        if (sold) {
          lotsTotal++;
          lotsSold++;
        }
        continue;
      }
      lotsTotal++;
      if (l.status === 'AVAILABLE') {
        lotsAvailable++;
        const price = dec(l.price.toString());
        if (!priceFrom || price.lt(priceFrom)) priceFrom = price;
      } else if (l.status === 'OPTIONED' || l.status === 'RESERVED') lotsHeld++;
      else if (sold) lotsSold++;
    }
  }
  return { lotsTotal, lotsAvailable, lotsHeld, lotsSold, listedPropertyCount: listed, lastSoldAt, priceFrom };
}
