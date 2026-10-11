// BO-003, CYC-200 — first sign-in of an invited staff member: password (AUTH-002), mandatory second factor (PRO-020
// steps), charter (`admin.charter`, `User.charterAcceptedAt`). No screen of the back office before the three: only the
// step token STAFF_SETUP. The invitation link is consumed by the last step, when the account becomes ACTIVE.
import { Inject, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  staffSetupCharterRequestSchema,
  staffSetupPasswordRequestSchema,
  staffSetupTwoFactorRequestSchema,
  tokenRequestSchema,
  type LoginResponse,
  type RecoveryCodesResponse,
  type StaffSetupStateResponse,
  type TwoFactorSetupResponse,
} from '@dp/contracts';
import type { Request, Response } from 'express';
import { writeAudit } from '../admin/audit.js';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { parseOrThrow } from '../platform/validation.js';
import { AuthFlowService, FLOW_USER_SELECT, type FlowUser, type StepPayload } from './auth-flow.service.js';
import { audienceOf, tokenPageHeaders } from './http.js';
import { hashPassword, passwordProblem } from './password.js';
import { TokensService } from './tokens.service.js';
import { TwoFactorService } from './two-factor.service.js';

@Injectable()
export class StaffSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly flow: AuthFlowService,
    private readonly tokens: TokensService,
    private readonly twoFactor: TwoFactorService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private requireAdmin(req: Request): void {
    if (audienceOf(req, this.env) !== 'ADMIN') throw new AppError(ErrorCode.BAD_REQUEST);
  }

  /** `POST /auth/staff-setup/start` — invitation link → step token; 410 when unknown, expired or consumed. */
  async start(req: Request, res: Response, body: unknown): Promise<LoginResponse> {
    tokenPageHeaders(res);
    this.requireAdmin(req);
    const parsed = tokenRequestSchema.safeParse(body);
    const row = parsed.success ? await this.tokens.find(parsed.data.token, 'STAFF_INVITATION') : null;
    if (!row?.userId || !this.tokens.isAlive(row)) throw new AppError(ErrorCode.GONE);
    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: FLOW_USER_SELECT });
    if (!user || user.kind !== 'STAFF' || user.status === 'DELETED' || user.status === 'SUSPENDED') throw new AppError(ErrorCode.GONE);
    return this.flow.issueStep(res, user as FlowUser, {
      step: 'STAFF_SETUP',
      audience: 'ADMIN',
      rememberMe: false,
      viaPassword: false,
      next: null,
      simulationId: null,
      fromInvitation: true,
      invitationTokenId: row.id,
      passwordDone: false,
    });
  }

  async state(req: Request): Promise<StaffSetupStateResponse> {
    this.requireAdmin(req);
    const { payload, user } = await this.flow.readStep(req, 'ADMIN', 'STAFF_SETUP');
    const remaining = await this.flow.staffRemaining(user, payload);
    const membership = await this.prisma.membership.findFirst({ where: { userId: user.id, revokedAt: null }, select: { role: true } });
    let charter: string | null = null;
    if (remaining.includes('CHARTER')) {
      const block = await this.prisma.contentBlock.findFirst({ where: { key: 'admin.charter', locale: 'fr' }, select: { value: true } });
      charter = typeof block?.value === 'string' ? block.value : block?.value ? JSON.stringify(block.value) : null;
    }
    return { remainingSteps: remaining, firstName: user.firstName, role: membership?.role ?? null, charter };
  }

  /** `…/password` — only while the account has none, or with a step token from the invitation link (BO-003). */
  async password(req: Request, res: Response, body: unknown): Promise<LoginResponse> {
    this.requireAdmin(req);
    const { row, payload, user } = await this.flow.readStep(req, 'ADMIN', 'STAFF_SETUP');
    const allowed = !user.passwordHash || (payload.fromInvitation && !payload.passwordDone);
    if (!allowed) throw new AppError(ErrorCode.FORBIDDEN);
    const { password } = parseOrThrow(staffSetupPasswordRequestSchema, body);
    const problem = passwordProblem(password, { minLength: await this.settings.get('security.password.minLength'), email: user.email, firstName: user.firstName, lastName: user.lastName });
    if (problem) throw AppError.validation([problem]);
    const now = this.clock.now();
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: now, updatedAt: now } });
    return this.advance(req, res, row, { ...payload, passwordDone: true, viaPassword: true });
  }

  /** `…/two-factor` — SETUP (secret, QR code) · CONFIRM (a code → ten recovery codes) · ENABLE (« J'ai conservé mes codes »). */
  async twoFactorStep(req: Request, res: Response, body: unknown): Promise<TwoFactorSetupResponse | RecoveryCodesResponse | LoginResponse> {
    this.requireAdmin(req);
    const { row, payload, user } = await this.flow.readStep(req, 'ADMIN', 'STAFF_SETUP');
    const remaining = await this.flow.staffRemaining(user, payload);
    if (remaining[0] === 'PASSWORD' || !remaining.includes('TWO_FACTOR')) throw new AppError(ErrorCode.FORBIDDEN);
    const input = parseOrThrow(staffSetupTwoFactorRequestSchema, body);
    if (input.action === 'SETUP') return this.twoFactor.setup(user.id);
    if (input.action === 'CONFIRM') return this.twoFactor.confirm(user.id, input.code);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await this.twoFactor.enable(user.id, tx);
      await writeAudit(tx, { type: 'USER', userId: user.id, role: null, reason: null }, now, { action: 'auth.two_factor_enabled', entityType: 'User', entityId: user.id });
    });
    return this.advance(req, res, row, { ...payload, twoFactorDone: true });
  }

  async charter(req: Request, res: Response, body: unknown): Promise<LoginResponse> {
    this.requireAdmin(req);
    const { row, payload, user } = await this.flow.readStep(req, 'ADMIN', 'STAFF_SETUP');
    const remaining = await this.flow.staffRemaining(user, payload);
    if (remaining[0] !== 'CHARTER') throw new AppError(ErrorCode.FORBIDDEN);
    parseOrThrow(staffSetupCharterRequestSchema, body);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { charterAcceptedAt: now, updatedAt: now } });
      await writeAudit(tx, { type: 'USER', userId: user.id, role: null, reason: null }, now, { action: 'user.charter_accepted', entityType: 'User', entityId: user.id });
    });
    return this.advance(req, res, row, { ...payload, twoFactorDone: payload.twoFactorDone ?? false });
  }

  /** A step done: the next one (the step token's payload is renewed), or — nothing left — the account becomes ACTIVE. */
  private async advance(req: Request, res: Response, row: { id: string }, payload: StepPayload): Promise<LoginResponse> {
    const user = (await this.prisma.user.findUniqueOrThrow({ where: { id: (await this.prisma.authToken.findUniqueOrThrow({ where: { id: row.id } })).userId! }, select: FLOW_USER_SELECT })) as FlowUser;
    const remaining = await this.flow.staffRemaining(user, payload);
    if (remaining.length > 0) {
      await this.prisma.authToken.update({ where: { id: row.id }, data: { payload: payload as never } });
      return this.flow.describe(user, payload, 0);
    }
    const now = this.clock.now();
    const finished = await this.prisma.$transaction(async (tx) => {
      // CYC-200 — the last step consumes the invitation; the account is active, its address proven, the membership accepted.
      await tx.authToken.updateMany({ where: { userId: user.id, purpose: 'STAFF_INVITATION', usedAt: null }, data: { usedAt: now, updatedAt: now } });
      await tx.membership.updateMany({ where: { userId: user.id, revokedAt: null, acceptedAt: null }, data: { acceptedAt: now, updatedAt: now } });
      return tx.user.update({ where: { id: user.id }, data: { status: 'ACTIVE', emailVerifiedAt: user.emailVerifiedAt ?? now, updatedAt: now }, select: FLOW_USER_SELECT });
    });
    return this.flow.continue(req, res, finished as FlowUser, { ...this.flow.carry(payload), fromInvitation: false, twoFactorDone: true }, { id: row.id } as never);
  }
}
