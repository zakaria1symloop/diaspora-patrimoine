// API-100 `GET /public/home` — featured properties (ACC-051), next Cafés (ACC-030, ACC-061), fallback states (ACC-090).
// The fallback state of each element is decided by the server (ACC-091); blocks come from /public/content-blocks.
import { Controller, Get, Header } from '@nestjs/common';
import { comparisonBlockSchema, contentBlocks, type HomeResponse } from '@dp/contracts';
import { CatalogueIndex, type IndexedProperty } from '../catalogue/catalogue-index.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import { EventsPublicService } from '../events/events-public.service.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';

const STANDING_ORDER = ['COMFORT', 'STANDING', 'PREMIUM'] as const;

/** ACC-051 — pinned first, then one per missing standing by relevance, then by relevance; available before reserved. */
export function selectFeatured(rows: IndexedProperty[]): IndexedProperty[] {
  const byRelevance = (a: IndexedProperty, b: IndexedProperty) =>
    b.relevanceScore - a.relevanceScore || (b.firstPublishedAt?.getTime() ?? 0) - (a.firstPublishedAt?.getTime() ?? 0) || a.id.localeCompare(b.id);
  const picked: IndexedProperty[] = [];
  for (const availability of ['AVAILABLE', 'RESERVED'] as const) {
    const pool = rows.filter((p) => p.availability === availability && !picked.includes(p));
    const take = (p: IndexedProperty | undefined) => p && picked.length < 3 && picked.push(p);
    pool
      .filter((p) => p.featuredRank !== null)
      .sort((a, b) => a.featuredRank! - b.featuredRank! || byRelevance(a, b))
      .forEach(take);
    for (const standing of STANDING_ORDER) {
      if (picked.length >= 3) break;
      if (picked.some((p) => p.standing === standing)) continue;
      take(pool.filter((p) => p.standing === standing && !picked.includes(p)).sort(byRelevance)[0]);
    }
    pool.filter((p) => !picked.includes(p)).sort(byRelevance).forEach(take);
    if (picked.length >= 3) break;
  }
  // Displayed by increasing price: the section shows a ladder of budgets.
  return picked.sort((a, b) => (a.priceFromRef ?? Infinity) - (b.priceFromRef ?? Infinity));
}

@Controller('public/home')
export class HomeController {
  constructor(
    private readonly index: CatalogueIndex,
    private readonly catalogue: CatalogueService,
    private readonly events: EventsPublicService,
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async home(): Promise<HomeResponse> {
    const [rows, cafes, reference, search, comparisonRow] = await Promise.all([
      this.index.rows(),
      this.events.upcoming(12),
      this.settings.get('finance.reference.default'),
      this.catalogue.searchOptions(null),
      this.prisma.contentBlock.findUnique({ where: { key_locale: { key: 'home.comparison', locale: 'fr' } }, select: { value: true } }),
    ]);
    const comparison = comparisonBlockSchema.partial().safeParse(comparisonRow?.value ?? contentBlocks['home.comparison'].origin);
    let comparisonProperty: HomeResponse['comparisonProperty'] = null;
    if (comparison.success && comparison.data.propertyId) {
      const p = rows.find((r) => r.id === comparison.data.propertyId);
      const card = p ? (await this.catalogue.toCards([p]))[0] : undefined;
      comparisonProperty = p ? { slug: p.slug, available: p.availability === 'AVAILABLE', cover: card?.cover ?? null } : null;
    }
    const listable = rows.filter((p) => p.availability === 'AVAILABLE' || p.availability === 'RESERVED');
    return {
      featured: await this.catalogue.toCards(selectFeatured(listable)),
      nextCafe: this.events.nextCafe(cafes),
      cafes: cafes.filter((c) => c.state.kind !== 'CANCELLED').slice(0, 3),
      catalogue: {
        publishedCount: rows.length,
        availableCount: rows.filter((p) => p.availability === 'AVAILABLE').length,
        onlyGone: rows.length > 0 && listable.length === 0,
      },
      search,
      referenceDownPaymentPct: reference.downPaymentPct.toFixed(2),
      comparisonProperty,
    };
  }
}
