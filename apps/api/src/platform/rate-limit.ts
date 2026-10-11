// SEC-070 — rate limits. Memory store for a single local instance; the Redis store replaces it
// with the same interface once Redis is part of the environment (ARC-075).
import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import { Inject } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { Clock } from './clock.js';

export interface RateRule {
  /** Max events in the window. */
  limit: number;
  windowSeconds: number;
  /** Optional lock after the limit is hit (e.g. gate: 15 minutes). */
  lockSeconds?: number;
}

@Injectable()
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly locks = new Map<string, number>();

  constructor(private readonly clock: Clock) {}

  /** Seconds to wait if blocked, else 0. Does not record anything. */
  blockedFor(key: string): number {
    const until = this.locks.get(key);
    const now = this.clock.now().getTime();
    if (until && until > now) return Math.ceil((until - now) / 1000);
    return 0;
  }

  /** Records one event; returns seconds to wait when the rule is exceeded, else 0. */
  hit(key: string, rule: RateRule): number {
    const now = this.clock.now().getTime();
    const locked = this.blockedFor(key);
    if (locked) return locked;
    const windowStart = now - rule.windowSeconds * 1000;
    const list = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    list.push(now);
    this.hits.set(key, list);
    if (list.length > rule.limit) {
      if (rule.lockSeconds) {
        this.locks.set(key, now + rule.lockSeconds * 1000);
        this.hits.delete(key);
        return rule.lockSeconds;
      }
      return Math.max(1, Math.ceil((list[0]! + rule.windowSeconds * 1000 - now) / 1000));
    }
    return 0;
  }

  /** Seconds before one more event fits in the rule (0: it fits now). Does not record anything. */
  retryAfter(key: string, rule: RateRule): number {
    const now = this.clock.now().getTime();
    const list = (this.hits.get(key) ?? []).filter((t) => t > now - rule.windowSeconds * 1000);
    if (list.length < rule.limit) return 0;
    const oldestThatMustLeave = list[list.length - rule.limit]!;
    return Math.max(1, Math.ceil((oldestThatMustLeave + rule.windowSeconds * 1000 - now) / 1000));
  }

  /** Records one event without checking (to count only accepted actions, DEM-032). */
  record(key: string, rule: RateRule): void {
    const now = this.clock.now().getTime();
    const list = (this.hits.get(key) ?? []).filter((t) => t > now - rule.windowSeconds * 1000);
    list.push(now);
    this.hits.set(key, list);
  }

  /** Counts without recording: true when the next event would exceed the rule. */
  wouldExceed(key: string, rule: RateRule): boolean {
    const now = this.clock.now().getTime();
    const list = (this.hits.get(key) ?? []).filter((t) => t > now - rule.windowSeconds * 1000);
    return list.length >= rule.limit;
  }
}

/** SEC-028 — client IP: forwarded header trusted only from configured proxies. Hashed before any use as a key. */
@Injectable()
export class ClientIp {
  private readonly trusted: Set<string>;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.trusted = new Set((env.TRUSTED_PROXIES ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  }

  of(req: Request): string {
    const remote = req.socket.remoteAddress ?? 'unknown';
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && this.trusted.has(remote)) {
      const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
      if (first) return first;
    }
    return remote;
  }

  /** IP_HASH_KEY fingerprint — never store or log a raw address. */
  hash(req: Request): string {
    return createHmac('sha256', this.env.IP_HASH_KEY).update(this.of(req)).digest('hex').slice(0, 32);
  }

  /** Full 64-hex fingerprint, for the `ipHash Char(64)` columns (Lead, Consent) and the idempotency scope (API-040). */
  fingerprint(req: Request): string {
    return createHmac('sha256', this.env.IP_HASH_KEY).update(this.of(req)).digest('hex');
  }

  /** Keyed hash of any identifier used as a memory key (an e-mail address for DEM-032): no raw value kept. */
  keyHash(value: string): string {
    return createHmac('sha256', this.env.IP_HASH_KEY).update(value).digest('hex').slice(0, 32);
  }
}
