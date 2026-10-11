// SEC-040, MOD-105, 01-domaine/02 § 1.5 — single-use tokens: 256 random bits, only the SHA-256 fingerprint stored,
// lifetime per purpose, single use for those that open a session or change a secret; a new token invalidates the
// previous unused ones of the same (account or address, purpose) — except ACCOUNT_ACTIVATION (MOD-105) and
// STAFF_INVITATION, consumed by the last step of the first sign-in (BO-003).
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import type { AuthTokenPurpose } from '../generated/prisma/client.js';
import { Clock } from '../platform/clock.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';
import { hmacHex, randomToken, safeEqual, sha256Hex, sixDigitCode } from './crypto.js';

/** 01-domaine/02 § 1.5 — lifetimes. */
export const TOKEN_TTL_MS: Record<AuthTokenPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 3600_000,
  PASSWORD_RESET: 3600_000,
  MAGIC_LOGIN: 15 * 60_000,
  ACCOUNT_ACTIVATION: 7 * 24 * 3600_000,
  STAFF_INVITATION: 7 * 24 * 3600_000,
  EMAIL_CHANGE: 24 * 3600_000,
  ACTION_CODE: 10 * 60_000,
  CLIENT_PREVIEW: 60_000,
  LOGIN_CHALLENGE: 10 * 60_000,
};

export interface TokenRow {
  id: string;
  purpose: AuthTokenPurpose;
  userId: string | null;
  email: string;
  payload: Record<string, unknown>;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
}

export interface IssueInput {
  purpose: AuthTokenPurpose;
  userId: string | null;
  email: string;
  payload?: Record<string, unknown> | null;
  ipHash?: string | null;
}

type Db = Tx | PrismaService;

@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** MOD-105 — the previous unused tokens of the same purpose die (expire now), except the two exceptions. */
  private async invalidatePrevious(db: Db, input: IssueInput, now: Date): Promise<void> {
    if (input.purpose === 'ACCOUNT_ACTIVATION') return;
    await db.authToken.updateMany({
      where: {
        purpose: input.purpose,
        usedAt: null,
        expiresAt: { gt: now },
        ...(input.userId ? { userId: input.userId } : { email: input.email, userId: null }),
      },
      data: { expiresAt: now, updatedAt: now },
    });
  }

  /** A new link token; returns the token in clear — to be put in the e-mail, then forgotten. */
  async issue(input: IssueInput, db: Db = this.prisma): Promise<{ token: string; id: string; expiresAt: Date }> {
    const now = this.clock.now();
    await this.invalidatePrevious(db, input, now);
    const token = randomToken();
    const id = newId();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS[input.purpose]);
    await db.authToken.create({
      data: {
        id,
        purpose: input.purpose,
        userId: input.userId,
        email: input.email,
        tokenHash: sha256Hex(token),
        payload: (input.payload ?? undefined) as never,
        expiresAt,
        ipHash: input.ipHash ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return { token, id, expiresAt };
  }

  /**
   * AUTH-086 — a 6-digit code. Its fingerprint is keyed by the row id (a 6-digit space would collide between accounts
   * on the unique `tokenHash`); it is checked by `checkCode`, never looked up by value.
   */
  async issueCode(input: IssueInput, db: Db = this.prisma): Promise<{ code: string; id: string; expiresAt: Date }> {
    const now = this.clock.now();
    await this.invalidatePrevious(db, input, now);
    const code = sixDigitCode();
    const id = newId();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS[input.purpose]);
    await db.authToken.create({
      data: {
        id,
        purpose: input.purpose,
        userId: input.userId,
        email: input.email,
        tokenHash: this.codeHash(id, code),
        payload: (input.payload ?? undefined) as never,
        expiresAt,
        ipHash: input.ipHash ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return { code, id, expiresAt };
  }

  codeHash(id: string, code: string): string {
    return hmacHex(this.env.LINK_SIGNING_KEY, `dp_code:${id}:${code}`);
  }

  codeMatches(row: { id: string; tokenHash: string }, code: string): boolean {
    return safeEqual(row.tokenHash, this.codeHash(row.id, code));
  }

  /** The row of a token, whatever its state (null when unknown). The caller decides what an expired or used one means. */
  async find(token: string | undefined, purpose: AuthTokenPurpose | AuthTokenPurpose[], db: Db = this.prisma): Promise<TokenRow | null> {
    if (!token || !/^[A-Za-z0-9_-]{20,200}$/.test(token)) return null;
    const row = await db.authToken.findUnique({ where: { tokenHash: sha256Hex(token) } });
    const purposes = Array.isArray(purpose) ? purpose : [purpose];
    if (!row || !purposes.includes(row.purpose)) return null;
    return { ...row, payload: (row.payload as Record<string, unknown> | null) ?? {} };
  }

  isAlive(row: TokenRow): boolean {
    return row.usedAt === null && row.expiresAt.getTime() > this.clock.now().getTime() && row.attempts < 5;
  }

  /** Marks the token used — atomically: of two concurrent uses, one only succeeds. */
  async consume(row: { id: string }, db: Db = this.prisma): Promise<boolean> {
    const now = this.clock.now();
    const done = await db.authToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now, updatedAt: now } });
    return done.count === 1;
  }

  /** Kills every unused token of an account for these purposes (password changed, account deleted, activation done…). */
  async killAll(userId: string, purposes: AuthTokenPurpose[], db: Db = this.prisma): Promise<void> {
    const now = this.clock.now();
    await db.authToken.updateMany({ where: { userId, purpose: { in: purposes }, usedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now, updatedAt: now } });
  }

  /** AUTH-050, AUTH-086 — one more wrong code; returns the attempts now counted. */
  async addAttempt(id: string, db: Db = this.prisma): Promise<number> {
    const row = await db.authToken.update({ where: { id }, data: { attempts: { increment: 1 }, updatedAt: this.clock.now() }, select: { attempts: true } });
    return row.attempts;
  }
}
