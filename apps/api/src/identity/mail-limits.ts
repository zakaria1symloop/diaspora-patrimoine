// SEC-070 — e-mails asked from a public screen (sign-in link, forgotten password, verification resend, confirmation
// code, e-mail set off by a sign-up on a known address): 1 per address and minute, 3 per hour, 5 per day; 10 per IP and
// hour. Counted whether or not the address has an account: the limit says nothing about it (TRV-112).
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../platform/errors.js';
import { ClientIp, RateLimiter, type RateRule } from '../platform/rate-limit.js';

const ADDRESS_RULES: RateRule[] = [
  { limit: 1, windowSeconds: 60 },
  { limit: 3, windowSeconds: 3600 },
  { limit: 5, windowSeconds: 86_400 },
];
const IP_RULE: RateRule = { limit: 10, windowSeconds: 3600 };
/** AUTH-005 — 5 sign-ups per IP and hour. */
export const SIGNUP_IP_RULE: RateRule = { limit: 5, windowSeconds: 3600 };

export type MailAction = 'magic' | 'forgot' | 'verify' | 'code' | 'signup' | 'email-change';

@Injectable()
export class MailLimits {
  constructor(
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
  ) {}

  private keys(req: Request, action: MailAction, email: string) {
    const addr = this.ip.keyHash(`${action}:${email}`);
    return { addr: ADDRESS_RULES.map((r, i) => ({ key: `mail:${action}:a${i}:${addr}`, rule: r })), ip: { key: `mail:${action}:ip:${this.ip.hash(req)}`, rule: IP_RULE } };
  }

  /** Seconds to wait, 0 when one more e-mail fits. Records nothing. */
  wait(req: Request, action: MailAction, email: string): number {
    const k = this.keys(req, action, email);
    return Math.max(...k.addr.map((x) => this.limiter.retryAfter(x.key, x.rule)), this.limiter.retryAfter(k.ip.key, k.ip.rule));
  }

  record(req: Request, action: MailAction, email: string): void {
    const k = this.keys(req, action, email);
    for (const x of k.addr) this.limiter.record(x.key, x.rule);
    this.limiter.record(k.ip.key, k.ip.rule);
  }

  /** 429 with Retry-After when over the limit; otherwise counts this request. */
  take(req: Request, action: MailAction, email: string): void {
    const wait = this.wait(req, action, email);
    if (wait > 0) throw AppError.rateLimited(wait);
    this.record(req, action, email);
  }

  /** The sign-up variant (AUTH-005): over the limit, nothing leaves, and the screen does not change. */
  tryTake(req: Request, action: MailAction, email: string): boolean {
    if (this.wait(req, action, email) > 0) return false;
    this.record(req, action, email);
    return true;
  }
}
