// SEC-010, AUTH-002 — password hashing (Argon2id, 19 MiB, 2 passes, 1 lane, salt per password) and the choice rules:
// `security.password.minLength` (10) to 128 characters, no composition rule, refused when common (embedded list of the
// 10 000 most frequent) or when it contains the e-mail address, the first name or the last name.
import { hash, verify } from '@node-rs/argon2';
import type { ApiErrorDetail } from '@dp/contracts';
import { AUTH_LIMITS } from '@dp/contracts';
import { COMMON_PASSWORDS_SOURCE } from './common-passwords.js';

/** SEC-010 — reviewed every year; a hash made with older parameters is rehashed at the next sign-in. */
/** `algorithm: 2` is Argon2id (the library's const enum cannot be imported under isolatedModules). */
export const ARGON2_PARAMS = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

let common: Set<string> | null = null;
function commonPasswords(): Set<string> {
  common ??= new Set(COMMON_PASSWORDS_SOURCE.split('\n'));
  return common;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_PARAMS);
}

/** A fixed hash verified when there is no account or no password: the answer takes the same time (AUTH-021, SEC-071). */
let dummyHash: Promise<string> | null = null;
function dummy(): Promise<string> {
  dummyHash ??= hash('dp-timing-equaliser-not-a-password', ARGON2_PARAMS);
  return dummyHash;
}

/** Verifies `password` against `stored`; with no stored hash, burns the same time and answers false. */
export async function verifyPassword(stored: string | null | undefined, password: string): Promise<boolean> {
  if (!stored) {
    await verify(await dummy(), password).catch(() => false);
    return false;
  }
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

/** SEC-010 — true when the stored hash was made with other parameters than the current ones. */
export function needsRehash(stored: string): boolean {
  const m = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(stored);
  if (!m) return true;
  return Number(m[1]) !== ARGON2_PARAMS.memoryCost || Number(m[2]) !== ARGON2_PARAMS.timeCost || Number(m[3]) !== ARGON2_PARAMS.parallelism;
}

export interface PasswordContext {
  minLength: number;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/**
 * AUTH-002 — the field error of a new password, or null. Codes (TRV-064): `TOO_SHORT` {n}, `TOO_LONG` {n},
 * `WEAK_PASSWORD` {reason: COMMON | PERSONAL} — the screen picks the sentence of AUTH-002 from the reason.
 */
export function passwordProblem(password: string, ctx: PasswordContext, field = 'password'): ApiErrorDetail | null {
  const length = [...password].length;
  if (length < ctx.minLength) return { field, code: 'TOO_SHORT', params: { n: ctx.minLength, min: ctx.minLength } };
  if (length > AUTH_LIMITS.passwordMaxLength) return { field, code: 'TOO_LONG', params: { n: AUTH_LIMITS.passwordMaxLength, max: AUTH_LIMITS.passwordMaxLength } };
  const folded = fold(password);
  if (commonPasswords().has(password.toLowerCase()) || commonPasswords().has(folded)) return { field, code: 'WEAK_PASSWORD', params: { reason: 'COMMON' } };
  // Same character repeated, or a plain run like 1234567890 / abcdefghij: as weak as a listed one.
  if (/^(.)\1+$/u.test(password) || isSequence(folded)) return { field, code: 'WEAK_PASSWORD', params: { reason: 'COMMON' } };
  const personal: string[] = [];
  if (ctx.email) {
    const e = fold(ctx.email);
    personal.push(e);
    const local = e.split('@')[0];
    if (local && local.length >= 3) personal.push(local);
  }
  for (const name of [ctx.firstName, ctx.lastName]) {
    if (!name) continue;
    for (const part of fold(name).split(/[\s'’.-]+/)) if (part.length >= 3) personal.push(part);
  }
  if (personal.some((p) => folded.includes(p))) return { field, code: 'WEAK_PASSWORD', params: { reason: 'PERSONAL' } };
  return null;
}

function isSequence(s: string): boolean {
  if (s.length < 6) return false;
  const codes = [...s].map((c) => c.codePointAt(0)!);
  const step = codes[1]! - codes[0]!;
  if (Math.abs(step) !== 1) return false;
  return codes.every((c, i) => i === 0 || c - codes[i - 1]! === step);
}
