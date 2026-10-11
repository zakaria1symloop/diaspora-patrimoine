// Package 3.6 « Médias et import de lots » (EA-44, EA-45: CTL-080 … CTL-084, CTL-100 … CTL-102, API-080).
import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { raw } from 'express';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { CatalogueAdminModule } from '../catalogue-admin/catalogue-admin.module.js';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { FilesModule } from '../files/files.module.js';
import { ImportConflictTasks } from './import-conflicts.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';
import { MediaAdminController } from './media-admin.controller.js';
import { MediaAdminService } from './media-admin.service.js';

@Module({
  imports: [CatalogueModule, CatalogueAdminModule, FilesModule, BackOfficeModule, CommunicationModule],
  controllers: [MediaAdminController, ImportsController],
  providers: [MediaAdminService, ImportsService, ImportConflictTasks],
  exports: [MediaAdminService, ImportsService],
})
export class MediaAdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // API-080 step 2 (local stand-in of the direct send to the storage): one file, 50 MB at most (a 360° view, MED-010).
    consumer.apply(raw({ type: () => true, limit: '51mb' })).forRoutes({ path: 'admin/media/uploads/:id/content', method: RequestMethod.PUT });
    // CTL-100 — a grid of lots: 5 MB at most.
    consumer.apply(raw({ type: () => true, limit: '6mb' })).forRoutes({ path: 'admin/imports/uploads/:id/content', method: RequestMethod.PUT });
  }
}
