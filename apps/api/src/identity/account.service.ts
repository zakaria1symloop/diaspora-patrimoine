// AUTH-080, AUTH-081, AUTH-085, AUTH-086, PRO-020, PRO-021, BO-070 — what a signed-in person does with his own account:
// who am I, open sessions, second factor, address and password changes, each sensitive action proven again.
import { Inject, Injectable } from '@nestjs/common';
import {
  changeEmailRequestSchema,
  changePasswordRequestSchema,
  ErrorCode,
  permissionsOf,
  recoveryCodesRequestSchema,
  staffTwoFactorReconfigureRequestSchema,
  tokenRequestSchema,
  twoFactorConfirmRequestSchema,
  twoFactorDisableRequestSchema,
  twoFactorEnableRequestSchema,
  twoFactorSetupRequestSchema,
  type ClientMe,
  type EmailChangeConfirmResponse,
  type RecoveryCodesResponse,
  type SensitiveAction,
  type SentResponse,
  type SessionItem,
  type StaffRole,
  type TwoFactorSetupResponse,
} from '@dp/contracts';
import type { Request, Response } from 'express';
import { writeAudit } from '../admin/audit.js';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { z } from 'zod';

const mergeFavoritesSchema = z.strictObject({
  items: z.array(z.strictObject({ ref: z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/), at: z.number().int().positive() })).max(20),
});
import { AuthMailRequester } from './auth-mail.js';
import { AuthService, LINK_PATHS } from './auth.service.js';
import { audienceOf, tokenPageHeaders } from './http.js';
import { MailLimits } from './mail-limits.js';
import { hashPassword, passwordProblem } from './password.js';
import { SessionsService, type AuthContext } from './sessions.service.js';
import { TokensService } from './tokens.service.js';
import { TwoFactorService } from './two-factor.service.js';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokensService,
    private readonly twoFactor: TwoFactorService,
    private readonly auth: AuthService,
    private readonly mail: AuthMailRequester,
    private readonly limits: MailLimits,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ─── Who am I ─────────────────────────────────────────────────────────────

  /** NAV-013 — `GET /client/me`. `unreadNotifications` and `hasDossier` feed the header. */
  async clientMe(ctx: AuthContext): Promise<ClientMe> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { id: true, email: true, pendingEmail: true, passwordHash: true, twoFactorEnabled: true, phone: true } });
    const client = ctx.clientId
      ? await this.prisma.client.findUnique({ where: { id: ctx.clientId }, select: { id: true, firstName: true, lastName: true, phone: true, countryOfResidence: true } })
      : null;
    const [unread, dossiers] = await Promise.all([
      this.prisma.notification.count({ where: { userId: ctx.userId, readAt: null } }).catch(() => 0),
      client ? this.prisma.dossier.count({ where: { clientId: client.id, deletedAt: null } }) : Promise.resolve(0),
    ]);
    return {
      id: user.id,
      clientId: client?.id ?? '',
      firstName: client?.firstName ?? ctx.firstName,
      lastName: client?.lastName ?? ctx.lastName,
      email: user.email,
      phone: client?.phone ?? user.phone,
      countryOfResidence: client?.countryOfResidence ?? null,
      unreadNotifications: unread,
      hasDossier: dossiers > 0,
      hasPassword: Boolean(user.passwordHash),
      twoFactorEnabled: user.twoFactorEnabled,
      pendingEmail: user.pendingEmail,
    };
  }

  /** `GET /admin/me` — the staff member, his effective role and its permissions (ROL-023 menu). */
  async staffMe(ctx: AuthContext) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { id: true, email: true, firstName: true, lastName: true, jobTitle: true, twoFactorEnabled: true, charterAcceptedAt: true } });
    const all = (await this.settings.all()) as unknown as Record<string, unknown>;
    return { ...user, role: ctx.role, permissions: permissionsOf(ctx.role as StaffRole, (k) => all[k] === true) };
  }

  // ─── Anonymous favourites brought over (SFA-021) ──────────────────────────

  /**
   * SFA-021 — `POST /client/favorites/merge`: the favourites kept in the browser (`dp_favorites`, twenty at most:
   * reference and date added) join the account, without duplicates; unknown or deleted references are ignored.
   * Called by the site right after a sign-in or a sign-up. Returns how many were added.
   */
  async mergeFavorites(ctx: AuthContext, body: unknown): Promise<{ merged: number }> {
    if (!ctx.clientId) return { merged: 0 };
    const items = parseOrThrow(mergeFavoritesSchema, body).items;
    if (!items.length) return { merged: 0 };
    const props = await this.prisma.property.findMany({ where: { reference: { in: items.map((i) => i.ref) }, deletedAt: null }, select: { id: true, reference: true } });
    const idOf = new Map(props.map((p) => [p.reference, p.id]));
    const now = this.clock.now();
    const rows = items
      .filter((i) => idOf.has(i.ref))
      .map((i) => ({ clientId: ctx.clientId!, propertyId: idOf.get(i.ref)!, createdAt: new Date(Math.min(i.at, now.getTime())), updatedAt: now }));
    const done = await this.prisma.favorite.createMany({ data: rows, skipDuplicates: true });
    return { merged: done.count };
  }

  // ─── Proof of a sensitive action (AUTH-086) ───────────────────────────────

  /** The proof travels in the request: `password` when the account has one, `actionCode` otherwise. No trust window. */
  async prove(req: Request, ctx: AuthContext, proof: { password?: string; actionCode?: string }, action: SensitiveAction): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { id: true, passwordHash: true } });
    if (user.passwordHash) {
      if (!proof.password) throw AppError.validation([{ field: 'password', code: 'REQUIRED' }]);
      await this.auth.checkPassword(req, user.id, proof.password, ctx.audience);
      return;
    }
    if (!proof.actionCode) throw AppError.validation([{ field: 'actionCode', code: 'REQUIRED' }]);
    const now = this.clock.now();
    const row = await this.prisma.authToken.findFirst({
      where: { userId: user.id, purpose: 'ACTION_CODE', usedAt: null, expiresAt: { gt: now }, attempts: { lt: 5 } },
      orderBy: { createdAt: 'desc' },
    });
    const payload = (row?.payload as { action?: string } | null) ?? {};
    if (!row || payload.action !== action) throw new AppError(ErrorCode.GONE);
    if (!this.tokens.codeMatches(row, proof.actionCode)) {
      const attempts = await this.tokens.addAttempt(row.id);
      if (attempts >= 5) throw new AppError(ErrorCode.GONE);
      throw new AppError(ErrorCode.INVALID_CODE, { params: { remaining: 5 - attempts, n: 5 - attempts } });
    }
    if (!(await this.tokens.consume(row))) throw new AppError(ErrorCode.GONE);
  }

  // ─── Sessions (AUTH-085, PRO-021, BO-070) ─────────────────────────────────

  async listSessions(ctx: AuthContext): Promise<{ data: SessionItem[] }> {
    const now = this.clock.now();
    const rows = await this.prisma.session.findMany({
      where: { userId: ctx.userId, revokedAt: null, expiresAt: { gt: now }, impersonatedById: null },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, deviceLabel: true, lastUsedAt: true, createdAt: true },
    });
    return { data: rows.map((r) => ({ id: r.id, deviceLabel: r.deviceLabel, lastUsedAt: r.lastUsedAt.toISOString(), createdAt: r.createdAt.toISOString(), current: r.id === ctx.sessionId })) };
  }

  /** « Me déconnecter de tous les autres appareils » — keeps the current session. */
  async revokeOtherSessions(ctx: AuthContext): Promise<void> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const n = await this.sessions.revokeAll(ctx.userId, 'LOGOUT', ctx.sessionId, tx);
      if (n) await writeAudit(tx, ctx.actor, now, { action: 'auth.session_revoked', entityType: 'User', entityId: ctx.userId, after: { count: n } });
    });
  }

  async revokeSession(ctx: AuthContext, id: string): Promise<void> {
    if (id === ctx.sessionId) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    const s = await this.prisma.session.findFirst({ where: { id, userId: ctx.userId, impersonatedById: null }, select: { id: true } });
    if (!s) throw AppError.notFound(); // ROL-030
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await this.sessions.revoke(id, 'LOGOUT', tx);
      await writeAudit(tx, ctx.actor, now, { action: 'auth.session_revoked', entityType: 'User', entityId: ctx.userId, after: { count: 1 } });
    });
  }

  // ─── Second factor (PRO-020 client; BO-070 staff) ─────────────────────────

  async twoFactorSetup(req: Request, ctx: AuthContext, body: unknown): Promise<TwoFactorSetupResponse> {
    if (ctx.kind === 'STAFF') {
      // BO-070 — reconfiguration: the password and a current code.
      const input = parseOrThrow(staffTwoFactorReconfigureRequestSchema, body);
      await this.auth.checkPassword(req, ctx.userId, input.password, ctx.audience);
      if (!(await this.twoFactor.verifyCode(ctx.userId, input.code))) throw new AppError(ErrorCode.INVALID_CODE, { params: { remaining: null } });
      return this.twoFactor.setup(ctx.userId);
    }
    const input = parseOrThrow(twoFactorSetupRequestSchema, body);
    await this.prove(req, ctx, input, 'TWO_FACTOR');
    return this.twoFactor.setup(ctx.userId);
  }

  async twoFactorConfirm(ctx: AuthContext, body: unknown): Promise<RecoveryCodesResponse> {
    const { code } = parseOrThrow(twoFactorConfirmRequestSchema, body);
    return this.twoFactor.confirm(ctx.userId, code);
  }

  async twoFactorEnable(ctx: AuthContext, body: unknown): Promise<void> {
    parseOrThrow(twoFactorEnableRequestSchema, body);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await this.twoFactor.enable(ctx.userId, tx);
      await this.twoFactorChanged(tx, ctx, true, now);
    });
    this.mail.wake();
  }

  async twoFactorDisable(req: Request, ctx: AuthContext, body: unknown): Promise<void> {
    // D-033 — mandatory for staff: no deactivation by oneself (a Direction resets it, ADM-032).
    if (ctx.kind === 'STAFF' && (await this.settings.get('security.staff.twoFactorRequired'))) throw new AppError(ErrorCode.FORBIDDEN);
    const input = parseOrThrow(twoFactorDisableRequestSchema, body);
    await this.prove(req, ctx, input, 'TWO_FACTOR');
    if (!(await this.twoFactor.verifyCode(ctx.userId, input.code))) throw new AppError(ErrorCode.INVALID_CODE, { params: { remaining: null } });
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await this.twoFactor.disable(ctx.userId, tx);
      await this.twoFactorChanged(tx, ctx, false, now);
    });
    this.mail.wake();
  }

  async recoveryCodes(req: Request, ctx: AuthContext, body: unknown): Promise<RecoveryCodesResponse> {
    const input = parseOrThrow(recoveryCodesRequestSchema, body);
    if (ctx.kind === 'STAFF') {
      if (!input.password) throw AppError.validation([{ field: 'password', code: 'REQUIRED' }]);
      await this.auth.checkPassword(req, ctx.userId, input.password, ctx.audience);
    } else {
      await this.prove(req, ctx, input, 'TWO_FACTOR');
    }
    return this.twoFactor.regenerate(ctx.userId);
  }

  private async twoFactorChanged(tx: Tx, ctx: AuthContext, enabled: boolean, now: Date): Promise<void> {
    await writeAudit(tx, ctx.actor, now, { action: enabled ? 'auth.two_factor_enabled' : 'auth.two_factor_disabled', entityType: 'User', entityId: ctx.userId });
    await tx.outboxEvent.create({
      data: { id: newId(), type: 'user.two_factor_changed', aggregateType: 'User', aggregateId: ctx.userId, payload: { enabled } as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now },
    });
    await this.mail.request(tx, {
      template: ctx.kind === 'STAFF' ? 'S_TWO_FACTOR_CHANGED' : 'C_TWO_FACTOR_CHANGED',
      userId: ctx.userId,
      to: ctx.email,
      vars: { action: { stateLabel: enabled ? 'activée' : 'désactivée', adminUrl: `${this.env.ADMIN_URL ?? this.env.WEB_URL}/preferences/securite` } },
    });
  }

  // ─── Password (AUTH-081) ──────────────────────────────────────────────────

  async changePassword(req: Request, ctx: AuthContext, body: unknown): Promise<void> {
    const input = parseOrThrow(changePasswordRequestSchema, body);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { id: true, email: true, kind: true, passwordHash: true, firstName: true, lastName: true } });
    if (user.passwordHash) {
      if (!input.currentPassword) throw AppError.validation([{ field: 'currentPassword', code: 'REQUIRED' }]);
      await this.auth.checkPassword(req, user.id, input.currentPassword, ctx.audience);
    } else {
      // A space activated by a link chooses one without the old one, after the code of AUTH-086.
      await this.prove(req, ctx, { actionCode: input.actionCode }, 'PASSWORD_SET');
    }
    const problem = passwordProblem(input.newPassword, { minLength: await this.settings.get('security.password.minLength'), email: user.email, firstName: user.firstName, lastName: user.lastName }, 'newPassword');
    if (problem) throw AppError.validation([problem]);
    const passwordHash = await hashPassword(input.newPassword);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: now, updatedAt: now } });
      // The OTHER sessions close (SEC-024).
      await this.sessions.revokeAll(user.id, 'PASSWORD_CHANGED', ctx.sessionId, tx);
      await tx.session.update({ where: { id: ctx.sessionId }, data: { passwordConfirmedAt: now } });
      await this.auth.passwordChanged(tx, user, now);
    });
    this.mail.wake();
  }

  // ─── Address (AUTH-080) ───────────────────────────────────────────────────

  async changeEmail(req: Request, ctx: AuthContext, body: unknown): Promise<SentResponse & { email: string }> {
    const input = parseOrThrow(changeEmailRequestSchema, body);
    await this.prove(req, ctx, input, 'EMAIL_CHANGE');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { id: true, email: true, kind: true } });
    if (input.email === user.email) throw AppError.validation([{ field: 'email', code: 'ALREADY_USED' }]);
    this.limits.take(req, 'email-change', input.email);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const other = await tx.user.findUnique({ where: { email: input.email }, select: { id: true, status: true } });
      if (other && other.status !== 'DELETED') {
        // Another account holds it: nothing changes; the e-mail sent to that address says so (C_ACCOUNT_EXISTS).
        await this.mail.request(tx, { template: 'C_ACCOUNT_EXISTS', userId: other.id, to: input.email });
        return;
      }
      await tx.user.update({ where: { id: user.id }, data: { pendingEmail: input.email, updatedAt: now } });
      await this.mail.request(tx, {
        template: user.kind === 'STAFF' ? 'S_EMAIL_CHANGE_CONFIRM' : 'C_EMAIL_CHANGE_CONFIRM',
        userId: user.id,
        to: input.email,
        link: { purpose: 'EMAIL_CHANGE', host: user.kind === 'STAFF' ? 'admin' : 'web', path: LINK_PATHS.emailChange, payload: { newEmail: input.email } },
      });
      await this.mail.request(tx, {
        template: user.kind === 'STAFF' ? 'S_EMAIL_CHANGE_NOTICE' : 'C_EMAIL_CHANGE_NOTICE',
        userId: user.id,
        to: user.email,
        vars: { action: { adminUrl: `${this.env.ADMIN_URL ?? this.env.WEB_URL}/preferences/securite` } },
      });
    });
    this.mail.wake();
    return { status: 'SENT', email: input.email };
  }

  /** `POST /auth/email-change/confirm` — the page does not sign anyone in. */
  async confirmEmailChange(req: Request, res: Response, body: unknown): Promise<EmailChangeConfirmResponse> {
    tokenPageHeaders(res);
    const parsed = tokenRequestSchema.safeParse(body);
    const row = parsed.success ? await this.tokens.find(parsed.data.token, 'EMAIL_CHANGE') : null;
    if (!row?.userId || !this.tokens.isAlive(row)) throw new AppError(ErrorCode.GONE);
    const newEmail = row.payload.newEmail as string | undefined;
    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { id: true, kind: true, email: true, pendingEmail: true, status: true } });
    if (!user || !newEmail || user.status === 'DELETED' || user.pendingEmail !== newEmail) throw new AppError(ErrorCode.GONE);
    let audience: 'WEB' | 'ADMIN' | 'PARTNER' = user.kind === 'STAFF' ? 'ADMIN' : user.kind === 'PARTNER' ? 'PARTNER' : 'WEB';
    try {
      audience = audienceOf(req, this.env) === 'ADMIN' ? 'ADMIN' : audience;
    } catch {
      /* unknown origin: no session to read */
    }
    const ctx = await this.sessions.authenticate(req, audience);
    const signedIn = Boolean(ctx && ctx.userId === user.id);
    const now = this.clock.now();

    const outcome = await this.prisma.$transaction(async (tx) => {
      if (!(await this.tokens.consume(row, tx))) throw new AppError(ErrorCode.GONE);
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `lead:${newEmail}`);
      const taken = await tx.user.findFirst({ where: { email: newEmail, id: { not: user.id } }, select: { id: true } });
      if (taken) {
        await tx.user.update({ where: { id: user.id }, data: { pendingEmail: null, updatedAt: now } });
        return 'IN_USE' as const;
      }
      const ownClient = await tx.client.findFirst({ where: { userId: user.id }, select: { id: true, firstName: true, lastName: true } });
      const otherRecord = await tx.client.findFirst({
        where: { deletedAt: null, userId: null, OR: [{ email: newEmail }, { alternateEmails: { has: newEmail } }], ...(ownClient ? { id: { not: ownClient.id } } : {}) },
        select: { id: true },
      });
      if (otherRecord && ownClient) {
        // The address of another record without account, now proven: the change waits for the merge (CRM-080).
        const dedupeKey = `email-merge:${ownClient.id}:${otherRecord.id}`;
        const exists = await tx.task.findFirst({ where: { dedupeKey, deletedAt: null }, select: { id: true } });
        if (!exists) {
          // Stored data (the task title of AUTH-080), not a screen text produced by the API.
          await tx.task.create({
            data: {
              id: newId(),
              type: 'OTHER',
              origin: 'SYSTEM',
              title: `Fusionner les fiches de ${[ownClient.firstName, ownClient.lastName].filter(Boolean).join(' ') || 'ce client'} : il a confirmé l’adresse d’une autre fiche`.slice(0, 160),
              priority: 'HIGH',
              status: 'OPEN',
              clientId: ownClient.id,
              dedupeKey,
              createdAt: now,
              updatedAt: now,
            },
          });
        }
        return 'MERGE_PENDING' as const;
      }
      await tx.user.update({ where: { id: user.id }, data: { email: newEmail, pendingEmail: null, emailVerifiedAt: now, updatedAt: now } });
      if (ownClient) await tx.client.update({ where: { id: ownClient.id }, data: { email: newEmail, updatedAt: now } });
      // The other sessions close; the one of this browser stays open.
      await this.sessions.revokeAll(user.id, 'PASSWORD_CHANGED', signedIn ? ctx!.sessionId : null, tx);
      await writeAudit(tx, { type: 'USER', userId: user.id, role: null, reason: null }, now, { action: user.kind === 'STAFF' ? 'user.email_changed' : 'auth.email_changed', entityType: 'User', entityId: user.id, clientId: ownClient?.id ?? null, after: { email: 'modifié' } });
      await tx.outboxEvent.create({
        data: { id: newId(), type: 'user.email_changed', aggregateType: 'User', aggregateId: user.id, payload: {} as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now },
      });
      return 'CHANGED' as const;
    });
    if (outcome === 'IN_USE') throw AppError.conflictState('EMAIL_IN_USE');
    return { status: outcome, signedIn };
  }
}
