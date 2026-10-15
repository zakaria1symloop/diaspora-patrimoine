// Package 3.2 « Échanges et e-mail écrit à la main » — API-100 `communications` (noter, corriger, supprimer un appel, un
// échange, une rencontre ; un e-mail reçu: `communication.log`) and `emails` (`send`, `cancel`, the window and its
// preview: `email.send`).
import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { raw, type Request } from 'express';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { idempotentCreate } from '../catalogue-admin/admin-idempotency.js';
import { CommunicationModule } from '../communication/communication.module.js';
import { FilesModule } from '../files/files.module.js';
import { CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { PrismaService } from '../platform/prisma.service.js';
import { EmailAttachmentsService } from './email-attachments.service.js';
import { ExchangesService } from './exchanges.service.js';
import { ManualEmailService } from './manual-email.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin/communications')
export class ExchangesController {
  constructor(
    private readonly exchanges: ExchangesService,
    private readonly files: EmailAttachmentsService,
    private readonly idempotency: IdempotencyService,
    private readonly prisma: PrismaService,
  ) {}

  /** COM-030 « fichiers éventuels » — API-080, steps 1 to 3, for « Noter un e-mail reçu ». */
  @Post('uploads') @RequirePermission('communication.log')
  announce(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.files.announce(auth, body, 'communications'); }
  @Put('uploads/:id/content') @HttpCode(204) @RequirePermission('communication.log')
  content(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: { e?: string; s?: string }, @Body() body: unknown) { return this.files.receive(auth, id, query, body); }
  @Post('uploads/:id/complete') @HttpCode(200) @RequirePermission('communication.log')
  complete(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.files.complete(auth, id); }
  /** MED-030 — one file of an e-mail (sent or noted as received), by a link of 5 minutes. */
  @Get(':id/attachments/:uploadId') @RequirePermission('client.read')
  attachment(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Param('uploadId', uuid) uploadId: string) { return this.exchanges.attachmentLink(auth, id, uploadId); }

  /** CRM-030, CRM-031, TRV-091 — a double click on « Enregistrer » notes the exchange once. */
  @Post() @RequirePermission('communication.log')
  create(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return idempotentCreate(this.idempotency, this.prisma, req, 'admin.communications', auth.userId, () => this.exchanges.create(auth, body));
  }
  @Post('received-email') @RequirePermission('communication.log')
  received(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return idempotentCreate(this.idempotency, this.prisma, req, 'admin.communications.received', auth.userId, () => this.exchanges.receivedEmail(auth, body));
  }
  @Patch(':id') @HttpCode(200) @RequirePermission('communication.log')
  update(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.exchanges.update(auth, id, body); }
  @Delete(':id') @HttpCode(204) @RequirePermission('communication.log')
  remove(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.exchanges.remove(auth, id); }
}

@Controller('admin/emails')
export class ManualEmailController {
  constructor(
    private readonly emails: ManualEmailService,
    private readonly files: EmailAttachmentsService,
    private readonly idempotency: IdempotencyService,
    private readonly prisma: PrismaService,
  ) {}

  /** COM-020 « Pièces jointes » — API-080, steps 1 to 3 (MED-010, MED-011, MED-021). */
  @Post('uploads') @RequirePermission('email.send')
  announce(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.files.announce(auth, body, 'emails'); }
  @Put('uploads/:id/content') @HttpCode(204) @RequirePermission('email.send')
  content(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: { e?: string; s?: string }, @Body() body: unknown) { return this.files.receive(auth, id, query, body); }
  @Post('uploads/:id/complete') @HttpCode(200) @RequirePermission('email.send')
  complete(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.files.complete(auth, id); }

  @Get('compose') @RequirePermission('email.send')
  compose(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.emails.compose(auth, query); }
  @Post('preview') @HttpCode(200) @RequirePermission('email.send')
  preview(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.emails.preview(auth, body); }
  /** COM-020, TRV-091 — « Envoyer » clicked twice sends one e-mail. */
  @Post('send') @RequirePermission('email.send')
  send(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return idempotentCreate(this.idempotency, this.prisma, req, 'admin.emails.send', auth.userId, () => this.emails.send(auth, body));
  }
  @Post(':id/cancel') @HttpCode(200) @RequirePermission('email.send')
  cancel(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.emails.cancel(auth, id); }
}

@Module({
  imports: [BackOfficeModule, CommunicationModule, FilesModule],
  controllers: [ExchangesController, ManualEmailController],
  providers: [ExchangesService, ManualEmailService, EmailAttachmentsService],
})
export class ExchangesAdminModule implements NestModule {
  /** API-080 step 2 (D-097) — the raw bytes of a file (MED-010: 10 MB at most for a hand-written e-mail). */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(raw({ type: () => true, limit: '11mb' }))
      .forRoutes({ path: 'admin/emails/uploads/:id/content', method: RequestMethod.PUT }, { path: 'admin/communications/uploads/:id/content', method: RequestMethod.PUT });
  }
}
