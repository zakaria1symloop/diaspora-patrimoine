// 03-espace-client/01 §§ 2, 3, 5 — client sign-up (AUTH-001…AUTH-005), verification of the address and its precautions
// (AUTH-012, AUTH-013, « Ce n'est pas moi »), activation of a prepared space (AUTH-040). Two principles: never reveal
// whether an address has an account (TRV-112), never give access to existing data without proof of the address.
import { Inject, Injectable } from '@nestjs/common';
import {
  activateRequestSchema,
  AuthConsentWording,
  CURRENT_MARKETING_CONSENT_KEY,
  ErrorCode,
  FORM_TOKEN_HEADER,
  LEAD_HONEYPOT_FIELD,
  LeadConsentWording,
  resendVerificationRequestSchema,
  signupEmailRequestSchema,
  signupRequestSchema,
  tokenRequestSchema,
  verifyEmailRequestSchema,
  emailOnlyRequestSchema,
  type ActivationCheckResponse,
  type LoginResponse,
  type SentResponse,
  type VerifyEmailResponse,
} from '@dp/contracts';
import type { Request, Response } from 'express';
import { writeAudit } from '../admin/audit.js';
import { ENV, type Env } from '../config/env.js';
import { verifyFormToken } from '../leads/form-token.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp, RateLimiter } from '../platform/rate-limit.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { anonymousIdOf, attachAnonymousSimulations } from './anonymous-data.js';
import { AuthFlowService, FLOW_USER_SELECT, type FlowUser } from './auth-flow.service.js';
import { AuthMailRequester } from './auth-mail.js';
import { AuthService, LINK_PATHS } from './auth.service.js';
import { randomToken, sha256Hex } from './crypto.js';
import { audienceOf, tokenPageHeaders } from './http.js';
import { MailLimits, SIGNUP_IP_RULE } from './mail-limits.js';
import { hashPassword, passwordProblem } from './password.js';
import { SessionsService } from './sessions.service.js';
import { TokensService } from './tokens.service.js';

const SIGNUP_COOKIE_MS = 24 * 3600_000;

interface KnownAddressInput {
  email: string;
  signupKeyHash: string | null;
  next: string | null;
  simulationId: string | null;
  /** Partner door (ACP-080): any existing account gets the « adresse déjà utilisée » variant instead. */
  ipHash: string;
  req: Request;
}

@Injectable()
export class SignupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly idempotency: IdempotencyService,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
    private readonly limits: MailLimits,
    private readonly mail: AuthMailRequester,
    private readonly tokens: TokensService,
    private readonly sessions: SessionsService,
    private readonly flow: AuthFlowService,
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** AUTH-013 — `dp_signup` is set in every case; a cookie already valid for this browser is kept as it is. */
  signupCookie(req: Request, res: Response): string {
    const value = this.sessions.cookies.readSignup(req) ?? randomToken();
    this.sessions.cookies.setSignup(res, value, new Date(this.clock.now().getTime() + SIGNUP_COOKIE_MS));
    return value;
  }

  checkFormToken(req: Request, form: 'SIGNUP' | 'PARTNER_SIGNUP'): void {
    const header = req.headers[FORM_TOKEN_HEADER.toLowerCase()];
    const token = verifyFormToken(this.env.LINK_SIGNING_KEY, Array.isArray(header) ? header[0] : header, this.clock.now());
    if (!token.ok) throw new AppError(token.reason === 'EXPIRED' ? ErrorCode.GONE : ErrorCode.BAD_REQUEST);
    if (token.claims.form !== form) throw new AppError(ErrorCode.BAD_REQUEST);
  }

  checkSignupRate(req: Request): void {
    const wait = this.limiter.retryAfter(`signup:ip:${this.ip.hash(req)}`, SIGNUP_IP_RULE);
    if (wait > 0) throw AppError.rateLimited(wait);
  }

  recordSignup(req: Request): void {
    this.limiter.record(`signup:ip:${this.ip.hash(req)}`, SIGNUP_IP_RULE);
  }

  // ─── Sign-up (AUTH-001, AUTH-003) ─────────────────────────────────────────

  async signup(req: Request, res: Response, body: unknown): Promise<{ status: number; body: SentResponse }> {
    const audience = audienceOf(req, this.env);
    if (audience !== 'WEB') throw new AppError(ErrorCode.BAD_REQUEST);
    const cookie = this.signupCookie(req, res);
    const signupKeyHash = sha256Hex(cookie);
    const result = await this.idempotency.run(req, { route: 'auth.signup' }, {
      status: 202,
      prepare: async () => {
        this.checkFormToken(req, 'SIGNUP');
        const input = parseOrThrow(signupRequestSchema, body);
        this.checkSignupRate(req);
        // AUTH-002 — checked for every address (a 422 only for unknown ones would tell which are known).
        const problem = passwordProblem(input.password, { minLength: await this.settings.get('security.password.minLength'), email: input.email, firstName: input.firstName, lastName: input.lastName });
        if (problem) throw AppError.validation([problem]);
        // Hashed in every case: the same work whatever the address (SEC-071).
        return { input, passwordHash: await hashPassword(input.password), honeypot: typeof input[LEAD_HONEYPOT_FIELD] === 'string' && input[LEAD_HONEYPOT_FIELD]!.trim() !== '' };
      },
      execute: async (tx, p) => {
        if (p.honeypot) return { status: 'SENT' as const }; // DEM-030 — a robot: nothing is created, same answer.
        await this.applySignup(tx, req, p.input, p.passwordHash, signupKeyHash);
        return { status: 'SENT' as const };
      },
    });
    if (!result.replayed) this.recordSignup(req);
    this.mail.wake();
    return { status: result.status, body: result.body };
  }

  private async applySignup(
    tx: Tx,
    req: Request,
    input: ReturnType<typeof signupRequestSchema.parse>,
    passwordHash: string,
    signupKeyHash: string,
  ): Promise<void> {
    const now = this.clock.now();
    const email = input.email;
    // One submission at a time per address, shared with the request forms (they write the same client record).
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `lead:${email}`);
    const known = await this.knownAddress(tx, { email, signupKeyHash, next: input.next ?? null, simulationId: input.simulationId ?? null, ipHash: this.ip.fingerprint(req), req });
    if (known) return;

    // First row of AUTH-003 — unknown address: a client record and an account.
    const clientId = newId();
    const userId = newId();
    const timezone = input.timezone ?? 'Europe/Paris';
    await tx.user.create({
      data: {
        id: userId,
        kind: 'CLIENT',
        email,
        passwordHash,
        passwordChangedAt: now,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        locale: input.locale,
        timezone,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.client.create({
      data: {
        id: clientId,
        userId,
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        timezone,
        preferredLanguage: input.locale,
        source: 'SIGNUP',
        utm: (input.utm ?? undefined) as never,
        status: 'PROSPECT',
        marketingOptIn: input.marketingOptIn,
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    await this.auth.writeTermsConsents(tx, { userId, clientId, source: 'signup', wording: AuthConsentWording['auth.terms.v1'], req, now });
    if (input.marketingOptIn) {
      await tx.consent.create({
        data: {
          id: newId(),
          type: 'MARKETING_EMAIL',
          granted: true,
          userId,
          clientId,
          wording: LeadConsentWording[CURRENT_MARKETING_CONSENT_KEY].text,
          source: 'signup',
          givenAt: now,
          ipHash: this.ip.fingerprint(req),
          userAgent: (req.headers['user-agent'] ?? '').slice(0, 400) || null,
          createdAt: now,
        },
      });
    }
    // AUTH-004 — the anonymous simulations of this browser join the record (visible once the address is verified).
    await attachAnonymousSimulations(tx, clientId, anonymousIdOf(req), now);
    for (const [type, aggregateId, payload] of [
      ['client.created', clientId, { source: 'SIGNUP' }],
      ['client.account_created', clientId, {}],
    ] as const) {
      await tx.outboxEvent.create({ data: { id: newId(), type, aggregateType: 'Client', aggregateId, payload: payload as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now } });
    }
    await writeAudit(tx, { type: 'ANONYMOUS', userId: null, role: null, reason: null }, now, { action: 'client.created', entityType: 'Client', entityId: clientId, clientId, after: { source: 'SIGNUP' } });
    await this.mail.request(tx, {
      template: 'C_EMAIL_VERIFICATION',
      userId,
      clientId,
      to: email,
      link: { purpose: 'EMAIL_VERIFICATION', host: 'web', path: LINK_PATHS.verifyClient, payload: { next: input.next ?? null, simulationId: input.simulationId ?? null, signupKeyHash } },
    });
  }

  /**
   * AUTH-003 rows 2 to 8 (also AUTH-012 « Modifier mon adresse » towards a taken address): what an already known address
   * receives. Returns false when the address is unknown (row 1 applies). The e-mails follow the per-address limit;
   * beyond it nothing leaves (AUTH-005) — the screen never changes.
   */
  async knownAddress(tx: Tx, a: KnownAddressInput): Promise<boolean> {
    const now = this.clock.now();
    const client = await tx.client.findFirst({ where: { deletedAt: null, OR: [{ email: a.email }, { alternateEmails: { has: a.email } }] }, orderBy: { createdAt: 'asc' } });
    let user = await tx.user.findUnique({ where: { email: a.email } });
    if (!user && client?.userId) user = await tx.user.findUnique({ where: { id: client.userId } });
    if (user?.status === 'DELETED') user = null;
    if (!user && !client) return false;
    const send = () => this.limits.tryTake(a.req, 'signup', a.email);

    if (user) {
      if (user.status === 'SUSPENDED') return true; // row 8: nothing, no e-mail
      if (user.kind !== 'CLIENT') {
        // Row 7 (D-107) — the address is a partner's or a team member's: one address, one account (ACP-080). Its owner
        // is told, by e-mail only (the screen never changes), to use another address for a client space.
        if (send()) await this.mail.request(tx, { template: 'C_ACCOUNT_EXISTS', userId: user.id, to: a.email, vars: { action: { otherSpace: true } } });
        return true;
      }
      if (user.status === 'INVITED') {
        if (send()) await this.requestActivation(tx, user.id, a.email, client?.id ?? null, true, a.next);
        return true;
      }
      if (!user.emailVerifiedAt) {
        // Row 5 — a new verification link; the password typed is ignored.
        if (send()) {
          await this.mail.request(tx, {
            template: 'C_EMAIL_VERIFICATION',
            userId: user.id,
            to: a.email,
            link: { purpose: 'EMAIL_VERIFICATION', host: 'web', path: LINK_PATHS.verifyClient, payload: { next: a.next, simulationId: a.simulationId, signupKeyHash: a.signupKeyHash } },
          });
        }
        return true;
      }
      if (send()) await this.mail.request(tx, { template: 'C_ACCOUNT_EXISTS', userId: user.id, to: a.email }); // row 6
      return true;
    }

    // Row 2 (and 3, an alternate address) — a record without account: an INVITED account, without the typed password;
    // names, phone and boxes typed do not touch the record (they are asked again at activation).
    const userId = newId();
    await tx.user.create({
      data: {
        id: userId,
        kind: 'CLIENT',
        email: client!.email ?? a.email,
        firstName: client!.firstName,
        lastName: client!.lastName,
        phone: client!.phone,
        locale: client!.preferredLanguage,
        timezone: client!.timezone ?? 'Europe/Paris',
        status: 'INVITED',
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.client.update({ where: { id: client!.id }, data: { userId, updatedAt: now } });
    await tx.outboxEvent.create({
      data: { id: newId(), type: 'client.account_invited', aggregateType: 'Client', aggregateId: client!.id, payload: { reason: 'SIGNUP' } as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now },
    });
    if (send()) await this.requestActivation(tx, userId, a.email, client!.id, true, a.next);
    return true;
  }

  /** C_ACCOUNT_ACTIVATION — `fromSignup`: the « inscription » version (AUTH-003 rows 2 and 4). */
  async requestActivation(tx: Tx, userId: string, to: string, clientId: string | null, fromSignup: boolean, next: string | null): Promise<void> {
    await this.mail.request(tx, {
      template: 'C_ACCOUNT_ACTIVATION',
      userId,
      clientId,
      to,
      link: { purpose: 'ACCOUNT_ACTIVATION', host: 'web', path: LINK_PATHS.activation, payload: { fromSignup, next }, next },
      vars: { action: { fromSignup } },
    });
  }

  // ─── Verification (AUTH-012, AUTH-013) ────────────────────────────────────

  async verify(req: Request, res: Response, body: unknown): Promise<VerifyEmailResponse> {
    tokenPageHeaders(res);
    const audience = audienceOf(req, this.env);
    const parsed = verifyEmailRequestSchema.safeParse(body);
    if (!parsed.success) {
      const tokenOk = tokenRequestSchema.safeParse({ token: (body as { token?: unknown } | null)?.token });
      if (!tokenOk.success) throw new AppError(ErrorCode.GONE);
      throw AppError.validation([{ field: 'password', code: 'REQUIRED' }]);
    }
    const row = await this.tokens.find(parsed.data.token, 'EMAIL_VERIFICATION');
    if (!row?.userId) throw new AppError(ErrorCode.GONE);
    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: FLOW_USER_SELECT });
    if (!user || user.status === 'DELETED' || user.kind === 'STAFF') throw new AppError(ErrorCode.GONE);
    const loginPath = user.kind === 'PARTNER' ? '/partenaires/connexion' : '/connexion';
    if (user.emailVerifiedAt) return { status: 'ALREADY_VERIFIED', redirectTo: loginPath };
    if (!this.tokens.isAlive(row) || user.status !== 'ACTIVE') throw new AppError(ErrorCode.GONE);
    const kindAudience = user.kind === 'PARTNER' ? 'PARTNER' : 'WEB';
    if (audience !== kindAudience) throw new AppError(ErrorCode.GONE);

    const cookie = this.sessions.cookies.readSignup(req);
    const sameBrowser = Boolean(cookie && typeof row.payload.signupKeyHash === 'string' && sha256Hex(cookie) === row.payload.signupKeyHash);
    if (!sameBrowser) {
      // Opened elsewhere: the link proves the mailbox, not the choice of the password — ask for it.
      if (!parsed.data.password) return { status: 'PASSWORD_REQUIRED' };
      await this.auth.checkPassword(req, user.id, parsed.data.password, audience);
    }
    const now = this.clock.now();
    const updated = await this.prisma.$transaction(async (tx) => {
      if (!(await this.tokens.consume(row, tx))) throw new AppError(ErrorCode.GONE);
      const u = await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now, updatedAt: now }, select: FLOW_USER_SELECT });
      await this.tokens.killAll(user.id, ['EMAIL_VERIFICATION'], tx);
      if (user.kind === 'PARTNER') await this.auth.partnerVerified(tx, user.id, user.email, now);
      else await this.auth.activated(tx, user.id, user.email, now); // the first verification sends C_WELCOME
      return u;
    });
    this.mail.wake();
    return this.flow.continue(req, res, updated as FlowUser, {
      audience,
      rememberMe: false,
      viaPassword: !sameBrowser,
      next: (row.payload.next as string | null) ?? null,
      simulationId: (row.payload.simulationId as string | null) ?? null,
      simulationFromLink: true,
    });
  }

  /** AUTH-013 « Ce n'est pas moi » — `POST /auth/verify-email/disown`. */
  async disown(res: Response, body: unknown): Promise<void> {
    tokenPageHeaders(res);
    const parsed = tokenRequestSchema.safeParse(body);
    const row = parsed.success ? await this.tokens.find(parsed.data.token, 'EMAIL_VERIFICATION') : null;
    if (!row?.userId || !this.tokens.isAlive(row)) throw new AppError(ErrorCode.GONE);
    const userId = row.userId;
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, kind: true, status: true, emailVerifiedAt: true, createdAt: true } });
      if (!user || user.kind !== 'CLIENT' || user.emailVerifiedAt || user.status !== 'ACTIVE') throw new AppError(ErrorCode.GONE);
      if (!(await this.tokens.consume(row, tx))) throw new AppError(ErrorCode.GONE);
      await this.deleteAccount(tx, userId, now);
      const client = await tx.client.findFirst({ where: { userId }, select: { id: true, source: true, createdAt: true } });
      if (client) {
        await tx.simulation.updateMany({ where: { clientId: client.id, dossierId: null, leadId: null }, data: { clientId: null, updatedAt: now } });
        const attached = (await tx.lead.count({ where: { clientId: client.id } })) + (await tx.eventRegistration.count({ where: { clientId: client.id } }));
        const bornOfSignup = client.source === 'SIGNUP' && Math.abs(client.createdAt.getTime() - user.createdAt.getTime()) < 60_000;
        // The record born of this sign-up goes to the trash with its consents (TRV-096) — unless something joined it since.
        await tx.client.update({ where: { id: client.id }, data: { userId: null, ...(bornOfSignup && attached === 0 ? { deletedAt: now } : {}), updatedAt: now } });
      }
      await writeAudit(tx, { type: 'ANONYMOUS', userId: null, role: null, reason: null }, now, { action: 'auth.signup_disowned', entityType: 'User', entityId: userId });
    });
  }

  /** MOD-100 — a deleted account keeps its row, its personal fields erased; its tokens and sessions die. */
  async deleteAccount(tx: Tx, userId: string, now: Date): Promise<void> {
    await tx.user.update({
      where: { id: userId },
      data: {
        status: 'DELETED',
        email: `deleted+${userId}@invalid`,
        pendingEmail: null,
        firstName: null,
        lastName: null,
        phone: null,
        passwordHash: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
        updatedAt: now,
      },
    });
    await tx.authToken.updateMany({ where: { userId, usedAt: null }, data: { expiresAt: now, updatedAt: now } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, revokedReason: 'ADMIN', updatedAt: now } });
  }

  /** AUTH-012 « Renvoyer l'e-mail » (step EMAIL_VERIFICATION) and AUTH-013 « Recevoir un nouveau lien » (an address). */
  async resend(req: Request, body: unknown): Promise<SentResponse> {
    const audience = audienceOf(req, this.env);
    const input = parseOrThrow(resendVerificationRequestSchema, body ?? {});
    let user: { id: string; email: string; kind: string; status: string; emailVerifiedAt: Date | null } | null;
    if (input.email) {
      user = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true, email: true, kind: true, status: true, emailVerifiedAt: true } });
      this.limits.take(req, 'verify', input.email);
    } else {
      const step = await this.flow.readStep(req, audience, 'EMAIL_VERIFICATION');
      user = step.user;
      this.limits.take(req, 'verify', step.user.email);
    }
    const kindAudience = user?.kind === 'PARTNER' ? 'PARTNER' : 'WEB';
    if (user && user.status === 'ACTIVE' && !user.emailVerifiedAt && (user.kind === 'CLIENT' || user.kind === 'PARTNER') && kindAudience === audience) {
      const cookie = this.sessions.cookies.readSignup(req);
      const u = user;
      await this.prisma.$transaction((tx) =>
        this.mail.request(tx, {
          template: u.kind === 'PARTNER' ? 'P_PARTNER_EMAIL_VERIFICATION' : 'C_EMAIL_VERIFICATION',
          userId: u.id,
          to: u.email,
          link: { purpose: 'EMAIL_VERIFICATION', host: 'web', path: u.kind === 'PARTNER' ? LINK_PATHS.verifyPartner : LINK_PATHS.verifyClient, payload: { signupKeyHash: cookie ? sha256Hex(cookie) : null } },
          vars: { action: { addressInUse: false } },
        }),
      );
      this.mail.wake();
    }
    return { status: 'SENT' };
  }

  /** AUTH-012 « Modifier mon adresse » — an account with nothing else yet; the password proves the person. */
  async changeSignupEmail(req: Request, body: unknown): Promise<SentResponse & { email: string }> {
    const audience = audienceOf(req, this.env);
    const { user } = await this.flow.readStep(req, audience, 'EMAIL_VERIFICATION');
    const input = parseOrThrow(signupEmailRequestSchema, body);
    await this.auth.checkPassword(req, user.id, input.password, audience);
    this.limits.take(req, 'verify', input.email);
    const client = await this.prisma.client.findFirst({ where: { userId: user.id }, select: { id: true } });
    if (user.kind === 'CLIENT') {
      const busy = client ? (await this.prisma.lead.count({ where: { clientId: client.id } })) + (await this.prisma.dossier.count({ where: { clientId: client.id } })) : 0;
      if (busy > 0) throw AppError.conflictState('ACCOUNT_NOT_EMPTY');
    }
    if (input.email === user.email) return { status: 'SENT', email: input.email };
    const now = this.clock.now();
    const cookie = this.sessions.cookies.readSignup(req);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `lead:${input.email}`);
      const takenUser = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
      const takenClient = await tx.client.findFirst({ where: { deletedAt: null, id: { not: client?.id }, OR: [{ email: input.email }, { alternateEmails: { has: input.email } }] }, select: { id: true } });
      if (takenUser || takenClient) {
        // Nothing changes on the unverified account; the e-mail to the new address says what to do (AUTH-003).
        if (user.kind === 'CLIENT') await this.knownAddress(tx, { email: input.email, signupKeyHash: null, next: null, simulationId: null, ipHash: this.ip.fingerprint(req), req });
        else await this.mail.request(tx, { template: 'P_PARTNER_EMAIL_VERIFICATION', userId: null, to: input.email, vars: { action: { addressInUse: true } } });
        return;
      }
      await tx.user.update({ where: { id: user.id }, data: { email: input.email, updatedAt: now } });
      if (client) await tx.client.update({ where: { id: client.id }, data: { email: input.email, updatedAt: now } });
      if (user.kind === 'PARTNER') await tx.lead.updateMany({ where: { applicantUserId: user.id }, data: { email: input.email, updatedAt: now } });
      await this.tokens.killAll(user.id, ['EMAIL_VERIFICATION'], tx);
      await this.mail.request(tx, {
        template: user.kind === 'PARTNER' ? 'P_PARTNER_EMAIL_VERIFICATION' : 'C_EMAIL_VERIFICATION',
        userId: user.id,
        to: input.email,
        link: { purpose: 'EMAIL_VERIFICATION', host: 'web', path: user.kind === 'PARTNER' ? LINK_PATHS.verifyPartner : LINK_PATHS.verifyClient, payload: { signupKeyHash: cookie ? sha256Hex(cookie) : null } },
        vars: { action: { addressInUse: false } },
      });
    });
    this.mail.wake();
    // AUTH-012 — « Nous avons écrit à {nouvelle adresse}. », in every case.
    return { status: 'SENT', email: input.email };
  }

  // ─── Activation (AUTH-040) ────────────────────────────────────────────────

  async checkActivation(res: Response, body: unknown, next: string | null): Promise<ActivationCheckResponse> {
    tokenPageHeaders(res);
    const parsed = tokenRequestSchema.safeParse(body);
    const row = parsed.success ? await this.tokens.find(parsed.data.token, 'ACCOUNT_ACTIVATION') : null;
    const user = row?.userId ? await this.prisma.user.findUnique({ where: { id: row.userId }, select: { id: true, status: true, kind: true, firstName: true } }) : null;
    // The account's state comes first: an active space sends a found link — expired or not — to sign-in (MOD-105).
    if (user && user.kind === 'CLIENT' && user.status === 'ACTIVE') return { status: 'ACTIVE', next: next ?? '/espace-client' };
    if (!row || !user || user.kind !== 'CLIENT' || user.status !== 'INVITED' || !this.tokens.isAlive(row)) throw new AppError(ErrorCode.GONE);
    const client = await this.prisma.client.findFirst({ where: { userId: user.id }, select: { firstName: true } });
    return { status: 'VALID', firstName: client?.firstName ?? user.firstName, fromSignup: row.payload.fromSignup === true };
  }

  async activate(req: Request, res: Response, body: unknown, next: string | null): Promise<LoginResponse> {
    tokenPageHeaders(res);
    const audience = audienceOf(req, this.env);
    if (audience !== 'WEB') throw new AppError(ErrorCode.BAD_REQUEST);
    const raw = body as { token?: unknown } | null;
    const row = typeof raw?.token === 'string' ? await this.tokens.find(raw.token, 'ACCOUNT_ACTIVATION') : null;
    const user = row?.userId ? await this.prisma.user.findUnique({ where: { id: row.userId }, select: FLOW_USER_SELECT }) : null;
    if (!row || !user || user.kind !== 'CLIENT' || user.status !== 'INVITED' || !this.tokens.isAlive(row)) throw new AppError(ErrorCode.GONE);
    const input = parseOrThrow(activateRequestSchema, body);
    const client = await this.prisma.client.findFirst({ where: { userId: user.id }, select: { id: true, firstName: true, lastName: true } });
    const problem = passwordProblem(input.password, {
      minLength: await this.settings.get('security.password.minLength'),
      email: user.email,
      firstName: client?.firstName ?? user.firstName,
      lastName: client?.lastName ?? user.lastName,
    });
    if (problem) throw AppError.validation([problem]);
    const passwordHash = await hashPassword(input.password);
    const now = this.clock.now();
    const updated = await this.prisma.$transaction(async (tx) => {
      if (!(await this.tokens.consume(row, tx))) throw new AppError(ErrorCode.GONE);
      // MOD-105 — the first activation link used kills all the others.
      await this.tokens.killAll(user.id, ['ACCOUNT_ACTIVATION'], tx);
      const u = await tx.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', passwordHash, passwordChangedAt: now, emailVerifiedAt: user.emailVerifiedAt ?? now, updatedAt: now },
        select: FLOW_USER_SELECT,
      });
      await this.auth.writeTermsConsents(tx, { userId: user.id, clientId: client?.id ?? null, source: 'activation', wording: AuthConsentWording['auth.terms.v1'], req, now });
      if (input.marketingOptIn && client) {
        await tx.consent.create({
          data: { id: newId(), type: 'MARKETING_EMAIL', granted: true, userId: user.id, clientId: client.id, wording: LeadConsentWording[CURRENT_MARKETING_CONSENT_KEY].text, source: 'activation', givenAt: now, ipHash: this.ip.fingerprint(req), createdAt: now },
        });
        await tx.client.update({ where: { id: client.id }, data: { marketingOptIn: true, updatedAt: now } });
      }
      await this.auth.activated(tx, user.id, user.email, now);
      return u;
    });
    this.mail.wake();
    const target = next ?? (row.payload.next as string | null) ?? null;
    return this.flow.continue(req, res, updated as FlowUser, { audience: 'WEB', rememberMe: false, viaPassword: true, next: target, simulationId: null });
  }

  /** AUTH-040 « Recevoir un nouveau lien »: INVITED → an activation link; active → a sign-in link. Same sentence always. */
  async resendActivation(req: Request, body: unknown): Promise<SentResponse> {
    const { email, next } = parseOrThrow(emailOnlyRequestSchema, body);
    this.limits.take(req, 'verify', email);
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, kind: true, status: true, emailVerifiedAt: true } });
    if (user?.kind === 'CLIENT') {
      await this.prisma.$transaction(async (tx) => {
        const client = await tx.client.findFirst({ where: { userId: user.id }, select: { id: true } });
        if (user.status === 'INVITED') await this.requestActivation(tx, user.id, email, client?.id ?? null, false, next ?? null);
        else if (user.status === 'ACTIVE' && user.emailVerifiedAt) {
          await this.mail.request(tx, { template: 'C_MAGIC_LOGIN', userId: user.id, to: email, link: { purpose: 'MAGIC_LOGIN', host: 'web', path: LINK_PATHS.magic, payload: { next: next ?? null } } });
        }
      });
      this.mail.wake();
    }
    return { status: 'SENT' };
  }
}
