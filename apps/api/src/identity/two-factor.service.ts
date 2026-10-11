// SEC-011, PRO-020, BO-070, BO-003 — the second factor of an account: enrolment in three gestes (setup → a pending
// secret and its QR code; confirm → a code of the new application, ten new recovery codes; enable → « J'ai conservé mes
// codes de secours », the pending secret and codes replace the old ones), verification at sign-in (replay refused),
// recovery codes (single use), deactivation. The secret is encrypted by the application (MOD-016).
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode, type RecoveryCodesResponse, type TwoFactorSetupResponse } from '@dp/contracts';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { decryptSecret, encryptSecret, keyRingFrom, type KeyRing } from './crypto.js';
import {
  newRecoveryCodes,
  newTotpSecret,
  otpauthUrl,
  qrSvg,
  readTwoFactorState,
  recoveryHash,
  useRecoveryCode,
  verifyTotp,
  type TwoFactorState,
} from './totp.js';

interface TwoFactorUser {
  id: string;
  email: string;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorPendingSecret: string | null;
  twoFactorRecoveryHashes: unknown;
}

const SELECT = { id: true, email: true, twoFactorEnabled: true, twoFactorSecret: true, twoFactorPendingSecret: true, twoFactorRecoveryHashes: true } as const;

@Injectable()
export class TwoFactorService {
  private readonly ring: KeyRing;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    @Inject(ENV) env: Env,
  ) {
    this.ring = keyRingFrom(env);
  }

  private async load(userId: string): Promise<TwoFactorUser> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: SELECT });
    if (!u) throw AppError.notFound();
    return u;
  }

  /** Setup: a new pending secret (any previous pending one is dropped, BO-070). */
  async setup(userId: string): Promise<TwoFactorSetupResponse> {
    const u = await this.load(userId);
    const secret = newTotpSecret();
    const state = readTwoFactorState(u.twoFactorRecoveryHashes);
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorPendingSecret: encryptSecret(this.ring, secret), twoFactorRecoveryHashes: { ...state, pending: undefined } as never, updatedAt: this.clock.now() },
    });
    const issuer = await this.settings.get('contact.companyName');
    const url = otpauthUrl(issuer, u.email, secret);
    return { secret, otpauthUrl: url, qrSvg: await qrSvg(url) };
  }

  /** Confirm: a code of the NEW application; returns the ten new codes, effective only at `enable`. */
  async confirm(userId: string, code: string): Promise<RecoveryCodesResponse> {
    const u = await this.load(userId);
    if (!u.twoFactorPendingSecret) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    const secret = decryptSecret(this.ring, u.twoFactorPendingSecret);
    const step = verifyTotp(secret, code, this.clock.now().getTime(), null);
    if (step === null) throw new AppError(ErrorCode.INVALID_CODE, { params: { remaining: null } });
    const codes = newRecoveryCodes();
    const state = readTwoFactorState(u.twoFactorRecoveryHashes);
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorRecoveryHashes: { ...state, pending: codes.map(recoveryHash), pendingStep: step } as never, updatedAt: this.clock.now() },
    });
    return { recoveryCodes: codes };
  }

  /** Enable: the pending secret and codes replace the current ones. Returns whether it was a reconfiguration. */
  async enable(userId: string, tx?: Tx): Promise<{ reconfigured: boolean }> {
    const db = tx ?? this.prisma;
    const u = await db.user.findUnique({ where: { id: userId }, select: SELECT });
    if (!u) throw AppError.notFound();
    const state = readTwoFactorState(u.twoFactorRecoveryHashes) as TwoFactorState & { pendingStep?: number };
    const raw = u.twoFactorRecoveryHashes as { pendingStep?: number } | null;
    if (!u.twoFactorPendingSecret || !state.pending?.length) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    await db.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: u.twoFactorPendingSecret,
        twoFactorPendingSecret: null,
        twoFactorRecoveryHashes: { codes: state.pending, lastStep: raw?.pendingStep ?? null } as never,
        updatedAt: this.clock.now(),
      },
    });
    return { reconfigured: u.twoFactorEnabled };
  }

  /** AUTH-050 — a code of the application at sign-in (or for a sensitive action): accepted step recorded (no replay). */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const u = await this.load(userId);
    if (!u.twoFactorEnabled || !u.twoFactorSecret) return false;
    const state = readTwoFactorState(u.twoFactorRecoveryHashes);
    const step = verifyTotp(decryptSecret(this.ring, u.twoFactorSecret), code, this.clock.now().getTime(), state.lastStep);
    if (step === null) return false;
    const done = await this.prisma.user.updateMany({
      where: { id: userId, twoFactorRecoveryHashes: { equals: u.twoFactorRecoveryHashes as never } },
      data: { twoFactorRecoveryHashes: { ...state, lastStep: step } as never },
    });
    return done.count === 1;
  }

  /** AUTH-050 — a recovery code serves once. */
  async useRecovery(userId: string, code: string): Promise<boolean> {
    const u = await this.load(userId);
    if (!u.twoFactorEnabled) return false;
    const state = readTwoFactorState(u.twoFactorRecoveryHashes);
    const next = useRecoveryCode(state, code);
    if (!next) return false;
    const done = await this.prisma.user.updateMany({
      where: { id: userId, twoFactorRecoveryHashes: { equals: u.twoFactorRecoveryHashes as never } },
      data: { twoFactorRecoveryHashes: next as never },
    });
    return done.count === 1;
  }

  /** PRO-020 — new recovery codes now; the old ones die. */
  async regenerate(userId: string): Promise<RecoveryCodesResponse> {
    const u = await this.load(userId);
    if (!u.twoFactorEnabled) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    const codes = newRecoveryCodes();
    const state = readTwoFactorState(u.twoFactorRecoveryHashes);
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorRecoveryHashes: { ...state, codes: codes.map(recoveryHash), pending: undefined } as never, updatedAt: this.clock.now() } });
    return { recoveryCodes: codes };
  }

  /** Deactivation (by the client, PRO-020; by an administrator, CRM-070; reset of a staff member, ADM-032). */
  async disable(userId: string, tx?: Tx): Promise<void> {
    await (tx ?? this.prisma).user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null, twoFactorRecoveryHashes: undefined, updatedAt: this.clock.now() },
    });
    await (tx ?? this.prisma).$executeRawUnsafe(`UPDATE users SET two_factor_recovery_hashes = NULL WHERE id = $1::uuid`, userId);
  }
}
