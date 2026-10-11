import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { BarriersMiddleware } from './platform/barriers.middleware.js';
import { ErrorFilter } from './platform/error.filter.js';
import { PlatformModule } from './platform/platform.module.js';
import { AutomationModule } from './automation/automation.module.js';
import { PublicModule } from './public/public.module.js';
import { CatalogueModule } from './catalogue/catalogue.module.js';
import { CommunicationModule } from './communication/communication.module.js';
import { LeadsModule } from './leads/leads.module.js';
import { FilesModule } from './files/files.module.js';
import { CatalogueAdminModule } from './catalogue-admin/catalogue-admin.module.js';
import { EventsAdminModule } from './events-admin/events-admin.module.js';
import { EditorialModule } from './editorial/editorial.module.js';
import { SimulationsModule } from './simulations/simulations.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { ClientToolsModule } from './client-tools/client-tools.module.js';
import { ClientSpaceModule } from './client-space/client-space.module.js';
import { BackOfficeModule } from './back-office/back-office.module.js';
import { DossiersAdminModule } from './dossiers-admin/dossiers-admin.module.js';
import { TasksAdminModule } from './tasks-admin/tasks-admin.module.js';
import { PromotersAdminModule } from './promoters-admin/promoters-admin.module.js';
import { ProgramsAdminModule } from './programs-admin/programs-admin.module.js';
import { PropertiesAdminModule } from './properties-admin/properties-admin.module.js';
import { MediaAdminModule } from './media-admin/media-admin.module.js';
import { CrmModule } from './crm/crm.module.js';
import { LeadsAdminModule } from './leads-admin/leads-admin.module.js';
import { ExchangesAdminModule } from './exchanges-admin/exchanges-admin.module.js';
import { ClientsAdminModule } from './clients-admin/clients-admin.module.js';
import { ClientsMergeAdminModule } from './clients-merge-admin/clients-merge-admin.module.js';
import { ClientAccountAdminModule } from './client-account-admin/client-account-admin.module.js';
import { SimulationsAdminModule } from './simulations-admin/simulations-admin.module.js';

@Module({
  imports: [PlatformModule, AutomationModule, IdentityModule, PublicModule, CatalogueModule, CommunicationModule, LeadsModule, FilesModule, CatalogueAdminModule, EventsAdminModule, EditorialModule, SimulationsModule, AssistantModule, AlertsModule, DocumentsModule, ClientSpaceModule, ClientToolsModule, BackOfficeModule, CrmModule, LeadsAdminModule, ExchangesAdminModule, ClientsAdminModule, ClientsMergeAdminModule, ClientAccountAdminModule, SimulationsAdminModule, PromotersAdminModule, ProgramsAdminModule, PropertiesAdminModule, MediaAdminModule, DossiersAdminModule, TasksAdminModule],
  providers: [{ provide: APP_FILTER, useClass: ErrorFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(BarriersMiddleware).forRoutes('*path');
  }
}
