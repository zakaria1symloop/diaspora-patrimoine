import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { EventsModule } from '../events/events.module.js';
import { PublicContentController } from './content.controller.js';
import { CountriesController } from './countries.controller.js';
import { GateController } from './gate.controller.js';
import { HealthController } from './health.controller.js';
import { HomeController } from './home.controller.js';
import { PublicSettingsController } from './settings.controller.js';

@Module({
  imports: [CatalogueModule, EventsModule],
  controllers: [HealthController, PublicSettingsController, GateController, PublicContentController, HomeController, CountriesController],
})
export class PublicModule {}
