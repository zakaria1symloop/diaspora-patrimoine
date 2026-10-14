// Package 2.8 — the client space (« Espace client »): shell summary, dashboard, dossier follow-up, interests and
// proposals (read), « Écrire à mon conseiller », notifications, profile, trusted people, agreements.
import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { PropertyCards } from '../dossiers-admin/property-cards.js';
import { AgreementsService } from './agreements.service.js';
import { ClientContactsController, ClientProfileController, ClientSpaceController } from './client-space.controller.js';
import { DossierViews } from './dossier-view.js';
import { ClientNotificationHandlers } from './notification-handlers.js';
import { NotificationsService } from './notifications.service.js';
import { ProfileService } from './profile.service.js';
import { PropertiesService } from './properties.service.js';
import { RequestsService } from './requests.service.js';
import { SpaceReader } from './space-reader.js';
import { SpaceService } from './space.service.js';

@Module({
  imports: [CatalogueModule],
  providers: [SpaceReader, DossierViews, PropertyCards, SpaceService, PropertiesService, RequestsService, NotificationsService, ProfileService, AgreementsService, ClientNotificationHandlers],
  controllers: [ClientSpaceController, ClientProfileController, ClientContactsController],
})
export class ClientSpaceModule {}
