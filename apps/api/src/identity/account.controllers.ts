// API-100 « Moi » — `/client/me` (NAV-013, AUTH-080, AUTH-081, PRO-020, PRO-021), `/admin/me` (BO-070) and the partner
// space `/partner` (ACP-083, ACP-087). Each declares its audience and kind (SEC-030); the global AccessGuard checks.
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AccountService } from './account.service.js';
import { ClientAccess, CurrentAuth, PartnerAccess, StaffAccess } from './access.js';
import { PartnerService } from './partner.service.js';
import type { AuthContext } from './sessions.service.js';

const uuid = new ParseUUIDPipe();

@Controller('client/me')
@ClientAccess()
export class ClientAccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  me(@CurrentAuth() auth: AuthContext) { return this.account.clientMe(auth); }
  @Get('sessions')
  sessions(@CurrentAuth() auth: AuthContext) { return this.account.listSessions(auth); }
  @Delete('sessions') @HttpCode(204)
  revokeOthers(@CurrentAuth() auth: AuthContext) { return this.account.revokeOtherSessions(auth); }
  @Delete('sessions/:id') @HttpCode(204)
  revoke(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.account.revokeSession(auth, id); }
  @Post('two-factor/setup') @HttpCode(200)
  setup(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.twoFactorSetup(req, auth, body); }
  @Post('two-factor/confirm') @HttpCode(200)
  confirm(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.twoFactorConfirm(auth, body); }
  @Post('two-factor/enable') @HttpCode(204)
  enable(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.twoFactorEnable(auth, body); }
  @Delete('two-factor') @HttpCode(204)
  disable(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.twoFactorDisable(req, auth, body); }
  @Post('two-factor/recovery-codes') @HttpCode(200)
  codes(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.recoveryCodes(req, auth, body); }
  @Patch('password') @HttpCode(204)
  password(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.changePassword(req, auth, body); }
  @Patch('email') @HttpCode(200)
  email(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.changeEmail(req, auth, body); }
}

@Controller('client/favorites')
@ClientAccess()
export class ClientFavoritesMergeController {
  constructor(private readonly account: AccountService) {}

  /** SFA-021 — the browser's favourites join the account after sign-in / sign-up. */
  @Post('merge') @HttpCode(200)
  merge(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.mergeFavorites(auth, body); }
}

@Controller('admin/me')
@StaffAccess()
export class StaffAccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  me(@CurrentAuth() auth: AuthContext) { return this.account.staffMe(auth); }
  @Get('sessions')
  sessions(@CurrentAuth() auth: AuthContext) { return this.account.listSessions(auth); }
  @Delete('sessions') @HttpCode(204)
  revokeOthers(@CurrentAuth() auth: AuthContext) { return this.account.revokeOtherSessions(auth); }
  @Delete('sessions/:id') @HttpCode(204)
  revoke(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.account.revokeSession(auth, id); }
  @Patch('password') @HttpCode(204)
  password(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.changePassword(req, auth, body); }
  /** BO-070 — reconfiguration: password and current code → new key and QR code. */
  @Post('two-factor/reconfigure') @HttpCode(200)
  reconfigure(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.twoFactorSetup(req, auth, body); }
  @Post('two-factor/confirm') @HttpCode(200)
  confirm(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.twoFactorConfirm(auth, body); }
  @Post('two-factor/enable') @HttpCode(204)
  enable(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.twoFactorEnable(auth, body); }
  @Post('two-factor/recovery-codes') @HttpCode(200)
  codes(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.account.recoveryCodes(req, auth, body); }
}

@Controller('partner')
@PartnerAccess()
export class PartnerController {
  constructor(private readonly partners: PartnerService) {}

  @Get('application')
  application(@CurrentAuth() auth: AuthContext) { return this.partners.application(auth); }
  /** ACP-087 « Régions où vous construisez » — the active regions of the catalogue countries. */
  @Get('regions')
  regions() { return this.partners.regions(); }
  @Patch('application/sections/:section') @HttpCode(200)
  section(@CurrentAuth() auth: AuthContext, @Param('section') section: string, @Body() body: unknown) { return this.partners.saveSection(auth, section, body); }
  @Post('application/uploads')
  announce(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.partners.announceUpload(auth, body); }
  @Put('application/uploads/:id/content') @HttpCode(204)
  content(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: { e?: string; s?: string }, @Body() body: unknown) { return this.partners.receiveContent(auth, id, query, body); }
  @Post('application/uploads/:id/complete') @HttpCode(200)
  complete(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.partners.completeUpload(auth, id, body); }
  @Delete('application/files/:id') @HttpCode(200)
  deleteFile(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.partners.deleteFile(auth, id); }
  @Post('application/submit') @HttpCode(200)
  submit(@CurrentAuth() auth: AuthContext) { return this.partners.submit(auth); }
  @Post('application/additions') @HttpCode(200)
  addition(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.partners.addition(auth, body); }
}
