// API-100 `POST /public/simulations/quick` — express calculation of EP-10 (EDI-023, CAL-103): indicative scale only,
// no down-payment, minimum-amount or income control. Nothing is stored, no idempotency key; SEC-070: 60 per IP per minute.
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { quickSimulationRequestSchema, type QuickSimulationResponse } from '@dp/contracts';
import { quickSimulation } from '@dp/domain';
import { Decimal } from 'decimal.js';
import type { Request } from 'express';
import { AppError } from '../platform/errors.js';
import { ClientIp, RateLimiter, type RateRule } from '../platform/rate-limit.js';
import { SettingsService } from '../platform/settings.service.js';
import { parseOrThrow } from '../platform/validation.js';

export const QUICK_RULE: RateRule = { limit: 60, windowSeconds: 60 };

/** API-002 — decimal strings with two decimals. */
const amount = (v: string) => new Decimal(v).toFixed(2);

@Controller('public/simulations')
export class QuickSimulationController {
  constructor(
    private readonly settings: SettingsService,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
  ) {}

  @Post('quick')
  @HttpCode(200)
  async quick(@Body() body: unknown, @Req() req: Request): Promise<QuickSimulationResponse> {
    const wait = this.limiter.hit(`simulation.quick:${this.ip.hash(req)}`, QUICK_RULE);
    if (wait) throw AppError.rateLimited(wait);
    const input = parseOrThrow(quickSimulationRequestSchema, body ?? {});
    const [scale, currency] = await Promise.all([this.settings.get('finance.indicative'), this.settings.get('display.referenceCurrency')]);
    const r = quickSimulation({ downPayment: String(input.downPayment), monthlyPayment: String(input.monthlyPayment) }, scale, currency);
    return {
      budget: amount(r.budget),
      financing: amount(r.financing),
      financingComputed: amount(r.financingComputed),
      durationMonths: r.durationMonths,
      annualRateBps: r.annualRateBps,
      currency: r.currency,
    };
  }
}
