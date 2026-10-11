import { describe, expect, it } from 'vitest';
import { referenceCardValues } from '@dp/domain';
import {
  availabilityOf,
  lotAggregates,
  manualLotTransitionRefusal,
  programCounters,
  programPublicationMissing,
  propertyPublicationMissing,
} from '../src/catalogue-admin/catalogue-rules.js';
import { CAFES, dzd, PROGRAMS } from '../src/install/demo-data.js';

const ctx = {
  rates: [{ base: 'EUR', quote: 'DZD', rate: '148.50', kind: 'OFFICIAL' as const, asOf: '2026-10-09', createdAt: '2026-10-09T07:51:43Z' }],
  kind: 'OFFICIAL' as const,
  referenceCurrency: 'EUR',
  today: '2026-10-09',
};
const financing = { downPaymentPct: 20, durationMonths: 300, annualRateBps: 650, pricingMethod: 'AMORTIZED_RATE' as const };

describe('availability and lot aggregates', () => {
  it('CYC-110 — availability is deduced from the lots', () => {
    expect(availabilityOf(['SOLD', 'AVAILABLE', 'WITHDRAWN'])).toBe('AVAILABLE');
    expect(availabilityOf(['SOLD', 'OPTIONED'])).toBe('RESERVED');
    expect(availabilityOf(['SOLD', 'RESERVED', 'WITHDRAWN'])).toBe('RESERVED');
    expect(availabilityOf(['SOLD', 'SOLD', 'WITHDRAWN'])).toBe('SOLD');
    expect(availabilityOf(['WITHDRAWN', 'WITHDRAWN'])).toBe('WITHDRAWN');
    expect(availabilityOf([])).toBe('WITHDRAWN');
  });

  it('MOD-220 — price and surface ranges of the AVAILABLE lots, else of the lots not withdrawn', () => {
    const t3 = PROGRAMS[0]!.properties[0]!.lots.map((l) => ({ status: 'AVAILABLE' as const, price: dzd(l.eur), surfaceM2: l.surfaceM2 }));
    const agg = lotAggregates(t3);
    expect(agg).toMatchObject({ lotsTotal: 7, lotsAvailable: 7, lotsTaken: 0, availability: 'AVAILABLE' });
    expect(agg.priceFrom!.toFixed(2)).toBe('22275000.00');
    expect(agg.priceTo!.toFixed(2)).toBe('24502500.00');
    expect(agg.surfaceMin!.toFixed(0)).toBe('84');
    expect(agg.surfaceMax!.toFixed(0)).toBe('85');
    const none = lotAggregates([
      { status: 'SOLD', price: '100', surfaceM2: 50 },
      { status: 'RESERVED', price: '90', surfaceM2: 40 },
      { status: 'WITHDRAWN', price: '10', surfaceM2: 10 },
    ]);
    expect(none).toMatchObject({ availability: 'RESERVED', lotsAvailable: 0, lotsTaken: 2 });
    expect(none.priceFrom!.toFixed(0)).toBe('90');
    expect(none.surfaceMin!.toFixed(0)).toBe('40');
  });

  it('CAL-030 — B-304 at 22 275 000 DA → 150 000 € → down payment 30 000 € → 810 € a month', () => {
    const v = referenceCardValues({ priceFrom: lotAggregates([{ status: 'AVAILABLE', price: dzd(150_000), surfaceM2: 85 }]).priceFrom!.toString(), currency: 'DZD' }, financing, ctx);
    expect(dzd(150_000)).toBe('22275000.00');
    expect(v.priceFromRef!.toFixed(2)).toBe('150000.00');
    expect(v.downPaymentRef!.toFixed(2)).toBe('30000.00');
    expect(v.monthlyExact!.toFixed(2)).toBe('810.25');
    expect(v.monthlyFromRef!.toFixed(2)).toBe('810.00');
  });

  it('CAL-021 — every demo lot price converts exactly to the euro figure of the reference file', () => {
    for (const program of PROGRAMS) {
      for (const property of program.properties) {
        for (const lot of property.lots) {
          const v = referenceCardValues({ priceFrom: dzd(lot.eur), currency: 'DZD' }, financing, ctx);
          expect(v.priceFromRef!.toNumber(), `${program.name} ${lot.reference}`).toBe(lot.eur);
        }
      }
    }
    expect(referenceCardValues({ priceFrom: dzd(240_000), currency: 'DZD' }, financing, ctx).monthlyFromRef!.toFixed(0)).toBe('1300');
    expect(referenceCardValues({ priceFrom: dzd(410_000), currency: 'DZD' }, financing, ctx).monthlyFromRef!.toFixed(0)).toBe('2210');
    expect(CAFES.map((c) => new Date(`${c.date}T12:00:00Z`).getUTCDay())).toEqual([6, 6, 6]); // Saturdays
  });
});

describe('manual lot transitions', () => {
  const free = { externalSale: false, referencePending: false, hasActiveReservation: false };
  it('CYC-100 — AVAILABLE → RESERVED, SOLD, WITHDRAWN by hand; never OPTIONED', () => {
    expect(manualLotTransitionRefusal('AVAILABLE', 'RESERVED', free)).toBeNull();
    expect(manualLotTransitionRefusal('AVAILABLE', 'SOLD', free)).toBeNull();
    expect(manualLotTransitionRefusal('AVAILABLE', 'WITHDRAWN', free)).toBeNull();
    expect(manualLotTransitionRefusal('AVAILABLE', 'OPTIONED', free)).toBe('TRANSITION_NOT_ALLOWED');
  });
  it('CYC-100 — WITHDRAWN → AVAILABLE refused while the reference is provisional (MOD-230)', () => {
    expect(manualLotTransitionRefusal('WITHDRAWN', 'AVAILABLE', { ...free, referencePending: true })).toBe('LOT_REFERENCE_PENDING');
    expect(manualLotTransitionRefusal('WITHDRAWN', 'AVAILABLE', free)).toBeNull();
  });
  it('CYC-100 — an external reservation or sale comes back by hand; a dossier sale never does', () => {
    expect(manualLotTransitionRefusal('RESERVED', 'SOLD', { ...free, externalSale: true })).toBeNull();
    expect(manualLotTransitionRefusal('SOLD', 'AVAILABLE', { ...free, externalSale: true })).toBeNull();
    expect(manualLotTransitionRefusal('SOLD', 'AVAILABLE', free)).toBe('SALE_NOT_EXTERNAL');
    expect(manualLotTransitionRefusal('AVAILABLE', 'SOLD', { ...free, hasActiveReservation: true })).toBe('LOT_HAS_ACTIVE_RESERVATION');
  });
});

describe('publication conditions', () => {
  const ok = {
    missingRequiredFields: [],
    hasPricedLot: true,
    hasReadyMedia: true,
    completenessScore: 61,
    publishMinScore: 60,
    promoterActive: true,
    programPublished: true,
    countryActive: true,
  };
  it('CYC-120 — a complete property is publishable', () => {
    expect(propertyPublicationMissing(ok)).toEqual([]);
    expect(propertyPublicationMissing({ ...ok, programPublished: null })).toEqual([]);
  });
  it('CYC-120 — every missing condition is listed, in the order of API-102', () => {
    expect(
      propertyPublicationMissing({
        missingRequiredFields: ['ROOMS'],
        hasPricedLot: false,
        hasReadyMedia: false,
        completenessScore: 48,
        publishMinScore: 60,
        promoterActive: false,
        programPublished: false,
        countryActive: false,
      }),
    ).toEqual(['REQUIRED_FIELDS', 'LOT_WITH_PRICE', 'READY_MEDIA', 'COMPLETENESS_SCORE', 'PROMOTER_ACTIVE', 'PROGRAM_PUBLISHED', 'COUNTRY_ACTIVE']);
  });
  it('CYC-125 — a programme needs 100 characters of description, an active promoter and a ready media', () => {
    const base = { name: 'Résidence El Yasmine', regionId: 'r', standing: 'COMFORT', deliveryStatus: 'UNDER_CONSTRUCTION', deliveryDate: '2027-10-01', descriptionLength: 100, promoterActive: true, hasReadyMedia: true, countryActive: true };
    expect(programPublicationMissing(base)).toEqual([]);
    expect(programPublicationMissing({ ...base, descriptionLength: 99, deliveryDate: null, hasReadyMedia: false })).toEqual(['REQUIRED_FIELDS', 'DESCRIPTION_LENGTH', 'READY_MEDIA']);
    expect(programPublicationMissing({ ...base, deliveryStatus: 'DELIVERED', deliveryDate: null })).toEqual([]);
  });
});

describe('programme counters', () => {
  it('CYC-127 — drafts do not count; archived properties count only their sold lots', () => {
    const lot = (status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'WITHDRAWN', price = '100', at?: Date) => ({ status, price, surfaceM2: 50, statusChangedAt: at ?? new Date('2026-01-01') });
    const c = programCounters([
      { publication: 'PUBLISHED', lots: [lot('AVAILABLE', '120'), lot('AVAILABLE', '90'), lot('RESERVED'), lot('SOLD', '1', new Date('2026-05-01'))] },
      { publication: 'ARCHIVED', lots: [lot('SOLD', '1', new Date('2026-06-01')), lot('AVAILABLE', '10')] },
      { publication: 'DRAFT', lots: [lot('AVAILABLE', '5')] },
    ]);
    expect(c).toMatchObject({ lotsTotal: 5, lotsAvailable: 2, lotsHeld: 1, lotsSold: 2, listedPropertyCount: 2 });
    expect(c.priceFrom!.toFixed(0)).toBe('90');
    expect(c.lastSoldAt!.toISOString().slice(0, 10)).toBe('2026-06-01');
  });
});
