// Package 3.3 — API-100 `clients`: `merge` (`client.merge`), `not-duplicate` (`client.update`), and « Mettre à jour la
// fiche » from the last request (`client.update`, CRM-045).
import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { ClientsMergeService } from './clients-merge.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin/clients')
export class ClientsMergeController {
  constructor(private readonly merge: ClientsMergeService) {}

  @Post(':id/not-duplicate') @HttpCode(200) @RequirePermission('client.update')
  notDuplicate(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.merge.notDuplicate(auth, id, body); }
  @Get(':id/merge-preview') @RequirePermission('client.merge')
  preview(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: Record<string, unknown>) { return this.merge.preview(auth, id, query); }
  @Post(':id/merge') @HttpCode(200) @RequirePermission('client.merge')
  doMerge(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.merge.merge(auth, id, body); }
  @Get(':id/lead-differences') @RequirePermission('client.read')
  differences(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.merge.leadDifferences(auth, id); }
  @Post(':id/apply-lead-values') @HttpCode(200) @RequirePermission('client.update')
  apply(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.merge.applyLeadValues(auth, id, body); }
}

@Module({ imports: [BackOfficeModule], controllers: [ClientsMergeController], providers: [ClientsMergeService] })
export class ClientsMergeAdminModule {}
