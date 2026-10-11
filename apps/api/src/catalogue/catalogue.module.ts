import { Module } from '@nestjs/common';
import { CatalogueIndex } from './catalogue-index.js';
import { CatalogueService } from './catalogue.service.js';
import { CatalogueDetailService } from './catalogue-detail.service.js';
import { CatalogueCompareService } from './catalogue-compare.service.js';
import { PublicCatalogueController } from './catalogue.controller.js';
import { ViewController, ViewCounter } from './views.js';
import { SitemapController } from './sitemap.controller.js';

@Module({
  providers: [CatalogueIndex, CatalogueService, CatalogueDetailService, CatalogueCompareService, ViewCounter],
  controllers: [ViewController, PublicCatalogueController, SitemapController],
  exports: [CatalogueIndex, CatalogueService],
})
export class CatalogueModule {}
