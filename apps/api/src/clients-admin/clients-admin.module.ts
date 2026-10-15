// Package 3.3 « Clients » — API-100 `/admin/clients`: list and record (`client.read`), creation (`client.create`),
// edit, « Ne pas contacter », `confirm-phone`, `confirm-email`, trusted persons (`client.update`), `archive`,
// `unarchive` (`client.archive`), `assign` (`client.assign`), the bulk actions, the check of known coordinates, the
// tabs of the record and its timeline.
import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { ClientCachesJobs } from './client-caches.jobs.js';
import { ClientsReadService } from './clients-read.service.js';
import { ClientsWriteService } from './clients-write.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin/clients')
export class ClientsAdminController {
  constructor(
    private readonly read: ClientsReadService,
    private readonly write: ClientsWriteService,
  ) {}

  @Get() @RequirePermission('client.read')
  list(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.read.list(auth, query); }
  @Get('contact-check') @RequirePermission('client.read')
  check(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.write.check(auth, query); }
  @Post() @RequirePermission('client.create')
  create(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.write.create(auth, body); }
  @Post('bulk') @HttpCode(200) @RequirePermission('client.read')
  bulk(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.write.bulk(auth, body); }

  @Get(':id') @RequirePermission('client.read')
  detail(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.read.detail(auth, id); }
  @Get(':id/project') @RequirePermission('client.read')
  project(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.read.project(auth, id); }
  @Get(':id/leads') @RequirePermission('client.read')
  leads(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.read.leads(auth, id); }
  @Get(':id/dossiers') @RequirePermission('client.read')
  dossiers(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.read.dossiers(auth, id); }
  @Get(':id/favorites') @RequirePermission('client.read')
  favorites(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.read.favorites(auth, id); }
  @Get(':id/registrations') @RequirePermission('client.read')
  registrations(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.read.registrations(auth, id); }
  @Get(':id/feedback') @RequirePermission('client.read')
  feedback(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.read.feedback(auth, id); }
  @Get(':id/contacts') @RequirePermission('client.read')
  contacts(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.read.contacts(auth, id); }
  @Get(':id/consents') @RequirePermission('client.read')
  consents(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.read.consents(auth, id); }
  @Get(':id/timeline') @RequirePermission('client.read')
  timeline(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: { before?: string; type?: string }) { return this.read.timeline(auth, id, query); }

  @Patch(':id') @HttpCode(200) @RequirePermission('client.update')
  update(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.write.update(auth, id, body); }
  @Post(':id/do-not-contact') @HttpCode(200) @RequirePermission('client.update')
  doNotContact(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.write.doNotContact(auth, id, body); }
  @Post(':id/confirm-phone') @HttpCode(200) @RequirePermission('client.update')
  confirmPhone(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.write.confirmPhone(auth, id); }
  @Post(':id/confirm-email') @HttpCode(200) @RequirePermission('client.update')
  confirmEmail(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.write.confirmEmail(auth, id); }
  @Post(':id/archive') @HttpCode(200) @RequirePermission('client.archive')
  archive(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.write.archive(auth, id, body); }
  @Post(':id/unarchive') @HttpCode(200) @RequirePermission('client.archive')
  unarchive(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.write.unarchive(auth, id); }
  @Post(':id/assign') @HttpCode(200) @RequirePermission('client.assign')
  assign(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.write.assign(auth, id, body); }
  @Post(':id/contacts') @RequirePermission('client.update')
  addContact(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.write.addContact(auth, id, body); }
  @Patch(':id/contacts/:contactId') @HttpCode(200) @RequirePermission('client.update')
  updateContact(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Param('contactId', uuid) contactId: string, @Body() body: unknown) { return this.write.updateContact(auth, id, contactId, body); }
  @Delete(':id/contacts/:contactId') @HttpCode(204) @RequirePermission('client.update')
  deleteContact(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Param('contactId', uuid) contactId: string) { return this.write.deleteContact(auth, id, contactId); }
}

@Module({
  imports: [BackOfficeModule],
  controllers: [ClientsAdminController],
  providers: [ClientsReadService, ClientsWriteService, ClientCachesJobs],
  exports: [ClientsReadService],
})
export class ClientsAdminModule {}
