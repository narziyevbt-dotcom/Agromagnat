import { cookies } from 'next/headers';
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
} from './cookies';

/**
 * Tokens live in httpOnly cookies rather than localStorage.
 *
 * Two reasons, in order of importance: server components need the token to
 * render a personalised page, and script on the page cannot read an httpOnly
 * cookie, so an XSS bug cannot walk off with a 30-day refresh token.
 */
export { ACCESS_COOKIE, REFRESH_COOKIE };

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = (maxAge: number) =>
  ({
    httpOnly: true,
    // Lax rather than Strict: a listing shared into Telegram must open logged in.
    sameSite: 'lax' as const,
    secure: isProduction,
    path: '/',
    maxAge,
  }) as const;

/** The access token for the current request, if the visitor is signed in. */
export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

export async function setSession(accessToken: string, refreshToken: string): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_MAX_AGE));
  store.set(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE));
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function isSignedIn(): Promise<boolean> {
  return (await getAccessToken()) !== undefined;
}

/**
 * Where to send somebody the API refused for want of a verified phone.
 *
 * The path they were trying to use is carried along, so verifying returns them
 * to the listing they were about to save rather than to the home page — the
 * gate should feel like a step in what they were doing, not an interruption
 * that loses their place.
 */
export function phoneGatePath(next: string): string {
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return `/telefon?next=${encodeURIComponent(safe)}`;
}
