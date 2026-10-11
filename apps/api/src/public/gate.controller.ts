// NAV-064 — POST /public/gate: password → signed cookie dp_gate (HttpOnly, 30 days). No idempotency key.
// SEC-070: 5 wrong passwords per IP in 10 minutes → 15 minutes wait.
import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { Cookies, ErrorCode, gateRequestSchema } from '@dp/contracts';
import type { Request, Response } from 'express';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { GATE_COOKIE_DAYS, passwordMatches, signGate } from '../platform/gate.js';
import { ClientIp, RateLimiter } from '../platform/rate-limit.js';
import { parseOrThrow } from '../platform/validation.js';

const WRONG_RULE = { limit: 4, windowSeconds: 600, lockSeconds: 900 };

@Controller('public/gate')
export class GateController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly clock: Clock,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
  ) {}

  @Post()
  @HttpCode(204)
  open(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    const password = this.env.SITE_GATE_PASSWORD;
    if (!password) return; // Gate open: nothing to do.
    const key = `gate:${this.ip.hash(req)}`;
    const wait = this.limiter.blockedFor(key);
    if (wait) throw AppError.rateLimited(wait);
    const { password: attempt } = parseOrThrow(gateRequestSchema, body);
    if (!passwordMatches(password, attempt)) {
      const locked = this.limiter.hit(key, WRONG_RULE);
      if (locked) throw AppError.rateLimited(locked);
      throw new AppError(ErrorCode.GATE_PASSWORD_INVALID);
    }
    const expires = this.clock.now().getTime() + GATE_COOKIE_DAYS * 86_400_000;
    res.cookie(Cookies.gate, signGate(password, expires), {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.APP_ENV !== 'local',
      path: '/',
      expires: new Date(expires),
    });
  }
}
