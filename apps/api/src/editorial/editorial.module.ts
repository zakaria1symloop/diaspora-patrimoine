// Work package 2.7 — public routes of the editorial pages (02-site-public/08).
import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { PublicEditorialContentController } from './editorial-content.controller.js';
import { PublicPartnersController } from './partners.controller.js';

@Module({
  imports: [CatalogueModule],
  controllers: [PublicPartnersController, PublicEditorialContentController],
})
export class EditorialModule {}
