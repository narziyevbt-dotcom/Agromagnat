import { cookies } from 'next/headers';

/**
 * Tokens live in httpOnly cookies rather than localStorage.
 *
 * Two reasons, in order of importance: server components need the token to
 * render a personalised page, and script on the page cannot read an httpOnly
 * cookie, so an XSS bug cannot walk off with a 30-day refresh token.
 */
export const ACCESS_COOKIE = 'agm_at';
export const REFRESH_COOKIE = 'agm_rt';

const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

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
