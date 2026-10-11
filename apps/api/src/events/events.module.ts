import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { CafeRegistrationService } from './cafe-registration.service.js';
import { CafeRegistrationsController } from './cafe-registrations.controller.js';
import { EventsPublicController } from './events-public.controller.js';
import { EventsPublicService } from './events-public.service.js';
import { NotifyController } from './notify.controller.js';
import { RegistrationDocuments } from './registration-documents.js';
import { EventScan } from './event-scan.js';
import { RegistrationMailHandler } from './registration-mail.handler.js';

@Module({
  imports: [CatalogueModule, CommunicationModule],
  providers: [EventsPublicService, CafeRegistrationService, RegistrationDocuments, RegistrationMailHandler, EventScan],
  controllers: [EventsPublicController, NotifyController, CafeRegistrationsController],
  exports: [EventsPublicService, RegistrationDocuments],
})
export class EventsModule {}
