// EA-40, EA-41 in reading — CTL-020 (list: origin views, filters with their facets, sort, pages, all on the server,
// TRV-100), CTL-021 … CTL-024 (the record and what its tabs and actions need), CTL-060 … CTL-062 (the lots, with the
// dossier that holds a lot and the equivalent of its price), MOD-231 (price history from the audit log).
import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  PROGRAM_VIEWS,
  programListQuerySchema,
  type AdminLot,
  type AdminLotStatus,
  type AdminProgramDetail,
  type CatalogueDossiers,
  type LotPriceChange,
  type LotsResponse,
  type ProgramList,
  type ProgramView,
} from '@dp/contracts';
import { convert } from '@dp/domain';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { localDate } from '../platform/holidays.service.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { staffName, StaffViews } from '../back-office/staff-view.js';
import { CatalogueCaches } from '../catalogue-admin/catalogue-caches.js';
import { CatalogueReferenceService } from '../catalogue-admin/catalogue-reference.js';
import { ProgramsAdminService } from '../catalogue-admin/programs-admin.service.js';
import { stockChecksDue, stockCheckState } from '../catalogue-admin/stock-check.js';
import { isOverdue } from '../catalogue/delivery.js';
import { catalogueDossiers, countsOf, coversOf, dec, dossierImpact, iso, isoDay, promoterName, stockView } from './catalogue-read.js';

const OPEN_DOSSIER: Prisma.DossierWhereInput = { status: { in: ['OPEN', 'ON_HOLD'] }, deletedAt: null };

@Injectable()
export class ProgramsReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly views: StaffViews,
    private readonly references: CatalogueReferenceService,
    private readonly programs: ProgramsAdminService,
    private readonly caches: CatalogueCaches,
  ) {}

  private async today(): Promise<string> {
    return localDate(this.clock.now(), await this.settings.get('business.calendar.timezone'));
  }

  private viewWhere(view: ProgramView): Prisma.ProgramWhereInput {
    if (view === 'published') return { publication: 'PUBLISHED' };
    if (view === 'drafts') return { publication: 'DRAFT' };
    if (view === 'archived') return { publication: 'ARCHIVED' };
    return {};
  }

  /** Programmes whose announced delivery period is over without the status DELIVERED (FIC-110). */
  private async lateIds(today: string): Promise<string[]> {
    const rows = await this.prisma.program.findMany({
      where: { deletedAt: null, deliveryStatus: { not: 'DELIVERED' }, deliveryDate: { lt: new Date(`${today}T00:00:00Z`) } },
      select: { id: true, deliveryStatus: true, deliveryDate: true, deliveryDatePrecision: true },
    });
    return rows.filter((r) => isOverdue(r.deliveryStatus, r.deliveryDate, r.deliveryDatePrecision, today)).map((r) => r.id);
  }

  /** Lots of all the properties of each programme, drafts included (the team's view of the stock). */
  private async lotCounts(programIds: string[]): Promise<Map<string, { available: number; total: number; properties: number }>> {
    const out = new Map<string, { available: number; total: number; properties: number }>();
    if (!programIds.length) return out;
    const rows = await this.prisma.$queryRaw<{ program_id: string; available: bigint; total: bigint; properties: bigint }[]>`
      SELECT p.program_id,
             count(l.id) FILTER (WHERE l.status = 'AVAILABLE' AND p.publication <> 'ARCHIVED') AS available,
             count(l.id) FILTER (WHERE p.publication <> 'ARCHIVED') AS total,
             count(DISTINCT p.id) FILTER (WHERE p.publication <> 'ARCHIVED') AS properties
      FROM properties p LEFT JOIN lots l ON l.property_id = p.id AND l.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.program_id = ANY(${programIds}::uuid[])
      GROUP BY p.program_id`;
    for (const r of rows) out.set(r.program_id, { available: Number(r.available), total: Number(r.total), properties: Number(r.properties) });
    return out;
  }

  /** `GET /admin/programs` (`catalogue.read`) — CTL-020. */
  async list(rawQuery: unknown): Promise<ProgramList> {
    const parsed = programListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST); // API-011
    const query = parsed.data;
    const now = this.clock.now();
    const today = await this.today();
    const days = await this.settings.get('catalogue.stockCheckDays');
    const [due, late] = await Promise.all([stockChecksDue(this.prisma, now, days), this.lateIds(today)]);
    const dueIds = due.filter((d) => d.kind === 'PROGRAM').map((d) => d.id);
    const attentionWhere = (values: string[]): Prisma.ProgramWhereInput =>
      values.length ? { OR: values.map((v) => ({ id: { in: v === 'to-check' ? dueIds : late } })) } : {};

    const q = query.q && query.q.length >= 2 ? query.q : null;
    const search: Prisma.ProgramWhereInput = q
      ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { promoter: { legalName: { contains: q, mode: 'insensitive' } } }, { promoter: { brandName: { contains: q, mode: 'insensitive' } } }, { region: { nameFr: { contains: q, mode: 'insensitive' } } }] }
      : {};
    type Facet = 'standing' | 'deliveryStatus' | 'promoterId' | 'regionId' | 'attention';
    const criteria = (skip?: Facet): Prisma.ProgramWhereInput => ({
      AND: [
        { deletedAt: null },
        this.viewWhere(query.view ?? 'all'),
        search,
        skip !== 'standing' && query.standing.length ? { standing: { in: query.standing } } : {},
        skip !== 'deliveryStatus' && query.deliveryStatus.length ? { deliveryStatus: { in: query.deliveryStatus } } : {},
        skip !== 'promoterId' && query.promoterId.length ? { promoterId: { in: query.promoterId } } : {},
        skip !== 'regionId' && query.regionId.length ? { regionId: { in: query.regionId } } : {},
        skip !== 'attention' ? attentionWhere(query.attention) : {},
      ],
    });
    const dir = query.sort.startsWith('-') ? 'desc' : 'asc';
    const key = query.sort.replace(/^-/, '');
    const orderBy: Prisma.ProgramOrderByWithRelationInput[] =
      key === 'name' ? [{ name: dir }, { id: 'asc' }]
      : key === 'deliveryDate' ? [{ deliveryDate: { sort: dir, nulls: 'last' } }, { name: 'asc' }, { id: 'asc' }]
      : key === 'priceFrom' ? [{ priceFrom: { sort: dir, nulls: 'last' } }, { name: 'asc' }, { id: 'asc' }]
      : [{ updatedAt: dir }, { id: dir }];

    const where = criteria();
    const [total, rows, byStanding, byDelivery, byPromoter, byRegion, viewCounts, attentionCounts] = await Promise.all([
      this.prisma.program.count({ where }),
      this.prisma.program.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { promoter: { select: { id: true, legalName: true, brandName: true, status: true } }, region: { select: { nameFr: true } }, city: { select: { nameFr: true } }, country: { select: { currency: true } } },
      }),
      this.prisma.program.groupBy({ by: ['standing'], where: criteria('standing'), _count: { _all: true } }),
      this.prisma.program.groupBy({ by: ['deliveryStatus'], where: criteria('deliveryStatus'), _count: { _all: true } }),
      this.prisma.program.groupBy({ by: ['promoterId'], where: criteria('promoterId'), _count: { _all: true } }),
      this.prisma.program.groupBy({ by: ['regionId'], where: criteria('regionId'), _count: { _all: true } }),
      Promise.all(PROGRAM_VIEWS.map((v) => this.prisma.program.count({ where: { deletedAt: null, ...this.viewWhere(v) } }))),
      Promise.all((['to-check', 'late'] as const).map((v) => this.prisma.program.count({ where: { AND: [criteria('attention'), attentionWhere([v])] } }))),
    ]);
    const ids = rows.map((r) => r.id);
    const [covers, lots, promoters, regions] = await Promise.all([
      coversOf(this.prisma, this.references.mediaUrl(), 'PROGRAM', ids),
      this.lotCounts(ids),
      this.prisma.promoter.findMany({ where: { deletedAt: null, programs: { some: { deletedAt: null } } }, select: { id: true, legalName: true, brandName: true }, orderBy: { legalName: 'asc' } }),
      this.prisma.region.findMany({ where: { programs: { some: { deletedAt: null } } }, select: { id: true, nameFr: true }, orderBy: { nameFr: 'asc' } }),
    ]);
    return {
      data: rows.map((p) => {
        const l = lots.get(p.id) ?? { available: 0, total: 0, properties: 0 };
        return {
          id: p.id,
          name: p.name,
          promoter: { id: p.promoter.id, name: promoterName(p.promoter) },
          region: p.region.nameFr,
          city: p.city?.nameFr ?? null,
          standing: p.standing,
          deliveryStatus: p.deliveryStatus,
          deliveryDate: isoDay(p.deliveryDate),
          deliveryDatePrecision: p.deliveryDatePrecision,
          deliveryLate: isOverdue(p.deliveryStatus, p.deliveryDate, p.deliveryDatePrecision, today),
          propertyCount: l.properties,
          lotsAvailable: l.available,
          lotsTotal: l.total,
          priceFrom: dec(p.priceFrom),
          currency: p.country.currency,
          publication: p.publication,
          updatedAt: p.updatedAt.toISOString(),
          cover: covers.get(p.id) ?? null,
          stockCheck: stockCheckState({ publication: p.publication, lotsAvailable: p.lotsAvailable, promoterStatus: p.promoter.status, stockConfirmedAt: p.stockConfirmedAt, firstPublishedAt: p.firstPublishedAt }, now, days),
        };
      }),
      meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
      views: Object.fromEntries(PROGRAM_VIEWS.map((v, i) => [v, viewCounts[i]!])) as Record<ProgramView, number>,
      facets: {
        standing: countsOf(byStanding, 'standing'),
        deliveryStatus: countsOf(byDelivery, 'deliveryStatus'),
        promoterId: countsOf(byPromoter, 'promoterId'),
        regionId: countsOf(byRegion, 'regionId'),
        attention: { 'to-check': attentionCounts[0]!, late: attentionCounts[1]! },
      },
      promoters: promoters.map((p) => ({ id: p.id, name: promoterName(p) })),
      regions: regions.map((r) => ({ id: r.id, name: r.nameFr })),
    };
  }

  /** `GET /admin/programs/{id}` (`catalogue.read`) — CTL-021 … CTL-024. */
  async detail(auth: AuthContext, id: string): Promise<AdminProgramDetail> {
    const staff = await this.views.of(auth);
    const p = await this.prisma.program.findFirst({
      where: { id, deletedAt: null },
      include: {
        promoter: { select: { id: true, legalName: true, brandName: true, status: true } },
        region: { select: { nameFr: true } },
        city: { select: { nameFr: true } },
        country: { select: { nameFr: true, currency: true } },
      },
    });
    if (!p) throw AppError.notFound();
    const now = this.clock.now();
    const today = await this.today();
    const [days, referenceCurrency] = await Promise.all([this.settings.get('catalogue.stockCheckDays'), this.settings.get('display.referenceCurrency')]);
    const props = await this.prisma.property.findMany({
      where: { programId: id, deletedAt: null },
      orderBy: [{ publication: 'asc' }, { type: 'asc' }, { rooms: 'asc' }, { surfaceM2: 'asc' }, { id: 'asc' }],
      select: { id: true, reference: true, title: true, type: true, rooms: true, surfaceM2: true, priceFrom: true, priceTo: true, priceCurrency: true, lotsAvailable: true, lotsTotal: true, publication: true, availability: true, completenessScore: true, programCascadeAt: true },
    });
    const propIds = props.map((x) => x.id);
    const liveIds = props.filter((x) => x.publication !== 'ARCHIVED').map((x) => x.id);
    const mediaUrl = this.references.mediaUrl();
    const [missing, cover, propCovers, lotCount, mediaCount, dossierCount, updateCount, poiCount, impact, stock] = await Promise.all([
      this.programs.publicationMissing(this.prisma as unknown as Tx, id),
      coversOf(this.prisma, mediaUrl, 'PROGRAM', [id], 'card'),
      coversOf(this.prisma, mediaUrl, 'PROPERTY', propIds),
      this.prisma.lot.count({ where: { deletedAt: null, property: { programId: id, deletedAt: null } } }),
      this.prisma.media.count({ where: { ownerType: 'PROGRAM', ownerId: id, deletedAt: null } }),
      this.prisma.dossier.count({ where: { deletedAt: null, OR: [{ programId: id }, { propertyId: { in: propIds } }, { dossierCandidates: { some: { propertyId: { in: propIds } } } }] } }),
      this.prisma.programUpdate.count({ where: { programId: id, deletedAt: null } }),
      this.prisma.propertyPoi.count({ where: { programId: id } }),
      dossierImpact(this.prisma, liveIds),
      stockView(this.prisma, { publication: p.publication, lotsAvailable: p.lotsAvailable, promoterStatus: p.promoter.status, stockConfirmedAt: p.stockConfirmedAt, firstPublishedAt: p.firstPublishedAt, stockConfirmedBy: p.stockConfirmedBy, promoterId: p.promoterId }, now, days),
    ]);
    return {
      id: p.id,
      version: p.version,
      name: p.name,
      slug: p.slug,
      tagline: p.tagline,
      description: p.description,
      standing: p.standing,
      countryCode: p.countryCode,
      country: p.country.nameFr,
      regionId: p.regionId,
      region: p.region.nameFr,
      cityId: p.cityId,
      city: p.city?.nameFr ?? null,
      addressLine: p.addressLine,
      latitude: p.latitude === null ? null : Number(p.latitude),
      longitude: p.longitude === null ? null : Number(p.longitude),
      deliveryStatus: p.deliveryStatus,
      deliveryDate: isoDay(p.deliveryDate),
      deliveryDatePrecision: p.deliveryDatePrecision,
      deliveryLate: isOverdue(p.deliveryStatus, p.deliveryDate, p.deliveryDatePrecision, today),
      totalUnits: p.totalUnits,
      amenities: p.amenities,
      guarantees: p.guarantees,
      highlightLabel: p.highlightLabel,
      highlightUntil: isoDay(p.highlightUntil),
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      publication: p.publication,
      publishedAt: iso(p.publishedAt),
      firstPublishedAt: iso(p.firstPublishedAt),
      promoter: { id: p.promoter.id, name: promoterName(p.promoter), status: p.promoter.status },
      currency: p.country.currency,
      referenceCurrency,
      lotsTotal: p.lotsTotal,
      lotsAvailable: p.lotsAvailable,
      lotsHeld: p.lotsHeld,
      lotsSold: p.lotsSold,
      priceFrom: dec(p.priceFrom),
      priceFromRef: dec(p.priceFromRef),
      cover: cover.get(id) ?? null,
      publicationMissing: missing,
      cascade: {
        unpublished: props.filter((x) => x.publication === 'DRAFT' && x.programCascadeAt).length,
        archived: props.filter((x) => x.publication === 'ARCHIVED' && x.programCascadeAt).length,
      },
      archiveImpact: { properties: liveIds.length, openDossiers: impact.considering },
      stock,
      properties: props.map((x) => ({
        id: x.id,
        reference: x.reference,
        title: x.title,
        type: x.type,
        rooms: x.rooms,
        surfaceM2: x.surfaceM2.toString(),
        priceFrom: dec(x.priceFrom),
        priceTo: dec(x.priceTo),
        currency: x.priceCurrency,
        lotsAvailable: x.lotsAvailable,
        lotsTotal: x.lotsTotal,
        publication: x.publication,
        availability: x.availability,
        completenessScore: x.completenessScore,
        cover: propCovers.get(x.id) ?? null,
      })),
      counts: { properties: props.length, lots: lotCount, media: mediaCount, dossiers: dossierCount, updates: updateCount, pois: poiCount },
      publicPath: p.publication === 'PUBLISHED' ? `/programmes/${p.slug}` : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      can: {
        write: staff.has('catalogue.write'),
        publish: staff.has('catalogue.publish'),
        delete: staff.has('catalogue.delete'),
        eligibility: staff.has('catalogue.eligibility.manage'),
        import: staff.has('catalogue.import'),
      },
    };
  }

  /** `GET /admin/programs/{id}/dossiers` (`catalogue.read`; dossiers within the reader's perimeter) — CTL-021. */
  async dossiers(auth: AuthContext, id: string): Promise<CatalogueDossiers> {
    const p = await this.prisma.program.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!p) throw AppError.notFound();
    const props = await this.prisma.property.findMany({ where: { programId: id, deletedAt: null }, select: { id: true } });
    return catalogueDossiers(this.prisma, await this.views.of(auth), props.map((x) => x.id), id);
  }

  // ─── Lots (CTL-060 … CTL-062) ───────────────────────────────────────────

  /** `GET /admin/programs/{id}/lots`, `GET /admin/properties/{id}/lots` (`catalogue.read`). */
  async lots(scope: { programId: string } | { propertyId: string }): Promise<LotsResponse> {
    let currency: string;
    let typologies: LotsResponse['typologies'] = [];
    let propertyWhere: Prisma.PropertyWhereInput;
    if ('programId' in scope) {
      const program = await this.prisma.program.findFirst({ where: { id: scope.programId, deletedAt: null }, select: { country: { select: { currency: true } } } });
      if (!program) throw AppError.notFound();
      currency = program.country.currency;
      propertyWhere = { programId: scope.programId, deletedAt: null };
      typologies = (
        await this.prisma.property.findMany({ where: propertyWhere, orderBy: [{ type: 'asc' }, { rooms: 'asc' }, { surfaceM2: 'asc' }, { id: 'asc' }], select: { id: true, reference: true, title: true, publication: true } })
      ).map((t) => ({ id: t.id, reference: t.reference, title: t.title, publication: t.publication }));
    } else {
      const property = await this.prisma.property.findFirst({ where: { id: scope.propertyId, deletedAt: null }, select: { priceCurrency: true } });
      if (!property) throw AppError.notFound();
      currency = property.priceCurrency;
      propertyWhere = { id: scope.propertyId };
    }
    const lots = await this.prisma.lot.findMany({
      where: { deletedAt: null, property: propertyWhere },
      orderBy: [{ property: { type: 'asc' } }, { property: { rooms: 'asc' } }, { propertyId: 'asc' }, { sortOrder: 'asc' }, { reference: 'asc' }, { id: 'asc' }],
      include: {
        property: { select: { id: true, reference: true, title: true, publication: true } },
        reservations: { where: { status: { in: ['OPTION', 'RESERVED', 'COMPLETED'] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, optionExpiresAt: true, contractualDeliveryDate: true, dossier: { select: { reference: true } } } },
      },
    });
    const propIds = [...new Set(lots.map((l) => l.propertyId))];
    const lotIds = lots.map((l) => l.id);
    const [considering, targeting, ctx] = await Promise.all([
      this.prisma.dossierCandidate.groupBy({ by: ['propertyId'], where: { propertyId: { in: propIds }, status: { notIn: ['DECLINED', 'UNAVAILABLE'] }, dossier: OPEN_DOSSIER }, _count: { _all: true } }),
      this.prisma.dossierCandidate.groupBy({ by: ['lotId'], where: { lotId: { in: lotIds }, status: { notIn: ['DECLINED', 'UNAVAILABLE'] }, dossier: OPEN_DOSSIER }, _count: { _all: true } }),
      this.caches.context(this.prisma as unknown as Tx),
    ]);
    const consideringBy = countsOf(considering, 'propertyId');
    const targetingBy = countsOf(targeting, 'lotId');
    const ref = ctx.conversion.referenceCurrency;
    const rate = convert('1', currency, ref, ctx.conversion);
    return {
      data: lots.map((l): AdminLot => {
        const r = l.reservations[0];
        const price = l.price.toString();
        const priceRef = convert(price, currency, ref, ctx.conversion);
        return {
          id: l.id,
          version: l.version,
          reference: l.reference,
          referencePending: l.referencePending,
          propertyId: l.propertyId,
          propertyReference: l.property.reference,
          propertyTitle: l.property.title,
          propertyPublication: l.property.publication,
          building: l.building,
          floor: l.floor,
          door: l.door,
          orientation: l.orientation,
          surfaceM2: l.surfaceM2.toString(),
          terraceM2: dec(l.terraceM2),
          landM2: dec(l.landM2),
          price,
          currency,
          priceRef: priceRef && currency !== ref ? priceRef.amount.toFixed(0) : null,
          pricePerM2: Number(l.surfaceM2) > 0 ? Math.round(Number(price) / Number(l.surfaceM2)).toString() : '0',
          status: l.status as AdminLotStatus,
          statusChangedAt: l.statusChangedAt.toISOString(),
          statusNote: l.statusNote,
          externalSale: l.externalSale,
          parkingIncluded: l.parkingIncluded,
          extras: l.extras,
          hasPlan: l.planMediaId !== null,
          deliveredAt: isoDay(l.deliveredAt),
          hold: r ? { kind: r.status === 'OPTION' ? 'OPTION' : r.status === 'RESERVED' ? 'RESERVED' : 'COMPLETED', dossierReference: r.dossier?.reference ?? null, dueAt: iso(r.status === 'OPTION' ? r.optionExpiresAt : null) } : null,
          dossiers: { considering: consideringBy[l.propertyId] ?? 0, targeting: targetingBy[l.id] ?? 0 },
        };
      }),
      typologies,
      currency,
      referenceCurrency: ref,
      rate: rate && currency !== ref ? rate.amount.toString() : null,
    };
  }

  /** `GET /admin/lots/{id}/price-history` (`catalogue.read`) — MOD-231: the audit rows of the lot, latest first. */
  async priceHistory(lotId: string): Promise<LotPriceChange[]> {
    const lot = await this.prisma.lot.findFirst({ where: { id: lotId }, select: { id: true } });
    if (!lot) throw AppError.notFound();
    const rows = await this.prisma.auditLog.findMany({
      where: { entityType: 'lot', entityId: lotId, action: { in: ['lot.created', 'lot.price_changed'] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
      select: { action: true, before: true, after: true, createdAt: true, actorId: true },
    });
    const authors = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.actorId).filter((x): x is string => Boolean(x)) } }, select: { id: true, firstName: true, lastName: true, status: true } });
    const byId = new Map(authors.map((a) => [a.id, staffName(a)]));
    const price = (v: unknown) => (v && typeof v === 'object' && 'price' in v ? String((v as { price: unknown }).price) : null);
    return rows
      .filter((r) => price(r.after) !== null)
      .map((r) => ({ at: r.createdAt.toISOString(), before: r.action === 'lot.created' ? null : price(r.before), after: price(r.after)!, author: r.actorId ? (byId.get(r.actorId) ?? null) : null }));
  }
}
