// API-100 — `GET /public/promoters`, `/promoters/{slug}` (EDI-030, EDI-031), `/banks` (EDI-020), `/partners` (EDI-035).
// Only the public fields leave the API: never the website, address, phone, e-mail, contacts, documents or commission
// terms of a promoter (EDI-032, D-048).
import { Controller, Get, Header, Param } from '@nestjs/common';
import type {
  CommercialState,
  DetailRedirect,
  ListResponse,
  PromoterProgramCard,
  PublicBank,
  PublicPartner,
  PublicPromoterCard,
  PublicPromoterDetail,
} from '@dp/contracts';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { isOverdue } from '../catalogue/delivery.js';
import { pickCover, toPublicImage, type MediaRow } from '../catalogue/media.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { MEDIA_SELECT, imagesById } from './editorial-media.js';

const PARTNER_CATEGORY_ORDER = ['NOTARY', 'INSURER', 'INSTITUTION', 'MEDIA', 'OTHER'] as const;
const CURRENT_FIRST: Record<Exclude<CommercialState, 'WITHDRAWN'>, number> = { ON_SALE: 0, ALL_RESERVED: 1, UPCOMING: 2, SOLD: 3 };

/** CYC-127 — commercial state of a published programme (same rule as the programme page). */
export function commercialState(p: { listedPropertyCount: number; lotsAvailable: number; lotsHeld: number; lotsSold: number }): CommercialState {
  if (p.listedPropertyCount === 0) return 'UPCOMING';
  if (p.lotsAvailable > 0) return 'ON_SALE';
  if (p.lotsHeld > 0) return 'ALL_RESERVED';
  if (p.lotsSold > 0) return 'SOLD';
  return 'WITHDRAWN';
}

const PUBLIC_PROMOTER = { status: 'ACTIVE', isPublic: true, deletedAt: null } as const;

@Controller('public')
export class PublicPartnersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly index: CatalogueIndex,
    private readonly settings: SettingsService,
  ) {}

  @Get('promoters')
  @Header('Cache-Control', 'public, max-age=60')
  async promoters(): Promise<ListResponse<PublicPromoterCard>> {
    const rows = await this.prisma.promoter.findMany({
      where: PUBLIC_PROMOTER,
      select: {
        id: true, sortOrder: true, slug: true, brandName: true, legalName: true, referencesPublic: true, logoMediaId: true,
        region: { select: { nameFr: true } },
      },
    });
    const counts = await this.programCounts(rows.map((r) => r.id));
    const names = rows.map((r) => ({ ...r, name: r.brandName ?? r.legalName }));
    names.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fr')); // EDI-030
    const logos = await imagesById(this.prisma, this.index.mediaUrl, names.map((r) => ({ id: r.logoMediaId, alt: r.name })));
    return {
      data: names.map((r) => ({
        slug: r.slug,
        name: r.name,
        logo: r.logoMediaId ? (logos.get(r.logoMediaId) ?? null) : null,
        region: r.region?.nameFr ?? null,
        programCount: counts.get(r.id) ?? 0,
        referencesPublic: r.referencesPublic,
      })),
    };
  }

  @Get('promoters/:slug')
  @Header('Cache-Control', 'public, max-age=60')
  async promoter(@Param('slug') slug: string): Promise<PublicPromoterDetail | DetailRedirect> {
    const p = await this.prisma.promoter.findFirst({
      where: { slug, ...PUBLIC_PROMOTER },
      select: {
        id: true, slug: true, brandName: true, legalName: true, referencesPublic: true, descriptionPublic: true,
        foundedYear: true, deliveredUnits: true, vettedAt: true, logoMediaId: true, coverMediaId: true,
        region: { select: { nameFr: true } },
      },
    });
    if (!p) {
      // NAV-040 — an old slug answers with the current address.
      const h = await this.prisma.slugHistory.findFirst({ where: { entityType: 'PROMOTER', slug }, select: { entityId: true } });
      const current = h ? await this.prisma.promoter.findFirst({ where: { id: h.entityId, ...PUBLIC_PROMOTER }, select: { slug: true } }) : null;
      if (current && current.slug !== slug) return { redirect: `/promoteurs/${current.slug}` };
      throw AppError.notFound(); // EDI-031: no longer ACTIVE or public → 404.
    }
    const name = p.brandName ?? p.legalName;
    const [images, programs] = await Promise.all([
      imagesById(this.prisma, this.index.mediaUrl, [
        { id: p.logoMediaId, alt: name },
        { id: p.coverMediaId, alt: name },
      ]),
      this.programs(p.id),
    ]);
    return {
      slug: p.slug,
      name,
      logo: p.logoMediaId ? (images.get(p.logoMediaId) ?? null) : null,
      cover: p.coverMediaId ? (images.get(p.coverMediaId) ?? null) : null,
      region: p.region?.nameFr ?? null,
      programCount: programs.length,
      referencesPublic: p.referencesPublic,
      selectedSince: p.vettedAt ? p.vettedAt.getUTCFullYear() : null,
      descriptionPublic: p.descriptionPublic,
      foundedYear: p.foundedYear,
      deliveredUnits: p.deliveredUnits,
      programs,
    };
  }

  @Get('banks')
  @Header('Cache-Control', 'public, max-age=60')
  async banks(): Promise<ListResponse<PublicBank>> {
    const rows = await this.prisma.bank.findMany({
      where: { status: 'ACTIVE', isPublic: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true, shortName: true, logoMediaId: true },
    });
    const logos = await imagesById(this.prisma, this.index.mediaUrl, rows.map((r) => ({ id: r.logoMediaId, alt: r.name })));
    return {
      data: rows.map((r) => ({ slug: r.slug, name: r.name, shortName: r.shortName, logo: r.logoMediaId ? (logos.get(r.logoMediaId) ?? null) : null })),
    };
  }

  @Get('partners')
  @Header('Cache-Control', 'public, max-age=60')
  async partners(): Promise<ListResponse<PublicPartner>> {
    const rows = await this.prisma.partner.findMany({
      where: { isPublic: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, category: true, logoMediaId: true, url: true, descriptionPublic: true },
    });
    rows.sort((a, b) => PARTNER_CATEGORY_ORDER.indexOf(a.category) - PARTNER_CATEGORY_ORDER.indexOf(b.category));
    const logos = await imagesById(this.prisma, this.index.mediaUrl, rows.map((r) => ({ id: r.logoMediaId, alt: r.name })));
    return {
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        logo: r.logoMediaId ? (logos.get(r.logoMediaId) ?? null) : null,
        url: r.url && /^https?:\/\//.test(r.url) ? r.url : null,
        description: r.descriptionPublic,
      })),
    };
  }

  private async programCounts(promoterIds: string[]): Promise<Map<string, number>> {
    if (promoterIds.length === 0) return new Map();
    const rows = await this.prisma.program.findMany({
      where: { promoterId: { in: promoterIds }, publication: 'PUBLISHED', deletedAt: null },
      select: { promoterId: true, listedPropertyCount: true, lotsAvailable: true, lotsHeld: true, lotsSold: true },
    });
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (commercialState(r) === 'WITHDRAWN') continue;
      counts.set(r.promoterId, (counts.get(r.promoterId) ?? 0) + 1);
    }
    return counts;
  }

  /** EDI-031 — published programmes: current ones first, then sold; withdrawn ones never. */
  private async programs(promoterId: string): Promise<PromoterProgramCard[]> {
    const rows = await this.prisma.program.findMany({
      where: { promoterId, publication: 'PUBLISHED', deletedAt: null },
      orderBy: [{ publishedAt: 'desc' }],
      select: {
        id: true, slug: true, name: true, standing: true, priceFromRef: true, deliveryStatus: true, deliveryDate: true,
        deliveryDatePrecision: true, listedPropertyCount: true, lotsAvailable: true, lotsHeld: true, lotsSold: true,
        region: { select: { nameFr: true } },
        city: { select: { nameFr: true } },
      },
    });
    if (rows.length === 0) return [];
    const [media, currency, today] = await Promise.all([
      this.prisma.media.findMany({
        where: {
          ownerType: 'PROGRAM',
          ownerId: { in: rows.map((r) => r.id) },
          kind: { in: ['PHOTO', 'RENDER_3D'] },
          processingStatus: 'READY',
          deletedAt: null,
          isPublic: true,
        },
        select: MEDIA_SELECT,
      }),
      this.settings.get('display.referenceCurrency'),
      this.index.today(),
    ]);
    const cards: PromoterProgramCard[] = [];
    for (const r of rows) {
      const state = commercialState(r);
      if (state === 'WITHDRAWN') continue;
      const cover = pickCover(media.filter((m) => m.ownerId === r.id) as MediaRow[]);
      cards.push({
        slug: r.slug,
        name: r.name,
        region: r.region.nameFr,
        city: r.city?.nameFr ?? null,
        cover: cover ? toPublicImage(this.index.mediaUrl, cover, r.name) : null,
        standing: r.standing,
        state,
        priceFromRef:
          (state === 'ON_SALE' || state === 'ALL_RESERVED') && r.priceFromRef ? { amount: r.priceFromRef.toFixed(2), currency } : null,
        delivery: {
          status: r.deliveryStatus,
          date: r.deliveryDate ? r.deliveryDate.toISOString().slice(0, 10) : null,
          precision: r.deliveryDatePrecision,
          overdue: isOverdue(r.deliveryStatus, r.deliveryDate, r.deliveryDatePrecision, today),
        },
      });
    }
    return cards.sort((a, b) => CURRENT_FIRST[a.state] - CURRENT_FIRST[b.state]);
  }
}
