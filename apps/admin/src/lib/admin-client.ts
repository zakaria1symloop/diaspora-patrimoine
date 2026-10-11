'use client';
// API-003, SEC-027, TRV-083, TRV-115, BO-005 — the browser side of the back office: every call goes through the
// application's own origin (`/api/v1` rewrite), with the session cookies (HttpOnly, never readable here) and, on a
// write, the anti-forgery token read from its readable cookie (`dp_admin_csrf` → `X-CSRF-Token`).
//
//   const r = await adminCall<TeamMember>('/admin/users/invite', { body });        // a write (POST by default with a body)
//   const r = await adminCall<LeadList>('/admin/leads', { query: { page: 2 } });   // a read
//   if (!r.ok) show(errorText(r));                                                 // never throws
//
// What it does for every screen:
//   · 401 on a session route → the session is renewed once (`POST /auth/refresh`) and the call replayed; if it cannot be
//     renewed, the shell asks to sign in again WITHOUT leaving the screen, then replays the call (TRV-083);
//   · 403 `REAUTH_REQUIRED` → the shell asks for the password (« Confirmez votre mot de passe pour continuer. »), then
//     replays the call (BO-005);
//   · a READ that meets a network cut or a 502/503/504 is retried alone after 1, 3 and 10 seconds (TRV-115); a WRITE is
//     never retried silently.
import { CSRF_HEADER, csrfCookieName, isApiErrorBody, type ApiErrorBody, type SessionResponse } from '@dp/contracts';
import { newUuid } from '@dp/ui';

export type ApiError = ApiErrorBody['error'];

export type CallResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiError | null; offline?: boolean; aborted?: boolean; retryAfter?: number };

export interface CallOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  /** Off for the sign-in routes themselves: a 401 there is an answer, not an expired session. */
  session?: boolean;
  /** TRV-091 — a form that CREATES sends the key generated when it opened. */
  idempotencyKey?: string;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

// ─── Gestures (SEC-023: only the person's gestures extend the idle deadline) ─

let lastGesture = Date.now();
let lastRefresh = 0;
if (typeof window !== 'undefined') {
  const mark = () => {
    lastGesture = Date.now();
  };
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, mark, { passive: true, capture: true });
}
export const lastGestureAt = () => lastGesture;
export const lastRefreshAt = () => lastRefresh;

function headers(write: boolean, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json', ...extra };
  if (write) {
    h['content-type'] = 'application/json';
    const csrf = readCookie(csrfCookieName('ADMIN'));
    if (csrf) h[CSRF_HEADER] = csrf;
  }
  return h;
}

/** The pages that carry a token send no referrer (SEC-040): the origin alone is sent, so the API knows the audience (API-003). */
const REFERRER: RequestInit = { referrerPolicy: 'strict-origin', credentials: 'same-origin' };

// ─── Session renewal ────────────────────────────────────────────────────────

let refreshing: Promise<SessionResponse | null> | null = null;

/** `POST /auth/refresh` — one at a time; the deadlines of the session, or null when it is over. */
export function refreshSession(forceActive = false): Promise<SessionResponse | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', { ...REFERRER, method: 'POST', headers: headers(true), body: JSON.stringify({ userActive: forceActive || lastGesture > lastRefresh }) });
      if (!res.ok) return null;
      lastRefresh = Date.now();
      const data = (await res.json()) as SessionResponse;
      window.dispatchEvent(new CustomEvent('dp:session-renewed', { detail: data }));
      return data;
    } catch {
      return null;
    } finally {
      setTimeout(() => {
        refreshing = null;
      }, 0);
    }
  })();
  return refreshing;
}

// ─── What the shell provides (sign in again in place, confirm the password) ──

type Gate = () => Promise<boolean>;
const gates: { relogin: Gate | null; reauth: Gate | null } = { relogin: null, reauth: null };
export function setSessionGates(next: { relogin?: Gate | null; reauth?: Gate | null }): void {
  if (next.relogin !== undefined) gates.relogin = next.relogin;
  if (next.reauth !== undefined) gates.reauth = next.reauth;
}

const RETRY_READ_AFTER = [1000, 3000, 10_000];
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

async function once<T>(path: string, opts: CallOptions): Promise<CallResult<T>> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  const write = method !== 'GET';
  const url = new URL(`/api/v1${path}`, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url, {
      ...REFERRER,
      method,
      headers: headers(write, opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      body: opts.body === undefined ? (write ? '{}' : undefined) : JSON.stringify(opts.body),
      signal: opts.signal,
      cache: 'no-store',
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return { ok: false, status: 0, error: null, aborted: true };
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
  return { ok: false, status: res.status, error: isApiErrorBody(json) ? json.error : null, retryAfter: Number(res.headers.get('Retry-After') ?? '') || undefined };
}

/** One call to the API. Never throws: a network cut comes back as `offline`, an aborted call as `aborted`. */
export async function adminCall<T>(path: string, opts: CallOptions = {}): Promise<CallResult<T>> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  const session = opts.session ?? true;
  let result = await once<T>(path, opts);

  // TRV-115 — reads only: three silent retries on a cut or a gateway error.
  if (method === 'GET') {
    for (const delay of RETRY_READ_AFTER) {
      if (result.ok || result.aborted) break;
      const transient = result.offline || [502, 504].includes(result.status) || (result.status === 503 && result.error?.code !== 'MAINTENANCE');
      if (!transient) break;
      await wait(delay, opts.signal);
      if (opts.signal?.aborted) return { ok: false, status: 0, error: null, aborted: true };
      result = await once<T>(path, opts);
    }
  }
  if (result.ok || !session) return result;

  // TRV-083 — session expired: renew once; else sign in again in place; then replay.
  if (result.status === 401 && result.error?.code === 'UNAUTHENTICATED') {
    if (await refreshSession()) return once<T>(path, opts);
    if (gates.relogin && (await gates.relogin())) return once<T>(path, opts);
    return result;
  }
  // BO-005 — the password was typed more than 15 minutes ago: confirm it, then replay.
  if (result.status === 403 && result.error?.reason === 'REAUTH_REQUIRED' && gates.reauth) {
    if (await gates.reauth()) return once<T>(path, opts);
  }
  return result;
}

/** TRV-105 — « Se déconnecter » also forgets what the lists remembered in this browser (`dp_list_*`). */
export function forgetListMemory(): void {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('dp_list_')) localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/** SEC-026 — sign-out: the session is revoked server-side, the cookies cleared; then the door. */
export async function signOut(): Promise<void> {
  await once('/auth/logout', { method: 'POST' });
  forgetListMemory();
  window.location.assign('/connexion');
}

/** TRV-091 — a key for a form that creates something, generated when the form opens. */
export function newIdempotencyKey(): string {
  return newUuid();
}
