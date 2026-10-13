// API-100 « Demandes » — public routes of 02-site-public/05: `POST /public/form-token` (DEM-030), `POST /public/leads`
// (DEM-002, DEM-027) and `POST /public/leads/complete` (DEM-013).
import { Body, Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { formTokenRequestSchema, type FormTokenResponse, type LeadCompleteResponse, type LeadSubmitResponse } from '@dp/contracts';
import type { Request, Response } from 'express';
import { ENV, type Env } from '../config/env.js';
import { CurrentAuth, OptionalClientSession } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { parseOrThrow } from '../platform/validation.js';
import { CompleteLeadService } from './complete-lead.service.js';
import { signFormToken } from './form-token.js';
import { SubmitLeadService } from './submit-lead.service.js';

@Controller('public')
export class LeadsController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly clock: Clock,
    private readonly submitLead: SubmitLeadService,
    private readonly completeLead: CompleteLeadService,
  ) {}

  /** DEM-030 — signed token dating the opening of a form, 24 hours. */
  @Post('form-token')
  @HttpCode(200)
  formToken(@Body() body: unknown): FormTokenResponse {
    const { form } = parseOrThrow(formTokenRequestSchema, body);
    const { token, expiresAt } = signFormToken(this.env.LINK_SIGNING_KEY, form, this.clock.now());
    return { token, expiresAt: expiresAt.toISOString() };
  }

  /** DEM-027 — always 201 with the same shape for an anonymous visitor. DEM-022 — a signed-in client sends from his account. */
  @Post('leads')
  @UseGuards(OptionalClientSession)
  async create(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown, @CurrentAuth() auth: AuthContext | null): Promise<LeadSubmitResponse> {
    const result = await this.submitLead.submit(req, body, auth?.kind === 'CLIENT' ? auth.clientId : null);
    res.status(result.status);
    return result.body;
  }

  @Post('leads/complete')
  @HttpCode(200)
  complete(@Req() req: Request, @Body() body: unknown): Promise<LeadCompleteResponse> {
    return this.completeLead.complete(req, body);
  }
}
