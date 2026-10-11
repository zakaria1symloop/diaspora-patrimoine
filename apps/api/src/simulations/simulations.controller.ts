// API-100 « Simulateurs » — EP-11 and EP-12 routes (SIM-032 sequencing). The express calculation stays in
// quick.controller.ts. Added for the screens: `GET options` (bounds, currencies, products), `GET property/{référence}`
// (SIM-030 reminder) and `GET estimated-budget` (CAT-035 value for `GET /public/search-options`).
import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { OptionalClientSession } from '../identity/access.js';
import type { CreditResponse, EligibilityResponse, EstimatedBudget, SimulationCreatedResponse, SimulatorOptions, SimulatorProperty } from '@dp/contracts';
import type { Request, Response } from 'express';
import { SimulationsService } from './simulations.service.js';

@Controller('public/simulations')
export class SimulationsController {
  constructor(private readonly sims: SimulationsService) {}

  @Get('options')
  @Header('Cache-Control', 'public, max-age=60')
  options(): Promise<SimulatorOptions> {
    return this.sims.options();
  }

  @Get('property/:reference')
  @Header('Cache-Control', 'public, max-age=60')
  property(@Param('reference') reference: string): Promise<SimulatorProperty> {
    return this.sims.property(reference);
  }

  @Get('estimated-budget')
  @UseGuards(OptionalClientSession)
  @Header('Cache-Control', 'private, no-store')
  estimatedBudget(@Req() req: Request, @Query() query: Record<string, string>): Promise<EstimatedBudget> {
    return this.sims.estimatedBudget(req, query);
  }

  /** SIM-015 — computes and writes (anonymous, `dp_anon`); 201 with the id. */
  @Post('eligibility')
  @UseGuards(OptionalClientSession)
  async eligibility(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown): Promise<EligibilityResponse> {
    const r = await this.sims.eligibility(req, res, body);
    res.status(r.status);
    return r.body;
  }

  /** CAL-112 — computes without writing. */
  @Post('credit')
  @HttpCode(200)
  credit(@Req() req: Request, @Body() body: unknown): Promise<CreditResponse> {
    return this.sims.credit(req, body);
  }

  /** SIM-032 — « Télécharger (PDF) »: nothing written. */
  @Post('pdf')
  async pdf(@Req() req: Request, @Res() res: Response, @Body() body: unknown): Promise<void> {
    const file = await this.sims.pdf(req, body);
    res
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
      .setHeader('Cache-Control', 'no-store')
      .send(file.content);
  }

  /** SIM-032 — writes a credit simulation (scenarios included); Idempotency-Key required. */
  @Post()
  @UseGuards(OptionalClientSession)
  async save(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown): Promise<SimulationCreatedResponse> {
    const r = await this.sims.saveCredit(req, res, body);
    res.status(r.status);
    return r.body;
  }

  @Post(':id/save')
  @UseGuards(OptionalClientSession)
  @HttpCode(200)
  markSaved(@Req() req: Request, @Param('id') id: string): Promise<SimulationCreatedResponse> {
    return this.sims.markSaved(req, id);
  }

  @Post(':id/email')
  @UseGuards(OptionalClientSession)
  @HttpCode(204)
  async email(@Req() req: Request, @Param('id') id: string, @Body() body: unknown): Promise<void> {
    await this.sims.email(req, id, body);
  }
}
