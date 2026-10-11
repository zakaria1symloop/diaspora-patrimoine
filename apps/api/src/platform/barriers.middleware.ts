// ARC-013 — two barriers before the route guards, for /public, /auth (client audience) and /client:
// the gate when closed (403 GATE_CLOSED, NAV-064) and maintenance (503 MAINTENANCE, NAV-061).
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import { Cookies, ErrorCode } from '@dp/contracts';
import type { NextFunction, Request, Response } from 'express';
import { ENV, type Env } from '../config/env.js';
import { Clock } from './clock.js';
import { AppError } from './errors.js';
import { verifyGate } from './gate.js';
import { SettingsService } from './settings.service.js';

const API = '/api/v1';

function family(path: string): 'public' | 'auth' | 'client' | 'other' {
  if (path.startsWith(`${API}/public`)) return 'public';
  if (path.startsWith(`${API}/auth`)) return 'auth';
  if (path.startsWith(`${API}/client`)) return 'client';
  return 'other';
}

// Q-051 (to record): public settings are readable behind the gate — the waiting page shows contact.email (D-045).
const GATE_EXEMPT = [
  /^\/api\/v1\/public\/gate$/,
  /^\/api\/v1\/public\/settings\/public$/,
  /^\/api\/v1\/public\/shares\//,
  /^\/api\/v1\/public\/health/,
];
const MAINTENANCE_EXEMPT = [
  /^\/api\/v1\/public\/health/,
  /^\/api\/v1\/public\/shares\//,
  /^\/api\/v1\/public\/preferences\//,
  /^\/api\/v1\/public\/unsubscribe\//,
  /^\/api\/v1\/public\/settings\/public$/,
];

@Injectable()
export class BarriersMiddleware implements NestMiddleware {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const path = req.path.startsWith(API) ? req.path : req.originalUrl.split('?')[0]!;
    const fam = family(path);
    if (fam === 'other') return next();
    if (fam === 'auth' && this.isAdminAudience(req)) return next();

    const password = this.env.SITE_GATE_PASSWORD;
    if (password && !GATE_EXEMPT.some((r) => r.test(path))) {
      const cookie = (req.cookies as Record<string, string> | undefined)?.[Cookies.gate];
      if (!verifyGate(password, cookie, this.clock.now().getTime())) {
        return next(new AppError(ErrorCode.GATE_CLOSED));
      }
    }

    const unsubscribeAlert = req.method === 'DELETE' && /^\/api\/v1\/public\/alerts\/[^/]+$/.test(path);
    if (!MAINTENANCE_EXEMPT.some((r) => r.test(path)) && !unsubscribeAlert) {
      if (await this.settings.get('maintenance.enabled')) {
        return next(new AppError(ErrorCode.MAINTENANCE, { headers: { 'Retry-After': '600' } }));
      }
    }
    next();
  }

  private isAdminAudience(req: Request): boolean {
    const origin = req.headers.origin ?? req.headers.referer;
    return Boolean(this.env.ADMIN_URL && origin?.startsWith(this.env.ADMIN_URL));
  }
}
