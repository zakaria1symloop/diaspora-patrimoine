// AUT-045 `R_VERIFICATION_REMINDER` — 24 hours after `client.account_created`, if the address is still not verified:
// C_EMAIL_VERIFICATION again, with a new link, once (key `C_EMAIL_VERIFICATION:R_VERIFICATION_REMINDER:{userId}`).
// The RULE decides (automation engine: trigger, delay, condition read again, key); identity only knows how the e-mail
// leaves — with a token minted at sending time (NOT-010) — and declares it to the engine as the sender of the template.
// The key is the one the in-process stand-in used before the engine (AUT-084): nothing is sent twice.
// AUT-091 (identity lines of `purge`) — single-use tokens 7 days after their expiry or use; sessions 30 days after
// their end, except the last one of each device of an account, kept 13 months (the memory of AUTH-033).
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { RuleMailComposers } from '../automation/rule-mail.js';
import { Scheduler } from '../automation/scheduler.js';
import { Clock } from '../platform/clock.js';
import { PrismaService } from '../platform/prisma.service.js';
import { AuthMailHandler } from './auth-mail.js';
import { LINK_PATHS } from './auth.service.js';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

@Injectable()
export class IdentityJobs implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly mail: AuthMailHandler,
    private readonly scheduler: Scheduler,
    private readonly ruleMails: RuleMailComposers,
  ) {}

  onModuleInit(): void {
    this.scheduler.registerPurge('authTokens', (now) => this.purgeTokens(now));
    this.scheduler.registerPurge('sessions', (now) => this.purgeSessions(now));
    this.ruleMails.send('C_EMAIL_VERIFICATION', ({ ctx, dedupeKey }) => this.verificationReminder(ctx.id('user'), dedupeKey));
  }

  /** The reminder of R_VERIFICATION_REMINDER for one account; returns the outcome of the mailer. */
  async verificationReminder(userId: string | null, dedupeKey: string): Promise<string> {
    const user = userId ? await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, kind: true, status: true, emailVerifiedAt: true } }) : null;
    if (!user || user.kind !== 'CLIENT' || user.status !== 'ACTIVE' || user.emailVerifiedAt) return 'SUPPRESSED';
    return this.mail.send(
      { template: 'C_EMAIL_VERIFICATION', userId: user.id, to: user.email, triggeredBy: 'WORKFLOW', dedupeKey, link: { purpose: 'EMAIL_VERIFICATION', host: 'web', path: LINK_PATHS.verifyClient, payload: { next: null, reminder: true } } },
      dedupeKey,
    );
  }

  /** AUT-091 — single-use tokens, 7 days after their expiry or their use. */
  async purgeTokens(now: Date = this.clock.now()): Promise<number> {
    const tokens = await this.prisma.authToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date(now.getTime() - 7 * DAY) } }, { usedAt: { lt: new Date(now.getTime() - 7 * DAY) } }] },
    });
    return tokens.count;
  }

  /** AUT-091 — sessions, 30 days after their end; the last one of each device is kept 13 months (AUTH-033). */
  async purgeSessions(now: Date = this.clock.now()): Promise<number> {
    const old = new Date(now.getTime() - 30 * DAY);
    const deviceMemory = new Date(now.getTime() - 395 * DAY);
    const sessions = await this.prisma.$executeRawUnsafe(
      `DELETE FROM sessions s
        WHERE (s.revoked_at < $1 OR s.expires_at < $1)
          AND (s.device_key IS NULL OR s.updated_at < $2 OR EXISTS (
                SELECT 1 FROM sessions n WHERE n.user_id = s.user_id AND n.device_key = s.device_key AND n.created_at > s.created_at))`,
      old,
      deviceMemory,
    );
    return sessions;
  }
}
