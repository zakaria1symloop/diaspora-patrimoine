// API-003, SEC-022, SEC-027, SEC-040 — what the identity routes read from and write to HTTP: the audience of a request,
// the session, step, device and sign-up cookies, the anti-forgery cookie, and the headers of token pages.
import { AUDIENCE_HEADER, authCookieName, Cookies, csrfCookieName, ErrorCode, usesHostPrefix, type BrowserAudience } from '@dp/contracts';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../config/env.js';
import { AppError } from '../platform/errors.js';

function originOf(req: Request): string | null {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin !== 'null') return origin;
  const referer = req.headers.referer;
  if (typeof referer === 'string') {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

const sameOrigin = (a: string | undefined, b: string | null) => {
  if (!a || !b) return false;
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
};

/** A private network host (RFC 1918 ranges, `*.local`): a colleague's browser reaching this machine on the LAN. */
const PRIVATE_HOST = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[a-z0-9-]+\.local)$/i;

/**
 * Local development only (`APP_ENV=local`): the same application opened through this machine's network address by
 * another developer — same port as the configured URL, private host. Never true in any deployed environment.
 */
const sameAppOnLan = (env: Env, configured: string | undefined, origin: string | null) => {
  if (env.APP_ENV !== 'local' || !configured || !origin) return false;
  try {
    const a = new URL(configured);
    const b = new URL(origin);
    return a.protocol === b.protocol && a.port === b.port && PRIVATE_HOST.test(b.hostname);
  } catch {
    return false;
  }
};

/**
 * API-003 — the audience of a request: `Origin` (else `Referer`) compared with WEB_URL (→ WEB, or PARTNER when the page
 * of the partner space says `X-Audience: PARTNER`) and ADMIN_URL (→ ADMIN). Nothing in the body chooses it; an unknown
 * origin answers 400 BAD_REQUEST. Being an origin check, it also refuses cross-site writes (SEC-027).
 */
export function audienceOf(req: Request, env: Env): BrowserAudience {
  const origin = originOf(req);
  const header = req.headers[AUDIENCE_HEADER.toLowerCase()];
  const wanted = Array.isArray(header) ? header[0] : header;
  if (sameOrigin(env.ADMIN_URL, origin) || sameAppOnLan(env, env.ADMIN_URL, origin)) {
    if (wanted && wanted !== 'ADMIN') throw new AppError(ErrorCode.BAD_REQUEST);
    return 'ADMIN';
  }
  if (sameOrigin(env.WEB_URL, origin) || sameAppOnLan(env, env.WEB_URL, origin)) {
    if (!wanted || wanted === 'WEB') return 'WEB';
    if (wanted === 'PARTNER') return 'PARTNER';
    throw new AppError(ErrorCode.BAD_REQUEST);
  }
  // A read without any origin information (a page served with `Referrer-Policy: no-referrer`, SEC-040, sends neither
  // header on a same-origin GET): it changes nothing, and SameSite=Lax keeps the cookies off cross-site requests.
  if (!origin && (req.method === 'GET' || req.method === 'HEAD')) {
    if (!wanted || wanted === 'WEB') return 'WEB';
    if (wanted === 'PARTNER') return 'PARTNER';
  }
  throw new AppError(ErrorCode.BAD_REQUEST);
}

export type CookieKind = 'access' | 'refresh' | 'step' | 'device';

export class AuthCookies {
  private readonly prefix: boolean;
  private readonly secure: boolean;

  constructor(env: Env) {
    this.prefix = usesHostPrefix(env.APP_ENV);
    this.secure = env.APP_ENV !== 'local';
  }

  name(audience: BrowserAudience, kind: CookieKind): string {
    return authCookieName(audience, kind, this.prefix);
  }

  read(req: Request, audience: BrowserAudience, kind: CookieKind): string | undefined {
    const v = (req.cookies as Record<string, unknown> | undefined)?.[this.name(audience, kind)];
    return typeof v === 'string' && v.length > 0 && v.length < 4000 ? v : undefined;
  }

  readCsrf(req: Request, audience: BrowserAudience): string | undefined {
    const v = (req.cookies as Record<string, unknown> | undefined)?.[csrfCookieName(audience)];
    return typeof v === 'string' ? v : undefined;
  }

  readSignup(req: Request): string | undefined {
    const v = (req.cookies as Record<string, unknown> | undefined)?.[Cookies.signup];
    return typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v) ? v : undefined;
  }

  /** SEC-022 — HttpOnly, Secure (outside local), SameSite=Lax, Path=/, no Domain (`__Host-`). `expires` absent: session cookie. */
  private opts(httpOnly: boolean, expires?: Date): CookieOptions {
    return { httpOnly, secure: this.secure, sameSite: 'lax', path: '/', ...(expires ? { expires } : {}) };
  }

  set(res: Response, audience: BrowserAudience, kind: CookieKind, value: string, expires?: Date): void {
    res.cookie(this.name(audience, kind), value, this.opts(true, expires));
  }

  clear(res: Response, audience: BrowserAudience, kind: CookieKind): void {
    res.clearCookie(this.name(audience, kind), this.opts(true));
  }

  /** SEC-027 — the anti-forgery token, readable by the page of its application. */
  setCsrf(res: Response, audience: BrowserAudience, value: string, expires?: Date): void {
    res.cookie(csrfCookieName(audience), value, this.opts(false, expires));
  }

  clearCsrf(res: Response, audience: BrowserAudience): void {
    res.clearCookie(csrfCookieName(audience), this.opts(false));
  }

  /** AUTH-013 — `dp_signup`, HttpOnly, 24 hours. */
  setSignup(res: Response, value: string, expires: Date): void {
    res.cookie(Cookies.signup, value, this.opts(true, expires));
  }

  clearSession(res: Response, audience: BrowserAudience): void {
    this.clear(res, audience, 'access');
    this.clear(res, audience, 'refresh');
    this.clearCsrf(res, audience);
  }
}

/** SEC-040 — answers about a link token: never cached, never referred. */
export function tokenPageHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

/** PRO-021 — a readable device label from the user agent (« Chrome sur Windows », « iPhone »). No fingerprinting. */
export function deviceLabel(ua: string | undefined): string | null {
  if (!ua) return null;
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null;
  if (os === 'iPhone' || os === 'iPad') return browser && browser !== 'Safari' ? `${browser} sur ${os}` : os;
  if (browser && os) return `${browser} sur ${os}`;
  return browser ?? os ?? null;
}
