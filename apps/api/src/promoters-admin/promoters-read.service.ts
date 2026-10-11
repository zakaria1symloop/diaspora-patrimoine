// EA-50, EA-51 in reading — CTL-001 (list: origin views, filters with facets, sort, pages, on the server), CTL-003 (the
// record: the convention's terms only for `partner.convention.manage`), CTL-004 (what a suspension or an end would
// unpublish, announced before confirming), CTL-005 (the relation over a period, with the definitions of the rule) and
// « Ce que nous attendons de lui » (ACP-015, ACP-020: what the state of the objects shows the promoter owes us — ONE
// definition, also read by the scheduled watch).
import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  PROMOTER_VIEWS,
  promoterListQuerySchema,
  type AdminPromoterDetail,
  type ConventionState,
  type Expectation,
  type PromoterExpectations,
  type PromoterImpact,
  type PromoterList,
  type PromoterRelation,
  type PromoterView,
  type VettingLine,
} from '@dp/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { localDate } from '../platform/holidays.service.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { clientName, maskName, staffName, StaffViews } from '../back-office/staff-view.js';
import { CatalogueReferenceService, adminImageRef } from '../catalogue-admin/catalogue-reference.js';
import { stockChecksDue } from '../catalogue-admin/stock-check.js';
import { isOverdue, periodEnd } from '../catalogue/delivery.js';
import { countsOf, iso, isoDay, promoterName } from '../programs-admin/catalogue-read.js';

const DAY = 86_400_000;
const OPEN: Prisma.DossierWhereInput = { status: { in: ['OPEN', 'ON_HOLD'] }, deletedAt: null };

/** Q-003 — the lines proposed at creation, editable. */
export const DEFAULT_VETTING = ['Registre de commerce vérifié', 'Agrément de promoteur vérifié', 'Références de programmes livrés', 'Garanties du programme examinées', 'Chantier ou programme livré visité', 'Convention signée'];

/** AUT-073 — expired, or within 30 days. */
export function expiryState(date: Date | null, today: string): ConventionState {
  if (!date) return 'NONE';
  const d = date.toISOString().slice(0, 10);
  if (d < today) return 'EXPIRED';
  const limit = new Date(`${today}T00:00:00Z`).getTime() + 30 * DAY;
  return date.getTime() <= limit ? 'EXPIRING' : 'OK';
}

@Injectable()
export class PromotersReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly views: StaffViews,
    private readonly references: CatalogueReferenceService,
  ) {}

  async today(): Promise<string> {
    return localDate(this.clock.now(), await this.settings.get('business.calendar.timezone'));
  }

  private viewWhere(view: PromoterView): Prisma.PromoterWhereInput {
    if (view === 'selected') return { status: 'ACTIVE' };
    if (view === 'prospects') return { status: 'PROSPECT' };
    if (view === 'suspended-ended') return { status: { in: ['SUSPENDED', 'ENDED'] } };
    return {};
  }

  /** `GET /admin/promoters` (`promoter.read`) — CTL-001. */
  async list(rawQuery: unknown): Promise<PromoterList> {
    const parsed = promoterListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST);
    const q = parsed.data;
    const today = await this.today();
    const t0 = new Date(`${today}T00:00:00Z`);
    const t30 = new Date(t0.getTime() + 30 * DAY);
    const conventionWhere = (v: string): Prisma.PromoterWhereInput =>
      v === 'expired' ? { conventionExpiresAt: { lt: t0 } } : v === 'expiring' ? { conventionExpiresAt: { gte: t0, lte: t30 } } : { conventionExpiresAt: null };
    const search: Prisma.PromoterWhereInput = q.q && q.q.length >= 2 ? { OR: [{ legalName: { contains: q.q, mode: 'insensitive' } }, { brandName: { contains: q.q, mode: 'insensitive' } }, { registrationNumber: { contains: q.q, mode: 'insensitive' } }] } : {};
    type Facet = 'regionId' | 'convention' | 'isPublic';
    const criteria = (skip?: Facet): Prisma.PromoterWhereInput => ({
      AND: [
        { deletedAt: null },
        this.viewWhere(q.view ?? 'selected'),
        search,
        skip !== 'regionId' && q.regionId.length ? { regionId: { in: q.regionId } } : {},
        skip !== 'convention' && q.convention.length ? { OR: q.convention.map(conventionWhere) } : {},
        skip !== 'isPublic' && q.isPublic ? { isPublic: q.isPublic === 'true' } : {},
      ],
    });
    const dir = q.sort.startsWith('-') ? 'desc' : 'asc';
    const key = q.sort.replace(/^-/, '');
    const orderBy: Prisma.PromoterOrderByWithRelationInput[] =
      key === 'conventionExpiresAt' ? [{ conventionExpiresAt: { sort: dir, nulls: 'last' } }, { legalName: 'asc' }, { id: 'asc' }] : key === 'updatedAt' ? [{ updatedAt: dir }, { id: dir }] : [{ legalName: dir }, { id: 'asc' }];
    const where = criteria();
    const [total, rows, byRegion, byPublic, convCounts, viewCounts] = await Promise.all([
      this.prisma.promoter.count({ where }),
      this.prisma.promoter.findMany({ where, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { region: { select: { nameFr: true } }, logoMedia: true } }),
      this.prisma.promoter.groupBy({ by: ['regionId'], where: criteria('regionId'), _count: { _all: true } }),
      this.prisma.promoter.groupBy({ by: ['isPublic'], where: criteria('isPublic'), _count: { _all: true } }),
      Promise.all((['expiring', 'expired', 'none'] as const).map((v) => this.prisma.promoter.count({ where: { AND: [criteria('convention'), conventionWhere(v)] } }))),
      Promise.all(PROMOTER_VIEWS.map((v) => this.prisma.promoter.count({ where: { deletedAt: null, ...this.viewWhere(v) } }))),
    ]);
    const ids = rows.map((r) => r.id);
    const [programs, published, dossiers, regions] = await Promise.all([
      this.prisma.program.groupBy({ by: ['promoterId'], where: { promoterId: { in: ids }, deletedAt: null }, _count: { _all: true } }),
      this.prisma.property.groupBy({ by: ['promoterId'], where: { promoterId: { in: ids }, deletedAt: null, publication: 'PUBLISHED' }, _count: { _all: true } }),
      this.prisma.dossier.groupBy({ by: ['promoterId'], where: { ...OPEN, promoterId: { in: ids } }, _count: { _all: true } }),
      this.prisma.region.findMany({ where: { promoters: { some: { deletedAt: null } } }, select: { id: true, nameFr: true }, orderBy: { nameFr: 'asc' } }),
    ]);
    const by = (rowsIn: { _count: { _all: number } }[]) => countsOf(rowsIn, 'promoterId');
    const [pc, pp, od] = [by(programs), by(published), by(dossiers)];
    const mediaUrl = this.references.mediaUrl();
    return {
      data: rows.map((p) => ({
        id: p.id,
        name: promoterName(p),
        legalName: p.legalName,
        status: p.status,
        region: p.region?.nameFr ?? null,
        programCount: pc[p.id] ?? 0,
        publishedProperties: pp[p.id] ?? 0,
        openDossiers: od[p.id] ?? 0,
        conventionExpiresAt: isoDay(p.conventionExpiresAt),
        conventionState: expiryState(p.conventionExpiresAt, today),
        isPublic: p.isPublic,
        logo: adminImageRef(mediaUrl, p.logoMedia && !p.logoMedia.deletedAt ? p.logoMedia : null, 'thumb'),
        updatedAt: p.updatedAt.toISOString(),
      })),
      meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
      views: Object.fromEntries(PROMOTER_VIEWS.map((v, i) => [v, viewCounts[i]!])) as Record<PromoterView, number>,
      facets: {
        regionId: countsOf(byRegion, 'regionId'),
        convention: { expiring: convCounts[0]!, expired: convCounts[1]!, none: convCounts[2]! },
        isPublic: Object.fromEntries(byPublic.map((r) => [String(r.isPublic), r._count._all])),
      },
      regions: regions.map((r) => ({ id: r.id, name: r.nameFr })),
    };
  }

  /** `GET /admin/promoters/{id}` (`promoter.read`) — CTL-003. */
  async detail(auth: AuthContext, id: string): Promise<AdminPromoterDetail> {
    const staff = await this.views.of(auth);
    const p = await this.prisma.promoter.findFirst({
      where: { id, deletedAt: null },
      include: {
        region: { select: { nameFr: true } },
        city: { select: { nameFr: true } },
        country: { select: { nameFr: true } },
        logoMedia: true,
        coverMedia: true,
        accountManager: { select: { firstName: true, lastName: true, status: true } },
        promoterContacts: { orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }] },
      },
    });
    if (!p) throw AppError.notFound();
    const today = await this.today();
    const [documents, programs, standalone, openDossiers, suspended] = await Promise.all([
      this.prisma.partnerDocument.findMany({ where: { ownerType: 'PROMOTER', ownerId: id, deletedAt: null }, orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }] }),
      this.prisma.program.findMany({
        where: { promoterId: id, deletedAt: null },
        orderBy: [{ publication: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, publication: true, region: { select: { nameFr: true } }, properties: { where: { deletedAt: null }, orderBy: { reference: 'asc' }, select: { id: true, reference: true, title: true, publication: true, availability: true, lots: { where: { deletedAt: null }, select: { status: true } } } } },
      }),
      this.prisma.property.findMany({ where: { promoterId: id, programId: null, deletedAt: null }, orderBy: { reference: 'asc' }, select: { id: true, reference: true, title: true, publication: true, availability: true } }),
      this.prisma.dossier.count({ where: { ...OPEN, promoterId: id } }),
      Promise.all([
        this.prisma.program.aggregate({ where: { promoterId: id, deletedAt: null, unpublishedBySuspensionAt: { not: null } }, _count: { _all: true }, _max: { unpublishedBySuspensionAt: true } }),
        this.prisma.property.aggregate({ where: { promoterId: id, deletedAt: null, unpublishedBySuspensionAt: { not: null } }, _count: { _all: true }, _max: { unpublishedBySuspensionAt: true } }),
      ]),
    ]);
    const mediaUrl = this.references.mediaUrl();
    const nProperties = programs.reduce((n, x) => n + x.properties.length, 0) + standalone.length;
    const susCount = suspended[0]._count._all + suspended[1]._count._all;
    const susDate = [suspended[0]._max.unpublishedBySuspensionAt, suspended[1]._max.unpublishedBySuspensionAt].filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0];
    const convention = staff.has('partner.convention.manage');
    const checklist = Array.isArray(p.vettingChecklist) ? (p.vettingChecklist as unknown as VettingLine[]) : DEFAULT_VETTING.map((label) => ({ label, done: false, note: null }));
    return {
      id: p.id,
      version: p.version,
      name: promoterName(p),
      legalName: p.legalName,
      brandName: p.brandName,
      slug: p.slug,
      status: p.status,
      statusReason: p.statusReason,
      statusChangedAt: iso(p.statusChangedAt),
      countryCode: p.countryCode,
      country: p.country.nameFr,
      registrationNumber: p.registrationNumber,
      taxId: p.taxId,
      licenseNumber: p.licenseNumber,
      addressLine: p.addressLine,
      regionId: p.regionId,
      region: p.region?.nameFr ?? null,
      cityId: p.cityId,
      city: p.city?.nameFr ?? null,
      website: p.website,
      email: p.email,
      phone: p.phone,
      descriptionPublic: p.descriptionPublic,
      referencesPublic: p.referencesPublic,
      foundedYear: p.foundedYear,
      deliveredUnits: p.deliveredUnits,
      isPublic: p.isPublic,
      logo: adminImageRef(mediaUrl, p.logoMedia && !p.logoMedia.deletedAt ? p.logoMedia : null, 'card'),
      cover: adminImageRef(mediaUrl, p.coverMedia && !p.coverMedia.deletedAt ? p.coverMedia : null, 'card'),
      vettingChecklist: checklist.map((l) => ({ label: l.label, done: Boolean(l.done), note: l.note ?? null })),
      vettedAt: isoDay(p.vettedAt),
      conventionSignedAt: isoDay(p.conventionSignedAt),
      conventionExpiresAt: isoDay(p.conventionExpiresAt),
      conventionState: expiryState(p.conventionExpiresAt, today),
      ...(convention ? { commissionTerms: p.commissionTerms } : {}),
      accountManager: staffName(p.accountManager),
      contacts: p.promoterContacts.map((c) => ({ id: c.id, fullName: c.fullName, role: c.role, email: c.email, phone: c.phone, isPrimary: c.isPrimary, notes: c.notes, hasAccount: c.userId !== null })),
      documents: documents.map((d) => ({
        id: d.id,
        label: d.label,
        category: d.category,
        issuedAt: isoDay(d.issuedAt),
        expiresAt: isoDay(d.expiresAt),
        expiry: expiryState(d.expiresAt, today) as AdminPromoterDetail['documents'][number]['expiry'],
        fileName: d.fileName,
        sizeBytes: d.sizeBytes,
        mimeType: d.mimeType,
        scanStatus: d.scanStatus,
        createdAt: d.createdAt.toISOString(),
      })),
      programs: programs.map((x) => ({
        id: x.id,
        name: x.name,
        publication: x.publication,
        region: x.region.nameFr,
        lotsAvailable: x.properties.reduce((n, y) => n + y.lots.filter((l) => l.status === 'AVAILABLE').length, 0),
        lotsTotal: x.properties.reduce((n, y) => n + y.lots.length, 0),
        properties: x.properties.map((y) => ({ id: y.id, reference: y.reference, title: y.title, publication: y.publication, availability: y.availability })),
      })),
      standalone: standalone.map((y) => ({ id: y.id, reference: y.reference, title: y.title, publication: y.publication, availability: y.availability })),
      suspension: susCount > 0 && susDate ? { count: susCount, date: susDate.toISOString() } : null,
      counts: { programs: programs.length, properties: nProperties, openDossiers, documents: documents.length, contacts: p.promoterContacts.length },
      deleteBlocked: programs.length + nProperties > 0 || (await this.prisma.dossier.count({ where: { promoterId: id, deletedAt: null } })) > 0,
      publicPath: p.isPublic && p.status === 'ACTIVE' ? `/promoteurs/${p.slug}` : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      can: { write: staff.has('promoter.write'), convention, delete: staff.has('promoter.delete'), publish: staff.has('catalogue.publish') },
    };
  }

  /** CTL-004, MOD-110 — what « Suspendre » or « Terminer » would unpublish, and the open dossiers concerned. */
  async impact(id: string): Promise<PromoterImpact> {
    const p = await this.prisma.promoter.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!p) throw AppError.notFound();
    const [programs, properties, dossiers] = await Promise.all([
      this.prisma.program.count({ where: { promoterId: id, deletedAt: null, publication: 'PUBLISHED' } }),
      this.prisma.property.count({ where: { promoterId: id, deletedAt: null, publication: 'PUBLISHED' } }),
      this.prisma.dossier.findMany({ where: { ...OPEN, OR: [{ promoterId: id }, { property: { promoterId: id } }] }, select: { assignedAgentId: true } }),
    ]);
    return { programs, properties, openDossiers: dossiers.length, advisers: new Set(dossiers.map((d) => d.assignedAgentId).filter(Boolean)).size };
  }

  /** `GET /admin/promoters/{id}/relation?from=&to=` — CTL-005, with the definitions of the rule (M21 uses the same). */
  async relation(auth: AuthContext, id: string, query: Record<string, unknown>): Promise<PromoterRelation> {
    const staff = await this.views.of(auth);
    const p = await this.prisma.promoter.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!p) throw AppError.notFound();
    const day = /^\d{4}-\d{2}-\d{2}$/;
    const today = await this.today();
    const to = typeof query.to === 'string' && day.test(query.to) ? query.to : today;
    const from = typeof query.from === 'string' && day.test(query.from) ? query.from : new Date(new Date(`${to}T00:00:00Z`).getTime() - 89 * DAY).toISOString().slice(0, 10);
    if (Object.keys(query).some((k) => k !== 'from' && k !== 'to') || from > to) throw new AppError(ErrorCode.BAD_REQUEST);
    const range = { gte: new Date(`${from}T00:00:00Z`), lt: new Date(new Date(`${to}T00:00:00Z`).getTime() + DAY) };
    const mine: Prisma.PropertyWhereInput = { promoterId: id };
    const [proposed, interests, visits, optionsNow, reservations, sales, externalSales, closed, open, holds] = await Promise.all([
      this.prisma.dossierCandidate.count({ where: { origin: 'ADVISOR_PROPOSAL', sentAt: range, property: mine } }),
      this.prisma.lead.count({ where: { kind: 'PROPERTY_INTEREST', createdAt: range, OR: [{ property: mine }, { program: { promoterId: id } }] } }),
      this.prisma.appointment.count({ where: { type: { in: ['PROPERTY_VISIT', 'VISIO'] }, status: 'DONE', startsAt: range, property: mine } }),
      this.prisma.reservation.count({ where: { status: 'OPTION', lot: { property: mine } } }),
      this.prisma.reservation.count({ where: { reservedAt: range, lot: { property: mine } } }),
      this.prisma.dossier.count({ where: { status: 'WON', wonAt: range, property: mine } }),
      this.prisma.lot.count({ where: { status: 'SOLD', externalSale: true, statusChangedAt: range, property: mine } }),
      this.prisma.dossier.groupBy({ by: ['lostReason'], where: { status: 'LOST', lostAt: range, promoterId: id }, _count: { _all: true } }),
      this.prisma.dossier.findMany({
        where: { AND: [OPEN, staff.scoped ? { assignedAgentId: staff.userId } : {}, { property: mine }] },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: 100,
        select: { id: true, reference: true, stage: true, client: { select: { firstName: true, lastName: true } }, property: { select: { reference: true, title: true } }, lot: { select: { reference: true } }, assignedAgent: { select: { firstName: true, lastName: true, status: true } } },
      }),
      this.prisma.reservation.findMany({
        where: { status: { in: ['OPTION', 'RESERVED'] }, lot: { property: mine } },
        orderBy: [{ optionExpiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
        take: 100,
        select: { id: true, reference: true, status: true, optionExpiresAt: true, lot: { select: { reference: true, property: { select: { title: true } } } }, dossier: { select: { reference: true } } },
      }),
    ]);
    return {
      from,
      to,
      figures: {
        proposed,
        interests,
        visits,
        optionsNow,
        reservations,
        sales,
        externalSales,
        closed: closed.reduce((n, r) => n + r._count._all, 0),
        closedByReason: Object.fromEntries(closed.map((r) => [r.lostReason ?? 'OTHER', r._count._all])),
      },
      openDossiers: open.map((d) => ({
        id: d.id,
        reference: d.reference,
        clientName: staff.masked ? maskName(d.client.firstName, d.client.lastName) : clientName(d.client),
        property: d.property ? `${d.property.reference} · ${d.property.title}` : '',
        lot: d.lot?.reference ?? null,
        stage: d.stage,
        agentName: staffName(d.assignedAgent),
      })),
      holds: holds.map((r) => ({ id: r.id, reference: r.reference, kind: r.status === 'OPTION' ? 'OPTION' : 'RESERVED', lot: r.lot.reference, property: r.lot.property.title, dossierReference: r.dossier.reference, dueAt: iso(r.status === 'OPTION' ? r.optionExpiresAt : null) })),
    };
  }

  /**
   * ACP-015, ACP-020 — « Ce que nous attendons de lui »: what the objects show the promoter owes us, each line with its
   * deadline, since when it waits, and where its gesture is entered. Written ONCE: the link (level 2) and the portal
   * (level 3) will read the same list.
   */
  async expectations(id: string): Promise<PromoterExpectations> {
    const p = await this.prisma.promoter.findFirst({ where: { id, deletedAt: null }, select: { id: true, conventionExpiresAt: true, status: true } });
    if (!p) throw AppError.notFound();
    const now = this.clock.now();
    const today = await this.today();
    const days = await this.settings.get('catalogue.stockCheckDays');
    const mine: Prisma.PropertyWhereInput = { promoterId: id };
    const items: Expectation[] = [];
    const dossierHref = (ref: string) => `/dossiers/${ref.toLowerCase()}`;
    const [stock, programs, properties, options, reservations, ended, visits, documents] = await Promise.all([
      stockChecksDue(this.prisma, now, days, id),
      this.prisma.program.findMany({ where: { promoterId: id, deletedAt: null, publication: { not: 'ARCHIVED' }, deliveryStatus: { not: 'DELIVERED' } }, select: { id: true, name: true, deliveryStatus: true, deliveryDate: true, deliveryDatePrecision: true } }),
      this.prisma.property.findMany({ where: { promoterId: id, programId: null, deletedAt: null, publication: { not: 'ARCHIVED' }, deliveryStatus: { not: 'DELIVERED' } }, select: { id: true, reference: true, deliveryStatus: true, deliveryDate: true, deliveryDatePrecision: true } }),
      this.prisma.reservation.findMany({ where: { status: 'OPTION', lot: { property: mine } }, select: { createdAt: true, optionExpiresAt: true, optionAcknowledgedAt: true, lot: { select: { reference: true } }, dossier: { select: { reference: true } } } }),
      this.prisma.reservation.findMany({ where: { status: 'RESERVED', contractDocumentId: null, lot: { property: mine } }, select: { reservedAt: true, createdAt: true, lot: { select: { reference: true } }, dossier: { select: { reference: true } } } }),
      this.prisma.reservation.findMany({ where: { status: { in: ['CANCELLED', 'EXPIRED'] }, depositPaidAt: { not: null }, depositRefundStatus: { in: ['NONE', 'DUE'] }, lot: { property: mine } }, select: { cancelledAt: true, expiredAt: true, updatedAt: true, lot: { select: { reference: true } }, dossier: { select: { reference: true } } } }),
      this.prisma.appointment.findMany({ where: { type: 'PROPERTY_VISIT', status: 'CONFIRMED', startsAt: { gt: now }, hostName: null, property: mine }, select: { startsAt: true, createdAt: true, property: { select: { reference: true } }, dossier: { select: { reference: true } } } }),
      this.prisma.partnerDocument.findMany({ where: { ownerType: 'PROMOTER', ownerId: id, deletedAt: null, expiresAt: { lte: new Date(now.getTime() + 30 * DAY) } }, select: { label: true, expiresAt: true } }),
    ]);
    for (const o of options) {
      const ref = o.dossier.reference;
      if (!o.optionAcknowledgedAt) items.push({ kind: 'OPTION_ANSWER', label: `${o.lot.reference} · ${ref}`, dueAt: iso(o.optionExpiresAt), since: o.createdAt.toISOString(), href: dossierHref(ref) });
      else items.push({ kind: 'RESERVATION_CONFIRM', label: `${o.lot.reference} · ${ref}`, dueAt: iso(o.optionExpiresAt), since: o.optionAcknowledgedAt.toISOString(), href: dossierHref(ref) });
    }
    for (const r of reservations) items.push({ kind: 'DOCUMENT_PROVIDE', label: `${r.lot.reference} · ${r.dossier.reference}`, dueAt: null, since: (r.reservedAt ?? r.createdAt).toISOString(), href: dossierHref(r.dossier.reference) });
    for (const r of ended) items.push({ kind: 'DEPOSIT_OUTCOME', label: `${r.lot.reference} · ${r.dossier.reference}`, dueAt: null, since: (r.cancelledAt ?? r.expiredAt ?? r.updatedAt).toISOString(), href: dossierHref(r.dossier.reference) });
    for (const v of visits) items.push({ kind: 'VISIT_HOST', label: `${v.property?.reference ?? ''}${v.dossier ? ` · ${v.dossier.reference}` : ''}`, dueAt: v.startsAt?.toISOString() ?? null, since: v.createdAt.toISOString(), href: v.dossier ? dossierHref(v.dossier.reference) : '/agenda' });
    for (const s of stock) items.push({ kind: 'STOCK_UPDATE', label: s.label, dueAt: null, since: s.dueAt.toISOString(), href: s.kind === 'PROGRAM' ? `/catalogue/programmes/${s.id}?onglet=lots` : `/catalogue/biens/${s.id}` });
    for (const x of programs) {
      if (isOverdue(x.deliveryStatus, x.deliveryDate, x.deliveryDatePrecision, today)) items.push({ kind: 'DELIVERY_UPDATE', label: x.name, dueAt: null, since: new Date(periodEnd(x.deliveryDate!, x.deliveryDatePrecision).getTime() + DAY).toISOString(), href: `/catalogue/programmes/${x.id}#livraison` });
    }
    for (const x of properties) {
      if (isOverdue(x.deliveryStatus, x.deliveryDate, x.deliveryDatePrecision, today)) items.push({ kind: 'DELIVERY_UPDATE', label: x.reference, dueAt: null, since: new Date(periodEnd(x.deliveryDate!, x.deliveryDatePrecision).getTime() + DAY).toISOString(), href: `/catalogue/biens/${x.id}#livraison` });
    }
    for (const d of documents) items.push({ kind: 'PARTNER_DOCUMENT', label: d.label, dueAt: iso(d.expiresAt), since: new Date(d.expiresAt!.getTime() - 30 * DAY).toISOString(), href: `/promoteurs/${id}?onglet=documents` });
    if (p.status === 'ACTIVE' && p.conventionExpiresAt && p.conventionExpiresAt.getTime() <= now.getTime() + 30 * DAY) {
      items.push({ kind: 'PARTNER_DOCUMENT', label: 'CONVENTION', dueAt: iso(p.conventionExpiresAt), since: new Date(p.conventionExpiresAt.getTime() - 30 * DAY).toISOString(), href: `/promoteurs/${id}?onglet=convention` });
    }
    return { items: items.sort((a, b) => a.since.localeCompare(b.since)) };
  }
}
