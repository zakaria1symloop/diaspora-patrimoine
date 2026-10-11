// Runs before every page: URL normalisation (NAV-002), the gate (NAV-064), maintenance (NAV-061),
// and the indexing header (NAV-030). The API enforces the same barriers on its side (ARC-013).
import { NextResponse, type NextRequest } from 'next/server';
import { verifyGate } from './lib/gate';

const GATE_COOKIE = 'dp_gate';
const NOT_GATED = [/^\/partage\//]; // NAV-064: the bank download page is never behind the gate.
const ALWAYS_OPEN_IN_MAINTENANCE = [/^\/partage\//, /^\/preferences\//, /^\/alertes\/[^/]+\/arreter$/];

// SEC-040 — pages that carry a token in their address: never cached, never referred.
const TOKEN_PAGES = /^\/(?:apercu|verification|nouvelle-adresse|reinitialisation|activation|invitation|connexion\/lien|partenaires\/verification|partenaires\/reinitialisation)\/[^/]+$/;
// AUTH-023 — the client space: without a session cookie, the sign-in page, which brings the person back here.
const CLIENT_SPACE = /^\/espace-client(?:\/|$)/;

interface Flags {
  at: number;
  allowIndexing: boolean;
  maintenance: boolean;
}
let flags: Flags | null = null;

async function readFlags(): Promise<Flags> {
  if (flags && Date.now() - flags.at < 30_000) return flags;
  try {
    const res = await fetch(`${process.env.API_URL ?? 'http://localhost:4000'}/api/v1/public/settings/public`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    const body = (await res.json()) as Record<string, unknown>;
    flags = {
      at: Date.now(),
      allowIndexing: body['seo.allowIndexing'] === true,
      maintenance: body['maintenance.enabled'] === true,
    };
  } catch {
    flags = { at: Date.now(), allowIndexing: false, maintenance: false };
  }
  return flags;
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // NAV-002 — lower case, no trailing slash: one 301.
  // The token pages keep their address as it is: the token (base64url) is case-sensitive (SEC-040).
  let normalised = TOKEN_PAGES.test(pathname.toLowerCase()) ? pathname.replace(/^(\/[^]*?\/)([^/]+)$/, (_, head: string, tok: string) => head.toLowerCase() + tok) : pathname.toLowerCase();
  if (normalised.length > 1 && normalised.endsWith('/')) normalised = normalised.replace(/\/+$/, '');
  if (normalised !== pathname) {
    const url = req.nextUrl.clone();
    url.pathname = normalised;
    return NextResponse.redirect(url, 301);
  }

  const appEnv = process.env.APP_ENV ?? 'local';
  const password = process.env.SITE_GATE_PASSWORD;
  const f = await readFlags();
  const noindex = appEnv !== 'production' || !f.allowIndexing || Boolean(password);

  let res: NextResponse;
  const gated =
    password && !NOT_GATED.some((r) => r.test(pathname)) && !(await verifyGate(password, req.cookies.get(GATE_COOKIE)?.value));
  if (gated) {
    // The waiting page answers 200 on every address, which keeps its URL (NAV-064).
    const url = req.nextUrl.clone();
    url.pathname = '/attente';
    url.search = '';
    url.searchParams.set('suite', pathname + search);
    res = NextResponse.rewrite(url);
  } else if (f.maintenance && !ALWAYS_OPEN_IN_MAINTENANCE.some((r) => r.test(pathname))) {
    const url = req.nextUrl.clone();
    url.pathname = '/maintenance';
    url.search = '';
    res = NextResponse.rewrite(url, { status: 503 });
    res.headers.set('Retry-After', '600');
  } else if (CLIENT_SPACE.test(pathname) && !req.cookies.get(`${appEnv === 'local' ? '' : '__Host-'}dp_web_refresh`)) {
    const url = req.nextUrl.clone();
    url.pathname = '/connexion';
    url.search = '';
    url.searchParams.set('suite', pathname + search);
    return NextResponse.redirect(url, 302);
  } else {
    res = NextResponse.next();
  }
  if (TOKEN_PAGES.test(pathname)) {
    res.headers.set('Referrer-Policy', 'no-referrer');
    res.headers.set('Cache-Control', 'no-store');
  }
  if (noindex) res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export const config = {
  matcher: ['/((?!api/|_next/|favicon.ico|robots.txt|sitemap.*\.xml|.*\.(?:png|jpg|jpeg|webp|avif|svg|woff2|ico)$).*)'],
};
