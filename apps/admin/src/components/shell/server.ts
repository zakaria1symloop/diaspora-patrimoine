// Server-side reads of the back office (`/admin/*`): the staff member's own cookies are forwarded and NOTHING is cached —
// these are private data (SEC-030). An expired access token (15 minutes) answers 401: the server cannot renew it (the
// cookies are the browser's), so the page renders <ReadFailure />, which renews in the browser and re-renders (TRV-083).
//
//   const r = await adminGet<LeadList>('/admin/leads', { page: 1 });
//   if (!r.ok) return <ReadFailure result={r} />;      // 401 → renewal · 403 → « Vous n'avez pas accès » · 404 → not found
import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { API_PREFIX, isApiErrorBody, type AdminShell, type Permission } from '@dp/contracts';
import { env } from '@/lib/env';

export type AdminRead<T> = { ok: true; data: T } | { ok: false; status: number; code: string | null; reason: string | null; requestId: string | null };

export async function adminGet<T>(path: string, searchParams?: Record<string, string | number | boolean | null | undefined>): Promise<AdminRead<T>> {
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
      headers: { accept: 'application/json', 'accept-language': 'fr', ...(cookie ? { cookie } : {}), 'user-agent': h.get('user-agent') ?? 'admin' },
    });
  } catch {
    return { ok: false, status: 0, code: null, reason: null, requestId: null };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.ok) return { ok: true, data: body as T };
  const err = isApiErrorBody(body) ? body.error : null;
  return { ok: false, status: res.status, code: err?.code ?? null, reason: err?.reason ?? null, requestId: err?.requestId ?? null };
}

/** `GET /admin/me/shell` — read once per request (the layout and the page share the answer). */
export const getShell = cache(async (): Promise<AdminRead<AdminShell>> => adminGet<AdminShell>('/admin/me/shell'));

/**
 * ROL-023, BO-015 — true when the signed-in role holds the permission. The screens hide what the role cannot do; the
 * API still checks every route (ROL-020). A page calls it first and renders <Forbidden /> when it answers false.
 */
export async function hasPermission(permission: Permission): Promise<boolean> {
  const shell = await getShell();
  return shell.ok && shell.data.permissions.includes(permission);
}
