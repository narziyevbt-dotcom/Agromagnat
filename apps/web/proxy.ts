import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
} from '@/lib/cookies';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Keeps a signed-in visitor signed in.
 *
 * The access token lives fifteen minutes and the refresh token thirty days,
 * but nothing was spending the second to renew the first: once the short token
 * expired, every authenticated page saw a 401 and bounced the person to the
 * login screen, holding a perfectly good refresh token in the next cookie
 * along. In practice that meant signing in again a few times an hour — and on
 * this market's connections, each of those is another SMS and another minute.
 *
 * This runs before the page does, which is the only place in the App Router
 * where a cookie can still be written for a server-rendered request: a server
 * component cannot set one, and by the time an action or handler notices the
 * 401 the page has already decided to redirect.
 */

/** Renew this long before expiry, so a slow render never straddles the boundary. */
const RENEW_BEFORE_SECONDS = 120;

const API_BASE =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

/**
 * Reads `exp` without verifying the signature.
 *
 * Verification here would be theatre: this decides whether to *ask the backend*
 * for a new token, and the backend verifies for real. A forged `exp` buys an
 * attacker one pointless refresh call with their own cookie.
 */
function expiresAt(token: string): number | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

export default async function proxy(request: NextRequest) {
  // Generated per request and threaded through the response, so every page
  // gets its own. `crypto` is the Web Crypto global, which exists in this
  // runtime; Node's `randomBytes` does not.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce);

  const secure = (response: NextResponse): NextResponse => {
    response.headers.set('Content-Security-Policy', csp);
    return response;
  };

  const passThrough = (): NextResponse => {
    // The nonce has to reach the render, not just the browser: Next reads it
    // from the request header to stamp its own inline script.
    request.headers.set('x-nonce', nonce);
    request.headers.set('Content-Security-Policy', csp);
    return secure(NextResponse.next({ request: { headers: request.headers } }));
  };

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return passThrough();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const exp = accessToken ? expiresAt(accessToken) : null;
  const stillGood = exp !== null && exp - Math.floor(Date.now() / 1000) > RENEW_BEFORE_SECONDS;
  if (stillGood) {
    return passThrough();
  }

  let tokens: TokenPair | null = null;
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (response.ok) {
      tokens = (await response.json()) as TokenPair;
    } else if (response.status === 401) {
      // The refresh token is genuinely dead — expired, revoked, or replayed.
      // Clearing both cookies turns the next page into the signed-out one
      // rather than an authenticated page that fails to load.
      const cleared = passThrough();
      cleared.cookies.delete(ACCESS_COOKIE);
      cleared.cookies.delete(REFRESH_COOKIE);
      return cleared;
    }
  } catch {
    // The API is unreachable. Leave the cookies alone and let the page render
    // what it can; signing somebody out because a network blipped is worse
    // than a page that briefly shows less than it should.
    return passThrough();
  }

  if (!tokens) {
    return passThrough();
  }

  // Both the downstream render and the browser need the new token: the request
  // cookies feed this page, the response cookies feed the next one. The request
  // is mutated first so the forwarded headers already carry the new value.
  request.cookies.set(ACCESS_COOKIE, tokens.accessToken);
  request.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
  request.headers.set('x-nonce', nonce);
  request.headers.set('Content-Security-Policy', csp);
  const response = secure(NextResponse.next({ request: { headers: request.headers } }));

  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...options,
    maxAge: ACCESS_MAX_AGE,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...options,
    maxAge: REFRESH_MAX_AGE,
  });

  return response;
}

/**
 * Content Security Policy, with a fresh nonce per request.
 *
 * The site had none. That is the difference between an XSS bug being a bad day
 * and being every seller's session — with a policy in place, injected script
 * has nowhere to run and nowhere to send what it steals.
 *
 * A nonce rather than `unsafe-inline`, because `unsafe-inline` is the setting
 * that makes a policy decorative. Next reads the nonce off the request header
 * and stamps it onto its own inline bootstrap; nothing else on the page is
 * allowed to run.
 *
 * `strict-dynamic` is what lets Next's own bootstrap load the chunks it needs
 * without every chunk URL being listed. Browsers that do not understand it fall
 * back to the host list.
 */
function contentSecurityPolicy(nonce: string): string {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "";
  const images = process.env.NEXT_PUBLIC_S3_URL ?? "";
  const origin = (url: string): string => {
    try {
      return url ? new URL(url).origin : "";
    } catch {
      return "";
    }
  };

  return [
    "default-src 'self'",
    // Google Identity Services is the one third party, and it is only there
    // when the sign-in button is.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://accounts.google.com https://apis.google.com`,
    // Tailwind ships a stylesheet, but Next injects style attributes for
    // things like the image placeholder, which no nonce can cover.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${origin(images)}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${origin(api)} https://accounts.google.com`.trim(),
    // The Google button renders in an iframe.
    "frame-src https://accounts.google.com",
    // Nothing here should ever be framed, and nothing should be able to
    // navigate the page into a plugin or a base-tag trick.
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    // Form posts go to this site and to nowhere else — the defence against an
    // injected form that harvests a phone number to somebody else's server.
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export const config = {
  /**
   * Everything except static assets. Notably this includes `/api/*`, the
   * server's own proxy routes — the favourite toggle is fetched straight from
   * the page and needs a live token as much as a navigation does.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
