// Server-side reads of the public API (ARC-040): cached with tags, 60 s lifetime, invalidated by the API.
// Behind the gate (NAV-064) the site signs its own gate cookie: the visitor already passed the proxy check,
// and the cached response stays anonymous.
import 'server-only';
import { API_PREFIX, Cookies, isApiErrorBody, type ApiErrorBody } from '@dp/contracts';
import { env } from './env';
import { signGate } from './gate';

export type CacheTag = 'home' | 'catalogue' | 'events' | 'content' | 'settings' | `property:${string}` | `program:${string}`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
  ) {
    super(body?.error.code ?? `HTTP_${status}`);
  }
  get code(): string {
    return this.body?.error.code ?? 'INTERNAL_ERROR';
  }
  get requestId(): string | null {
    return this.body?.error.requestId ?? null;
  }
}

async function gateHeader(): Promise<Record<string, string>> {
  const password = env().SITE_GATE_PASSWORD;
  if (!password) return {};
  const value = await signGate(password, Date.now() + 3_600_000);
  return { cookie: `${Cookies.gate}=${value}` };
}

interface ReadOptions {
  tags?: CacheTag[];
  /** Seconds; ARC-040 bounds every page to 60 s. 0 = never cached (counters re-read on each display, NAV-042). */
  revalidate?: number;
  searchParams?: Record<string, string | number | undefined | null>;
}

export async function apiGet<T>(path: string, opts: ReadOptions = {}): Promise<T> {
  const url = new URL(`${API_PREFIX}${path}`, env().API_URL);
  for (const [k, v] of Object.entries(opts.searchParams ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const revalidate = opts.revalidate ?? 60;
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'accept-language': 'fr', ...(await gateHeader()) },
    ...(revalidate === 0 ? { cache: 'no-store' as const } : { next: { revalidate, tags: opts.tags ?? [] } }),
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, isApiErrorBody(body) ? body : null);
  }
  return (await res.json()) as T;
}
