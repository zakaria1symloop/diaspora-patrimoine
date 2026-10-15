// SEC-020…SEC-028, AUTH-024, AUTH-033, BO-004 — sessions: two tokens (signed access token of 15 minutes, random refresh
// token of 256 bits whose fingerprint only is stored), rotation with a 10-second grace for two tabs, family revocation
// on reuse, durations per audience, ten sessions at most, device recognition, anti-forgery token, revocation.
import { Inject, Injectable } from '@nestjs/common';
import { CSRF_HEADER, ErrorCode, type BrowserAudience, type SessionResponse } from '@dp/contracts';
import type { Request, Response } from 'express';
import { writeAudit } from '../admin/audit.js';
import type { Actor } from '../admin/actor.js';
import { ENV, type Env } from '../config/env.js';
import type { SessionRevokedReason } from '../generated/prisma/client.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp } from '../platform/rate-limit.js';
import { log } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { ACCESS_TOKEN_MINUTES, signAccessToken, verifyAccessToken } from './access-token.js';
import { AuthMailRequester } from './auth-mail.js';
import { hmacBase64url, randomToken, safeEqual, sha256Hex } from './crypto.js';
import { AuthCookies, deviceLabel } from './http.js';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** SEC-021 — the token just replaced stays recognised 10 seconds (two tabs renewing at the same instant). */
export const ROTATION_GRACE_MS = 10_000;
/** SEC-025 */
export const MAX_SESSIONS = 10;
/** AUTH-033 — the device cookie lives 13 months. */
const DEVICE_COOKIE_MS = 395 * DAY;

export interface SessionUserRow {
  id: string;
  kind: 'CLIENT' | 'STAFF' | 'PARTNER';
  email: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
  lastLoginAt: Date | null;
  locale: string;
}

/** What a guarded route knows about its caller. */
export interface AuthContext {
  userId: string;
  kind: 'CLIENT' | 'STAFF' | 'PARTNER';
  audience: BrowserAudience;
  sessionId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  /** Effective staff role (MOD-104), else null. */
  role: string | null;
  /** The client record of a CLIENT account. */
  clientId: string | null;
  passwordConfirmedAt: Date | null;
  /** SEC-080 — the actor of the back-office use cases. */
  actor: Actor;
  /** ROL-017 — a read-only preview session opened by a member of the team (`Session.impersonatedById`), else null. */
  preview: { byUserId: string; expiresAt: Date } | null;
  /** Internal to the identity module: the anti-forgery token derives from them (SEC-027). */
  refreshTokenHash: string;
  previousRefreshTokenHash: string | null;
  rotatedAt: Date | null;
}

export interface OpenInput {
  user: SessionUserRow;
  audience: BrowserAudience;
  rememberMe: boolean;
  /** The password was typed for this sign-in (BO-005 `passwordConfirmedAt`). */
  viaPassword: boolean;
  redirectTo: string;
}

@Injectable()
export class SessionsService {
  readonly cookies: AuthCookies;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly ip: ClientIp,
    private readonly mail: AuthMailRequester,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.cookies = new AuthCookies(env);
  }

  /** SEC-023 — idle and absolute durations of a session. */
  async durations(audience: BrowserAudience, rememberMe: boolean): Promise<{ idleMs: number; absoluteMs: number }> {
    if (audience === 'ADMIN') return { idleMs: (await this.settings.get('security.staff.idleMinutes')) * 60_000, absoluteMs: 12 * HOUR };
    if (audience === 'WEB' && rememberMe) return { idleMs: 30 * DAY, absoluteMs: 90 * DAY };
    return { idleMs: 12 * HOUR, absoluteMs: 12 * HOUR };
  }

  /** SEC-027 — the anti-forgery token of a session, derived from its current refresh fingerprint: it changes at each renewal. */
  csrfFor(refreshTokenHash: string): string {
    return hmacBase64url(this.env.JWT_SIGNING_KEY, `dp_csrf:${refreshTokenHash}`);
  }

  private deviceKeyOf(req: Request, audience: BrowserAudience): { raw: string; key: string; fresh: boolean } {
    const raw = this.cookies.read(req, audience, 'device');
    if (raw && /^[A-Za-z0-9_-]{43}$/.test(raw)) return { raw, key: sha256Hex(`dp_device:${raw}`), fresh: false };
    const created = randomToken();
    return { raw: created, key: sha256Hex(`dp_device:${created}`), fresh: true };
  }

  /** AUTH-033 — the fingerprint of this browser's device cookie, when there is one. */
  deviceKey(req: Request, audience: BrowserAudience): string | null {
    const raw = this.cookies.read(req, audience, 'device');
    return raw && /^[A-Za-z0-9_-]{43}$/.test(raw) ? sha256Hex(`dp_device:${raw}`) : null;
  }

  /** AUTH-033 — a device is recognised when a past session of the account carries the same fingerprint. */
  async isRecognisedDevice(userId: string, deviceKey: string | null): Promise<boolean> {
    if (!deviceKey) return false;
    const found = await this.prisma.session.findFirst({ where: { userId, deviceKey, impersonatedById: null }, select: { id: true } });
    return Boolean(found);
  }

  /** Opens a session (one transaction), sets the cookies and returns the answer of API-003. */
  async open(req: Request, res: Response, input: OpenInput): Promise<SessionResponse> {
    const now = this.clock.now();
    const { user, audience } = input;
    const { idleMs, absoluteMs } = await this.durations(audience, input.rememberMe);
    const device = this.deviceKeyOf(req, audience);
    const refresh = randomToken();
    const refreshHash = sha256Hex(refresh);
    const sessionId = newId();
    const expiresAt = new Date(now.getTime() + absoluteMs);
    const ua = (req.headers['user-agent'] ?? '').slice(0, 400) || null;
    const role = user.kind === 'STAFF' ? await this.effectiveRole(user.id) : null;

    await this.prisma.$transaction(async (tx) => {
      const recognised = Boolean(await tx.session.findFirst({ where: { userId: user.id, deviceKey: device.key, impersonatedById: null }, select: { id: true } }));
      // SEC-025 — ten open sessions at most: the eleventh closes the oldest (preview sessions do not count).
      const open = await tx.session.findMany({
        where: { userId: user.id, revokedAt: null, expiresAt: { gt: now }, impersonatedById: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      const excess = open.length - (MAX_SESSIONS - 1);
      if (excess > 0) {
        await tx.session.updateMany({ where: { id: { in: open.slice(0, excess).map((s) => s.id) } }, data: { revokedAt: now, revokedReason: 'EXPIRED', updatedAt: now } });
      }
      await tx.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          audience,
          familyId: newId(),
          refreshTokenHash: refreshHash,
          rememberMe: input.rememberMe,
          userAgent: ua,
          deviceLabel: deviceLabel(ua ?? undefined)?.slice(0, 120) ?? null,
          ipHash: this.ip.fingerprint(req),
          lastUsedAt: now,
          passwordConfirmedAt: input.viaPassword ? now : null,
          expiresAt,
          deviceKey: device.key,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now, lastSeenAt: now, failedLoginCount: 0, lockedUntil: null, updatedAt: now } });
      const actor: Actor = { type: 'USER', userId: user.id, role, reason: null };
      await writeAudit(tx, actor, now, { action: 'auth.login_succeeded', entityType: 'User', entityId: user.id, after: { audience, rememberMe: input.rememberMe } });
      // AUTH-033, BO-007 — a new device, for an account that has signed in before: the alert e-mail.
      if (!recognised && user.lastLoginAt) {
        const label = deviceLabel(ua ?? undefined);
        await tx.outboxEvent.create({
          data: {
            id: newId(),
            type: 'user.new_device_login',
            aggregateType: 'User',
            aggregateId: user.id,
            payload: { deviceLabel: label } as never,
            occurredAt: now,
            availableAt: now,
            createdAt: now,
            updatedAt: now,
          },
        });
        await this.mail.request(tx, {
          template: user.kind === 'STAFF' ? 'S_NEW_DEVICE_LOGIN' : 'C_NEW_DEVICE_LOGIN',
          userId: user.id,
          to: user.email,
          vars: { action: { deviceLabel: label ?? '—', at: now.toISOString() } },
        });
      }
    });

    if (device.fresh) this.cookies.set(res, audience, 'device', device.raw, new Date(now.getTime() + DEVICE_COOKIE_MS));
    return this.issue(res, {
      audience,
      user: { ...user, role },
      sessionId,
      refresh,
      refreshHash,
      rememberMe: input.rememberMe,
      expiresAt,
      idleExpiresAt: new Date(now.getTime() + idleMs),
      redirectTo: input.redirectTo,
    });
  }

/** ROL-017, CRM-075 — the preview duration (30 minutes, never renewed beyond). */
  static readonly PREVIEW_MS = 30 * 60_000;

  /**
   * ROL-017 — opens the READ-ONLY session of « Voir comme le client » on the client space: `impersonatedById` names the
   * member of the team; it is not one of the ten sessions of the account (SEC-025), is never listed among its devices,
   * does not touch `lastLoginAt` and sends no alert to the client.
   */
  async openPreview(req: Request, res: Response, input: { user: SessionUserRow; byUserId: string }): Promise<SessionResponse> {
    const now = this.clock.now();
    const refresh = randomToken();
    const refreshHash = sha256Hex(refresh);
    const sessionId = newId();
    const expiresAt = new Date(now.getTime() + SessionsService.PREVIEW_MS);
    const ua = (req.headers['user-agent'] ?? '').slice(0, 400) || null;
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: input.user.id,
        audience: 'WEB',
        familyId: newId(),
        refreshTokenHash: refreshHash,
        impersonatedById: input.byUserId,
        rememberMe: false,
        userAgent: ua,
        deviceLabel: null,
        ipHash: this.ip.fingerprint(req),
        lastUsedAt: now,
        expiresAt,
        deviceKey: null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.issue(res, { audience: 'WEB', user: { ...input.user, role: null }, sessionId, refresh, refreshHash, rememberMe: false, expiresAt, idleExpiresAt: expiresAt, redirectTo: '/espace-client' });
  }

  /** Access token + cookies + body of API-003. `refresh` absent: the grace answer (access token only). */
  private issue(
    res: Response,
    a: {
      audience: BrowserAudience;
      user: { id: string; kind: SessionUserRow['kind']; firstName: string | null; lastName: string | null; role: string | null };
      sessionId: string;
      refresh?: string;
      refreshHash: string;
      rememberMe: boolean;
      expiresAt: Date;
      idleExpiresAt: Date;
      redirectTo: string;
    },
  ): SessionResponse {
    const now = this.clock.now();
    const accessExpires = new Date(Math.min(now.getTime() + ACCESS_TOKEN_MINUTES * 60_000, a.expiresAt.getTime()));
    const access = signAccessToken(this.env.JWT_SIGNING_KEY, {
      sub: a.user.id,
      kind: a.user.kind,
      aud: a.audience,
      sid: a.sessionId,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(accessExpires.getTime() / 1000),
    });
    // AUTH-024 — without « Se souvenir de moi », session cookies: they end with the browser.
    const persistent = a.rememberMe ? a.expiresAt : undefined;
    this.cookies.set(res, a.audience, 'access', access, persistent);
    if (a.refresh) this.cookies.set(res, a.audience, 'refresh', a.refresh, persistent);
    const csrf = this.csrfFor(a.refreshHash);
    this.cookies.setCsrf(res, a.audience, csrf, persistent);
    res.setHeader('Cache-Control', 'no-store');
    return {
      status: 'SESSION',
      csrfToken: csrf,
      accessExpiresAt: accessExpires.toISOString(),
      idleExpiresAt: new Date(Math.min(a.idleExpiresAt.getTime(), a.expiresAt.getTime())).toISOString(),
      absoluteExpiresAt: a.expiresAt.toISOString(),
      user: { id: a.user.id, kind: a.user.kind, firstName: a.user.firstName, lastName: a.user.lastName, role: a.user.role },
      redirectTo: a.redirectTo,
    };
  }

  /** API-003, SEC-021 — `POST /auth/refresh`. */
  async refresh(req: Request, res: Response, audience: BrowserAudience, userActive: boolean): Promise<SessionResponse> {
    const now = this.clock.now();
    const presented = this.cookies.read(req, audience, 'refresh');
    const fail = (): never => {
      this.cookies.clearSession(res, audience);
      throw new AppError(ErrorCode.UNAUTHENTICATED);
    };
    if (!presented) return fail();
    const hash = sha256Hex(presented);
    const csrf = this.headerCsrf(req);

    let session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });
    if (session) {
      if (!(await this.usable(session, audience, now))) return fail();
      if (!csrf || !safeEqual(csrf, this.csrfFor(hash))) throw new AppError(ErrorCode.FORBIDDEN);
      const next = randomToken();
      const nextHash = sha256Hex(next);
      const rotated = await this.prisma.session.updateMany({
        where: { id: session.id, refreshTokenHash: hash, revokedAt: null },
        data: {
          refreshTokenHash: nextHash,
          previousRefreshTokenHash: hash,
          rotatedAt: now,
          ...(userActive ? { lastUsedAt: now } : {}),
          updatedAt: now,
        },
      });
      if (rotated.count === 1) {
        // ROL-017 — a preview never counts as the client being seen
        if (userActive && !session.impersonatedById) await this.prisma.user.update({ where: { id: session.userId }, data: { lastSeenAt: now } });
        const { idleMs } = await this.durations(audience, session.rememberMe);
        const lastUsed = userActive ? now : session.lastUsedAt;
        return this.issue(res, {
          audience,
          user: { id: session.user.id, kind: session.user.kind, firstName: session.user.firstName, lastName: session.user.lastName, role: session.user.kind === 'STAFF' ? await this.effectiveRole(session.userId) : null },
          sessionId: session.id,
          refresh: next,
          refreshHash: nextHash,
          rememberMe: session.rememberMe,
          expiresAt: session.expiresAt,
          idleExpiresAt: new Date(lastUsed.getTime() + idleMs),
          redirectTo: '',
        });
      }
      // Lost the race to a concurrent renewal: read again, the grace rule below decides.
      session = null;
    }

    const previous = await this.prisma.session.findFirst({ where: { previousRefreshTokenHash: hash }, include: { user: true } });
    if (!previous) return fail();
    const withinGrace = previous.rotatedAt && now.getTime() - previous.rotatedAt.getTime() <= ROTATION_GRACE_MS;
    if (withinGrace && (await this.usable(previous, audience, now))) {
      // SEC-021 — two tabs: a new access token, no rotation, no alert. The browser already holds the new refresh token.
      if (!csrf || !(safeEqual(csrf, this.csrfFor(hash)) || safeEqual(csrf, this.csrfFor(previous.refreshTokenHash)))) throw new AppError(ErrorCode.FORBIDDEN);
      const { idleMs } = await this.durations(audience, previous.rememberMe);
      return this.issue(res, {
        audience,
        user: { id: previous.user.id, kind: previous.user.kind, firstName: previous.user.firstName, lastName: previous.user.lastName, role: previous.user.kind === 'STAFF' ? await this.effectiveRole(previous.userId) : null },
        sessionId: previous.id,
        refreshHash: previous.refreshTokenHash,
        rememberMe: previous.rememberMe,
        expiresAt: previous.expiresAt,
        idleExpiresAt: new Date(previous.lastUsedAt.getTime() + idleMs),
        redirectTo: '',
      });
    }
    // SEC-021 — a token already used, outside the grace: possible theft; the whole family is revoked.
    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({ where: { familyId: previous.familyId, revokedAt: null }, data: { revokedAt: now, revokedReason: 'REUSE_DETECTED', updatedAt: now } });
      await writeAudit(tx, { type: 'SYSTEM', userId: null, role: null, reason: null }, now, { action: 'auth.reuse_detected', entityType: 'User', entityId: previous.userId });
    });
    log('warn', 'auth.reuse_detected', { sessionFamily: previous.familyId });
    return fail();
  }

  private async usable(
    session: { id: string; audience: string; revokedAt: Date | null; expiresAt: Date; lastUsedAt: Date; rememberMe: boolean; impersonatedById: string | null; user: { status: string; kind: string } },
    audience: BrowserAudience,
    now: Date,
  ): Promise<boolean> {
    if (session.revokedAt || session.audience !== audience) return false;
    // ROL-017 — a preview session lives only on the client space, and never beyond its 30 minutes (no idle renewal)
    if (session.impersonatedById && audience !== 'WEB') return false;
    const { idleMs } = await this.durations(audience, session.rememberMe);
    const expired = session.expiresAt.getTime() <= now.getTime() || session.lastUsedAt.getTime() + idleMs <= now.getTime();
    if (expired) {
      await this.prisma.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now, revokedReason: 'EXPIRED', updatedAt: now } });
      return false;
    }
    if (session.user.status !== 'ACTIVE') return false;
    const kindOk = audience === 'WEB' ? session.user.kind === 'CLIENT' : audience === 'ADMIN' ? session.user.kind === 'STAFF' : session.user.kind === 'PARTNER';
    return kindOk;
  }

  headerCsrf(req: Request): string | undefined {
    const h = req.headers[CSRF_HEADER.toLowerCase()];
    const v = Array.isArray(h) ? h[0] : h;
    return typeof v === 'string' && v.length < 200 ? v : undefined;
  }

  /** SEC-020, SEC-024 — the caller of a request, or null: valid access token AND live session AND active account. */
  async authenticate(req: Request, audience: BrowserAudience): Promise<AuthContext | null> {
    const now = this.clock.now();
    const claims = verifyAccessToken(this.env.JWT_SIGNING_KEY, this.cookies.read(req, audience, 'access'), audience, now.getTime());
    if (!claims) return null;
    const session = await this.prisma.session.findUnique({
      where: { id: claims.sid },
      include: { user: { select: { id: true, kind: true, status: true, email: true, firstName: true, lastName: true } } },
    });
    if (!session || session.userId !== claims.sub) return null;
    if (!(await this.usable(session, audience, now))) return null;
    let role: string | null = null;
    let clientId: string | null = null;
    if (session.user.kind === 'STAFF') {
      role = await this.effectiveRole(session.userId);
      if (!role) return null; // ROL-002 — no live membership: no access.
    } else if (session.user.kind === 'CLIENT') {
      clientId = (await this.prisma.client.findFirst({ where: { userId: session.userId, deletedAt: null }, select: { id: true } }))?.id ?? null;
    }
    return {
      userId: session.userId,
      kind: session.user.kind,
      audience,
      sessionId: session.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      role,
      clientId,
      passwordConfirmedAt: session.passwordConfirmedAt,
      actor: { type: 'USER', userId: session.userId, role, reason: null },
      preview: session.impersonatedById ? { byUserId: session.impersonatedById, expiresAt: session.expiresAt } : null,
      refreshTokenHash: session.refreshTokenHash,
      previousRefreshTokenHash: session.previousRefreshTokenHash,
      rotatedAt: session.rotatedAt,
    };
  }

  /** SEC-027 — the header matches the session's token (or the one just replaced, for a request already in flight). */
  csrfValid(req: Request, ctx: { refreshTokenHash: string; previousRefreshTokenHash: string | null; rotatedAt: Date | null }): boolean {
    const given = this.headerCsrf(req);
    if (!given) return false;
    if (safeEqual(given, this.csrfFor(ctx.refreshTokenHash))) return true;
    const recent = ctx.rotatedAt && this.clock.now().getTime() - ctx.rotatedAt.getTime() <= 30_000;
    return Boolean(recent && ctx.previousRefreshTokenHash && safeEqual(given, this.csrfFor(ctx.previousRefreshTokenHash)));
  }

  /** MOD-104 — the effective role of a staff member (temporary role while it runs), or null without a live membership. */
  async effectiveRole(userId: string, db: Tx | PrismaService = this.prisma): Promise<string | null> {
    const m = await db.membership.findFirst({
      where: { userId, revokedAt: null, suspendedAt: null, organization: { type: 'OPERATOR' } },
      select: { role: true, elevatedRole: true, elevatedUntil: true },
    });
    if (!m) return null;
    return m.elevatedRole && m.elevatedUntil && m.elevatedUntil.getTime() > this.clock.now().getTime() ? m.elevatedRole : m.role;
  }

  /**
   * ROL-017, CRM-075 — a preview the team did not leave by « Quitter l'aperçu » ends with its 30 minutes: it is closed and
   * its end traced the same way (`client.impersonation_ended`, reason `expired`); the client is told nothing.
   */
  async endExpiredPreviews(now: Date): Promise<number> {
    const expired = await this.prisma.session.findMany({ where: { impersonatedById: { not: null }, revokedAt: null, expiresAt: { lte: now } }, select: { id: true, userId: true, impersonatedById: true }, take: 200 });
    for (const s of expired) {
      await this.prisma.$transaction(async (tx) => {
        await this.revoke(s.id, 'PREVIEW_ENDED', tx);
        const client = await tx.client.findFirst({ where: { userId: s.userId }, select: { id: true } });
        await writeAudit(tx, { type: 'USER', userId: s.impersonatedById!, role: await this.effectiveRole(s.impersonatedById!, tx), reason: null }, now, { action: 'client.impersonation_ended', entityType: 'Client', entityId: client?.id ?? null, clientId: client?.id ?? null, reason: 'expired' });
      });
    }
    return expired.length;
  }

  async revoke(sessionId: string, reason: SessionRevokedReason, db: Tx | PrismaService = this.prisma): Promise<void> {
    const now = this.clock.now();
    await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: now, revokedReason: reason, updatedAt: now } });
  }

  /** SEC-024 — every session of an account, except `keep` (the current one, for a change made from the profile). */
  async revokeAll(userId: string, reason: SessionRevokedReason, keep: string | null = null, db: Tx | PrismaService = this.prisma): Promise<number> {
    const now = this.clock.now();
    const done = await db.session.updateMany({
      where: { userId, revokedAt: null, impersonatedById: null, ...(keep ? { id: { not: keep } } : {}) },
      data: { revokedAt: now, revokedReason: reason, updatedAt: now },
    });
    return done.count;
  }

  /** SEC-026 — sign-out: the session is revoked server-side and the cookies are cleared. */
  async logout(req: Request, res: Response, audience: BrowserAudience): Promise<void> {
    const ctx = await this.authenticate(req, audience);
    const refresh = this.cookies.read(req, audience, 'refresh');
    const now = this.clock.now();
    let session: { id: string; userId: string } | null = ctx ? { id: ctx.sessionId, userId: ctx.userId } : null;
    if (ctx && !this.csrfValid(req, ctx)) throw new AppError(ErrorCode.FORBIDDEN);
    if (!session && refresh) {
      session = await this.prisma.session.findFirst({ where: { refreshTokenHash: sha256Hex(refresh), revokedAt: null }, select: { id: true, userId: true } });
      // Without a valid access token, the refresh cookie proves the session; the anti-forgery header must match it.
      if (session && !safeEqual(this.headerCsrf(req) ?? '', this.csrfFor(sha256Hex(refresh)))) throw new AppError(ErrorCode.FORBIDDEN);
    }
    if (session) {
      const s = session;
      const row = await this.prisma.session.findUnique({ where: { id: s.id }, select: { impersonatedById: true } });
      await this.prisma.$transaction(async (tx) => {
        if (row?.impersonatedById) {
          // ROL-017, CRM-075 — « Quitter l'aperçu »: the end of the consultation is traced, the client is told nothing
          await this.revoke(s.id, 'PREVIEW_ENDED', tx);
          const client = await tx.client.findFirst({ where: { userId: s.userId }, select: { id: true } });
          await writeAudit(tx, { type: 'USER', userId: row.impersonatedById, role: await this.effectiveRole(row.impersonatedById, tx), reason: null }, now, { action: 'client.impersonation_ended', entityType: 'Client', entityId: client?.id ?? null, clientId: client?.id ?? null });
          return;
        }
        await this.revoke(s.id, 'LOGOUT', tx);
        await writeAudit(tx, { type: 'USER', userId: s.userId, role: ctx?.role ?? null, reason: null }, now, { action: 'auth.logout', entityType: 'User', entityId: s.userId });
      });
    }
    this.cookies.clearSession(res, audience);
  }
}
