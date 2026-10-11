// 03-espace-client/01 §§ 4–7, 9, BO-002, BO-005 — sign-in (password, link, two-factor code), renewal, sign-out,
// forgotten password, new terms, confirmation of a sensitive action, staff re-confirmation of the password.
import { Inject, Injectable } from '@nestjs/common';
import {
  actionCodeRequestSchema,
  AuthConsentWording,
  confirmPasswordRequestSchema,
  emailOnlyRequestSchema,
  ErrorCode,
  legalAcceptRequestSchema,
  loginRequestSchema,
  passwordResetRequestSchema,
  refreshRequestSchema,
  tokenRequestSchema,
  twoFactorLoginRequestSchema,
  AUTH_LIMITS,
  type BrowserAudience,
  type LegalStepResponse,
  type LoginResponse,
  type SentResponse,
  type SessionResponse,
} from '@dp/contracts';
import { createTranslator } from '@dp/i18n';
import type { Request, Response } from 'express';
import { writeAudit } from '../admin/audit.js';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp } from '../platform/rate-limit.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { AuthFlowService, audienceOfKind, FLOW_USER_SELECT, type FlowUser } from './auth-flow.service.js';
import { AuthMailRequester } from './auth-mail.js';
import { audienceOf, tokenPageHeaders } from './http.js';
import { LoginAttemptsService } from './login-attempts.service.js';
import { MailLimits } from './mail-limits.js';
import { hashPassword, needsRehash, passwordProblem, verifyPassword } from './password.js';
import { SessionsService } from './sessions.service.js';
import { TokensService } from './tokens.service.js';
import { TwoFactorService } from './two-factor.service.js';

const tr = createTranslator('fr');
const LEGAL_PATH = { TERMS_OF_USE: '/conditions-generales', PRIVACY_POLICY: '/confidentialite' } as const;

/** Paths of the token pages, per door (they receive the token in their address, SEC-040). */
export const LINK_PATHS = {
  verifyClient: '/verification/{token}',
  verifyPartner: '/partenaires/verification/{token}',
  resetClient: '/reinitialisation/{token}',
  resetPartner: '/partenaires/reinitialisation/{token}',
  resetStaff: '/reinitialisation/{token}',
  activation: '/activation/{token}',
  magic: '/connexion/lien/{token}',
  emailChange: '/nouvelle-adresse/{token}',
  invitation: '/invitation/{token}',
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly flow: AuthFlowService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokensService,
    private readonly attempts: LoginAttemptsService,
    private readonly twoFactor: TwoFactorService,
    private readonly mail: AuthMailRequester,
    private readonly limits: MailLimits,
    private readonly ip: ClientIp,
    @Inject(ENV) private readonly env: Env,
  ) {}

  audience(req: Request): BrowserAudience {
    return audienceOf(req, this.env);
  }

  // ─── Password sign-in (AUTH-020…AUTH-033, BO-001, BO-002) ─────────────────

  async login(req: Request, res: Response, body: unknown): Promise<LoginResponse> {
    const audience = this.audience(req);
    const input = parseOrThrow(loginRequestSchema, body);
    this.attempts.countIp(req);
    const user = await this.prisma.user.findUnique({ where: { email: input.email }, select: { ...FLOW_USER_SELECT, lockedUntil: true, suspendedReason: true } });
    const deviceKey = this.sessions.deviceKey(req, audience);
    const recognised = user ? await this.sessions.isRecognisedDevice(user.id, deviceKey) : false;
    // AUTH-021 — the hash is always verified (a fixed one without account): same time in every case.
    const ok = await verifyPassword(user?.passwordHash, input.password);
    const lock = await this.attempts.lockFor(user, input.email, recognised);
    if (lock) throw lock;
    if (!ok || !user) throw await this.attempts.fail(user, input.email, { key: deviceKey, recognised });

    // AUTH-022 — in the audience of the request.
    if (audience === 'ADMIN' && user.kind !== 'STAFF') throw new AppError(ErrorCode.INVALID_CREDENTIALS); // BO-001
    if (user.status === 'DELETED') throw new AppError(ErrorCode.INVALID_CREDENTIALS);
    if (user.status === 'SUSPENDED') throw new AppError(ErrorCode.ACCOUNT_SUSPENDED, { reason: user.suspendedReason ?? 'STAFF_DECISION' });
    if ((audience === 'WEB' && user.kind !== 'CLIENT') || (audience === 'PARTNER' && user.kind !== 'PARTNER')) {
      throw new AppError(ErrorCode.FORBIDDEN, { reason: 'WRONG_AUDIENCE' });
    }
    if (user.kind === 'STAFF' && !(await this.sessions.effectiveRole(user.id))) throw new AppError(ErrorCode.INVALID_CREDENTIALS);
    if (user.passwordHash && needsRehash(user.passwordHash)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password) } }); // SEC-010
    }
    await this.attempts.succeed(user.id, input.email, deviceKey);
    return this.flow.continue(req, res, user as FlowUser, {
      audience,
      // BO-002: no « Se souvenir de moi » for staff; SEC-023: the partner space neither.
      rememberMe: audience === 'WEB' ? input.rememberMe : false,
      viaPassword: true,
      next: input.next ?? null,
      simulationId: audience === 'WEB' ? (input.simulationId ?? null) : null,
    });
  }

  /** AUTH-050 — `POST /auth/login/two-factor`. */
  async loginTwoFactor(req: Request, res: Response, body: unknown): Promise<LoginResponse> {
    const audience = this.audience(req);
    const { row, payload, user } = await this.flow.readStep(req, audience, 'TWO_FACTOR');
    const input = parseOrThrow(twoFactorLoginRequestSchema, body);
    const good = 'code' in input ? await this.twoFactor.verifyCode(user.id, input.code) : await this.twoFactor.useRecovery(user.id, input.recoveryCode);
    if (!good) {
      const attempts = await this.tokens.addAttempt(row.id);
      if (attempts >= AUTH_LIMITS.maxCodeAttempts) {
        // The fifth wrong code: the step token dies and the account is locked at once.
        await this.prisma.authToken.update({ where: { id: row.id }, data: { expiresAt: this.clock.now() } });
        this.sessions.cookies.clear(res, audience, 'step');
        throw await this.attempts.lockNow(user.id);
      }
      const remaining = AUTH_LIMITS.maxCodeAttempts - attempts;
      throw new AppError(ErrorCode.INVALID_CODE, { params: { remaining, n: remaining } });
    }
    return this.flow.continue(req, res, user, { ...this.flow.carry(payload), twoFactorDone: true }, row);
  }

  /** AUTH-026 — what step this browser is at (a page reloaded in the middle of a sign-in). */
  async currentStep(req: Request): Promise<LoginResponse> {
    const audience = this.audience(req);
    const { row, payload, user } = await this.flow.readStep(req, audience, ['TWO_FACTOR', 'EMAIL_VERIFICATION', 'TERMS', 'STAFF_SETUP']);
    return this.flow.describe(user, payload, row.attempts);
  }

  refresh(req: Request, res: Response, body: unknown): Promise<SessionResponse> {
    const audience = this.audience(req);
    const { userActive } = parseOrThrow(refreshRequestSchema, body ?? {});
    return this.sessions.refresh(req, res, audience, userActive);
  }

  logout(req: Request, res: Response): Promise<void> {
    return this.sessions.logout(req, res, this.audience(req));
  }

  // ─── Sign-in by link (AUTH-041) ───────────────────────────────────────────

  async requestMagicLink(req: Request, body: unknown): Promise<SentResponse> {
    const audience = this.audience(req);
    const { email, next } = parseOrThrow(emailOnlyRequestSchema, body);
    this.limits.take(req, 'magic', email);
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, kind: true, status: true, emailVerifiedAt: true } });
    // Only the client door offers it; staff (BO-002) and partners have no sign-in by link.
    if (audience === 'WEB' && user?.kind === 'CLIENT' && (user.status === 'ACTIVE' || user.status === 'INVITED')) {
      await this.prisma.$transaction(async (tx) => {
        if (user.status === 'ACTIVE' && !user.emailVerifiedAt) {
          // An unconfirmed sign-up gets the verification link again, with its precautions (AUTH-013).
          await this.mail.request(tx, { template: 'C_EMAIL_VERIFICATION', userId: user.id, to: email, link: { purpose: 'EMAIL_VERIFICATION', host: 'web', path: LINK_PATHS.verifyClient, payload: { next: next ?? null } } });
        } else {
          await this.mail.request(tx, { template: 'C_MAGIC_LOGIN', userId: user.id, to: email, link: { purpose: 'MAGIC_LOGIN', host: 'web', path: LINK_PATHS.magic, payload: { next: next ?? null } } });
        }
      });
      this.mail.wake();
    }
    return { status: 'SENT' };
  }

  async consumeMagicLink(req: Request, res: Response, body: unknown): Promise<LoginResponse> {
    tokenPageHeaders(res);
    const audience = this.audience(req);
    const parsed = tokenRequestSchema.safeParse(body);
    const row = parsed.success ? await this.tokens.find(parsed.data.token, 'MAGIC_LOGIN') : null;
    if (!row || !this.tokens.isAlive(row) || !row.userId || audience !== 'WEB') throw new AppError(ErrorCode.GONE);
    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: FLOW_USER_SELECT });
    if (!user || user.kind !== 'CLIENT' || (user.status !== 'ACTIVE' && user.status !== 'INVITED')) throw new AppError(ErrorCode.GONE);
    const now = this.clock.now();
    const updated = await this.prisma.$transaction(async (tx) => {
      if (!(await this.tokens.consume(row, tx))) throw new AppError(ErrorCode.GONE);
      const wasInvited = user.status === 'INVITED';
      const firstVerification = !user.emailVerifiedAt;
      // AUTH-041 — for an INVITED account the link is the activation: active, without password; the address is proven.
      const u = await tx.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', emailVerifiedAt: user.emailVerifiedAt ?? now, failedLoginCount: 0, lockedUntil: null, updatedAt: now },
        select: FLOW_USER_SELECT,
      });
      if (wasInvited) await this.tokens.killAll(user.id, ['ACCOUNT_ACTIVATION'], tx);
      if (wasInvited || firstVerification) await this.activated(tx, user.id, user.email, now);
      return u;
    });
    await this.attempts.succeed(user.id, user.email, null);
    this.mail.wake();
    return this.flow.continue(req, res, updated as FlowUser, { audience: 'WEB', rememberMe: false, viaPassword: false, next: (row.payload.next as string | null) ?? null, simulationId: null });
  }

  /** CYC-200 — first activation or verification: the event, the welcome e-mail, the audit line. */
  async activated(tx: Tx, userId: string, email: string, now: Date): Promise<void> {
    const client = await tx.client.findFirst({ where: { userId }, select: { id: true } });
    await tx.outboxEvent.create({
      data: { id: newId(), type: 'client.account_activated', aggregateType: 'Client', aggregateId: client?.id ?? userId, payload: {} as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now },
    });
    await this.mail.request(tx, { template: 'C_WELCOME', userId, to: email, clientId: client?.id ?? null, triggeredBy: 'EVENT' });
  }

  // ─── Forgotten password (AUTH-045, BO-002) ────────────────────────────────

  async forgot(req: Request, body: unknown): Promise<SentResponse> {
    const audience = this.audience(req);
    const { email } = parseOrThrow(emailOnlyRequestSchema, body);
    this.limits.take(req, 'forgot', email);
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, kind: true, status: true } });
    if (!user || user.status === 'SUSPENDED' || user.status === 'DELETED') return { status: 'SENT' };
    const staffDoor = audience === 'ADMIN';
    if (staffDoor !== (user.kind === 'STAFF')) return { status: 'SENT' }; // each door serves its own accounts (ROL-004)
    await this.prisma.$transaction(async (tx) => {
      if (user.kind === 'STAFF') {
        if (user.status === 'INVITED') return this.requestInvitation(tx, user.id, email, null); // BO-003
        return this.mail.request(tx, { template: 'S_PASSWORD_RESET', userId: user.id, to: email, link: { purpose: 'PASSWORD_RESET', host: 'admin', path: LINK_PATHS.resetStaff } });
      }
      if (user.kind === 'CLIENT' && user.status === 'INVITED') {
        return this.mail.request(tx, { template: 'C_ACCOUNT_ACTIVATION', userId: user.id, to: email, link: { purpose: 'ACCOUNT_ACTIVATION', host: 'web', path: LINK_PATHS.activation } });
      }
      // A partner's reset link leads to his own door, whichever door the request came from (ACP-080, ACP-085).
      const path = user.kind === 'PARTNER' ? LINK_PATHS.resetPartner : LINK_PATHS.resetClient;
      return this.mail.request(tx, { template: 'C_PASSWORD_RESET', userId: user.id, to: email, link: { purpose: 'PASSWORD_RESET', host: 'web', path } });
    });
    await this.audit(user.id, 'auth.password_reset_requested');
    this.mail.wake();
    return { status: 'SENT' };
  }

  /** S_INVITATION with a new link (MOD-105: the previous one dies). */
  async requestInvitation(tx: Tx, userId: string, email: string, inviter: string | null): Promise<void> {
    const m = await tx.membership.findFirst({ where: { userId, revokedAt: null }, select: { role: true } });
    await this.mail.request(tx, {
      template: 'S_INVITATION',
      userId,
      to: email,
      link: { purpose: 'STAFF_INVITATION', host: 'admin', path: LINK_PATHS.invitation },
      vars: { action: { roleLabel: m ? tr(`ui.enum.MembershipRole.${m.role}` as never) : '' }, actor: { fullName: inviter } },
    });
  }

  async resetCheck(res: Response, body: unknown): Promise<{ status: 'VALID' }> {
    tokenPageHeaders(res);
    const parsed = tokenRequestSchema.safeParse(body);
    const row = parsed.success ? await this.tokens.find(parsed.data.token, 'PASSWORD_RESET') : null;
    if (!row || !this.tokens.isAlive(row)) throw new AppError(ErrorCode.GONE);
    return { status: 'VALID' };
  }

  async reset(req: Request, res: Response, body: unknown): Promise<LoginResponse> {
    tokenPageHeaders(res);
    const audience = this.audience(req);
    const raw = body as { token?: unknown } | null;
    const row = typeof raw?.token === 'string' ? await this.tokens.find(raw.token, 'PASSWORD_RESET') : null;
    if (!row || !this.tokens.isAlive(row) || !row.userId) throw new AppError(ErrorCode.GONE);
    const input = parseOrThrow(passwordResetRequestSchema, body);
    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: FLOW_USER_SELECT });
    if (!user || user.status === 'SUSPENDED' || user.status === 'DELETED') throw new AppError(ErrorCode.GONE);
    const target = audienceOfKind(user.kind);
    if ((target === 'ADMIN') !== (audience === 'ADMIN')) throw new AppError(ErrorCode.GONE);
    const problem = passwordProblem(input.password, { minLength: await this.settings.get('security.password.minLength'), email: user.email, firstName: user.firstName, lastName: user.lastName });
    if (problem) throw AppError.validation([problem]);
    const passwordHash = await hashPassword(input.password);
    const now = this.clock.now();
    const updated = await this.prisma.$transaction(async (tx) => {
      if (!(await this.tokens.consume(row, tx))) throw new AppError(ErrorCode.GONE);
      const firstVerification = !user.emailVerifiedAt && user.kind !== 'STAFF';
      const u = await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: now, emailVerifiedAt: user.emailVerifiedAt ?? (user.kind !== 'STAFF' ? now : null), failedLoginCount: 0, lockedUntil: null, updatedAt: now },
        select: FLOW_USER_SELECT,
      });
      await this.tokens.killAll(user.id, ['PASSWORD_RESET', 'MAGIC_LOGIN', 'LOGIN_CHALLENGE'], tx);
      // AUTH-045 — every session closes.
      await this.sessions.revokeAll(user.id, 'PASSWORD_CHANGED', null, tx);
      await this.passwordChanged(tx, u, now);
      // The link proves the address: an unverified one is verified at the same time.
      if (firstVerification) {
        if (user.kind === 'PARTNER') await this.partnerVerified(tx, user.id, user.email, now);
        else await this.activated(tx, user.id, user.email, now);
      }
      return u;
    });
    await this.attempts.succeed(user.id, user.email, null);
    this.mail.wake();
    return this.flow.continue(req, res, updated as FlowUser, { audience: target, rememberMe: false, viaPassword: true, next: null, simulationId: null });
  }

  /** AUTH-045, AUTH-081 — audit, event and e-mail of a changed password. */
  async passwordChanged(tx: Tx, user: { id: string; email: string; kind: string }, now: Date): Promise<void> {
    await writeAudit(tx, { type: 'USER', userId: user.id, role: null, reason: null }, now, { action: 'auth.password_changed', entityType: 'User', entityId: user.id });
    await tx.outboxEvent.create({
      data: { id: newId(), type: 'user.password_changed', aggregateType: 'User', aggregateId: user.id, payload: {} as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now },
    });
    await this.mail.request(tx, {
      template: user.kind === 'STAFF' ? 'S_PASSWORD_CHANGED' : 'C_PASSWORD_CHANGED',
      userId: user.id,
      to: user.email,
      vars: user.kind === 'STAFF' ? { action: { adminUrl: `${this.env.ADMIN_URL ?? this.env.WEB_URL}/mot-de-passe-oublie` } } : {},
    });
  }

  /** ACP-082 — a partner's address confirmed: the application becomes « Dossier à compléter », P_PARTNER_APPLICATION_ACK. */
  async partnerVerified(tx: Tx, userId: string, email: string, now: Date): Promise<void> {
    const lead = await tx.lead.findFirst({ where: { applicantUserId: userId, kind: 'PARTNER_REQUEST' }, orderBy: { createdAt: 'desc' }, select: { id: true, applicationStatus: true } });
    if (lead?.applicationStatus === 'EMAIL_UNVERIFIED') {
      await tx.lead.update({ where: { id: lead.id }, data: { applicationStatus: 'DRAFT', updatedAt: now } });
    }
    const days = await this.settings.get('partner.applicationReviewDays');
    await this.mail.request(tx, {
      template: 'P_PARTNER_APPLICATION_ACK',
      userId,
      to: email,
      leadId: lead?.id ?? null,
      triggeredBy: 'EVENT',
      vars: { action: { reviewDaysLabel: days === 1 ? '1 jour ouvré' : `${days} jours ouvrés` } },
    });
  }

  // ─── Terms (AUTH-090) ─────────────────────────────────────────────────────

  async legal(req: Request): Promise<LegalStepResponse> {
    const audience = this.audience(req);
    const { user } = await this.flow.readStep(req, audience, 'TERMS');
    const now = this.clock.now();
    const documents: LegalStepResponse['documents'] = [];
    for (const type of ['TERMS_OF_USE', 'PRIVACY_POLICY'] as const) {
      const doc = await this.prisma.legalDocument.findFirst({
        where: { type, locale: 'fr', publishedAt: { not: null, lte: now }, effectiveAt: { lte: now } },
        orderBy: { effectiveAt: 'desc' },
        select: { version: true, title: true, effectiveAt: true, changeSummary: true },
      });
      if (doc) documents.push({ type, version: doc.version, title: doc.title, effectiveAt: doc.effectiveAt.toISOString(), changeSummary: doc.changeSummary, url: LEGAL_PATH[type] });
    }
    return { firstAcceptance: (await this.flow.termsStatus(user.id)).firstAcceptance, documents };
  }

  async acceptLegal(req: Request, res: Response, body: unknown): Promise<LoginResponse> {
    const audience = this.audience(req);
    const { row, payload, user } = await this.flow.readStep(req, audience, 'TERMS');
    parseOrThrow(legalAcceptRequestSchema, body);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({ where: { userId: user.id }, select: { id: true } });
      await this.writeTermsConsents(tx, { userId: user.id, clientId: client?.id ?? null, source: 'legal-update', wording: AuthConsentWording['auth.legalAccept.v1'], req, now });
    });
    return this.flow.continue(req, res, user, this.flow.carry(payload), row);
  }

  /** AUTH-001, AUTH-090 — TERMS_OF_USE and PRIVACY_POLICY with the versions in force. */
  async writeTermsConsents(tx: Tx, a: { userId: string; clientId: string | null; source: string; wording: string; req: Request; now: Date }): Promise<void> {
    for (const type of ['TERMS_OF_USE', 'PRIVACY_POLICY'] as const) {
      const doc = await tx.legalDocument.findFirst({
        where: { type, locale: 'fr', publishedAt: { not: null, lte: a.now }, effectiveAt: { lte: a.now } },
        orderBy: { effectiveAt: 'desc' },
        select: { version: true },
      });
      await tx.consent.create({
        data: {
          id: newId(),
          type,
          granted: true,
          userId: a.userId,
          clientId: a.clientId,
          documentVersion: doc?.version ?? null,
          wording: a.wording,
          source: a.source,
          givenAt: a.now,
          ipHash: this.ip.fingerprint(a.req),
          userAgent: (a.req.headers['user-agent'] ?? '').slice(0, 400) || null,
          createdAt: a.now,
        },
      });
    }
  }

  /** AUTH-090 — « Refuser et me déconnecter »: the step token dies, nothing is deleted. */
  async declineLegal(req: Request, res: Response): Promise<void> {
    const audience = this.audience(req);
    const { row } = await this.flow.readStep(req, audience, 'TERMS');
    await this.prisma.authToken.update({ where: { id: row.id }, data: { usedAt: this.clock.now() } });
    this.sessions.cookies.clear(res, audience, 'step');
  }

  // ─── Sensitive actions (AUTH-086, BO-005) ─────────────────────────────────

  /** AUTH-086 — `POST /auth/action-code` (client session, account without password). */
  async actionCode(req: Request, body: unknown): Promise<void> {
    const ctx = await this.sessions.authenticate(req, 'WEB');
    if (!ctx || ctx.kind !== 'CLIENT') throw new AppError(ErrorCode.UNAUTHENTICATED);
    if (!this.sessions.csrfValid(req, ctx)) throw new AppError(ErrorCode.FORBIDDEN);
    const { action } = parseOrThrow(actionCodeRequestSchema, body);
    const user = await this.prisma.user.findUnique({ where: { id: ctx.userId }, select: { id: true, email: true, passwordHash: true } });
    if (!user) throw new AppError(ErrorCode.UNAUTHENTICATED);
    // An account with a password proves itself with it: no code is sent.
    if (user.passwordHash) throw AppError.conflictState('HAS_PASSWORD');
    this.limits.take(req, 'code', user.email);
    await this.prisma.$transaction((tx) => this.mail.request(tx, { template: 'C_ACTION_CODE', userId: user.id, to: user.email, code: { action } }));
    this.mail.wake();
  }

  /** BO-005 — `POST /auth/confirm-password` (staff session). */
  async confirmPassword(req: Request, body: unknown): Promise<void> {
    const ctx = await this.sessions.authenticate(req, 'ADMIN');
    if (!ctx || ctx.kind !== 'STAFF') throw new AppError(ErrorCode.UNAUTHENTICATED);
    if (!this.sessions.csrfValid(req, ctx)) throw new AppError(ErrorCode.FORBIDDEN);
    const { password } = parseOrThrow(confirmPasswordRequestSchema, body);
    await this.checkPassword(req, ctx.userId, password, 'ADMIN');
    await this.prisma.session.update({ where: { id: ctx.sessionId }, data: { passwordConfirmedAt: this.clock.now() } });
  }

  /** A password typed to prove oneself (BO-005, AUTH-086): wrong counts as a sign-in failure (AUTH-032). */
  async checkPassword(req: Request, userId: string, password: string, audience: BrowserAudience): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, passwordHash: true, lockedUntil: true } });
    if (!user) throw new AppError(ErrorCode.UNAUTHENTICATED);
    const deviceKey = this.sessions.deviceKey(req, audience);
    const recognised = await this.sessions.isRecognisedDevice(user.id, deviceKey);
    const ok = await verifyPassword(user.passwordHash, password);
    const lock = await this.attempts.lockFor(user, user.email, recognised);
    if (lock) throw lock;
    if (!ok) throw await this.attempts.fail(user, user.email, { key: deviceKey, recognised });
  }

  private async audit(userId: string, action: string): Promise<void> {
    await this.prisma.$transaction((tx) => writeAudit(tx, { type: 'SYSTEM', userId: null, role: null, reason: null }, this.clock.now(), { action, entityType: 'User', entityId: userId }));
  }
}
