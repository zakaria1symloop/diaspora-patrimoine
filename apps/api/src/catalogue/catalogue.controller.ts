// API-100 — public catalogue routes. Unknown or malformed criteria are ignored (CAT-020, API-011).
import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  COMPARE_MAX,
  FAVORITES_MAX_ANONYMOUS,
  parseCatalogueCriteria,
  parseRefs,
  type CompareResponse,
  type FavoritesResponse,
  type CatalogueResponse,
  type DetailRedirect,
  type PropertyCard,
  type ProgramDetail,
  type PropertyDetail,
  type SearchOptions,
} from '@dp/contracts';
import { CatalogueCompareService } from './catalogue-compare.service.js';
import { relaxationLadder } from '@dp/domain';
import { CatalogueDetailService } from './catalogue-detail.service.js';
import { CatalogueService } from './catalogue.service.js';
import { CatalogueIndex } from './catalogue-index.js';

@Controller('public')
export class PublicCatalogueController {
  constructor(
    private readonly catalogue: CatalogueService,
    private readonly index: CatalogueIndex,
    private readonly detail: CatalogueDetailService,
    private readonly compareService: CatalogueCompareService,
  ) {}

  @Get('properties')
  @Header('Cache-Control', 'public, max-age=30')
  async properties(@Query() query: Record<string, string>): Promise<CatalogueResponse> {
    const year = Number((await this.index.today()).slice(0, 4));
    const criteria = parseCatalogueCriteria(query, year);
    return this.catalogue.list(criteria, query.facets === '1');
  }

  @Get('search-options')
  @Header('Cache-Control', 'private, max-age=30')
  async searchOptions(): Promise<SearchOptions> {
    // `estimatedBudget` comes with the eligibility simulator (CAT-035): no simulation can exist before it.
    return this.catalogue.searchOptions(null);
  }

  @Get('regions')
  @Header('Cache-Control', 'public, max-age=60')
  async regions(): Promise<{ data: { slug: string; name: string; count: number }[] }> {
    return { data: await this.catalogue.regions() };
  }

  /** CAT-092 — comparator: three references at most; unknown or archived ones are omitted (`missing`). */
  @Get('properties/compare')
  @Header('Cache-Control', 'public, max-age=30')
  async compare(@Query('refs') refs: string | string[] | undefined): Promise<CompareResponse> {
    return this.compareService.compare(parseRefs(refs, COMPARE_MAX));
  }

  /**
   * SFA-021, SFA-022 — favourites kept in the browser (`dp_favorites`), read back as cards; twenty references at most.
   * Not in API-100 yet (the favourites of an account use `/client/favorites`): to be added to the resource map.
   */
  @Get('properties/cards')
  @Header('Cache-Control', 'public, max-age=30')
  async cards(@Query('refs') refs: string | string[] | undefined): Promise<FavoritesResponse> {
    return this.compareService.favorites(parseRefs(refs, FAVORITES_MAX_ANONYMOUS));
  }

  /**
   * CAT-061 — under an empty result: three properties at most, found by relaxing the criteria in order (communes,
   * budget +20 %, rooms, delivery, region) until something matches; none → empty list (the block is hidden). Not paginated.
   */
  @Get('properties/suggestions')
  @Header('Cache-Control', 'public, max-age=30')
  async suggestions(@Query() query: Record<string, string>): Promise<{ data: PropertyCard[] }> {
    const year = Number((await this.index.today()).slice(0, 4));
    for (const step of relaxationLadder(parseCatalogueCriteria(query, year))) {
      const res = await this.catalogue.list({ ...step, page: 1 }, false);
      if (res.data.length) return { data: res.data.slice(0, 3) };
    }
    return { data: [] };
  }

  /** The word `suggestions` is reserved and never a slug (API-100). */
  @Get('properties/:slug/similar')
  @Header('Cache-Control', 'public, max-age=60')
  async similar(@Param('slug') slug: string): Promise<{ data: PropertyCard[]; regionCount: number }> {
    return this.detail.similar(slug);
  }

  /** FIC-120 — `?apercu=` the back office's signed link: never cached (the page is not online). */
  @Get('properties/:slug')
  async property(@Param('slug') slug: string, @Query('apercu') apercu: string | undefined, @Res({ passthrough: true }) res: Response): Promise<PropertyDetail | DetailRedirect> {
    res.setHeader('Cache-Control', apercu ? 'private, no-store' : 'public, max-age=60');
    return this.detail.property(slug, apercu);
  }

  @Get('programs/:slug')
  async program(@Param('slug') slug: string, @Query('apercu') apercu: string | undefined, @Res({ passthrough: true }) res: Response): Promise<ProgramDetail | DetailRedirect> {
    res.setHeader('Cache-Control', apercu ? 'private, no-store' : 'public, max-age=60');
    return this.detail.program(slug, apercu);
  }
}
