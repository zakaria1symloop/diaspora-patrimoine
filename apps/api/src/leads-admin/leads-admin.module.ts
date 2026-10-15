// Package 3.2 « Demandes : traitement » — API-100 `/admin/leads` (writes) and `/admin/lead-objects`. The reads of the
// list and of a request stay in `back-office/` (package 2.11); their answers say what each caller may do (`can`).
import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { idempotentCreate } from '../catalogue-admin/admin-idempotency.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { PrismaService } from '../platform/prisma.service.js';
import { LeadNotificationsHandler } from './lead-notifications.handler.js';
import { LeadsProcessingService } from './leads-processing.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin/leads')
export class LeadsProcessingController {
  constructor(
    private readonly leads: LeadsProcessingService,
    private readonly idempotency: IdempotencyService,
    private readonly prisma: PrismaService,
  ) {}

  /** CRM-025, TRV-091 — the form sends its `Idempotency-Key`: a double click replays the first answer. */
  @Post() @RequirePermission('lead.create')
  create(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return idempotentCreate(this.idempotency, this.prisma, req, 'admin.leads', auth.userId, () => this.leads.create(auth, body));
  }
  @Post('bulk') @HttpCode(200) @RequirePermission('lead.process')
  bulk(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.leads.bulk(auth, body); }
  @Post(':id/take') @HttpCode(200) @RequirePermission('lead.process')
  take(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.leads.take(auth, id); }
  @Post(':id/assign') @HttpCode(200) @RequirePermission('lead.assign')
  assign(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.leads.assign(auth, id, body); }
  @Post(':id/release') @HttpCode(200) @RequirePermission('lead.process')
  release(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.leads.release(auth, id); }
  @Post(':id/close') @HttpCode(200) @RequirePermission('lead.process')
  close(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.leads.close(auth, id, body); }
  @Post(':id/reopen') @HttpCode(200) @RequirePermission('lead.process')
  reopen(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.leads.reopen(auth, id); }
  @Post(':id/spam') @HttpCode(200) @RequirePermission('lead.process')
  spam(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.leads.spam(auth, id); }
  @Post(':id/restore') @HttpCode(200) @RequirePermission('lead.process')
  restore(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.leads.restore(auth, id); }
  @Post(':id/review') @HttpCode(200) @RequirePermission('lead.process')
  review(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.leads.review(auth, id, body); }
  @Post(':id/open-dossier') @HttpCode(200) @RequirePermission('dossier.create')
  openDossier(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.leads.openDossier(auth, id); }
  @Post(':id/attach') @HttpCode(200) @RequirePermission('dossier.create')
  attach(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.leads.attach(auth, id, body); }
}

@Controller('admin/lead-objects')
export class LeadObjectsController {
  constructor(private readonly leads: LeadsProcessingService) {}

  /** CRM-025 « bien ou programme » — read with the creation of a request. */
  @Get() @RequirePermission('lead.create')
  list(@Query('q') q?: string) { return this.leads.objects(q); }
}

@Module({
  imports: [BackOfficeModule, CommunicationModule],
  controllers: [LeadsProcessingController, LeadObjectsController],
  providers: [LeadsProcessingService, LeadNotificationsHandler],
})
export class LeadsAdminModule {}
