// CAT-001 … CAT-064 — public catalogue: criteria, counters, facets, sorts, pagination, cards.
import { Injectable } from '@nestjs/common';
import {
  criteriaToSearch,
  standingSlugToEnum,
  typeSlugToEnum,
  type CardLabel,
  type CatalogueGroup,
  type CatalogueMap,
  type MapMarker,
  type CatalogueCriteria,
  type CatalogueFacetOption,
  type CatalogueFacets,
  type CatalogueResponse,
  type PropertyCard,
  type SearchOptions,
} from '@dp/contracts';
import { Clock } from '../platform/clock.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { CatalogueIndex, type IndexedProperty } from './catalogue-index.js';
import { toPublicImage } from './media.js';

export const PAGE_SIZE = 12; // TRV-100

type Group =
  | 'q'
  | 'country'
  | 'region'
  | 'city'
  | 'type'
  | 'rooms'
  | 'budget'
  | 'surface'
  | 'delivery'
  | 'standing'
  | 'promoter'
  | 'program'
  | 'financing'
  | 'islamic'
  | 'tour360'
  | 'new'
  | 'availability'
  | 'bbox';

interface Context {
  criteria: CatalogueCriteria;
  qIds: Set<string> | null;
  newSince: number;
}

function money(value: number | null, currency: string) {
  return value === null ? null : { amount: value.toFixed(2), currency };
}

/** FIC-060 — centre of a ~500 m cell (latitude and longitude rounded to 0.005°): never the exact address (TRV-045). */
export const approxCoord = (v: number) => Math.round(Math.round(v / 0.005) * 0.005 * 1e6) / 1e6;

/** The public point of a property: its programme's when the programme has coordinates (one marker per programme). */
export function publicPoint(p: IndexedProperty): { lat: number; lng: number } | null {
  const lat = p.program?.lat ?? p.lat;
  const lng = p.program?.lng ?? p.lng;
  if (lat === null || lng === null || lat === undefined || lng === undefined) return null;
  return { lat: approxCoord(lat), lng: approxCoord(lng) };
}

@Injectable()
export class CatalogueService {
  constructor(
    private readonly index: CatalogueIndex,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  // ---------- matching ----------

  private matches(p: IndexedProperty, ctx: Context, skip?: Group): boolean {
    const c = ctx.criteria;
    const g = (name: Group) => skip !== name;
    if (g('availability') && c.availability !== 'all' && p.availability !== 'AVAILABLE') return false;
    if (g('q') && ctx.qIds && !ctx.qIds.has(p.id)) return false;
    if (g('country') && c.country && p.countryCode !== c.country) return false;
    if (g('region') && c.region && !c.region.includes(p.region.slug)) return false;
    if (g('city') && c.city && (!p.city || !c.city.includes(p.city.slug))) return false;
    if (g('type') && c.type && !c.type.map((t) => typeSlugToEnum[t]).includes(p.type as never)) return false;
    if (g('rooms') && c.rooms) {
      if (p.type === 'LAND' || p.type === 'COMMERCIAL') return false;
      const rooms = p.type === 'STUDIO' ? 1 : p.rooms;
      if (rooms === null) return false;
      const ok = c.rooms.some((r) => (r === '5plus' ? rooms >= 5 : rooms === Number(r)));
      if (!ok) return false;
    }
    if (g('budget')) {
      if (c.monthlyMax !== undefined && (p.monthlyFromRef === null || p.monthlyFromRef > c.monthlyMax)) return false;
      if (c.priceMin !== undefined && (p.priceFromRef === null || p.priceFromRef < c.priceMin)) return false;
      if (c.priceMax !== undefined && (p.priceFromRef === null || p.priceFromRef > c.priceMax)) return false;
    }
    if (g('surface') && (c.surfaceMin !== undefined || c.surfaceMax !== undefined)) {
      const lo = p.surfaceMin ?? p.surfaceMax;
      const hi = p.surfaceMax ?? p.surfaceMin;
      if (lo === null || hi === null) return false;
      if (c.surfaceMin !== undefined && hi < c.surfaceMin) return false;
      if (c.surfaceMax !== undefined && lo > c.surfaceMax) return false;
    }
    if (g('delivery') && c.delivery && !c.delivery.includes(p.delivery.bucket)) return false;
    if (g('standing') && c.standing && !c.standing.map((s) => standingSlugToEnum[s]).includes(p.standing as never)) return false;
    if (g('promoter') && c.promoter && !c.promoter.includes(p.promoter.slug)) return false;
    if (g('program') && c.program && p.program?.slug !== c.program) return false;
    if (g('financing') && c.financing && !p.financingEligible) return false;
    if (g('islamic') && c.islamic && !p.islamicFinancingEligible) return false;
    if (g('tour360') && c.tour360 && !p.has360Tour) return false;
    if (g('new') && c.new && !(p.firstPublishedAt && p.firstPublishedAt.getTime() >= ctx.newSince)) return false;
    if (g('bbox') && c.bbox) {
      // CAT-020 — the approximate point of FIC-060 falls in the rectangle (the exact one is never public).
      const [w, s, e, n] = c.bbox;
      const pt = publicPoint(p);
      if (!pt || pt.lng < w || pt.lng > e || pt.lat < s || pt.lat > n) return false;
    }
    return true;
  }

  /** TRV-103 — accent- and case-insensitive, one typo tolerated (trigram word similarity). */
  private async searchIds(q: string): Promise<Set<string>> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM properties
      WHERE deleted_at IS NULL AND publication = 'PUBLISHED'
        AND (
          search_text LIKE '%' || lower(public.f_unaccent(${q})) || '%'
          OR word_similarity(lower(public.f_unaccent(${q})), search_text) >= 0.6
          OR lower(reference) = lower(${q})
        )`;
    return new Set(rows.map((r) => r.id));
  }

  private async context(criteria: CatalogueCriteria): Promise<Context> {
    const newDays = await this.settings.get('catalogue.newBadgeDays');
    return {
      criteria,
      qIds: criteria.q ? await this.searchIds(criteria.q) : null,
      newSince: this.clock.now().getTime() - newDays * 86_400_000,
    };
  }

  /** AUT-060 — the listable properties matching criteria, by the same rules as the catalogue filters (CAT-020). */
  async matchingRows(criteria: CatalogueCriteria): Promise<IndexedProperty[]> {
    const all = await this.index.rows();
    const ctx = await this.context(criteria);
    return all.filter((p) => this.matches(p, ctx));
  }

  // ---------- sorting ----------

  private sort(rows: IndexedProperty[], sort: CatalogueCriteria['sort']): IndexedProperty[] {
    const relevance = (a: IndexedProperty, b: IndexedProperty) =>
      (a.featuredRank ?? Infinity) - (b.featuredRank ?? Infinity) ||
      b.relevanceScore - a.relevanceScore ||
      (b.firstPublishedAt?.getTime() ?? 0) - (a.firstPublishedAt?.getTime() ?? 0) ||
      a.id.localeCompare(b.id);
    const nullsLast = (x: number | null, y: number | null, dir: 1 | -1) => {
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (x - y) * dir;
    };
    const by: Record<string, (a: IndexedProperty, b: IndexedProperty) => number> = {
      price_asc: (a, b) => nullsLast(a.priceFromRef, b.priceFromRef, 1),
      price_desc: (a, b) => nullsLast(a.priceFromRef, b.priceFromRef, -1),
      monthly_asc: (a, b) => nullsLast(a.monthlyFromRef, b.monthlyFromRef, 1),
      surface_desc: (a, b) => nullsLast(a.surfaceMax, b.surfaceMax, -1),
      delivery_asc: (a, b) => {
        const key = (p: IndexedProperty) => (p.delivery.status === 'DELIVERED' ? 0 : (p.delivery.date?.getTime() ?? null));
        return nullsLast(key(a), key(b), 1);
      },
      newest: (a, b) => nullsLast(a.firstPublishedAt?.getTime() ?? null, b.firstPublishedAt?.getTime() ?? null, -1),
    };
    const primary = sort ? by[sort] : undefined;
    return [...rows].sort((a, b) => (primary ? primary(a, b) : 0) || relevance(a, b));
  }

  // ---------- cards ----------

  /** CAT-041 — the first label that applies. */
  private label(p: IndexedProperty, today: string, newSince: number, lowStock: number): CardLabel | null {
    if (p.availability !== 'AVAILABLE') return null;
    const until = (d: Date | null) => !d || d.toISOString().slice(0, 10) >= today;
    if (p.highlightLabel && until(p.highlightUntil)) return { kind: 'MANUAL', text: p.highlightLabel };
    if (p.program?.label && until(p.program.labelUntil)) return { kind: 'MANUAL', text: p.program.label };
    if (p.lotsTaken > 0) {
      if (p.lotsAvailable === 1) return { kind: 'LAST_LOT' };
      if (p.lotsAvailable > 1 && p.lotsAvailable <= lowStock) return { kind: 'LOW_STOCK', n: p.lotsAvailable };
    }
    if (p.firstPublishedAt && p.firstPublishedAt.getTime() >= newSince) return { kind: 'NEW' };
    return null;
  }

  async toCards(rows: IndexedProperty[], newSince?: number): Promise<PropertyCard[]> {
    const [currency, lowStock, today, newDays] = await Promise.all([
      this.settings.get('display.referenceCurrency'),
      this.settings.get('catalogue.lowStockThreshold'),
      this.index.today(),
      this.settings.get('catalogue.newBadgeDays'),
    ]);
    const since = newSince ?? this.clock.now().getTime() - newDays * 86_400_000;
    return rows.map((p) => ({
      id: p.id,
      reference: p.reference,
      slug: p.slug,
      title: p.title,
      type: p.type,
      rooms: p.rooms,
      standing: p.standing,
      region: { name: p.region.name, slug: p.region.slug },
      city: p.city ? { name: p.city.name, slug: p.city.slug } : null,
      program: p.program ? { name: p.program.name, slug: p.program.slug } : null,
      surfaceMin: p.surfaceMin === null ? null : p.surfaceMin.toFixed(2),
      surfaceMax: p.surfaceMax === null ? null : p.surfaceMax.toFixed(2),
      delivery: {
        status: p.delivery.status,
        date: p.delivery.date ? p.delivery.date.toISOString().slice(0, 10) : null,
        precision: p.delivery.precision,
        overdue: p.delivery.overdue,
      },
      availability: p.availability,
      priceFromRef: money(p.priceFromRef, currency),
      priceIsFrom: p.priceFrom !== null && p.priceTo !== null && p.priceFrom !== p.priceTo,
      downPaymentRef: money(p.downPaymentRef, currency),
      // CAT-043: the monthly payment of a reserved or sold property is hidden.
      monthlyFromRef: p.availability === 'AVAILABLE' ? money(p.monthlyFromRef, currency) : null,
      label: this.label(p, today, since, lowStock),
      cover: p.cover ? toPublicImage(this.index.mediaUrl, p.cover, p.title) : null,
      has360Tour: p.has360Tour,
      financingEligible: p.financingEligible,
    }));
  }

  // ---------- list ----------

  async list(criteria: CatalogueCriteria, withFacets: boolean): Promise<CatalogueResponse> {
    const all = await this.index.rows();
    const ctx = await this.context(criteria);
    const matching = this.sort(
      all.filter((p) => this.matches(p, ctx)),
      criteria.sort,
    );
    // CAT-091 — grouped by programme: the pagination counts the groups (12 per page).
    const grouped = criteria.groupe === 'programme' ? this.groupRows(matching) : null;
    const total = grouped ? grouped.length : matching.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    // CAT-055: a page beyond the last one shows the last one (the site redirects to it).
    const page = Math.min(criteria.page ?? 1, totalPages);
    const pageGroups = grouped?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? null;
    const slice = pageGroups ? pageGroups.flat() : matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const appliedCriteria = { ...criteria };
    if (page === 1) delete appliedCriteria.page;
    else appliedCriteria.page = page;
    const cards = await this.toCards(slice, ctx.newSince);
    const response: CatalogueResponse = {
      data: cards,
      meta: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
        publishedCount: all.length,
        availableCount: all.filter((p) => p.availability === 'AVAILABLE').length,
        criteria: appliedCriteria,
        referenceDownPaymentPct: (await this.settings.get('finance.reference.default')).downPaymentPct.toFixed(2),
        propertyCount: matching.length,
      },
      quickFilters: this.quickFilters(all, ctx),
    };
    if (withFacets) response.facets = this.facets(all, ctx);
    if (pageGroups) response.groups = await this.toGroups(pageGroups, cards);
    if (criteria.vue === 'carte') response.map = await this.toMap(matching, appliedCriteria);
    return response;
  }

  // ---------- CAT-091 groups ----------

  /** Properties of a programme together, in the order of their best-ranked property; an isolated property alone. */
  private groupRows(sorted: IndexedProperty[]): IndexedProperty[][] {
    const groups = new Map<string, IndexedProperty[]>();
    for (const p of sorted) {
      const key = p.program ? `g:${p.program.id}` : `p:${p.id}`;
      const list = groups.get(key);
      if (list) list.push(p);
      else groups.set(key, [p]);
    }
    return [...groups.values()];
  }

  private async toGroups(groups: IndexedProperty[][], cards: PropertyCard[]): Promise<CatalogueGroup[]> {
    const byId = new Map(cards.map((c) => [c.id, c]));
    const currency = await this.settings.get('display.referenceCurrency');
    return groups.map((rows) => {
      const first = rows[0]!;
      const props = rows.map((r) => byId.get(r.id)!).filter(Boolean);
      if (!first.program) return { kind: 'PROPERTY', property: props[0]! };
      const prices = rows.map((r) => r.priceFromRef).filter((v): v is number => v !== null);
      const cover = props.find((c) => c.cover)?.cover ?? null;
      return {
        kind: 'PROGRAM',
        program: { slug: first.program.slug, name: first.program.name, city: first.city?.name ?? null, region: first.region.name, cover },
        count: rows.length,
        priceMin: prices.length ? money(Math.min(...prices), currency) : null,
        priceMax: prices.length ? money(Math.max(...prices), currency) : null,
        properties: props,
      };
    });
  }

  // ---------- CAT-090 map ----------

  /** One marker per programme (per isolated property), over every matching property, at the approximate point. */
  private async toMap(matching: IndexedProperty[], criteria: CatalogueCriteria): Promise<CatalogueMap> {
    const currency = await this.settings.get('display.referenceCurrency');
    const markers = new Map<string, MapMarker & { min: number | null }>();
    let unlocated = 0;
    for (const p of matching) {
      const pt = publicPoint(p);
      if (!pt) {
        unlocated++;
        continue;
      }
      const key = p.program ? p.program.slug : p.reference;
      let m = markers.get(key);
      if (!m) {
        const target: CatalogueCriteria = { ...criteria, program: p.program?.slug };
        delete target.page;
        delete target.bbox;
        m = {
          key,
          kind: p.program ? 'PROGRAM' : 'PROPERTY',
          lat: pt.lat,
          lng: pt.lng,
          name: p.program ? p.program.name : p.title,
          city: p.city?.name ?? null,
          region: p.region.name,
          count: 0,
          priceFromRef: null,
          href: p.program ? `/programmes${criteriaToSearch(target)}` : `/biens/${p.slug}`,
          references: [],
          min: null,
        };
        markers.set(key, m);
      }
      m.count++;
      m.references.push(p.reference);
      if (p.priceFromRef !== null && (m.min === null || p.priceFromRef < m.min)) m.min = p.priceFromRef;
    }
    return {
      markers: [...markers.values()].map(({ min, ...m }) => ({ ...m, priceFromRef: money(min, currency) })),
      unlocated,
    };
  }

  /** CAT-012 — a quick filter is offered only if it gives at least one result in the whole catalogue. */
  private quickFilters(all: IndexedProperty[], ctx: Context): string[] {
    const available = all.filter((p) => p.availability === 'AVAILABLE');
    const out: string[] = [];
    if (available.some((p) => p.type === 'APARTMENT')) out.push('apartment');
    if (available.some((p) => p.type === 'VILLA')) out.push('villa');
    if (available.some((p) => p.delivery.status === 'DELIVERED')) out.push('delivered');
    if (available.some((p) => p.financingEligible)) out.push('financing');
    if (available.some((p) => p.firstPublishedAt && p.firstPublishedAt.getTime() >= ctx.newSince)) out.push('new');
    if (available.some((p) => p.has360Tour)) out.push('tour360');
    return out;
  }

  /** CAT-033 — the count next to an option is what checking it would give, given the OTHER groups. */
  private facets(all: IndexedProperty[], ctx: Context): CatalogueFacets {
    const count = <K extends string>(group: Group, keyOf: (p: IndexedProperty) => K[] | K | null, labelOf?: (k: K, p: IndexedProperty) => string) => {
      const map = new Map<K, CatalogueFacetOption>();
      for (const p of all) {
        if (!this.matches(p, ctx, group)) continue;
        const keys = keyOf(p);
        for (const k of keys === null ? [] : Array.isArray(keys) ? keys : [keys]) {
          const o = map.get(k) ?? { value: k, label: labelOf ? labelOf(k, p) : k, count: 0 };
          o.count++;
          map.set(k, o);
        }
      }
      return [...map.values()];
    };
    const typeSlug = Object.fromEntries(Object.entries(typeSlugToEnum).map(([s, e]) => [e, s])) as Record<string, string>;
    const standingSlug = Object.fromEntries(Object.entries(standingSlugToEnum).map(([s, e]) => [e, s])) as Record<string, string>;
    const roomsKey = (p: IndexedProperty) => {
      if (p.type === 'LAND' || p.type === 'COMMERCIAL') return null;
      const r = p.type === 'STUDIO' ? 1 : p.rooms;
      return r === null ? null : r >= 5 ? '5plus' : String(r);
    };
    const options: CatalogueFacetOption[] = [
      { value: 'financing', label: 'financing', count: all.filter((p) => this.matches(p, ctx, 'financing') && p.financingEligible).length },
      { value: 'islamic', label: 'islamic', count: all.filter((p) => this.matches(p, ctx, 'islamic') && p.islamicFinancingEligible).length },
      { value: 'tour360', label: 'tour360', count: all.filter((p) => this.matches(p, ctx, 'tour360') && p.has360Tour).length },
      {
        value: 'new',
        label: 'new',
        count: all.filter((p) => this.matches(p, ctx, 'new') && p.firstPublishedAt && p.firstPublishedAt.getTime() >= ctx.newSince).length,
      },
      { value: 'availability', label: 'availability', count: all.filter((p) => this.matches(p, ctx, 'availability')).length },
    ];
    const available = all.filter((p) => ctx.criteria.availability === 'all' || p.availability === 'AVAILABLE');
    const max = (f: (p: IndexedProperty) => number | null) =>
      available.reduce<number | null>((m, p) => {
        const v = f(p);
        return v === null ? m : m === null ? v : Math.max(m, v);
      }, null);
    const byLabel = (a: CatalogueFacetOption, b: CatalogueFacetOption) => a.label.localeCompare(b.label, 'fr');
    return {
      type: count('type', (p) => typeSlug[p.type]!),
      rooms: count('rooms', roomsKey).sort((a, b) => a.value.localeCompare(b.value)),
      region: count('region', (p) => p.region.slug, (_k, p) => p.region.name).sort(byLabel),
      city: ctx.criteria.region?.length === 1
        ? count('city', (p) => p.city?.slug ?? null, (_k, p) => p.city?.name ?? '').sort((a, b) => b.count - a.count || byLabel(a, b))
        : [],
      delivery: count('delivery', (p) => p.delivery.bucket),
      standing: count('standing', (p) => standingSlug[p.standing]!),
      promoter: count('promoter', (p) => p.promoter.slug, (_k, p) => p.promoter.name).sort(byLabel),
      options,
      bounds: { priceMax: max((p) => p.priceFromRef), monthlyMax: max((p) => p.monthlyFromRef), surfaceMax: max((p) => p.surfaceMax) },
    };
  }

  // ---------- search options (API-100, ACC-052, CAT-021) ----------

  async searchOptions(estimatedBudget: SearchOptions['estimatedBudget']): Promise<SearchOptions> {
    const all = (await this.index.rows()).filter((p) => p.availability === 'AVAILABLE');
    const regions = new Map<string, { slug: string; name: string; count: number }>();
    const types = new Map<string, { type: PropertyCard['type']; rooms: number | null; count: number }>();
    for (const p of all) {
      const r = regions.get(p.region.slug) ?? { slug: p.region.slug, name: p.region.name, count: 0 };
      r.count++;
      regions.set(p.region.slug, r);
      const rooms = p.type === 'STUDIO' || p.type === 'LAND' || p.type === 'COMMERCIAL' ? null : p.rooms;
      const key = `${p.type}:${rooms ?? ''}`;
      const t = types.get(key) ?? { type: p.type, rooms, count: 0 };
      t.count++;
      types.set(key, t);
    }
    const order = ['APARTMENT', 'DUPLEX', 'VILLA', 'STUDIO', 'LAND', 'COMMERCIAL'];
    const [monthlySteps, priceSteps] = await Promise.all([
      this.settings.get('catalogue.monthlyBudgetSteps'),
      this.settings.get('catalogue.priceBudgetSteps'),
    ]);
    // ACC-052: an option without any property is not offered.
    const minMonthly = all.reduce<number | null>((m, p) => (p.monthlyFromRef === null ? m : m === null ? p.monthlyFromRef : Math.min(m, p.monthlyFromRef)), null);
    const minPrice = all.reduce<number | null>((m, p) => (p.priceFromRef === null ? m : m === null ? p.priceFromRef : Math.min(m, p.priceFromRef)), null);
    return {
      regions: [...regions.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      types: [...types.values()].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || (a.rooms ?? 0) - (b.rooms ?? 0)),
      monthlyBudgetSteps: minMonthly === null ? [] : monthlySteps.filter((s) => s >= minMonthly),
      priceBudgetSteps: minPrice === null ? [] : priceSteps.filter((s) => s >= minPrice),
      estimatedBudget,
      country: await this.catalogueCountry(),
    };
  }

  private async catalogueCountry(): Promise<{ code: string; name: string } | null> {
    const countries = await this.prisma.country.findMany({ where: { isCatalogueActive: true }, select: { code: true, nameFr: true }, take: 2 });
    return countries.length === 1 ? { code: countries[0]!.code, name: countries[0]!.nameFr } : null;
  }

  /** GET /public/regions — regions with at least one published and available property (PAR-023, CAT-021). */
  async regions(): Promise<{ slug: string; name: string; count: number }[]> {
    return (await this.searchOptions(null)).regions;
  }
}
