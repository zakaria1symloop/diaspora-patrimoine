// EA-42, EA-43, EA-46 in reading — CTL-040 (list: origin views, filters with facets, sort, pages, on the server),
// CTL-042 … CTL-045 (the record: completeness card of CAL-050/CAL-051 computed in a rolled-back transaction, what
// publishing lacks per CYC-120, the single lot of a standalone property, what archiving touches), CTL-130 (financing
// eligibility rows) and CTL-150 (the three cards the home shows, and the pins).
import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  PROPERTY_VIEWS,
  propertyListQuerySchema,
  type AdminPropertyDetail,
  type CatalogueDossiers,
  type EligibilityView,
  type FeaturedView,
  type PropertyList,
  type PropertyView,
} from '@dp/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { staffName, StaffViews } from '../back-office/staff-view.js';
import { CatalogueCaches } from '../catalogue-admin/catalogue-caches.js';
import { CatalogueReferenceService } from '../catalogue-admin/catalogue-reference.js';
import { PropertyPublication } from '../catalogue-admin/property-publication.js';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { selectFeatured } from '../public/home.controller.js';
import { catalogueDossiers, countsOf, coversOf, dec, dossierImpact, inRolledBackTx, iso, isoDay, promoterName, stockView } from '../programs-admin/catalogue-read.js';

/** Q-031 — a « real » photo: a ready PHOTO of the property itself that is not marked « Image d'illustration ». */
async function idsWithRealPhoto(prisma: PrismaService): Promise<string[]> {
  const rows = await prisma.media.groupBy({ by: ['ownerId'], where: { ownerType: 'PROPERTY', kind: 'PHOTO', isIllustration: false, processingStatus: 'READY', deletedAt: null }, _count: { _all: true } });
  return rows.map((r) => r.ownerId);
}

@Injectable()
export class PropertiesReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly views: StaffViews,
    private readonly references: CatalogueReferenceService,
    private readonly caches: CatalogueCaches,
    private readonly publication: PropertyPublication,
    private readonly index: CatalogueIndex,
  ) {}

  private viewWhere(view: PropertyView, completeScore: number, realPhotoIds: string[]): Prisma.PropertyWhereInput {
    switch (view) {
      case 'published':
        return { publication: 'PUBLISHED' };
      case 'drafts':
        return { publication: 'DRAFT' };
      case 'to-complete':
        return { publication: 'PUBLISHED', completenessScore: { lt: completeScore } };
      case 'no-real-photo':
        return { publication: { not: 'ARCHIVED' }, id: { notIn: realPhotoIds } };
      case 'reserved-sold':
        return { availability: { in: ['RESERVED', 'SOLD'] }, publication: { not: 'ARCHIVED' } };
      case 'archived':
        return { publication: 'ARCHIVED' };
      default:
        return {};
    }
  }

  /** `GET /admin/properties` (`catalogue.read`) — CTL-040. */
  async list(rawQuery: unknown): Promise<PropertyList> {
    const parsed = propertyListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST);
    const query = parsed.data;
    const [publishMinScore, completeScore, referenceCurrency, realPhotoIds] = await Promise.all([
      this.settings.get('catalogue.publishMinScore'),
      this.settings.get('catalogue.completeScore'),
      this.settings.get('display.referenceCurrency'),
      idsWithRealPhoto(this.prisma),
    ]);
    const q = query.q && query.q.length >= 2 ? query.q : null;
    const search: Prisma.PropertyWhereInput = q
      ? { OR: [{ reference: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }, { searchText: { contains: q.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() } }] }
      : {};
    type Facet = 'type' | 'availability' | 'publication' | 'standing' | 'deliveryStatus' | 'kind' | 'programId' | 'promoterId' | 'regionId';
    const kindWhere = (values: string[]): Prisma.PropertyWhereInput =>
      values.length === 1 ? { programId: values[0] === 'standalone' ? null : { not: null } } : {};
    const criteria = (skip?: Facet): Prisma.PropertyWhereInput => ({
      AND: [
        { deletedAt: null },
        this.viewWhere(query.view ?? 'all', completeScore, realPhotoIds),
        search,
        skip !== 'type' && query.type.length ? { type: { in: query.type } } : {},
        skip !== 'availability' && query.availability.length ? { availability: { in: query.availability } } : {},
        skip !== 'publication' && query.publication.length ? { publication: { in: query.publication } } : {},
        skip !== 'standing' && query.standing.length ? { standing: { in: query.standing } } : {},
        skip !== 'deliveryStatus' && query.deliveryStatus.length ? { deliveryStatus: { in: query.deliveryStatus } } : {},
        skip !== 'kind' ? kindWhere(query.kind) : {},
        skip !== 'programId' && query.programId.length ? { programId: { in: query.programId } } : {},
        skip !== 'promoterId' && query.promoterId.length ? { promoterId: { in: query.promoterId } } : {},
        skip !== 'regionId' && query.regionId.length ? { regionId: { in: query.regionId } } : {},
      ],
    });
    const dir = query.sort.startsWith('-') ? 'desc' : 'asc';
    const key = query.sort.replace(/^-/, '') as 'reference' | 'title' | 'priceFrom' | 'surfaceM2' | 'completenessScore' | 'viewCount' | 'interestCount' | 'updatedAt';
    const orderBy: Prisma.PropertyOrderByWithRelationInput[] =
      key === 'priceFrom' ? [{ priceFromRef: { sort: dir, nulls: 'last' } }, { reference: 'asc' }, { id: 'asc' }]
      : key === 'updatedAt' ? [{ updatedAt: dir }, { id: dir }]
      : [{ [key]: dir }, { reference: 'asc' }, { id: 'asc' }];
    const where = criteria();
    const group = <F extends 'type' | 'availability' | 'publication' | 'standing' | 'deliveryStatus' | 'programId' | 'promoterId' | 'regionId'>(by: F) =>
      this.prisma.property.groupBy({ by: [by], where: criteria(by), _count: { _all: true } }) as unknown as Promise<{ _count: { _all: number } }[]>;
    const [total, rows, byType, byAvail, byPub, byStanding, byDelivery, byProgram, byPromoter, byRegion, standalone, typology, viewCounts] = await Promise.all([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { program: { select: { id: true, name: true } }, promoter: { select: { id: true, legalName: true, brandName: true } }, region: { select: { nameFr: true } } },
      }),
      group('type'),
      group('availability'),
      group('publication'),
      group('standing'),
      group('deliveryStatus'),
      group('programId'),
      group('promoterId'),
      group('regionId'),
      this.prisma.property.count({ where: { AND: [criteria('kind'), { programId: null }] } }),
      this.prisma.property.count({ where: { AND: [criteria('kind'), { programId: { not: null } }] } }),
      Promise.all(PROPERTY_VIEWS.map((v) => this.prisma.property.count({ where: { deletedAt: null, ...this.viewWhere(v, completeScore, realPhotoIds) } }))),
    ]);
    const ids = rows.map((r) => r.id);
    const [ownCovers, programCovers, programs, promoters, regions] = await Promise.all([
      coversOf(this.prisma, this.references.mediaUrl(), 'PROPERTY', ids),
      coversOf(this.prisma, this.references.mediaUrl(), 'PROGRAM', [...new Set(rows.map((r) => r.programId).filter((x): x is string => Boolean(x)))]),
      this.prisma.program.findMany({ where: { deletedAt: null, properties: { some: { deletedAt: null } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.promoter.findMany({ where: { deletedAt: null, properties: { some: { deletedAt: null } } }, select: { id: true, legalName: true, brandName: true }, orderBy: { legalName: 'asc' } }),
      this.prisma.region.findMany({ where: { properties: { some: { deletedAt: null } } }, select: { id: true, nameFr: true }, orderBy: { nameFr: 'asc' } }),
    ]);
    return {
      data: rows.map((p) => ({
        id: p.id,
        reference: p.reference,
        title: p.title,
        program: p.program ? { id: p.program.id, name: p.program.name } : null,
        promoter: { id: p.promoter.id, name: promoterName(p.promoter) },
        region: p.region.nameFr,
        type: p.type,
        rooms: p.rooms,
        surfaceM2: p.surfaceM2.toString(),
        priceFrom: dec(p.priceFrom),
        currency: p.priceCurrency,
        priceFromRef: dec(p.priceFromRef),
        referenceCurrency,
        lotsAvailable: p.lotsAvailable,
        lotsTotal: p.lotsTotal,
        availability: p.availability,
        publication: p.publication,
        completenessScore: p.completenessScore,
        viewCount: p.viewCount,
        interestCount: p.interestCount,
        updatedAt: p.updatedAt.toISOString(),
        cover: ownCovers.get(p.id) ?? (p.programId ? (programCovers.get(p.programId) ?? null) : null),
        featuredRank: p.featuredRank,
      })),
      meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
      views: Object.fromEntries(PROPERTY_VIEWS.map((v, i) => [v, viewCounts[i]!])) as Record<PropertyView, number>,
      facets: {
        type: countsOf(byType, 'type'),
        availability: countsOf(byAvail, 'availability'),
        publication: countsOf(byPub, 'publication'),
        standing: countsOf(byStanding, 'standing'),
        deliveryStatus: countsOf(byDelivery, 'deliveryStatus'),
        kind: { standalone, typology },
        programId: countsOf(byProgram, 'programId'),
        promoterId: countsOf(byPromoter, 'promoterId'),
        regionId: countsOf(byRegion, 'regionId'),
      },
      programs: programs.map((p) => ({ id: p.id, name: p.name })),
      promoters: promoters.map((p) => ({ id: p.id, name: promoterName(p) })),
      regions: regions.map((r) => ({ id: r.id, name: r.nameFr })),
      thresholds: { publishMinScore, completeScore },
    };
  }

  /** `GET /admin/properties/{id}` (`catalogue.read`) — CTL-042 … CTL-044, CTL-063. */
  async detail(auth: AuthContext, id: string): Promise<AdminPropertyDetail> {
    const staff = await this.views.of(auth);
    const p = await this.prisma.property.findFirst({
      where: { id, deletedAt: null },
      include: {
        program: { select: { id: true, name: true, publication: true, deliveryStatus: true, deliveryDate: true, deliveryDatePrecision: true } },
        promoter: { select: { id: true, legalName: true, brandName: true, status: true } },
        region: { select: { nameFr: true } },
        city: { select: { nameFr: true } },
        country: { select: { nameFr: true } },
        lots: { where: { deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!p) throw AppError.notFound();
    const now = this.clock.now();
    const [days, referenceCurrency] = await Promise.all([this.settings.get('catalogue.stockCheckDays'), this.settings.get('display.referenceCurrency')]);
    // CAL-050, CYC-120 — the derived facts as a write would compute them, in a transaction that is rolled back.
    const derived = await inRolledBackTx(this.prisma, async (tx) => {
      const ctx = await this.caches.context(tx);
      const facts = await this.caches.recalcProperty(tx, id, ctx);
      const missing = await this.publication.missing(tx, id, ctx);
      return { facts, missing, thresholds: ctx.thresholds };
    });
    const c = derived.facts.completeness;
    const ownImages = await this.prisma.media.count({ where: { ownerType: 'PROPERTY', ownerId: id, kind: { in: ['PHOTO', 'RENDER_3D'] }, processingStatus: 'READY', deletedAt: null } });
    const mediaUrl = this.references.mediaUrl();
    const [ownCover, programCover, mediaCount, impact, leadCount, dossierCount, reservations] = await Promise.all([
      coversOf(this.prisma, mediaUrl, 'PROPERTY', [id], 'card'),
      p.programId ? coversOf(this.prisma, mediaUrl, 'PROGRAM', [p.programId], 'card') : Promise.resolve(new Map()),
      this.prisma.media.count({ where: { ownerType: 'PROPERTY', ownerId: id, deletedAt: null } }),
      dossierImpact(this.prisma, [id]),
      this.prisma.lead.count({ where: { propertyId: id } }),
      this.prisma.dossier.count({ where: { deletedAt: null, OR: [{ propertyId: id }, { dossierCandidates: { some: { propertyId: id } } }] } }),
      this.prisma.reservation.count({ where: { lot: { propertyId: id } } }),
    ]);
    const lot = !p.programId ? p.lots[0] : undefined;
    return {
      id: p.id,
      version: p.version,
      reference: p.reference,
      slug: p.slug,
      title: p.title,
      titleAuto: p.titleAuto,
      description: p.description,
      descriptionAuto: p.descriptionAuto,
      type: p.type,
      rooms: p.rooms,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      surfaceM2: p.surfaceM2.toString(),
      terraceM2: dec(p.terraceM2),
      landM2: dec(p.landM2),
      features: p.features,
      standing: p.standing,
      deliveryStatus: p.deliveryStatus,
      deliveryDate: isoDay(p.deliveryDate),
      deliveryDatePrecision: p.deliveryDatePrecision,
      deliveryOverridden: p.deliveryOverridden,
      countryCode: p.countryCode,
      country: p.country.nameFr,
      regionId: p.regionId,
      region: p.region.nameFr,
      cityId: p.cityId,
      city: p.city?.nameFr ?? null,
      addressLine: p.addressLine,
      latitude: p.latitude === null ? null : Number(p.latitude),
      longitude: p.longitude === null ? null : Number(p.longitude),
      highlightLabel: p.highlightLabel,
      highlightUntil: isoDay(p.highlightUntil),
      featuredRank: p.featuredRank,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      publication: p.publication,
      availability: p.availability,
      publishedAt: iso(p.publishedAt),
      firstPublishedAt: iso(p.firstPublishedAt),
      unpublishedAt: iso(p.unpublishedAt),
      program: p.program
        ? { id: p.program.id, name: p.program.name, publication: p.program.publication, deliveryStatus: p.program.deliveryStatus, deliveryDate: isoDay(p.program.deliveryDate), deliveryDatePrecision: p.program.deliveryDatePrecision }
        : null,
      promoter: { id: p.promoter.id, name: promoterName(p.promoter), status: p.promoter.status },
      currency: p.priceCurrency,
      referenceCurrency,
      priceFrom: dec(p.priceFrom),
      priceTo: dec(p.priceTo),
      priceFromRef: dec(p.priceFromRef),
      lotsTotal: p.lots.length,
      lotsAvailable: p.lots.filter((l) => l.status === 'AVAILABLE').length,
      lotsTaken: p.lots.filter((l) => l.status !== 'AVAILABLE' && l.status !== 'WITHDRAWN').length,
      viewCount: p.viewCount,
      interestCount: p.interestCount,
      cover: ownCover.get(id) ?? (p.programId ? (programCover.get(p.programId) ?? null) : null),
      usesProgramPhotos: Boolean(p.programId) && ownImages === 0,
      completeness: {
        score: c.score,
        state: c.missingMandatory.length || !c.publishable ? 'DRAFT' : c.complete ? 'COMPLETE' : 'PUBLISHABLE',
        missingMandatory: c.missingMandatory,
        actions: c.actions.slice(0, 3).map((a) => ({ code: a.code, gain: a.gain, mandatory: a.mandatory, ...(a.count !== undefined ? { count: a.count } : {}) })),
        publishMinScore: derived.thresholds.publishMinScore,
        completeScore: derived.thresholds.completeScore,
      },
      publicationMissing: derived.missing,
      identityLocked: Boolean(p.firstPublishedAt) && p.interestCount > 0,
      lot: lot
        ? { id: lot.id, version: lot.version, price: lot.price.toString(), floor: lot.floor, orientation: lot.orientation, parkingIncluded: lot.parkingIncluded, extras: lot.extras, building: lot.building, door: lot.door, status: lot.status, statusNote: lot.statusNote, externalSale: lot.externalSale, deliveredAt: isoDay(lot.deliveredAt) }
        : null,
      stock: p.programId
        ? null
        : await stockView(this.prisma, { publication: p.publication, lotsAvailable: p.lotsAvailable, promoterStatus: p.promoter.status, stockConfirmedAt: p.stockConfirmedAt, firstPublishedAt: p.firstPublishedAt, stockConfirmedBy: p.stockConfirmedBy, promoterId: p.promoterId }, now, days),
      archiveImpact: { considering: impact.considering, selected: impact.selected },
      deleteBlocked: leadCount + dossierCount + reservations > 0,
      counts: { lots: p.lots.length, media: mediaCount, dossiers: dossierCount, leads: leadCount },
      publicPath: p.publication === 'PUBLISHED' ? `/biens/${p.slug}` : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      can: { write: staff.has('catalogue.write'), publish: staff.has('catalogue.publish'), delete: staff.has('catalogue.delete'), eligibility: staff.has('catalogue.eligibility.manage') },
    };
  }

  /** `GET /admin/properties/{id}/dossiers` — CTL-045. */
  async dossiers(auth: AuthContext, id: string): Promise<CatalogueDossiers> {
    const p = await this.prisma.property.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!p) throw AppError.notFound();
    return catalogueDossiers(this.prisma, await this.views.of(auth), [id], null);
  }

  /** `GET /admin/programs/{id}/eligibility`, `/admin/properties/{id}/eligibility` — CTL-130, MOD-240. */
  async eligibility(scope: { programId: string } | { propertyId: string }): Promise<EligibilityView> {
    const banks = await this.prisma.bank.findMany({ where: { deletedAt: null, status: 'ACTIVE' }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } });
    let programId: string | null = null;
    let eligible = false;
    if ('programId' in scope) {
      const p = await this.prisma.program.findFirst({ where: { id: scope.programId, deletedAt: null }, select: { id: true } });
      if (!p) throw AppError.notFound();
      programId = p.id;
      eligible = (await this.prisma.property.count({ where: { programId: p.id, deletedAt: null, financingEligible: true } })) > 0;
    } else {
      const p = await this.prisma.property.findFirst({ where: { id: scope.propertyId, deletedAt: null }, select: { id: true, programId: true, financingEligible: true } });
      if (!p) throw AppError.notFound();
      programId = p.programId;
      eligible = p.financingEligible;
    }
    const own = await this.prisma.financingEligibility.findMany({ where: 'programId' in scope ? { programId: scope.programId } : { propertyId: scope.propertyId } });
    const inherited = 'propertyId' in scope && programId ? await this.prisma.financingEligibility.findMany({ where: { programId } }) : [];
    const users = await this.prisma.user.findMany({ where: { id: { in: own.map((r) => r.checkedById).filter((x): x is string => Boolean(x)) } }, select: { id: true, firstName: true, lastName: true, status: true } });
    const names = new Map(users.map((u) => [u.id, staffName(u)]));
    return {
      rows: banks.map((b) => {
        const row = own.find((r) => r.bankId === b.id);
        const parent = inherited.find((r) => r.bankId === b.id);
        return {
          bankId: b.id,
          bankName: b.name,
          accepted: row ? row.accepted : null,
          note: row?.note ?? null,
          checkedAt: row ? isoDay(row.checkedAt) : null,
          checkedBy: row?.checkedById ? (names.get(row.checkedById) ?? null) : null,
          inherited: parent ? { accepted: parent.accepted, note: parent.note, checkedAt: isoDay(parent.checkedAt)! } : null,
        };
      }),
      eligible,
    };
  }

  /** `GET /admin/featured` — CTL-150: the three cards of the home now (ACC-051, same selection), and the pins. */
  async featured(auth: AuthContext): Promise<FeaturedView> {
    const staff = await this.views.of(auth);
    const rows = await this.index.rows();
    const listable = rows.filter((p) => p.availability === 'AVAILABLE' || p.availability === 'RESERVED');
    const shown = selectFeatured(listable);
    const pinned = await this.prisma.property.findMany({
      where: { deletedAt: null, featuredRank: { not: null } },
      orderBy: { featuredRank: 'asc' },
      select: { id: true, reference: true, title: true, priceFrom: true, priceCurrency: true, featuredRank: true, publication: true, availability: true, programId: true, region: { select: { nameFr: true } } },
    });
    const shownIds = shown.map((s) => s.id);
    const all = await this.prisma.property.findMany({
      where: { id: { in: shownIds } },
      select: { id: true, reference: true, title: true, priceFrom: true, priceCurrency: true, featuredRank: true, programId: true, region: { select: { nameFr: true } } },
    });
    const mediaUrl = this.references.mediaUrl();
    const ids = [...new Set([...shownIds, ...pinned.map((p) => p.id)])];
    const programIds = [...new Set([...all, ...pinned].map((p) => p.programId).filter((x): x is string => Boolean(x)))];
    const [ownCovers, programCovers] = await Promise.all([coversOf(this.prisma, mediaUrl, 'PROPERTY', ids, 'card'), coversOf(this.prisma, mediaUrl, 'PROGRAM', programIds, 'card')]);
    const card = (p: (typeof all)[number], source: 'PINNED' | 'AUTO') => ({
      propertyId: p.id,
      reference: p.reference,
      title: p.title,
      region: p.region.nameFr,
      priceFrom: dec(p.priceFrom),
      currency: p.priceCurrency,
      cover: ownCovers.get(p.id) ?? (p.programId ? (programCovers.get(p.programId) ?? null) : null),
      source,
      rank: p.featuredRank,
    });
    return {
      shown: shownIds.map((sid) => all.find((a) => a.id === sid)).filter((x): x is (typeof all)[number] => Boolean(x)).map((p) => card(p, p.featuredRank !== null ? 'PINNED' : 'AUTO')),
      pins: pinned.map((p) => ({ ...card(p, 'PINNED'), state: shownIds.includes(p.id) ? 'SHOWN' : p.publication !== 'PUBLISHED' ? 'OFFLINE' : 'UNAVAILABLE' })),
      canPublish: staff.has('catalogue.publish'),
    };
  }
}
