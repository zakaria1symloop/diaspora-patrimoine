// SEC-020 — the access token: signed (HS256, JWT_SIGNING_KEY), 15 minutes, carrying the account id, its kind, the
// audience and the session id. Its session is checked on every use (SEC-024): a revoked session refuses it.
import { createHmac } from 'node:crypto';
import { safeEqual } from './crypto.js';

export const ACCESS_TOKEN_MINUTES = 15;

export interface AccessClaims {
  /** `User.id` */
  sub: string;
  kind: 'CLIENT' | 'STAFF' | 'PARTNER';
  aud: 'WEB' | 'ADMIN' | 'PARTNER' | 'MOBILE';
  /** `Session.id` */
  sid: string;
  iat: number;
  exp: number;
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const HEADER = b64({ alg: 'HS256', typ: 'JWT' });

export function signAccessToken(key: string, claims: AccessClaims): string {
  const body = `${HEADER}.${b64(claims)}`;
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}

/** The claims of a valid, unexpired token of this audience; null otherwise (no reason given to the caller). */
export function verifyAccessToken(key: string, token: string | undefined, audience: AccessClaims['aud'], nowMs: number): AccessClaims | null {
  if (!token || token.length > 2000) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== HEADER) return null;
  const expected = createHmac('sha256', key).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  if (!safeEqual(expected, parts[2]!)) return null;
  let claims: AccessClaims;
  try {
    claims = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as AccessClaims;
  } catch {
    return null;
  }
  if (claims.aud !== audience || typeof claims.exp !== 'number' || claims.exp * 1000 <= nowMs) return null;
  if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string') return null;
  return claims;
}
