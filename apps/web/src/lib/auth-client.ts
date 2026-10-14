'use client';
// API-003, SEC-027 — the browser side of the session: every call goes through the site's own origin (`/api/v1`
// rewrite), with the session cookies (HttpOnly, never readable here) and, on a write, the anti-forgery token read from
// its readable cookie. A 401 on a session route renews the session once (`POST /auth/refresh`, one renewal at a time,
// shared between tabs by the cookies themselves) and replays the call.
import { AUDIENCE_HEADER, CSRF_HEADER, csrfCookieName, isApiErrorBody, type ApiErrorBody, type BrowserAudience } from '@dp/contracts';

export type DoorAudience = Extract<BrowserAudience, 'WEB' | 'PARTNER'>;

export type CallResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiErrorBody['error'] | null; offline?: boolean; retryAfter?: number };

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** The last gesture of the person (click, typing, navigation) — SEC-023: only gestures extend the idle deadline. */
let lastGesture = 0;
let lastRefresh = 0;
if (typeof window !== 'undefined') {
  const mark = () => {
    lastGesture = Date.now();
  };
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, mark, { passive: true, capture: true });
}

const refreshing = new Map<DoorAudience, Promise<boolean>>();

/** `POST /auth/refresh` — one at a time per space; true when the session is alive again. */
export function refreshSession(audience: DoorAudience = 'WEB'): Promise<boolean> {
  const current = refreshing.get(audience);
  if (current) return current;
  const run = (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
        headers: headers(audience, true),
        body: JSON.stringify({ userActive: lastGesture > lastRefresh }),
      });
      lastRefresh = Date.now();
      return res.ok;
    } catch {
      return false;
    } finally {
      setTimeout(() => refreshing.delete(audience), 0);
    }
  })();
  refreshing.set(audience, run);
  return run;
}

function headers(audience: DoorAudience, write: boolean, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json', ...extra };
  if (write) h['content-type'] = 'application/json';
  if (audience === 'PARTNER') h[AUDIENCE_HEADER] = 'PARTNER';
  const csrf = readCookie(csrfCookieName(audience));
  if (write && csrf) h[CSRF_HEADER] = csrf;
  return h;
}

export interface CallOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  audience?: DoorAudience;
  /** Renew the session once on a 401 (session routes). Off for the sign-in routes themselves. */
  retryOnAuth?: boolean;
  extraHeaders?: Record<string, string>;
}

const inFlight = new Map<string, Promise<CallResult<unknown>>>();

/**
 * One call to the API. Never throws: network cuts come back as `offline`. A write identical to one still on its way (a
 * double click, Enter pressed twice) is not sent again: it gets the answer of the first (D-107).
 */
export function apiCall<T>(path: string, opts: CallOptions = {}): Promise<CallResult<T>> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  if (method === 'GET') return callOnce<T>(path, opts);
  const key = `${method} ${opts.audience ?? 'WEB'} ${path} ${JSON.stringify(opts.body ?? null)}`;
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<CallResult<T>>;
  const run = callOnce<T>(path, opts).finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}

async function callOnce<T>(path: string, opts: CallOptions): Promise<CallResult<T>> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  const audience = opts.audience ?? 'WEB';
  const write = method !== 'GET';
  const send = () =>
    fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: headers(audience, write, opts.extraHeaders),
      body: opts.body === undefined ? (write ? '{}' : undefined) : JSON.stringify(opts.body),
    });
  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && opts.retryOnAuth && (await refreshSession(audience))) res = await send();
  } catch {
    return { ok: false, status: 0, error: null, offline: true };
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (res.ok) return { ok: true, status: res.status, data: json as T };
  return {
    ok: false,
    status: res.status,
    error: isApiErrorBody(json) ? json.error : null,
    retryAfter: Number(res.headers.get('Retry-After') ?? '') || undefined,
  };
}

/** SEC-026 — sign-out: the session is revoked server-side, the cookies cleared; then the space's door. */
export async function signOut(audience: DoorAudience = 'WEB'): Promise<void> {
  await apiCall('/auth/logout', { method: 'POST', audience });
  window.dispatchEvent(new Event('dp:session'));
}
