// Package 3.2 « Échanges et e-mail écrit à la main » — API-100 `communications` (noter, corriger, supprimer un appel, un
// échange, une rencontre ; un e-mail reçu: `communication.log`) and `emails` (`send`, `cancel`, the window and its
// preview: `email.send`).
import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { ExchangesService } from './exchanges.service.js';
import { ManualEmailService } from './manual-email.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin/communications')
export class ExchangesController {
  constructor(private readonly exchanges: ExchangesService) {}

  @Post() @RequirePermission('communication.log')
  create(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.exchanges.create(auth, body); }
  @Post('received-email') @RequirePermission('communication.log')
  received(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.exchanges.receivedEmail(auth, body); }
  @Patch(':id') @HttpCode(200) @RequirePermission('communication.log')
  update(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.exchanges.update(auth, id, body); }
  @Delete(':id') @HttpCode(204) @RequirePermission('communication.log')
  remove(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.exchanges.remove(auth, id); }
}

@Controller('admin/emails')
export class ManualEmailController {
  constructor(private readonly emails: ManualEmailService) {}

  @Get('compose') @RequirePermission('email.send')
  compose(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.emails.compose(auth, query); }
  @Post('preview') @HttpCode(200) @RequirePermission('email.send')
  preview(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.emails.preview(auth, body); }
  @Post('send') @RequirePermission('email.send')
  send(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.emails.send(auth, body); }
  @Post(':id/cancel') @HttpCode(200) @RequirePermission('email.send')
  cancel(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.emails.cancel(auth, id); }
}

@Module({
  imports: [BackOfficeModule, CommunicationModule],
  controllers: [ExchangesController, ManualEmailController],
  providers: [ExchangesService, ManualEmailService],
})
export class ExchangesAdminModule {}
