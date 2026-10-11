// API-100 « Compte (/auth) » — 03-espace-client/01, BO-002…BO-005, ACP-080…ACP-082. The audience of each request comes
// from its origin (API-003); the routes opened by a step token are those of AUTH-026 and only them.
import { Body, Controller, Get, HttpCode, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { isSafeNextPath } from '@dp/contracts';
import type { Request, Response } from 'express';
import { AccountService } from './account.service.js';
import { AuthService } from './auth.service.js';
import { PartnerService } from './partner.service.js';
import { SignupService } from './signup.service.js';
import { StaffSetupService } from './staff-setup.service.js';

const nextOf = (v: unknown) => (isSafeNextPath(v) ? v : null);

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly signups: SignupService,
    private readonly account: AccountService,
    private readonly staffSetup: StaffSetupService,
    private readonly partners: PartnerService,
  ) {}

  // Sign-in
  @Post('login') @HttpCode(200)
  login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.auth.login(req, res, body); }
  @Post('login/two-factor') @HttpCode(200)
  twoFactor(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.auth.loginTwoFactor(req, res, body); }
  @Get('step')
  step(@Req() req: Request) { return this.auth.currentStep(req); }
  @Post('logout') @HttpCode(204)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.logout(req, res); }
  @Post('refresh') @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.auth.refresh(req, res, body); }

  // Sign-up and address (AUTH-001…AUTH-013)
  @Post('signup')
  async signup(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    const r = await this.signups.signup(req, res, body);
    res.status(r.status);
    return r.body;
  }
  @Patch('signup/email') @HttpCode(200)
  signupEmail(@Req() req: Request, @Body() body: unknown) { return this.signups.changeSignupEmail(req, body); }
  @Post('verify-email') @HttpCode(200)
  verify(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.signups.verify(req, res, body); }
  @Post('verify-email/resend') @HttpCode(200)
  resend(@Req() req: Request, @Body() body: unknown) { return this.signups.resend(req, body); }
  @Post('verify-email/disown') @HttpCode(204)
  disown(@Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.signups.disown(res, body); }
  @Post('email-change/confirm') @HttpCode(200)
  emailChange(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.account.confirmEmailChange(req, res, body); }

  // Activation (AUTH-040) — the page aimed at travels in the link's address (`suite`), checked.
  @Post('activate/check') @HttpCode(200)
  activationCheck(@Res({ passthrough: true }) res: Response, @Body() body: unknown, @Query('suite') suite?: string) { return this.signups.checkActivation(res, body, nextOf(suite)); }
  @Post('activate') @HttpCode(200)
  activate(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown, @Query('suite') suite?: string) { return this.signups.activate(req, res, body, nextOf(suite)); }
  @Post('activate/resend') @HttpCode(200)
  activationResend(@Req() req: Request, @Body() body: unknown) { return this.signups.resendActivation(req, body); }

  // Sign-in by link (AUTH-041)
  @Post('magic-link') @HttpCode(200)
  magic(@Req() req: Request, @Body() body: unknown) { return this.auth.requestMagicLink(req, body); }
  @Post('magic-link/consume') @HttpCode(200)
  consume(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.auth.consumeMagicLink(req, res, body); }

  // Forgotten password (AUTH-045)
  @Post('password/forgot') @HttpCode(200)
  forgot(@Req() req: Request, @Body() body: unknown) { return this.auth.forgot(req, body); }
  @Post('password/reset/check') @HttpCode(200)
  resetCheck(@Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.auth.resetCheck(res, body); }
  @Post('password/reset') @HttpCode(200)
  reset(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.auth.reset(req, res, body); }

  // Terms (AUTH-090)
  @Get('legal')
  legal(@Req() req: Request) { return this.auth.legal(req); }
  @Post('legal/accept') @HttpCode(200)
  acceptLegal(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.auth.acceptLegal(req, res, body); }
  @Post('legal/decline') @HttpCode(204)
  declineLegal(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.declineLegal(req, res); }

  // Sensitive actions (AUTH-086, BO-005)
  @Post('action-code') @HttpCode(204)
  actionCode(@Req() req: Request, @Body() body: unknown) { return this.auth.actionCode(req, body); }
  @Post('confirm-password') @HttpCode(204)
  confirmPassword(@Req() req: Request, @Body() body: unknown) { return this.auth.confirmPassword(req, body); }

  // Staff first sign-in (BO-003)
  @Post('staff-setup/start') @HttpCode(200)
  setupStart(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.staffSetup.start(req, res, body); }
  @Get('staff-setup')
  setupState(@Req() req: Request) { return this.staffSetup.state(req); }
  @Post('staff-setup/password') @HttpCode(200)
  setupPassword(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.staffSetup.password(req, res, body); }
  @Post('staff-setup/two-factor') @HttpCode(200)
  setupTwoFactor(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.staffSetup.twoFactorStep(req, res, body); }
  @Post('staff-setup/charter') @HttpCode(200)
  setupCharter(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) { return this.staffSetup.charter(req, res, body); }

  // Partners (ACP-081)
  @Post('partner-signup')
  async partnerSignup(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    const r = await this.partners.signup(req, res, body);
    res.status(r.status);
    return r.body;
  }
}
