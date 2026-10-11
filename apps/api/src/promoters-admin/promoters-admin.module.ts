// Package 3.4 « Promoteurs » (EA-50, EA-51), « Autres partenaires » (EA-47, CTL-170) and the review of partner
// applications (ACP-084): reads, the gestures the write services of `catalogue-admin/` did not have yet, the
// scheduled watch of conventions, documents and availabilities (AUT-073, AUT-079).
import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { raw } from 'express';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { CatalogueAdminModule } from '../catalogue-admin/catalogue-admin.module.js';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { FilesModule } from '../files/files.module.js';
import { PartnerApplicationsService } from './partner-applications.service.js';
import { PartnerWatch } from './partner-watch.js';
import { PartnersService } from './partners.service.js';
import { PromotersAdminController } from './promoters-admin.controller.js';
import { PromotersGesturesService } from './promoters-gestures.service.js';
import { PromotersReadService } from './promoters-read.service.js';

@Module({
  imports: [CatalogueModule, CatalogueAdminModule, FilesModule, BackOfficeModule, CommunicationModule],
  controllers: [PromotersAdminController],
  providers: [PromotersReadService, PromotersGesturesService, PartnersService, PartnerApplicationsService, PartnerWatch],
  exports: [PromotersReadService],
})
export class PromotersAdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // API-080 step 2 (local stand-in of the direct send to the storage): a partner's document, 25 MB at most (MED-010).
    consumer.apply(raw({ type: () => true, limit: '26mb' })).forRoutes({ path: 'admin/promoters/:id/document-uploads/:uploadId/content', method: RequestMethod.PUT });
  }
}
