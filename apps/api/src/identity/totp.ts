// SEC-011 — time-based one-time codes (RFC 6238: SHA-1, 6 digits, 30 seconds, one step of tolerance before and after),
// a code already accepted is refused when replayed; ten recovery codes `k7m2p-x9q4t`, hashed like a token, single use.
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { AUTH_LIMITS } from '@dp/contracts';
import { safeEqual, sha256Hex } from './crypto.js';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_PERIOD_S = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new secret: 160 bits, base32. */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function stepAt(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_S);
}

export function totpCode(secretB32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', base32Decode(secretB32)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(bin % 1_000_000).padStart(6, '0');
}

/**
 * The accepted step for `code` (current step, one before, one after), or null. A step at or before `lastStep` is
 * refused: a code already accepted cannot be replayed (SEC-011).
 */
export function verifyTotp(secretB32: string, code: string, nowMs: number, lastStep: number | null | undefined): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = stepAt(nowMs);
  let matched: number | null = null;
  for (const s of [now - 1, now, now + 1]) {
    // Every candidate is computed and compared: no early exit on the timing of a match.
    if (safeEqual(totpCode(secretB32, s), code) && matched === null) matched = s;
  }
  if (matched === null) return null;
  if (lastStep !== null && lastStep !== undefined && matched <= lastStep) return null;
  return matched;
}

/** SEC-011 — `otpauth://totp/{issuer}:{email}?secret=…&issuer=…&algorithm=SHA1&digits=6&period=30`. */
export function otpauthUrl(issuer: string, email: string, secretB32: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
}

// ─── Recovery codes ─────────────────────────────────────────────────────────

const ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Ten codes of 10 characters `[a-z0-9]`, displayed in groups of 5 (`k7m2p-x9q4t`). */
export function newRecoveryCodes(): string[] {
  return Array.from({ length: AUTH_LIMITS.recoveryCodeCount }, () => {
    let c = '';
    for (let i = 0; i < 10; i++) c += ALNUM[randomInt(0, ALNUM.length)];
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
}

/** Stored fingerprint of a recovery code (hyphen and case ignored). */
export function recoveryHash(code: string): string {
  return sha256Hex(`dp_recovery:${code.toLowerCase().replace(/[\s-]+/g, '')}`);
}

/** `User.twoFactorRecoveryHashes` — active codes, codes waiting for « J'ai conservé mes codes », last accepted step. */
export interface TwoFactorState {
  codes: string[];
  pending?: string[];
  lastStep?: number | null;
}

export function readTwoFactorState(value: unknown): TwoFactorState {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Partial<TwoFactorState>;
    return { codes: Array.isArray(v.codes) ? v.codes.filter((c) => typeof c === 'string') : [], pending: Array.isArray(v.pending) ? v.pending : undefined, lastStep: typeof v.lastStep === 'number' ? v.lastStep : null };
  }
  if (Array.isArray(value)) return { codes: value.filter((c): c is string => typeof c === 'string'), lastStep: null };
  return { codes: [], lastStep: null };
}

/** Consumes a recovery code: the new state without it, or null when the code is not one of the active ones. */
export function useRecoveryCode(state: TwoFactorState, code: string): TwoFactorState | null {
  const h = recoveryHash(code);
  const found = state.codes.find((c) => safeEqual(c, h));
  if (!found) return null;
  return { ...state, codes: state.codes.filter((c) => c !== found) };
}
