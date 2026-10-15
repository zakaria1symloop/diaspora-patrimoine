import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { ChangeNotifier, WebRevalidator } from '../admin/revalidation.js';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { FilesModule } from '../files/files.module.js';
import { CatalogueAdminController } from './catalogue-admin.controller.js';
import { CatalogueCaches } from './catalogue-caches.js';
import { CatalogueNightly } from './catalogue-nightly.js';
import { CatalogueMediaService } from './catalogue-media.service.js';
import { CatalogueReferenceController, CatalogueReferenceService } from './catalogue-reference.js';
import { CatalogueTimelineController } from './catalogue-timeline.controller.js';
import { CatalogueTimelineService } from './catalogue-timeline.service.js';
import { LotsAdminService } from './lots-admin.service.js';
import { PartnersAdminService } from './partners-admin.service.js';
import { ProgramsAdminService } from './programs-admin.service.js';
import { PropertiesAdminService } from './properties-admin.service.js';
import { PropertyPublication } from './property-publication.js';

@Module({
  imports: [CatalogueModule, FilesModule, BackOfficeModule],
  providers: [
    WebRevalidator,
    ChangeNotifier,
    CatalogueCaches,
    PropertyPublication,
    PartnersAdminService,
    ProgramsAdminService,
    PropertiesAdminService,
    LotsAdminService,
    CatalogueMediaService,
    CatalogueTimelineService,
    CatalogueReferenceService,
    CatalogueNightly,
  ],
  controllers: [CatalogueAdminController, CatalogueTimelineController, CatalogueReferenceController],
  exports: [WebRevalidator, ChangeNotifier, CatalogueCaches, PropertyPublication, PartnersAdminService, ProgramsAdminService, PropertiesAdminService, LotsAdminService, CatalogueMediaService, CatalogueReferenceService, CatalogueTimelineService],
})
export class CatalogueAdminModule {}
