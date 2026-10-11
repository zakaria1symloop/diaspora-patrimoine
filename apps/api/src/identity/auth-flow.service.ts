// AUTH-022, AUTH-026, BO-003 — what happens once the person is proven (password, link, code): the remaining steps in
// the order of AUTH-022 (two-factor · staff first sign-in · address to verify · terms), each one a step token (an
// HttpOnly cookie of 10 minutes bound to the account and the step, `AuthToken` LOGIN_CHALLENGE) that opens no data,
// only the routes of its step; when nothing remains, the session opens.
import { Inject, Injectable } from '@nestjs/common';
import { AUTH_LIMITS, ErrorCode, type BrowserAudience, type LoginResponse, type NextStep, type StaffSetupStep } from '@dp/contracts';
import type { Request, Response } from 'express';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { anonymousIdOf, attachSavedSimulation } from './anonymous-data.js';
import { SessionsService } from './sessions.service.js';
import { TokensService, TOKEN_TTL_MS, type TokenRow } from './tokens.service.js';

export interface StepPayload {
  step: NextStep;
  audience: BrowserAudience;
  rememberMe: boolean;
  viaPassword: boolean;
  next: string | null;
  simulationId: string | null;
  /** The simulation id came from a verification link (SIM-032): no `dp_anon` check. */
  simulationFromLink?: boolean;
  twoFactorDone?: boolean;
  /** BO-003 — step token obtained through the invitation link: `…/password` always allowed. */
  fromInvitation?: boolean;
  invitationTokenId?: string | null;
  passwordDone?: boolean;
}

export type FlowUser = {
  id: string;
  kind: 'CLIENT' | 'STAFF' | 'PARTNER';
  email: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
  lastLoginAt: Date | null;
  locale: string;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  twoFactorEnabled: boolean;
  charterAcceptedAt: Date | null;
};

export const FLOW_USER_SELECT = {
  id: true,
  kind: true,
  email: true,
  status: true,
  firstName: true,
  lastName: true,
  lastLoginAt: true,
  locale: true,
  passwordHash: true,
  emailVerifiedAt: true,
  twoFactorEnabled: true,
  charterAcceptedAt: true,
} as const;

/** The home of each space (AUTH-023: the page asked for, else here). */
export function homeOf(audience: BrowserAudience): string {
  return audience === 'WEB' ? '/espace-client' : audience === 'PARTNER' ? '/partenaires/connexion' : '/';
}

/** The audience a kind of account belongs to (ROL-004). */
export function audienceOfKind(kind: FlowUser['kind']): BrowserAudience {
  return kind === 'CLIENT' ? 'WEB' : kind === 'PARTNER' ? 'PARTNER' : 'ADMIN';
}

@Injectable()
export class AuthFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly tokens: TokensService,
    private readonly sessions: SessionsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** AUTH-090, MOD-420 — never accepted, or a newer version in force that requires re-acceptance. */
  async termsStatus(userId: string): Promise<{ needed: boolean; firstAcceptance: boolean }> {
    const now = this.clock.now();
    let needed = false;
    let first = false;
    for (const type of ['TERMS_OF_USE', 'PRIVACY_POLICY'] as const) {
      const accepted = await this.prisma.consent.findFirst({
        where: { userId, type, granted: true },
        orderBy: { givenAt: 'desc' },
        select: { documentVersion: true },
      });
      if (!accepted) {
        needed = true;
        first = true;
        continue;
      }
      const acceptedDoc = accepted.documentVersion
        ? await this.prisma.legalDocument.findFirst({ where: { type, locale: 'fr', version: accepted.documentVersion }, select: { effectiveAt: true } })
        : null;
      const newer = await this.prisma.legalDocument.findFirst({
        where: {
          type,
          locale: 'fr',
          publishedAt: { not: null, lte: now },
          effectiveAt: { lte: now, ...(acceptedDoc ? { gt: acceptedDoc.effectiveAt } : {}) },
          requiresReacceptance: true,
          ...(accepted.documentVersion ? { version: { not: accepted.documentVersion } } : {}),
        },
        select: { id: true },
      });
      if (newer) needed = true;
    }
    return { needed, firstAcceptance: first };
  }

  /** BO-003 — the steps left of a staff first sign-in, deduced from the account. */
  async staffRemaining(user: FlowUser, payload: Partial<StepPayload>): Promise<StaffSetupStep[]> {
    const steps: StaffSetupStep[] = [];
    if (!user.passwordHash || (payload.fromInvitation && !payload.passwordDone)) steps.push('PASSWORD');
    if ((await this.settings.get('security.staff.twoFactorRequired')) && !user.twoFactorEnabled) steps.push('TWO_FACTOR');
    if (!user.charterAcceptedAt) steps.push('CHARTER');
    return steps;
  }

  /** AUTH-022 — the next step for this account, or null when the session can open. */
  async nextStep(user: FlowUser, p: Pick<StepPayload, 'audience' | 'twoFactorDone' | 'fromInvitation' | 'passwordDone'>): Promise<NextStep | null> {
    if (user.kind === 'STAFF' && p.fromInvitation) return (await this.staffRemaining(user, p)).length > 0 ? 'STAFF_SETUP' : null;
    if (user.twoFactorEnabled && !p.twoFactorDone) return 'TWO_FACTOR';
    if (user.kind === 'STAFF' && p.audience === 'ADMIN' && (user.status === 'INVITED' || (await this.staffRemaining(user, p)).length > 0)) return 'STAFF_SETUP';
    if ((user.kind === 'CLIENT' || user.kind === 'PARTNER') && !user.emailVerifiedAt) return 'EMAIL_VERIFICATION';
    if (user.kind === 'CLIENT' && (await this.termsStatus(user.id)).needed) return 'TERMS';
    return null;
  }

  /** Continues a sign-in: a step token, or the session. `current` is the step token being used, consumed on success. */
  async continue(req: Request, res: Response, user: FlowUser, payload: Omit<StepPayload, 'step'>, current?: TokenRow): Promise<LoginResponse> {
    const step = await this.nextStep(user, payload);
    if (step) return this.issueStep(res, user, { ...payload, step });
    if (current) await this.tokens.consume(current);
    this.sessions.cookies.clear(res, payload.audience, 'step');
    // AUTH-020, SIM-032 — the simulation to save joins the client record.
    if (user.kind === 'CLIENT' && payload.simulationId) {
      const client = await this.prisma.client.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
      if (client) {
        await this.prisma.$transaction((tx) =>
          attachSavedSimulation(tx, {
            clientId: client.id,
            simulationId: payload.simulationId,
            anonymousId: anonymousIdOf(req),
            trustLink: payload.simulationFromLink === true,
            now: this.clock.now(),
          }),
        );
      }
    }
    const redirectTo = payload.next ?? (user.kind === 'CLIENT' && payload.simulationId ? '/espace-client/simulations' : homeOf(payload.audience));
    return this.sessions.open(req, res, {
      user: { id: user.id, kind: user.kind, email: user.email, status: user.status, firstName: user.firstName, lastName: user.lastName, lastLoginAt: user.lastLoginAt, locale: user.locale },
      audience: payload.audience,
      rememberMe: payload.rememberMe,
      viaPassword: payload.viaPassword,
      redirectTo,
    });
  }

  /** AUTH-026 — `200` without session: the step and its cookie. A new step token kills the previous one (MOD-105). */
  async issueStep(res: Response, user: FlowUser, payload: StepPayload): Promise<LoginResponse> {
    const { token, expiresAt } = await this.tokens.issue({ purpose: 'LOGIN_CHALLENGE', userId: user.id, email: user.email, payload: payload as unknown as Record<string, unknown> });
    this.sessions.cookies.set(res, payload.audience, 'step', token, expiresAt);
    res.setHeader('Cache-Control', 'no-store');
    return this.describe(user, payload, 0);
  }

  async describe(user: FlowUser, payload: StepPayload, attempts: number): Promise<LoginResponse> {
    const out: LoginResponse = { status: 'STEP', nextStep: payload.step };
    if (payload.step === 'EMAIL_VERIFICATION') out.email = user.email;
    if (payload.step === 'TERMS') out.firstAcceptance = (await this.termsStatus(user.id)).firstAcceptance;
    if (payload.step === 'TWO_FACTOR') out.remainingAttempts = AUTH_LIMITS.maxCodeAttempts - attempts;
    if (payload.step === 'STAFF_SETUP') out.remainingSteps = await this.staffRemaining(user, payload);
    return out;
  }

  /** The step token of this request for `step` (401 when absent or dead: « Votre connexion a expiré. Recommencez. »). */
  async readStep(req: Request, audience: BrowserAudience, step: NextStep | NextStep[]): Promise<{ row: TokenRow; payload: StepPayload; user: FlowUser }> {
    const raw = this.sessions.cookies.read(req, audience, 'step');
    const row = await this.tokens.find(raw, 'LOGIN_CHALLENGE');
    const steps = Array.isArray(step) ? step : [step];
    if (!row || !this.tokens.isAlive(row) || !row.userId) throw new AppError(ErrorCode.UNAUTHENTICATED, { reason: 'STEP_EXPIRED' });
    const payload = row.payload as unknown as StepPayload;
    if (payload.audience !== audience) throw new AppError(ErrorCode.UNAUTHENTICATED, { reason: 'STEP_EXPIRED' });
    if (!steps.includes(payload.step)) throw new AppError(ErrorCode.FORBIDDEN);
    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: FLOW_USER_SELECT });
    if (!user || user.status === 'DELETED' || user.status === 'SUSPENDED') throw new AppError(ErrorCode.UNAUTHENTICATED, { reason: 'STEP_EXPIRED' });
    return { row, payload, user: user as FlowUser };
  }

  /** The step token lifetime (for the docs of the responses). */
  get stepTtlMs(): number {
    return TOKEN_TTL_MS.LOGIN_CHALLENGE;
  }

  /** Back to a session payload from a step payload. */
  carry(payload: StepPayload): Omit<StepPayload, 'step'> {
    const { step: _step, ...rest } = payload;
    return rest;
  }
}
