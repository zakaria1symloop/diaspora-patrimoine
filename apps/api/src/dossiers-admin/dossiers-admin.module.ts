// Package 3.7 « Dossier » — the dossiers of the back office (EA-21, EA-22): list, creation, record, qualification,
// matching (candidates, proposals, selection), pause, resume, closing, reopening, stepping back, deletion, change of
// adviser; the client's answers on a considered property (EC-12, EC-13) and « Mon bien » (EC-11); their notifications,
// e-mails, rules (AUT-043, `automation/rule-seeds-dossier.ts`) and scheduled scan (`dossier.scan`).
import { Module } from '@nestjs/common';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { DossierViews } from '../client-space/dossier-view.js';
import { SpaceReader } from '../client-space/space-reader.js';
import { IdentityModule } from '../identity/identity.module.js';
import { CandidatesService } from './candidates.service.js';
import { ClientAnswersService } from './client-answers.service.js';
import { DossierCommandsService } from './dossier-commands.service.js';
import { DossierJobs } from './dossier-jobs.js';
import { DossierNotificationHandlers } from './dossier-notifications.js';
import { DossierReadService } from './dossier-read.service.js';
import { ClientCandidatesController, DossiersAdminController } from './dossiers-admin.controller.js';
import { PropertyCards } from './property-cards.js';

@Module({
  imports: [BackOfficeModule, CatalogueModule, CommunicationModule, IdentityModule],
  controllers: [DossiersAdminController, ClientCandidatesController],
  providers: [PropertyCards, SpaceReader, DossierViews, DossierReadService, DossierCommandsService, CandidatesService, ClientAnswersService, DossierNotificationHandlers, DossierJobs],
  exports: [DossierReadService, PropertyCards],
})
export class DossiersAdminModule {}
