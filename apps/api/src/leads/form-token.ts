// DEM-030 point 2 — signed form token, handed out when a form opens, that dates the opening (a submission less than
// 3 seconds later is suspect: FAST_SUBMIT). Valid 24 hours (DEM-040: an expired token is renewed silently by the form).
// Format: base64url(JSON {f, o, e, n}) "." base64url(HMAC-SHA256(LINK_SIGNING_KEY, "dp_form:" + payload)).
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { FORM_TOKEN_HOURS } from '@dp/contracts';

export interface FormTokenClaims {
  form: string;
  openedAt: number;
  expiresAt: number;
  /** Random id: keys the challenge attempts of DEM-030 point 4. */
  nonce: string;
}

const mac = (key: string, payload: string) => createHmac('sha256', key).update(`dp_form:${payload}`).digest('base64url');

export function signFormToken(key: string, form: string, now: Date): { token: string; expiresAt: Date } {
  const expiresAt = new Date(now.getTime() + FORM_TOKEN_HOURS * 3600_000);
  const claims = { f: form, o: now.getTime(), e: expiresAt.getTime(), n: randomBytes(9).toString('base64url') };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return { token: `${payload}.${mac(key, payload)}`, expiresAt };
}

export type FormTokenCheck = { ok: true; claims: FormTokenClaims } | { ok: false; reason: 'MISSING' | 'INVALID' | 'EXPIRED' };

export function verifyFormToken(key: string, token: string | undefined, now: Date): FormTokenCheck {
  if (!token) return { ok: false, reason: 'MISSING' };
  const [payload, signature] = token.split('.');
  if (!payload || !signature || token.length > 600) return { ok: false, reason: 'INVALID' };
  const expected = Buffer.from(mac(key, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'INVALID' };
  let raw: { f?: unknown; o?: unknown; e?: unknown; n?: unknown };
  try {
    raw = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as typeof raw;
  } catch {
    return { ok: false, reason: 'INVALID' };
  }
  if (typeof raw.f !== 'string' || typeof raw.o !== 'number' || typeof raw.e !== 'number' || typeof raw.n !== 'string') {
    return { ok: false, reason: 'INVALID' };
  }
  if (raw.e <= now.getTime()) return { ok: false, reason: 'EXPIRED' };
  return { ok: true, claims: { form: raw.f, openedAt: raw.o, expiresAt: raw.e, nonce: raw.n } };
}
