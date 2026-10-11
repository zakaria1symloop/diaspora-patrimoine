// Server-side reads of the client space (`/client/*`): the visitor's own cookies are forwarded, nothing is cached —
// these are private data (SEC-030). Never use the shared `apiGet` of lib/api.ts here: it is cached and anonymous.
// An expired access token (15 minutes) answers 401: the server cannot renew it (the cookies are the browser's), so the
// caller renders <SessionRenewal />, which renews in the browser and re-renders the page (AUTH-023, TRV-083).
import 'server-only';
import { headers } from 'next/headers';
import { API_PREFIX, isApiErrorBody } from '@dp/contracts';
import { env } from '@/lib/env';

export type SpaceRead<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string | null; reason: string | null };

export async function spaceGet<T>(path: string, searchParams?: Record<string, string | number | null | undefined>): Promise<SpaceRead<T>> {
  const url = new URL(`${API_PREFIX}${path}`, env().API_URL);
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  let res: Response;
  try {
    res = await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/json', 'accept-language': 'fr', ...(cookie ? { cookie } : {}), 'user-agent': h.get('user-agent') ?? 'web' },
    });
  } catch {
    return { ok: false, status: 0, code: null, reason: null };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.ok) return { ok: true, data: body as T };
  const err = isApiErrorBody(body) ? body.error : null;
  return { ok: false, status: res.status, code: err?.code ?? null, reason: err?.reason ?? null };
}

/** The session is gone or belongs to someone else: renew in the browser, or go back to the sign-in page. */
export function needsSession(r: SpaceRead<unknown>): boolean {
  return !r.ok && (r.status === 401 || r.status === 403);
}
