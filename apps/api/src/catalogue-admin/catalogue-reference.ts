// Packages 3.4 to 3.6 — `GET /admin/catalogue/reference`: the reference data the catalogue forms and pickers of the
// back office read once (countries, regions, cities, closed lists of the settings, promoters, programmes, banks,
// thresholds), and `adminImageRef`, the address of a public image as the back office shows it (logo, cover, vignette).
// Any staff role reads it (ROL-020: `catalogue.read` and `promoter.read` are held by all).
import { Controller, Get, Inject, Injectable } from '@nestjs/common';
import { MEDIA_ROOM_LABELS, type AdminImageRef, type CatalogueReference } from '@dp/contracts';
import { ENV, type Env } from '../config/env.js';
import { mediaBase } from '../catalogue/media.js';
import { mediaUrlOf } from '../files/public-media.controller.js';
import { RequirePermission } from '../identity/access.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';

export interface ImageRow {
  id: string;
  ownerType: string;
  ownerId: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  renditions: unknown;
  processingStatus?: string;
}

/**
 * The address of a READY public image for the back office: the `card` rendition (640 px), else the widest one that
 * exists, in WebP. `null` for a media that is not ready or has no rendition (a PDF without vignette, a video).
 */
export function adminImageRef(mediaUrl: string, m: ImageRow | null | undefined, size: 'thumb' | 'card' | 'large' = 'card'): AdminImageRef | null {
  if (!m || (m.processingStatus !== undefined && m.processingStatus !== 'READY')) return null;
  const r = (m.renditions ?? {}) as Record<string, { formats?: string[] } | string>;
  const names = Object.keys(r).filter((k) => k !== 'blur' && typeof r[k] === 'object');
  if (!names.length) return null;
  const name = names.includes(size) ? size : names.includes('card') ? 'card' : names.includes('thumb') ? 'thumb' : names[0]!;
  const formats = (r[name] as { formats?: string[] }).formats ?? ['jpg'];
  const format = formats.includes('webp') ? 'webp' : formats[0]!;
  return { id: m.id, url: `${mediaBase(mediaUrl, m)}/${name}.${format}`, width: m.width, height: m.height, alt: m.alt };
}

@Injectable()
export class CatalogueReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Base of the public renditions (`/media-files` locally, the CDN when hosted). */
  mediaUrl(): string {
    return mediaUrlOf(this.env);
  }

  async reference(): Promise<CatalogueReference> {
    const [s, countries, regions, promoters, programs, banks] = await Promise.all([
      this.settings.all(),
      this.prisma.country.findMany({ orderBy: [{ isCatalogueActive: 'desc' }, { sortOrder: 'asc' }, { nameFr: 'asc' }] }),
      this.prisma.region.findMany({ where: { isActive: true, country: { isCatalogueActive: true } }, orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }], select: { id: true, countryCode: true, nameFr: true } }),
      this.prisma.promoter.findMany({ where: { deletedAt: null }, orderBy: [{ legalName: 'asc' }], select: { id: true, legalName: true, brandName: true, status: true } }),
      this.prisma.program.findMany({ where: { deletedAt: null }, orderBy: [{ name: 'asc' }], select: { id: true, name: true, promoterId: true, publication: true, country: { select: { currency: true } } } }),
      this.prisma.bank.findMany({ where: { deletedAt: null, status: 'ACTIVE' }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
    ]);
    const cities = await this.prisma.city.findMany({ where: { isActive: true, regionId: { in: regions.map((r) => r.id) } }, orderBy: [{ nameFr: 'asc' }], select: { id: true, regionId: true, nameFr: true } });
    const options = (list: { code: string; labelFr: string; sortOrder: number; isActive: boolean }[]) =>
      list.filter((x) => x.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((x) => ({ code: x.code, label: x.labelFr }));
    return {
      countries: countries.map((c) => ({ code: c.code, name: c.nameFr, currency: c.currency, catalogueActive: c.isCatalogueActive, regionLabel: c.regionLabelFr, cityLabel: c.cityLabelFr })),
      regions: regions.map((r) => ({ id: r.id, countryCode: r.countryCode, name: r.nameFr })),
      cities: cities.map((c) => ({ id: c.id, regionId: c.regionId, name: c.nameFr })),
      amenities: options(s['catalogue.amenities']),
      features: options(s['catalogue.features']),
      roomLabels: [...MEDIA_ROOM_LABELS],
      promoters: promoters.map((p) => ({ id: p.id, name: p.brandName ?? p.legalName, status: p.status })),
      programs: programs.map((p) => ({ id: p.id, name: p.name, promoterId: p.promoterId, publication: p.publication, currency: p.country.currency })),
      banks,
      settings: {
        referenceCurrency: s['display.referenceCurrency'],
        roomsPrefix: s['display.roomsPrefix'],
        publishMinScore: s['catalogue.publishMinScore'],
        completeScore: s['catalogue.completeScore'],
        stockCheckDays: s['catalogue.stockCheckDays'],
        soldVisibleDays: s['catalogue.soldVisibleDays'],
        tour360: s['features.tour360'],
        poi: s['features.poi'],
        constructionProgress: s['features.constructionProgress'],
      },
    };
  }
}

@Controller('admin/catalogue')
export class CatalogueReferenceController {
  constructor(private readonly references: CatalogueReferenceService) {}

  @Get('reference') @RequirePermission('catalogue.read')
  reference() { return this.references.reference(); }
}
