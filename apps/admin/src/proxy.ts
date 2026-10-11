// Runs before every page of the back office (BO-001, BO-002, SEC-040): without a session cookie, a page of the shell
// leads to the sign-in page, which brings the person back; the pages that carry a token in their address are never
// cached nor referred. The API checks every route again (SEC-030): this only spares a useless render.
import { NextResponse, type NextRequest } from 'next/server';

const DOOR = /^\/(?:connexion|mot-de-passe-oublie|invitation\/[^/]+|reinitialisation\/[^/]+|nouvelle-adresse\/[^/]+)$/;
const TOKEN_PAGES = /^\/(?:invitation|reinitialisation|nouvelle-adresse)\/[^/]+$/;

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const appEnv = process.env.APP_ENV ?? 'local';
  const signedIn = Boolean(req.cookies.get(`${appEnv === 'local' ? '' : '__Host-'}dp_admin_refresh`));

  if (!DOOR.test(pathname) && !signedIn) {
    const url = req.nextUrl.clone();
    url.pathname = '/connexion';
    url.search = '';
    if (pathname !== '/') url.searchParams.set('suite', pathname + search);
    return NextResponse.redirect(url, 302);
  }
  const res = NextResponse.next();
  if (TOKEN_PAGES.test(pathname)) {
    res.headers.set('Referrer-Policy', 'no-referrer');
    res.headers.set('Cache-Control', 'no-store');
  }
  return res;
}

export const config = {
  matcher: ['/((?!api/|_next/|favicon.ico|icon.png|.*\.(?:png|jpg|jpeg|webp|avif|svg|woff2|ico)$).*)'],
};
