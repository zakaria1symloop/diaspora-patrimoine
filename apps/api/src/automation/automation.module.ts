// Package 1.4 « moteur des automatisations » (AUT-083, ARC-050 `automation`) — rule engine, scheduler, tasks and staff
// notifications. Global: every module declares ITS scheduled tasks, ITS purge lines, ITS e-mail composers and ITS
// task-closing lines to the services exported here (see README.md), and none of them is imported back — the engine
// depends on the platform and on the mailer only.
import { Global, Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module.js';
import { AutomationJobs } from './automation-jobs.js';
import { DiagnosticsController } from './diagnostics.controller.js';
import { RuleTeamActions } from './rule-actions.js';
import { RuleContextLoader } from './rule-context.js';
import { RuleEngine } from './rule-engine.js';
import { RuleMailAction, RuleMailComposers } from './rule-mail.js';
import { Scheduler } from './scheduler.js';
import { StaffDirectory } from './staff-directory.js';
import { StaffNotifier } from './staff-notifications.service.js';
import { TaskAssignedHandler, TaskAutoClose } from './task-effects.js';
import { TasksService } from './tasks.service.js';
import { TechAlerts } from './tech-alerts.js';

@Global()
@Module({
  imports: [CommunicationModule],
  controllers: [DiagnosticsController],
  providers: [
    StaffDirectory,
    StaffNotifier,
    TasksService,
    TechAlerts,
    Scheduler,
    RuleMailComposers,
    RuleContextLoader,
    RuleMailAction,
    RuleTeamActions,
    RuleEngine,
    TaskAutoClose,
    TaskAssignedHandler,
    AutomationJobs,
  ],
  exports: [StaffDirectory, StaffNotifier, TasksService, TechAlerts, Scheduler, RuleMailComposers, RuleEngine, TaskAutoClose, RuleContextLoader],
})
export class AutomationModule {}
