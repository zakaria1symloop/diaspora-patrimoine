// API-100 « Contenus » — `GET /public/faq` (EDI-040), `/legal/{type}` (EDI-060, MOD-420), `/pages/{slug}` (EDI-002),
// `/testimonials` (EDI-071), `/checklist/public` (EDI-021). Rich texts are stored sanitised (SEC-060); the site
// sanitises them again before display (EDI-003).
import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import {
  FAQ_CATEGORY_ORDER,
  FaqPlacement,
  LegalDocumentType,
  type DetailRedirect,
  type ListResponse,
  type PublicChecklist,
  type PublicFaqItem,
  type PublicLegalDocument,
  type PublicPage,
  type PublicTestimonial,
} from '@dp/contracts';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { imagesById } from './editorial-media.js';

const DOCUMENT_CATEGORY_ORDER = ['IDENTITY', 'RESIDENCE', 'EMPLOYMENT', 'INCOME', 'BANKING', 'PROPERTY', 'FINANCING', 'OTHER'] as const;
const TESTIMONIALS_MAX = 6;

@Controller('public')
export class PublicEditorialContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
    private readonly index: CatalogueIndex,
  ) {}

  /**
   * EDI-040 — published questions whose feature flag (if any) is on, by category order then `sortOrder`.
   * `placement` keeps the questions of one page (FINANCEMENTS, LE_CAFE, NOTRE_CONCEPT); unknown values are ignored.
   */
  @Get('faq')
  @Header('Cache-Control', 'public, max-age=60')
  async faq(@Query('placement') placement?: string): Promise<ListResponse<PublicFaqItem>> {
    const rows = await this.prisma.faqItem.findMany({
      where: { locale: 'fr', isPublished: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { question: 'asc' }],
      select: { slug: true, category: true, question: true, answer: true, placements: true, requiredFeature: true },
    });
    const all = (await this.settings.all()) as unknown as Record<string, unknown>;
    // A question whose flag is unknown or false is served nowhere (EDI-040).
    const served = rows.filter((r) => !r.requiredFeature || all[r.requiredFeature] === true);
    const place = placement && placement !== FaqPlacement.FAQ && placement in FaqPlacement ? (placement as FaqPlacement) : null;
    const kept = place ? served.filter((r) => r.placements.includes(place)) : served;
    kept.sort((a, b) => FAQ_CATEGORY_ORDER.indexOf(a.category) - FAQ_CATEGORY_ORDER.indexOf(b.category));
    return {
      data: kept.map((r) => ({ slug: r.slug, category: r.category, question: r.question, answer: r.answer, placements: r.placements })),
    };
  }

  /** EDI-060, MOD-420 — the version in force: the latest whose publication and effective dates are passed. */
  @Get('legal/:type')
  @Header('Cache-Control', 'public, max-age=60')
  async legal(@Param('type') type: string): Promise<PublicLegalDocument> {
    const key = type.toUpperCase().replace(/-/g, '_');
    if (!(key in LegalDocumentType)) throw AppError.notFound();
    const now = this.clock.now();
    const doc = await this.prisma.legalDocument.findFirst({
      where: { type: key as LegalDocumentType, locale: 'fr', publishedAt: { lte: now }, effectiveAt: { lte: now } },
      orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }],
      select: { type: true, version: true, title: true, body: true, effectiveAt: true },
    });
    if (!doc) throw AppError.notFound();
    return { ...doc, effectiveAt: doc.effectiveAt.toISOString() };
  }

  /** EDI-002 — a published free page; a draft or archived one answers 404; an old slug, its current address (NAV-040). */
  @Get('pages/:slug')
  @Header('Cache-Control', 'public, max-age=60')
  async page(@Param('slug') slug: string): Promise<PublicPage | DetailRedirect> {
    const where = { locale: 'fr' as const, kind: 'EDITORIAL' as const, status: 'PUBLISHED' as const };
    const p = await this.prisma.page.findFirst({
      where: { slug, ...where },
      select: { slug: true, title: true, body: true, seoTitle: true, seoDescription: true, updatedAt: true },
    });
    if (!p) {
      const h = await this.prisma.slugHistory.findFirst({ where: { entityType: 'PAGE', slug }, select: { entityId: true } });
      const current = h ? await this.prisma.page.findFirst({ where: { id: h.entityId, ...where }, select: { slug: true } }) : null;
      if (current && current.slug !== slug) return { redirect: `/infos/${current.slug}` };
      throw AppError.notFound();
    }
    return { ...p, updatedAt: p.updatedAt.toISOString() };
  }

  /** EDI-071 — published testimonials with a written consent date, by `sortOrder`, six at most. */
  @Get('testimonials')
  @Header('Cache-Control', 'public, max-age=60')
  async testimonials(): Promise<ListResponse<PublicTestimonial>> {
    const rows = await this.prisma.testimonial.findMany({
      where: { isPublished: true, deletedAt: null, consentAt: { not: null } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: TESTIMONIALS_MAX,
      select: { id: true, displayName: true, residenceCity: true, purchaseSummary: true, quote: true, photoMediaId: true },
    });
    const photos = await imagesById(this.prisma, this.index.mediaUrl, rows.map((r) => ({ id: r.photoMediaId, alt: r.displayName })));
    return {
      data: rows.map((r) => ({
        id: r.id,
        displayName: r.displayName,
        residenceCity: r.residenceCity,
        purchaseSummary: r.purchaseSummary,
        quote: r.quote,
        photo: r.photoMediaId ? (photos.get(r.photoMediaId) ?? null) : null,
      })),
    };
  }

  /** EDI-021 — labels of the required items of the default CLIENT_FILE template, by category, without conditions. */
  @Get('checklist/public')
  @Header('Cache-Control', 'public, max-age=60')
  async checklist(): Promise<PublicChecklist> {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { scope: 'CLIENT_FILE', isDefault: true, isActive: true, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, version: true },
    });
    if (!template) return { groups: [] };
    const items = await this.prisma.checklistItem.findMany({
      where: { templateId: template.id, isRequired: true, retiredInVersion: null, addedInVersion: { lte: template.version } },
      orderBy: [{ sortOrder: 'asc' }],
      select: { category: true, label: true },
    });
    const groups: PublicChecklist['groups'] = [];
    for (const category of DOCUMENT_CATEGORY_ORDER) {
      const labels = [...new Set(items.filter((i) => i.category === category).map((i) => i.label))];
      if (labels.length) groups.push({ category, labels });
    }
    return { groups };
  }
}
