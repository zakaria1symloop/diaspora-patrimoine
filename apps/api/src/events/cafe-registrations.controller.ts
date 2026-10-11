// API-100 Cafés — `POST /public/events/{slug}/registrations` (CAF-021, idempotent API-040) and
// `GET`, `PATCH`, `DELETE /public/registrations/{jeton}` + `GET /public/registrations/{jeton}/ics` (EP-15, CAF-030 …
// CAF-032, CAF-050). The token routes are never cached nor indexed. They follow the gate and the maintenance like every
// /public route: NAV-061 exempts only the token pages whose sole purpose is to STOP e-mails, which this page is not.
import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { CafeRegistrationResponse, CafeRegistrationView } from '@dp/contracts';
import type { Request, Response } from 'express';
import { CurrentAuth, OptionalClientSession } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { CafeRegistrationService } from './cafe-registration.service.js';

@Controller('public')
export class CafeRegistrationsController {
  constructor(private readonly registrations: CafeRegistrationService) {}

  /** A signed-in client re-registering gets his registration updated (CAF-024, CYC-186). */
  @Post('events/:slug/registrations')
  @UseGuards(OptionalClientSession)
  async create(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('slug') slug: string,
    @Body() body: unknown,
    @CurrentAuth() auth: AuthContext | null,
  ): Promise<CafeRegistrationResponse> {
    const result = await this.registrations.register(req, slug, body, auth?.kind === 'CLIENT' ? auth.clientId : null);
    res.status(result.status);
    return result.body;
  }

  @Get('registrations/:token')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex')
  view(@Param('token') token: string): Promise<CafeRegistrationView> {
    return this.registrations.view(token);
  }

  @Patch('registrations/:token')
  @Header('Cache-Control', 'no-store')
  update(@Param('token') token: string, @Body() body: unknown): Promise<CafeRegistrationView> {
    return this.registrations.update(token, body);
  }

  @Delete('registrations/:token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  cancel(@Param('token') token: string, @Body() body: unknown): Promise<CafeRegistrationView> {
    return this.registrations.cancel(token, body);
  }

  @Get('registrations/:token/ics')
  async ics(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const file = await this.registrations.ics(token);
    res
      .status(200)
      .set({
        'Content-Type': 'text/calendar; charset=utf-8; method=PUBLISH',
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      })
      .send(file.body);
  }
}
