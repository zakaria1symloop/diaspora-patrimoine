// What a simulator calculation needs besides its inputs: exchange rates (CAL-010), the indicative scale (PAR-044), the
// reference financing (PAR-041), acquisition fees per country (CAL-106), the usable products (MOD-113) and the
// parameters snapshot written with a stored simulation (CAL-013, MOD-370).
import { Inject, Injectable } from '@nestjs/common';
import {
  SIMULATOR_CURRENCIES,
  referenceFinancingSchema,
  settingPatterns,
  type IndicativeScale,
  type ReferenceFinancing,
  type SimulatorProduct,
} from '@dp/contracts';
import { convert, type ConversionContext, type CreditProduct, type EligibilityProduct, type RateBand } from '@dp/domain';
import { ENV, type Env } from '../config/env.js';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';

export type Conversion = ConversionContext & { referenceCurrency: string };

/** A usable product (MOD-113) with what both simulators read from it. Amounts in the product currency. */
export interface LoadedProduct extends EligibilityProduct, CreditProduct {
  name: string;
  propertyCountryCode: string;
  otherFeesNote: string | null;
  /** SIM-006 — rank among the products of its type, for « Solution de crédit classique n° {n} ». */
  ordinal: number;
}

export interface SimContext {
  now: Date;
  today: string;
  conversion: Conversion;
  referenceCurrency: string;
  scale: IndicativeScale;
  /** PAR-041 of the country (CAL-030), else `finance.reference.default`. */
  reference: ReferenceFinancing;
  /** CAL-106 — `finance.acquisitionFeesPct.{pays}`, "0" by default. */
  acquisitionFeesPct: string;
  products: LoadedProduct[];
  islamicFinance: boolean;
  country: string | null;
}

@Injectable()
export class SimulationContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly index: CatalogueIndex,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async conversion(): Promise<Conversion> {
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

  /** PAR-001 pattern keys (`finance.reference.{pays}`, `finance.acquisitionFeesPct.{pays}`): absent or invalid → null. */
  private async pattern<K extends keyof typeof settingPatterns>(pattern: K, country: string): Promise<unknown> {
    const key = pattern.replace('{country}', country);
    const row = await this.prisma.setting.findUnique({ where: { key }, select: { value: true } });
    if (!row) return null;
    const parsed = settingPatterns[pattern].schema.safeParse(row.value);
    return parsed.success ? parsed.data : null;
  }

  async referenceFinancing(country: string | null): Promise<ReferenceFinancing> {
    if (country) {
      const own = referenceFinancingSchema.safeParse(await this.pattern('finance.reference.{country}', country));
      if (own.success) return own.data;
    }
    return this.settings.get('finance.reference.default');
  }

  async acquisitionFeesPct(country: string | null): Promise<string> {
    if (!country) return '0';
    const v = await this.pattern('finance.acquisitionFeesPct.{country}', country);
    return v === null || v === undefined ? '0' : String(v);
  }

  /** MOD-113 — active, not deleted, in its validity period, not fictitious (except outside production), bank ACTIVE; public in simulators. */
  async products(country: string | null, today: string): Promise<LoadedProduct[]> {
    const day = new Date(`${today}T00:00:00Z`);
    const rows = await this.prisma.bankProduct.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        isPublicInSimulators: true,
        ...(country ? { propertyCountryCode: country } : {}),
        ...(this.env.APP_ENV === 'production' ? { isExample: false } : {}),
        AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: day } }] }, { OR: [{ validTo: null }, { validTo: { gte: day } }] }],
        bank: { status: 'ACTIVE', deletedAt: null },
      },
      include: { bank: { select: { name: true, shortName: true, isPublic: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const counters: Record<string, number> = {};
    return rows.map((p) => {
      counters[p.financingType] = (counters[p.financingType] ?? 0) + 1;
      return {
        id: p.id,
        name: p.name,
        bankName: p.bank.shortName ?? p.bank.name,
        bankIsPublic: p.bank.isPublic,
        financingType: p.financingType,
        pricingMethod: p.pricingMethod,
        currency: p.currency,
        nominalRateBps: p.nominalRateBps,
        rateBands: Array.isArray(p.rateBands) ? (p.rateBands as unknown as RateBand[]) : null,
        minAmount: p.minAmount.toString(),
        maxAmount: p.maxAmount.toString(),
        minDurationMonths: p.minDurationMonths,
        maxDurationMonths: p.maxDurationMonths,
        maxDebtRatioPct: p.maxDebtRatioPct.toString(),
        minDownPaymentPct: p.minDownPaymentPct.toString(),
        maxAgeAtEnd: p.maxAgeAtEnd,
        minMonthlyIncome: p.minMonthlyIncome?.toString() ?? null,
        eligibleResidency: p.eligibleResidency,
        acceptedIncomeCurrencies: p.acceptedIncomeCurrencies,
        acceptedResidenceCountries: p.acceptedResidenceCountries,
        insuranceRateBps: p.insuranceRateBps,
        fileFeeFixed: p.fileFeeFixed?.toString() ?? null,
        fileFeePct: p.fileFeePct?.toString() ?? null,
        otherFeesNote: p.otherFeesNote,
        propertyCountryCode: p.propertyCountryCode,
        ordinal: counters[p.financingType]!,
      };
    });
  }

  async load(now: Date, country: string | null): Promise<SimContext> {
    const conversion = await this.conversion();
    const [scale, reference, acquisitionFeesPct, products, islamicFinance] = await Promise.all([
      this.settings.get('finance.indicative'),
      this.referenceFinancing(country),
      this.acquisitionFeesPct(country),
      this.products(country, conversion.today),
      this.settings.get('features.islamicFinance'),
    ]);
    return {
      now,
      today: conversion.today,
      conversion,
      referenceCurrency: conversion.referenceCurrency,
      scale,
      reference,
      acquisitionFeesPct,
      // ISLAMIC products are not offered while the feature is off (SIM-004).
      products: islamicFinance ? products : products.filter((p) => p.financingType !== 'ISLAMIC'),
      islamicFinance,
      country,
    };
  }

  /** PAR-025 — the simulator currencies that CAL-010 can convert to the reference currency. */
  currencies(conversion: Conversion): string[] {
    return SIMULATOR_CURRENCIES.filter((c) => convert(1, c, conversion.referenceCurrency, conversion) !== null);
  }

  /** The active catalogue countries (CAL-100 `propertyCountry`) with their currency. */
  async propertyCountries(): Promise<{ code: string; name: string; currency: string | null }[]> {
    const rows = await this.prisma.country.findMany({
      where: { isCatalogueActive: true },
      select: { code: true, nameFr: true, currency: true },
      orderBy: { nameFr: 'asc' },
    });
    return rows.map((r) => ({ code: r.code, name: r.nameFr, currency: r.currency }));
  }

  /** SIM-003 — the currency proposed for a residence country: its own when it is one of the offered currencies. */
  async currencyByCountry(offered: string[]): Promise<Record<string, string>> {
    const rows = await this.prisma.country.findMany({ where: { currency: { in: offered } }, select: { code: true, currency: true } });
    return Object.fromEntries(rows.map((r) => [r.code, r.currency]));
  }
}

/** SIM-006 — the selector entry of a product: the bank name only when it is public. */
export function publicProduct(p: LoadedProduct): SimulatorProduct {
  return {
    id: p.id,
    bankName: p.bankIsPublic ? p.bankName : null,
    productName: p.bankIsPublic ? p.name : null,
    ordinal: p.ordinal,
    financingType: p.financingType,
    currency: p.currency,
    propertyCountryCode: p.propertyCountryCode,
    minDurationMonths: p.minDurationMonths,
    maxDurationMonths: p.maxDurationMonths,
  };
}

/** CAL-013, MOD-370 — the parameters a stored simulation keeps: scales, reference financing, fees and the rates used. */
export function parametersSnapshot(ctx: SimContext, usedProductIds: (string | null)[], rateDates: Record<string, string>): Record<string, unknown> {
  const rates = ctx.conversion.rates.filter((r) => rateDates[`${r.base}/${r.quote}`] === r.asOf);
  return {
    computedAt: ctx.now.toISOString(),
    referenceCurrency: ctx.referenceCurrency,
    exchangeRateKind: ctx.conversion.kind ?? 'OFFICIAL',
    indicative: ctx.scale,
    reference: ctx.reference,
    acquisitionFeesPct: ctx.acquisitionFeesPct,
    productIds: [...new Set(usedProductIds.filter(Boolean))],
    rates: rates.map((r) => ({ pair: `${r.base}/${r.quote}`, rate: String(r.rate), asOf: r.asOf, kind: r.kind })),
  };
}
