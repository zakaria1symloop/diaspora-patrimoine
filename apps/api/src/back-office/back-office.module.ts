// Packages 1.8, 1.9, 2.11, 3.1 — the API side of the back-office foundation (04-back-office/01, 13 § 3, 03 § 1-2).
// Lot 3 modules (requests processing, clients, dossiers…) add their own modules; they reuse `StaffViews` (permissions,
// perimeter, masking) and `NotesTimelineService` exported here.
import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module.js';
import { LeadsAdminController, NotesController, StaffShellController, StaffSocleController, TeamController } from './back-office.controller.js';
import { LeadsAdminService } from './leads-admin.service.js';
import { NotesTimelineService } from './notes-timeline.service.js';
import { SavedViewsService } from './saved-views.service.js';
import { SearchService } from './search.service.js';
import { ShellService } from './shell.service.js';
import { StaffNotificationsService } from './staff-notifications.service.js';
import { StaffViews } from './staff-view.js';
import { TeamEventsHandler } from './team-events.handler.js';
import { TeamService } from './team.service.js';

@Module({
  imports: [CommunicationModule],
  controllers: [StaffShellController, StaffSocleController, NotesController, TeamController, LeadsAdminController],
  providers: [StaffViews, ShellService, StaffNotificationsService, SearchService, SavedViewsService, NotesTimelineService, TeamService, TeamEventsHandler, LeadsAdminService],
  exports: [StaffViews, NotesTimelineService, StaffNotificationsService, LeadsAdminService],
})
export class BackOfficeModule {}
