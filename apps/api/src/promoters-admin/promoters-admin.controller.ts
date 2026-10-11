// API-100 `/admin` — routes of package 3.4: promoters (CTL-001 … CTL-007; creation, identity, activation are the
// routes of `catalogue-admin.controller.ts`), « Autres partenaires » (CTL-170) and the review of partner applications
// (ACP-084). Every route declares its permission (SEC-030); a second one, when the rule asks for it, is checked by the
// service (ACP-084: `lead.process` AND `promoter.write` or `bank.write`).
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import type { Actor } from '../admin/actor.js';
import { CurrentActor, CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { PartnerApplicationsService } from './partner-applications.service.js';
import { PartnersService } from './partners.service.js';
import { PromotersGesturesService } from './promoters-gestures.service.js';
import { PromotersReadService } from './promoters-read.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin')
export class PromotersAdminController {
  constructor(
    private readonly reads: PromotersReadService,
    private readonly gestures: PromotersGesturesService,
    private readonly partners: PartnersService,
    private readonly applications: PartnerApplicationsService,
  ) {}

  // Promoters
  @Get('promoters') @RequirePermission('promoter.read')
  list(@Query() query: Record<string, unknown>) { return this.reads.list(query); }
  @Get('promoters/:id') @RequirePermission('promoter.read')
  one(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.reads.detail(auth, id); }
  @Get('promoters/:id/impact') @RequirePermission('promoter.read')
  impact(@Param('id', uuid) id: string) { return this.reads.impact(id); }
  @Get('promoters/:id/relation') @RequirePermission('promoter.read')
  relation(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: Record<string, unknown>) { return this.reads.relation(auth, id, query); }
  @Get('promoters/:id/expectations') @RequirePermission('promoter.read')
  expectations(@Param('id', uuid) id: string) { return this.reads.expectations(id); }
  @Put('promoters/:id/vetting') @HttpCode(200) @RequirePermission('promoter.write')
  vetting(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.vetting(id, body, actor); }
  @Post('promoters/:id/suspend') @HttpCode(200) @RequirePermission('promoter.write')
  suspend(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.suspend(id, body, actor); }
  @Post('promoters/:id/end') @HttpCode(200) @RequirePermission('promoter.write')
  end(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.end(id, body, actor); }
  @Post('promoters/:id/resume') @HttpCode(200) @RequirePermission('promoter.write')
  resume(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.resume(id, body, actor); }
  @Post('promoters/:id/republish') @HttpCode(200) @RequirePermission('catalogue.publish')
  republish(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.gestures.republish(id, actor); }
  @Delete('promoters/:id') @HttpCode(200) @RequirePermission('promoter.delete')
  remove(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.gestures.remove(id, actor); }

  // Contacts
  @Post('promoters/:id/contacts') @RequirePermission('promoter.write')
  addContact(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.saveContact(id, null, body, actor); }
  @Patch('promoters/:id/contacts/:contactId') @HttpCode(200) @RequirePermission('promoter.write')
  editContact(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Param('contactId', uuid) contactId: string, @Body() body: unknown) { return this.gestures.saveContact(id, contactId, body, actor); }
  @Delete('promoters/:id/contacts/:contactId') @HttpCode(200) @RequirePermission('promoter.write')
  deleteContact(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Param('contactId', uuid) contactId: string) { return this.gestures.deleteContact(id, contactId, actor); }

  // Documents (API-080, MED-030)
  @Post('promoters/:id/document-uploads') @RequirePermission('promoter.write')
  announceDocument(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.announceDocument(auth, id, body); }
  @Put('promoters/:id/document-uploads/:uploadId/content') @HttpCode(204) @RequirePermission('promoter.write')
  receiveDocument(@CurrentAuth() auth: AuthContext, @Param('uploadId', uuid) uploadId: string, @Query() query: { e?: string; s?: string }, @Body() body: unknown) { return this.gestures.receiveDocument(auth, uploadId, query, body); }
  @Post('promoters/:id/document-uploads/:uploadId/complete') @HttpCode(200) @RequirePermission('promoter.write')
  completeDocument(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Param('uploadId', uuid) uploadId: string, @Body() body: unknown) { return this.gestures.completeDocument(auth, actor, id, uploadId, body); }
  @Patch('promoters/:id/documents/:documentId') @HttpCode(200) @RequirePermission('promoter.write')
  editDocument(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Param('documentId', uuid) documentId: string, @Body() body: unknown) { return this.gestures.updateDocument(id, documentId, body, actor); }
  @Delete('promoters/:id/documents/:documentId') @HttpCode(200) @RequirePermission('promoter.write')
  deleteDocument(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Param('documentId', uuid) documentId: string) { return this.gestures.deleteDocument(id, documentId, actor); }
  @Get('promoters/:id/documents/:documentId/file') @RequirePermission('promoter.read')
  openDocument(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Param('documentId', uuid) documentId: string, @Query('disposition') disposition?: string) { return this.gestures.openDocument(actor, id, documentId, disposition === 'attachment' ? 'attachment' : 'inline'); }

  // Autres partenaires (CTL-170)
  @Get('partners') @RequirePermission('content.manage')
  partnersList(@Query() query: Record<string, unknown>) { return this.partners.list(query); }
  @Get('partners/:id') @RequirePermission('content.manage')
  partner(@Param('id', uuid) id: string) { return this.partners.one(id); }
  @Post('partners') @RequirePermission('content.manage')
  createPartner(@CurrentActor() actor: Actor, @Body() body: unknown) { return this.partners.create(body, actor); }
  @Patch('partners/:id') @HttpCode(200) @RequirePermission('content.manage')
  updatePartner(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.partners.update(id, body, actor); }
  @Post('partners/:id/move') @HttpCode(200) @RequirePermission('content.manage')
  movePartner(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.partners.move(id, body, actor); }
  @Delete('partners/:id') @HttpCode(200) @RequirePermission('content.manage')
  deletePartner(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.partners.remove(id, actor); }

  // Partner applications (ACP-084)
  @Get('leads/:id/partner-application') @RequirePermission('lead.read')
  application(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.applications.panel(auth, id); }
  @Get('leads/:id/partner-application/files/:fileId') @RequirePermission('lead.read')
  applicationFile(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Param('fileId', uuid) fileId: string) { return this.applications.openFile(actor, id, fileId); }
  @Post('leads/:id/approve-partner') @HttpCode(200) @RequirePermission('lead.process')
  approve(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.applications.approve(auth, actor, id, body); }
  @Post('leads/:id/request-partner-info') @HttpCode(200) @RequirePermission('lead.process')
  requestInfo(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.applications.requestInfo(auth, actor, id, body); }
  @Post('leads/:id/decline-partner') @HttpCode(200) @RequirePermission('lead.process')
  decline(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.applications.decline(auth, actor, id, body); }
}
