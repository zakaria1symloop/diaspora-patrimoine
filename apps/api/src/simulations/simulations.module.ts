// 02-site-public/06 — simulators: the express calculation of EP-10 (EDI-023), EP-11 eligibility and EP-12 credit
// (work package 2.6), their PDF (TRV-142) and the « Recevoir par e-mail » sending.
import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { FilesModule } from '../files/files.module.js';
import { ClientSimulationsController } from './client-simulations.controller.js';
import { ClientSimulationsService } from './client-simulations.service.js';
import { SimulationContextService } from './context.js';
import { PDF_RENDERER, PdfkitRenderer } from './pdf/pdf-renderer.js';
import { QuickSimulationController } from './quick.controller.js';
import { SimulationsController } from './simulations.controller.js';
import { SimulationsService } from './simulations.service.js';

@Module({
  imports: [CatalogueModule, CommunicationModule, FilesModule],
  controllers: [QuickSimulationController, SimulationsController, ClientSimulationsController],
  providers: [SimulationContextService, SimulationsService, ClientSimulationsService, { provide: PDF_RENDERER, useClass: PdfkitRenderer }],
  exports: [SimulationContextService],
})
export class SimulationsModule {}
