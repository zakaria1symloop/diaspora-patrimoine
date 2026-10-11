// Package 3.8 « Tâches et rendez-vous » — the tasks (EA-30), the agenda and the appointments (EA-31) of the back
// office, the client's appointments (EC-14), their notifications, e-mails, rules (AUT-051, `R_EMAIL_BOUNCED`:
// `automation/rule-seeds-agenda.ts`) and scheduled tasks (`appointment.scan`, `task.scan`, `digest.staff`).
import { Module } from '@nestjs/common';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { AgendaJobs } from './agenda-jobs.js';
import { AgendaNotificationHandlers } from './agenda-notifications.js';
import { AppointmentsService } from './appointments.service.js';
import { AppointmentsAdminController, ClientAppointmentsController, TasksAdminController } from './tasks-admin.controller.js';
import { TasksAdminService } from './tasks-admin.service.js';

@Module({
  imports: [BackOfficeModule, CommunicationModule],
  controllers: [TasksAdminController, AppointmentsAdminController, ClientAppointmentsController],
  providers: [TasksAdminService, AppointmentsService, AgendaNotificationHandlers, AgendaJobs],
  exports: [TasksAdminService, AppointmentsService],
})
export class TasksAdminModule {}
