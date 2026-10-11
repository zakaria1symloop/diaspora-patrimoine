// EC-41, EC-42, CAT-093, AUT-062 — the client's favourites and alerts on his account, and the favourites watch.
// (Saved simulations EC-40 live with the simulators, `simulations/client-simulations.*`.)
import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module.js';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { AccountAlertsService } from './account-alerts.service.js';
import { ClientAlertsController, ClientFavoritesController } from './client-tools.controller.js';
import { FavoritesService } from './favorites.service.js';
import { FavoritesWatch } from './favorites-watch.js';

@Module({
  imports: [CatalogueModule, CommunicationModule, AlertsModule],
  controllers: [ClientFavoritesController, ClientAlertsController],
  providers: [FavoritesService, AccountAlertsService, FavoritesWatch],
})
export class ClientToolsModule {}
