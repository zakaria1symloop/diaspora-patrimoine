// API-100 « Alertes » and « Préférences » — public routes. Token routes are never cached (`no-store`): they read and
// change a person's alert. Two routes are not in API-100 yet and are proposed to it: `POST /public/alerts/links` and
// `POST /public/preferences/links` (« Recevoir un nouveau lien », SFA-035, PRO-031); `GET /public/unsubscribe/{jeton}`
// only sends a browser that opened the one-click address to the matching page.
import { Body, Controller, Delete, Get, Header, HttpCode, Inject, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { CurrentAuth, OptionalClientSession } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import type { AlertActionResult, AlertView, CreateAlertResult, PreferencesView, UnsubscribeResult } from '@dp/contracts';
import type { Request, Response } from 'express';
import { ENV, type Env } from '../config/env.js';
import { alertStopPagePath, preferencesPagePath } from '../communication/link-tokens.js';
import { AlertsService } from './alerts.service.js';
import { PreferencesService } from './preferences.service.js';

/** A token is short lower-case text (link-tokens.ts); anything else is answered 410 by the services. */
const tokenOf = (raw: string) => raw.slice(0, 200);

@Controller('public')
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly preferences: PreferencesService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** CAT-070 — 201 `{outcome}`; 409 `ALERT_LIMIT` at ten active alerts (CAT-072). Idempotency-Key required (API-040). */
  @Post('alerts')
  @UseGuards(OptionalClientSession)
  async create(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: unknown,
    @CurrentAuth() auth: AuthContext | null,
  ): Promise<CreateAlertResult> {
    const client = auth?.kind === 'CLIENT' && auth.clientId ? { clientId: auth.clientId, email: auth.email } : null;
    const result = await this.alerts.create(req, body, client);
    res.status(result.status);
    return result.body;
  }

  @Post('alerts/links')
  @HttpCode(202)
  links(@Req() req: Request, @Body() body: unknown): Promise<Record<string, never>> {
    return this.alerts.requestLinks(req, body);
  }

  @Get('alerts/:token')
  @Header('Cache-Control', 'no-store')
  view(@Param('token') token: string): Promise<AlertView> {
    return this.alerts.view(tokenOf(token));
  }

  @Patch('alerts/:token')
  @Header('Cache-Control', 'no-store')
  patch(@Param('token') token: string, @Body() body: unknown): Promise<AlertActionResult> {
    return this.alerts.patch(tokenOf(token), body);
  }

  @Delete('alerts/:token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  stop(@Param('token') token: string): Promise<{ done: 'STOPPED' }> {
    return this.alerts.stop(tokenOf(token));
  }

  @Post('alerts/:token/confirm')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  confirm(@Param('token') token: string): Promise<AlertActionResult> {
    return this.alerts.confirm(tokenOf(token));
  }

  @Post('alerts/:token/extend')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  extend(@Param('token') token: string): Promise<AlertActionResult> {
    return this.alerts.extend(tokenOf(token));
  }

  // ---------- preferences (NOT-022, PRO-031) ----------

  @Post('preferences/links')
  @HttpCode(202)
  preferencesLink(@Req() req: Request, @Body() body: unknown): Promise<Record<string, never>> {
    return this.preferences.requestLink(req, body);
  }

  @Get('preferences/:token')
  @Header('Cache-Control', 'no-store')
  preferencesView(@Param('token') token: string): Promise<PreferencesView> {
    return this.preferences.view(tokenOf(token));
  }

  @Patch('preferences/:token')
  @Header('Cache-Control', 'no-store')
  preferencesPatch(@Req() req: Request, @Param('token') token: string, @Body() body: unknown): Promise<PreferencesView> {
    return this.preferences.patch(req, tokenOf(token), body);
  }

  /** RFC 8058 one click (`List-Unsubscribe-Post`): cuts the group, or stops the alert. */
  @Post('unsubscribe/:token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  unsubscribe(@Req() req: Request, @Param('token') token: string): Promise<UnsubscribeResult> {
    return this.preferences.unsubscribe(req, tokenOf(token));
  }

  /** A mail client without one-click support opens the address: the page does the same, and says it is done. */
  @Get('unsubscribe/:token')
  unsubscribePage(@Param('token') token: string, @Res() res: Response): void {
    const t = tokenOf(token);
    const path = t.startsWith('a') ? alertStopPagePath(t) : `${preferencesPagePath(t)}?arret=1`;
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(303, `${this.env.WEB_URL}${path}`);
  }
}
