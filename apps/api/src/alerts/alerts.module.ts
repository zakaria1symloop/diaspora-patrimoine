// Search alerts (CAT-070 … CAT-072, SFA-035, AUT-060, AUT-061) and e-mail preferences without signing in (NOT-022, PRO-031).
import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { AlertsController } from './alerts.controller.js';
import { AlertsJobs } from './alerts-jobs.js';
import { AlertsMailHandler } from './alerts-mail.handler.js';
import { AlertsService } from './alerts.service.js';
import { PreferencesService } from './preferences.service.js';

@Module({
  imports: [CatalogueModule, CommunicationModule],
  providers: [AlertsService, PreferencesService, AlertsMailHandler, AlertsJobs],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}
