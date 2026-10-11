import { Module } from '@nestjs/common';
import { CatalogueAdminModule } from '../catalogue-admin/catalogue-admin.module.js';
import { FilesModule } from '../files/files.module.js';
import { EventsAdminController } from './events-admin.controller.js';
import { EventsAdminService } from './events-admin.service.js';

@Module({
  imports: [CatalogueAdminModule, FilesModule],
  providers: [EventsAdminService],
  controllers: [EventsAdminController],
  exports: [EventsAdminService],
})
export class EventsAdminModule {}
