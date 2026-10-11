// Package 3.5 « Programmes et lots » (EA-40, EA-41, CTL-020 … CTL-024, CTL-060 … CTL-064, CTL-140, CTL-145): reads
// and the gestures the write services of `catalogue-admin/` did not have yet.
import { Module } from '@nestjs/common';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { CatalogueAdminModule } from '../catalogue-admin/catalogue-admin.module.js';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { FilesModule } from '../files/files.module.js';
import { ProgramUpdateNotifications } from './program-update-notifications.js';
import { ProgramsAdminController } from './programs-admin.controller.js';
import { ProgramsGesturesService } from './programs-gestures.service.js';
import { ProgramsReadService } from './programs-read.service.js';

@Module({
  imports: [CatalogueModule, CatalogueAdminModule, FilesModule, BackOfficeModule, CommunicationModule],
  controllers: [ProgramsAdminController],
  providers: [ProgramsReadService, ProgramsGesturesService, ProgramUpdateNotifications],
  exports: [ProgramsReadService, ProgramsGesturesService],
})
export class ProgramsAdminModule {}
