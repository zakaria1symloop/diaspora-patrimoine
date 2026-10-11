// NAV-034 — published objects for the site map, with their last change. Properties: exactly those the catalogue shows
// (same filter, CatalogueIndex); a programme or a promoter only while it is public.
import { Controller, Get, Header } from '@nestjs/common';
import type { SitemapEntry, SitemapResponse } from '@dp/contracts';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { CatalogueIndex } from './catalogue-index.js';

const entry = (r: { slug: string; updatedAt: Date }): SitemapEntry => ({ slug: r.slug, updatedAt: r.updatedAt.toISOString() });
const bySlug = { slug: true, updatedAt: true } as const;

@Controller('public')
export class SitemapController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly index: CatalogueIndex,
    private readonly settings: SettingsService,
  ) {}

  @Get('sitemap')
  @Header('Cache-Control', 'public, max-age=300')
  async sitemap(): Promise<SitemapResponse> {
    const ids = (await this.index.rows()).map((r) => r.id);
    const [pages, properties, programs, promoters, events] = await Promise.all([
      this.prisma.page.findMany({ where: { locale: 'fr', kind: 'EDITORIAL', status: 'PUBLISHED' }, select: bySlug, orderBy: { slug: 'asc' } }),
      this.prisma.property.findMany({ where: { id: { in: ids } }, select: bySlug, orderBy: { slug: 'asc' } }),
      this.prisma.program.findMany({
        where: { publication: 'PUBLISHED', deletedAt: null, promoter: { deletedAt: null, status: 'ACTIVE' } },
        select: bySlug,
        orderBy: { slug: 'asc' },
      }),
      this.prisma.promoter.findMany({ where: { status: 'ACTIVE', isPublic: true, deletedAt: null }, select: bySlug, orderBy: { slug: 'asc' } }),
      (await this.settings.get('features.cafe'))
        ? this.prisma.event.findMany({ where: { deletedAt: null, status: { in: ['PUBLISHED', 'CLOSED'] } }, select: bySlug, orderBy: { slug: 'asc' } })
        : Promise.resolve([]),
    ]);
    return {
      pages: pages.map(entry),
      properties: properties.map(entry),
      programs: programs.map(entry),
      promoters: promoters.map(entry),
      events: events.map(entry),
    };
  }
}
