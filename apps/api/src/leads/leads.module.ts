// Work package 2.5 « Demandes » — public request forms (02-site-public/05).
import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module.js';
import { SimulationsModule } from '../simulations/simulations.module.js';
import { EnvChallengeProvider } from './challenge.js';
import { CompleteLeadService } from './complete-lead.service.js';
import { LeadMailHandler } from './lead-mail.handler.js';
import { LeadsController } from './leads.controller.js';
import { SubmitLeadService } from './submit-lead.service.js';

@Module({
  imports: [CommunicationModule, SimulationsModule],
  controllers: [LeadsController],
  providers: [SubmitLeadService, CompleteLeadService, EnvChallengeProvider, LeadMailHandler],
})
export class LeadsModule {}
