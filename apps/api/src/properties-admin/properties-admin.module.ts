// Package 3.5 « Biens » (EA-42, EA-43, EA-46: CTL-040 … CTL-045, CTL-130, CTL-150), « Signaler une erreur »
// (DEM-018) and the nightly watch of the catalogue (CYC-123, AUT-074, AUT-078).
import { Module } from '@nestjs/common';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { CatalogueAdminModule } from '../catalogue-admin/catalogue-admin.module.js';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { FilesModule } from '../files/files.module.js';
import { ProgramsAdminModule } from '../programs-admin/programs-admin.module.js';
import { PropertiesAdminController } from './properties-admin.controller.js';
import { PropertiesGesturesService } from './properties-gestures.service.js';
import { PropertiesReadService } from './properties-read.service.js';

@Module({
  imports: [CatalogueModule, CatalogueAdminModule, FilesModule, BackOfficeModule, CommunicationModule, ProgramsAdminModule],
  controllers: [PropertiesAdminController],
  providers: [PropertiesReadService, PropertiesGesturesService],
  exports: [PropertiesReadService],
})
export class PropertiesAdminModule {}
