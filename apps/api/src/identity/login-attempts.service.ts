// AUTH-032, SEC-070 — password sign-in protection: `security.login.maxAttempts` (5) consecutive failures on an address
// lock it `security.login.lockMinutes` (15) — the same for an unknown address (memory counter, no account to hold it);
// 20 attempts per IP and 10 minutes; a RECOGNISED device of the account is exempt from the lock, within its own bound:
// ten consecutive failures from it withdraw its recognition (its `deviceKey` is cleared on the account's past sessions).
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@dp/contracts';
import type { Request } from 'express';
import { writeAudit } from '../admin/audit.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp, RateLimiter } from '../platform/rate-limit.js';
import { SettingsService } from '../platform/settings.service.js';

export const LOGIN_IP_RULE = { limit: 20, windowSeconds: 600 };
export const DEVICE_MAX_FAILURES = 10;

interface Counter {
  n: number;
  lockedUntil: number;
}

@Injectable()
export class LoginAttemptsService {
  /** Unknown addresses and recognised devices: counters that need not survive a restart (AUTH-032). */
  private readonly memory = new Map<string, Counter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
  ) {}

  /** SEC-070 — 20 attempts per IP and 10 minutes, counted before anything else. */
  countIp(req: Request): void {
    const wait = this.limiter.hit(`login:ip:${this.ip.hash(req)}`, LOGIN_IP_RULE);
    if (wait) throw AppError.rateLimited(wait);
  }

  private async rules(): Promise<{ max: number; lockMs: number }> {
    return { max: await this.settings.get('security.login.maxAttempts'), lockMs: (await this.settings.get('security.login.lockMinutes')) * 60_000 };
  }

  private lockedError(untilMs: number): AppError {
    const minutes = Math.max(1, Math.ceil((untilMs - this.clock.now().getTime()) / 60_000));
    return new AppError(ErrorCode.ACCOUNT_LOCKED, { params: { minutes, n: minutes }, headers: { 'Retry-After': String(minutes * 60) } });
  }

  /** The lock in force, as the error to throw (423), or null. A recognised device is not subject to it. */
  async lockFor(user: { id: string; lockedUntil: Date | null } | null, email: string, recognisedDevice: boolean): Promise<AppError | null> {
    const now = this.clock.now().getTime();
    if (user) {
      if (!recognisedDevice && user.lockedUntil && user.lockedUntil.getTime() > now) return this.lockedError(user.lockedUntil.getTime());
      return null;
    }
    const c = this.memory.get(`addr:${this.ip.keyHash(email)}`);
    if (c && c.lockedUntil > now) return this.lockedError(c.lockedUntil);
    return null;
  }

  /**
   * One failure. Returns the error to answer: 423 when this failure locks the address, else 401 INVALID_CREDENTIALS.
   * `deviceKey` set and recognised: the failure counts on the device, not on the account.
   */
  async fail(user: { id: string } | null, email: string, device: { key: string | null; recognised: boolean }): Promise<AppError> {
    const { max, lockMs } = await this.rules();
    const now = this.clock.now();
    if (!user) {
      const key = `addr:${this.ip.keyHash(email)}`;
      const c = this.memory.get(key) ?? { n: 0, lockedUntil: 0 };
      c.n += 1;
      if (c.n >= max) {
        c.n = 0;
        c.lockedUntil = now.getTime() + lockMs;
        this.memory.set(key, c);
        return this.lockedError(c.lockedUntil);
      }
      this.memory.set(key, c);
      return new AppError(ErrorCode.INVALID_CREDENTIALS);
    }
    if (device.recognised && device.key) {
      const key = `dev:${user.id}:${device.key}`;
      const c = this.memory.get(key) ?? { n: 0, lockedUntil: 0 };
      c.n += 1;
      this.memory.set(key, c);
      if (c.n >= DEVICE_MAX_FAILURES) {
        this.memory.delete(key);
        // The device becomes an ordinary one: its fingerprint leaves the account's past sessions.
        await this.prisma.session.updateMany({ where: { userId: user.id, deviceKey: device.key }, data: { deviceKey: null, updatedAt: now } });
      }
      await this.prisma.$transaction((tx) => writeAudit(tx, { type: 'ANONYMOUS', userId: null, role: null, reason: null }, now, { action: 'auth.login_failed', entityType: 'User', entityId: user.id }));
      return new AppError(ErrorCode.INVALID_CREDENTIALS);
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: { increment: 1 }, updatedAt: now }, select: { failedLoginCount: true } });
      await writeAudit(tx, { type: 'ANONYMOUS', userId: null, role: null, reason: null }, now, { action: 'auth.login_failed', entityType: 'User', entityId: user.id });
      if (row.failedLoginCount >= max) {
        const until = new Date(now.getTime() + lockMs);
        await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: until, updatedAt: now } });
        await writeAudit(tx, { type: 'SYSTEM', userId: null, role: null, reason: null }, now, { action: 'auth.locked', entityType: 'User', entityId: user.id });
        return this.lockedError(until.getTime());
      }
      return new AppError(ErrorCode.INVALID_CREDENTIALS);
    });
  }

  /** AUTH-050 — five wrong codes: the account is locked at once, like after five wrong passwords. */
  async lockNow(userId: string): Promise<AppError> {
    const { lockMs } = await this.rules();
    const now = this.clock.now();
    const until = new Date(now.getTime() + lockMs);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: until, updatedAt: now } });
      await writeAudit(tx, { type: 'SYSTEM', userId: null, role: null, reason: null }, now, { action: 'auth.locked', entityType: 'User', entityId: userId });
    });
    return this.lockedError(until.getTime());
  }

  /** A success, a reset or a sign-in by link: counters back to zero. */
  async succeed(userId: string, email: string, deviceKey: string | null): Promise<void> {
    this.memory.delete(`addr:${this.ip.keyHash(email)}`);
    if (deviceKey) this.memory.delete(`dev:${userId}:${deviceKey}`);
    await this.prisma.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: null } });
  }
}
