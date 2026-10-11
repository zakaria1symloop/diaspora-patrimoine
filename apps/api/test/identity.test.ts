// Package 1.6 — unit tests of the identity primitives: hashing (SEC-010), password rules (AUTH-002), TOTP and recovery
// codes (SEC-011), access tokens (SEC-020), application encryption (MOD-016), return paths (AUTH-023), lockout
// (AUTH-032), e-mail limits (SEC-070), the permission matrix (ROL-022, SEC-034) and the access guard (SEC-030).
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isPermission, isSafeNextPath, PERMISSIONS, roleHasPermission, type StaffRole } from '@dp/contracts';
import { FixedClock } from '../src/platform/clock.js';
import { AppError } from '../src/platform/errors.js';
import { RateLimiter, type ClientIp } from '../src/platform/rate-limit.js';
import type { SettingsService } from '../src/platform/settings.service.js';
import { signAccessToken, verifyAccessToken } from '../src/identity/access-token.js';
import { ACCESS_KEY, AccessGuard, familyOf, PERMISSION_KEY } from '../src/identity/access.js';
import { decryptSecret, encryptSecret, keyRingFrom } from '../src/identity/crypto.js';
import { LoginAttemptsService } from '../src/identity/login-attempts.service.js';
import { MailLimits } from '../src/identity/mail-limits.js';
import { hashPassword, needsRehash, passwordProblem, verifyPassword } from '../src/identity/password.js';
import type { AuthContext, SessionsService } from '../src/identity/sessions.service.js';
import { newRecoveryCodes, readTwoFactorState, recoveryHash, totpCode, useRecoveryCode, verifyTotp } from '../src/identity/totp.js';
import { CatalogueAdminController } from '../src/catalogue-admin/catalogue-admin.controller.js';
import { EventsAdminController } from '../src/events-admin/events-admin.controller.js';

const now = new Date('2026-10-09T10:00:00Z');

describe('SEC-010 password hashing', () => {
  it('hashes with Argon2id 19 MiB / 2 passes / 1 lane, verifies, refuses a wrong password', async () => {
    const h = await hashPassword('une phrase de passe 2026');
    expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(h, 'une phrase de passe 2026')).toBe(true);
    expect(await verifyPassword(h, 'une phrase de passe 2027')).toBe(false);
    expect(needsRehash(h)).toBe(false);
    expect(needsRehash('$argon2id$v=19$m=4096,t=3,p=1$abc$def')).toBe(true);
  });
  it('burns the same work without any stored hash and answers false', async () => {
    expect(await verifyPassword(null, 'whatever')).toBe(false);
  });
});

describe('AUTH-002 password rules', () => {
  const ctx = { minLength: 10, email: 'karima.benali@example.test', firstName: 'Karima', lastName: 'Benali' };
  it('10 characters at least, 128 at most', () => {
    expect(passwordProblem('court', ctx)?.code).toBe('TOO_SHORT');
    expect(passwordProblem('x'.repeat(129), ctx)?.code).toBe('TOO_LONG');
  });
  it('refuses a common password, a run, the name or the address', () => {
    expect(passwordProblem('azertyuiop', ctx)).toMatchObject({ code: 'WEAK_PASSWORD', params: { reason: 'COMMON' } });
    expect(passwordProblem('1234567890', ctx)).toMatchObject({ code: 'WEAK_PASSWORD', params: { reason: 'COMMON' } });
    expect(passwordProblem('aaaaaaaaaaaa', ctx)).toMatchObject({ code: 'WEAK_PASSWORD' });
    expect(passwordProblem('Karima-aime-la-mer', ctx)).toMatchObject({ code: 'WEAK_PASSWORD', params: { reason: 'PERSONAL' } });
    expect(passwordProblem('ma maison benali 2026', ctx)).toMatchObject({ params: { reason: 'PERSONAL' } });
  });
  it('no composition rule: a long phrase passes', () => {
    expect(passwordProblem('une maison au bord de la mer', ctx)).toBeNull();
  });
});

describe('SEC-011 TOTP and recovery codes', () => {
  // RFC 6238 test secret « 12345678901234567890 » (SHA-1); T = 59 s → 94287082 (8 digits) → 287082 (6 digits).
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  it('matches the RFC 6238 vector', () => {
    expect(totpCode(secret, 1)).toBe('287082');
  });
  it('accepts one step before and after, refuses beyond, refuses a replay', () => {
    const t = 1_000_000 * 30_000;
    const step = Math.floor(t / 30_000);
    expect(verifyTotp(secret, totpCode(secret, step - 1), t, null)).toBe(step - 1);
    expect(verifyTotp(secret, totpCode(secret, step + 1), t, null)).toBe(step + 1);
    expect(verifyTotp(secret, totpCode(secret, step + 2), t, null)).toBeNull();
    expect(verifyTotp(secret, totpCode(secret, step), t, step)).toBeNull(); // already accepted
  });
  it('ten codes k7m2p-x9q4t, each usable once', () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    for (const c of codes) expect(c).toMatch(/^[a-z0-9]{5}-[a-z0-9]{5}$/);
    const state = { codes: codes.map(recoveryHash), lastStep: null };
    const after = useRecoveryCode(state, codes[3]!.toUpperCase().replace('-', ' '));
    expect(after?.codes).toHaveLength(9);
    expect(useRecoveryCode(after!, codes[3]!)).toBeNull();
    expect(readTwoFactorState(null)).toEqual({ codes: [], lastStep: null });
  });
});

describe('SEC-020 access token', () => {
  const key = 'k'.repeat(40);
  const claims = { sub: 'u1', kind: 'CLIENT' as const, aud: 'WEB' as const, sid: 's1', iat: 0, exp: Math.floor(now.getTime() / 1000) + 900 };
  it('verifies its signature, audience and expiry', () => {
    const tok = signAccessToken(key, claims);
    expect(verifyAccessToken(key, tok, 'WEB', now.getTime())?.sid).toBe('s1');
    expect(verifyAccessToken(key, tok, 'ADMIN', now.getTime())).toBeNull();
    expect(verifyAccessToken('x'.repeat(40), tok, 'WEB', now.getTime())).toBeNull();
    expect(verifyAccessToken(key, tok, 'WEB', now.getTime() + 901_000)).toBeNull();
    expect(verifyAccessToken(key, tok.slice(0, -2) + 'aa', 'WEB', now.getTime())).toBeNull();
  });
});

describe('MOD-016 application encryption', () => {
  it('AES-256-GCM with the key id, decryptable by a retired key', () => {
    const old = keyRingFrom({ ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'), ENCRYPTION_KEY_ID: 'k1' });
    const sealed = encryptSecret(old, 'JBSWY3DPEHPK3PXP');
    expect(sealed.startsWith('v1.k1.')).toBe(true);
    const renewed = keyRingFrom({ ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'), ENCRYPTION_KEY_ID: 'k2', ENCRYPTION_KEYS_RETIRED: `k1:${Buffer.alloc(32, 1).toString('base64')}` });
    expect(decryptSecret(renewed, sealed)).toBe('JBSWY3DPEHPK3PXP');
    // Tampered data: the FIRST character of the ciphertext changes (its six bits all count; the last character of a
    // base64url segment carries unused bits, so replacing it does not always change a byte).
    const parts = sealed.split('.');
    parts[4] = (parts[4]![0] === 'A' ? 'B' : 'A') + parts[4]!.slice(1);
    expect(() => decryptSecret(renewed, parts.join('.'))).toThrow();
  });
});

describe('AUTH-023 return path', () => {
  it('accepts internal paths only', () => {
    expect(isSafeNextPath('/espace-client/dossier?x=1')).toBe(true);
    for (const bad of ['//evil.example', '/\\evil', 'https://evil.example', 'javascript:alert(1)', '/javascript:x', '', 'espace']) expect(isSafeNextPath(bad)).toBe(false);
  });
});

const fakeIp = { hash: () => 'ip1', keyHash: (v: string) => `h:${v}`, fingerprint: () => 'f'.repeat(64) } as unknown as ClientIp;

describe('AUTH-032 lockout', () => {
  const settings = { get: async (k: string) => ({ 'security.login.maxAttempts': 5, 'security.login.lockMinutes': 15 })[k] } as unknown as SettingsService;
  it('locks an unknown address after 5 failures, the same as an account (memory counter)', async () => {
    const clock = new FixedClock(now);
    const svc = new LoginAttemptsService({} as never, clock, settings, new RateLimiter(clock), fakeIp);
    for (let i = 0; i < 4; i++) expect((await svc.fail(null, 'nobody@example.test', { key: null, recognised: false })).code).toBe('INVALID_CREDENTIALS');
    const fifth = await svc.fail(null, 'nobody@example.test', { key: null, recognised: false });
    expect(fifth.code).toBe('ACCOUNT_LOCKED');
    expect(fifth.options.params).toMatchObject({ minutes: 15 });
    expect((await svc.lockFor(null, 'nobody@example.test', false))?.code).toBe('ACCOUNT_LOCKED');
    clock.set(new Date(now.getTime() + 16 * 60_000));
    expect(await svc.lockFor(null, 'nobody@example.test', false)).toBeNull();
  });
  it('a locked account is refused, except from a recognised device', async () => {
    const clock = new FixedClock(now);
    const svc = new LoginAttemptsService({} as never, clock, settings, new RateLimiter(clock), fakeIp);
    const user = { id: 'u1', lockedUntil: new Date(now.getTime() + 60_000) };
    expect((await svc.lockFor(user, 'a@example.test', false))?.code).toBe('ACCOUNT_LOCKED');
    expect(await svc.lockFor(user, 'a@example.test', true)).toBeNull();
  });
  it('counts account failures in the database and locks at the fifth', async () => {
    const clock = new FixedClock(now);
    let count = 0;
    let lockedUntil: Date | null = null;
    const tx = {
      user: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          if (data.failedLoginCount && typeof data.failedLoginCount === 'object') count += 1;
          if (data.lockedUntil) lockedUntil = data.lockedUntil as Date;
          if (data.failedLoginCount === 0) count = 0;
          return { failedLoginCount: count };
        },
      },
      auditLog: { create: async () => ({}) },
    };
    const prisma = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) };
    const svc = new LoginAttemptsService(prisma as never, clock, settings, new RateLimiter(clock), fakeIp);
    const codes: string[] = [];
    for (let i = 0; i < 5; i++) codes.push((await svc.fail({ id: 'u1' }, 'a@example.test', { key: null, recognised: false })).code);
    expect(codes).toEqual(['INVALID_CREDENTIALS', 'INVALID_CREDENTIALS', 'INVALID_CREDENTIALS', 'INVALID_CREDENTIALS', 'ACCOUNT_LOCKED']);
    expect(lockedUntil).toEqual(new Date(now.getTime() + 15 * 60_000));
  });
  it('20 attempts per IP and 10 minutes', () => {
    const clock = new FixedClock(now);
    const svc = new LoginAttemptsService({} as never, clock, settings, new RateLimiter(clock), fakeIp);
    for (let i = 0; i < 20; i++) svc.countIp({} as never);
    expect(() => svc.countIp({} as never)).toThrow(AppError);
  });
});

describe('SEC-070 e-mail limits', () => {
  it('1 per address and minute, 3 per hour', () => {
    const clock = new FixedClock(now);
    const limits = new MailLimits(new RateLimiter(clock), fakeIp);
    const req = {} as never;
    limits.take(req, 'forgot', 'a@example.test');
    expect(() => limits.take(req, 'forgot', 'a@example.test')).toThrow(AppError);
    clock.set(new Date(now.getTime() + 61_000));
    limits.take(req, 'forgot', 'a@example.test');
    clock.set(new Date(now.getTime() + 122_000));
    limits.take(req, 'forgot', 'a@example.test');
    clock.set(new Date(now.getTime() + 183_000));
    expect(limits.tryTake(req, 'forgot', 'a@example.test')).toBe(false); // the fourth in the hour
    expect(limits.tryTake(req, 'forgot', 'b@example.test')).toBe(true); // another address
  });
});

describe('ROL-022 permission matrix (SEC-034)', () => {
  const roles: StaffRole[] = ['OWNER', 'ADMIN', 'AGENT', 'VIEWER', 'SUPPORT'];
  it('OWNER holds every permission; the samples of § 4 hold', () => {
    for (const p of Object.keys(PERMISSIONS)) expect(roleHasPermission('OWNER', p as never)).toBe(true);
    expect(roleHasPermission('ADMIN', 'settings.sensitive.manage')).toBe(false);
    expect(roleHasPermission('ADMIN', 'user.twofactor.reset')).toBe(false);
    expect(roleHasPermission('AGENT', 'client.merge')).toBe(false);
    expect(roleHasPermission('AGENT', 'lead.read')).toBe(true);
    expect(roleHasPermission('VIEWER', 'client.sensitive.read')).toBe(false);
    expect(roleHasPermission('SUPPORT', 'settings.read')).toBe(true);
    expect(roleHasPermission('SUPPORT', 'message.read')).toBe(false);
    expect(roleHasPermission('AGENT', 'catalogue.write')).toBe(false);
    expect(roleHasPermission('AGENT', 'catalogue.write', (k) => k === 'access.agentCanEditCatalogue')).toBe(true);
    expect(roleHasPermission('AGENT', 'catalogue.publish', () => true)).toBe(false);
  });
  it('every back-office route declares a permission of the matrix (SEC-030)', () => {
    const reflector = new Reflector();
    for (const ctrl of [CatalogueAdminController, EventsAdminController]) {
      for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
        if (name === 'constructor') continue;
        const handler = (ctrl.prototype as unknown as Record<string, unknown>)[name] as () => void;
        const permission = reflector.get<string>(PERMISSION_KEY, handler);
        expect(permission, `${ctrl.name}.${name}`).toBeTruthy();
        expect(isPermission(permission)).toBe(true);
        expect(reflector.get(ACCESS_KEY, handler)).toMatchObject({ audience: 'ADMIN', kind: 'STAFF' });
      }
    }
    expect(roles).toHaveLength(5);
  });
});

describe('SEC-030 access guard', () => {
  const staff = (role: string): AuthContext => ({
    userId: 'u1', kind: 'STAFF', audience: 'ADMIN', sessionId: 's1', email: 'x@example.test', firstName: null, lastName: null, role, clientId: null,
    passwordConfirmedAt: now, actor: { type: 'USER', userId: 'u1', role, reason: null }, refreshTokenHash: 'h', previousRefreshTokenHash: null, rotatedAt: null,
  });
  function guard(ctx: AuthContext | null, csrfOk = true) {
    const sessions = { authenticate: async () => ctx, csrfValid: () => csrfOk } as unknown as SessionsService;
    const settings = { all: async () => ({}) } as unknown as SettingsService;
    return new AccessGuard(new Reflector(), sessions, settings, new FixedClock(now));
  }
  function context(path: string, method: string, handler: () => void, cls: object): ExecutionContext {
    const req = { path, method } as Record<string, unknown>;
    return { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler, getClass: () => cls } as unknown as ExecutionContext;
  }
  const publish = CatalogueAdminController.prototype.publishProgram as unknown as () => void;
  const code = async (p: Promise<unknown>) => p.then(() => 'OK', (e: AppError) => e.code);

  it('no session: 401; wrong role: 403; right role: allowed; write without anti-forgery token: 403', async () => {
    expect(await code(guard(null).canActivate(context('/api/v1/admin/programs/x/publish', 'POST', publish, CatalogueAdminController)))).toBe('UNAUTHENTICATED');
    expect(await code(guard(staff('AGENT')).canActivate(context('/api/v1/admin/programs/x/publish', 'POST', publish, CatalogueAdminController)))).toBe('FORBIDDEN');
    expect(await code(guard(staff('ADMIN')).canActivate(context('/api/v1/admin/programs/x/publish', 'POST', publish, CatalogueAdminController)))).toBe('OK');
    expect(await code(guard(staff('ADMIN'), false).canActivate(context('/api/v1/admin/programs/x/publish', 'POST', publish, CatalogueAdminController)))).toBe('FORBIDDEN');
  });
  it('a client session never passes a staff route; an undeclared protected route is refused', async () => {
    const client = { ...staff('OWNER'), kind: 'CLIENT' as const, role: null };
    expect(await code(guard(client).canActivate(context('/api/v1/admin/programs/x/publish', 'POST', publish, CatalogueAdminController)))).toBe('FORBIDDEN');
    class Undeclared {
      handler() {}
    }
    expect(await code(guard(staff('OWNER')).canActivate(context('/api/v1/admin/secret', 'GET', Undeclared.prototype.handler, Undeclared)))).toBe('FORBIDDEN');
    expect(await code(guard(null).canActivate(context('/api/v1/public/home', 'GET', Undeclared.prototype.handler, Undeclared)))).toBe('OK');
    expect(familyOf('/api/v1/client/me')).toBe('client');
    expect(familyOf('/api/v1/partners')).toBe('other');
  });
});
