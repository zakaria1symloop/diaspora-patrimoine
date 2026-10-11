// Package 3.3 « Compte du client » — API-100: `GET /admin/clients/{id}/account` (`client.read`), `invite`
// (`client.invite`), `suspend`, `reactivate`, `revoke-sessions`, `disable-two-factor` (recent password, BO-005),
// `change-email` (`client.account.manage`), `preview-code` (`client.impersonate`, ROL-017); `POST /auth/preview/exchange`
// (the client space exchanges the one-minute code for the read-only session) and `GET /client/preview` (ECL-004).
import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { ClientAccess, CurrentAuth, RequirePermission, RequireRecentPassword } from '../identity/access.js';
import { IdentityModule } from '../identity/identity.module.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { ClientAccountService } from './client-account.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin/clients')
export class ClientAccountAdminController {
  constructor(private readonly account: ClientAccountService) {}

  @Get(':id/account') @RequirePermission('client.read')
  read(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.account.account(auth, id); }
  @Post(':id/invite') @HttpCode(200) @RequirePermission('client.invite')
  invite(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.account.invite(auth, id); }
  @Post(':id/suspend') @HttpCode(200) @RequirePermission('client.account.manage')
  suspend(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.account.suspend(auth, id, body); }
  @Post(':id/reactivate') @HttpCode(200) @RequirePermission('client.account.manage')
  reactivate(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.account.reactivate(auth, id, body); }
  @Post(':id/revoke-sessions') @HttpCode(200) @RequirePermission('client.account.manage')
  revokeSessions(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.account.revokeSessions(auth, id); }
  @Post(':id/disable-two-factor') @HttpCode(200) @RequirePermission('client.account.manage') @RequireRecentPassword()
  disableTwoFactor(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.account.disableTwoFactor(auth, id, body); }
  @Post(':id/change-email') @HttpCode(200) @RequirePermission('client.account.manage')
  changeEmail(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.account.changeEmail(auth, id, body); }
  @Post(':id/preview-code') @HttpCode(200) @RequirePermission('client.impersonate')
  previewCode(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.account.previewCode(auth, id, body); }
}

@Controller('auth/preview')
export class PreviewExchangeController {
  constructor(private readonly account: ClientAccountService) {}

  @Post('exchange') @HttpCode(200)
  exchange(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.account.exchange(req, res, body); }
}

@Controller('client/preview')
@ClientAccess()
export class ClientPreviewController {
  constructor(private readonly account: ClientAccountService) {}

  @Get()
  state(@CurrentAuth() auth: AuthContext) { return this.account.previewState(auth); }
}

@Module({
  imports: [BackOfficeModule, IdentityModule],
  controllers: [ClientAccountAdminController, PreviewExchangeController, ClientPreviewController],
  providers: [ClientAccountService],
})
export class ClientAccountAdminModule {}
