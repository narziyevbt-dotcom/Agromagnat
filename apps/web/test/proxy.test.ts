import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/cookies';
import proxy from '../proxy';

/**
 * The session renewer.
 *
 * This file exists because its absence cost us the worst bug in the project:
 * nothing was calling refresh, so every signed-in visitor was thrown back to
 * the SMS screen fifteen minutes after logging in, holding a thirty-day
 * refresh token the whole time. Nothing failed, nothing logged, and no test
 * noticed — there were none. These are those tests.
 */

/** A token is only ever read for its `exp` here, so only `exp` has to be real. */
const tokenExpiringIn = (seconds: number): string => {
  const payload = Buffer.from(
    JSON.stringify({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + seconds }),
  ).toString('base64url');
  return `header.${payload}.signature`;
};

const requestWith = (cookies: Record<string, string>): NextRequest =>
  new NextRequest('http://localhost/profil', {
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; '),
    },
  });

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const refreshSucceeds = () =>
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' }),
  });

describe('when there is nothing to renew', () => {
  it('leaves a signed-out visitor alone', async () => {
    await proxy(requestWith({}));

    // Not merely "does not crash": a refresh call for every anonymous page
    // view would put the API in front of the marketing landing page.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not spend a call on a token with plenty of life left', async () => {
    await proxy(
      requestWith({ [ACCESS_COOKIE]: tokenExpiringIn(600), [REFRESH_COOKIE]: 'rt' }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('renewal', () => {
  it('renews an expired access token and hands back both cookies', async () => {
    refreshSucceeds();

    const response = await proxy(
      requestWith({ [ACCESS_COOKIE]: tokenExpiringIn(-60), [REFRESH_COOKIE]: 'old-refresh' }),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/auth/refresh');
    expect(JSON.parse(init.body)).toEqual({ refreshToken: 'old-refresh' });

    expect(response.cookies.get(ACCESS_COOKIE)?.value).toBe('fresh-access');
    // The refresh token rotates too. Storing only the new access token would
    // leave the next renewal presenting a token the backend has already burned.
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe('fresh-refresh');
  });

  it('renews before expiry rather than after it', async () => {
    refreshSucceeds();

    // Still valid, but not for long enough to outlive a slow render.
    await proxy(
      requestWith({ [ACCESS_COOKIE]: tokenExpiringIn(30), [REFRESH_COOKIE]: 'rt' }),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('renews when the access cookie is missing entirely', async () => {
    refreshSucceeds();

    await proxy(requestWith({ [REFRESH_COOKIE]: 'rt' }));

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('renews when the access cookie is not a readable token', async () => {
    refreshSucceeds();

    await proxy(requestWith({ [ACCESS_COOKIE]: 'garbage', [REFRESH_COOKIE]: 'rt' }));

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('keeps the cookies httpOnly', async () => {
    refreshSucceeds();

    const response = await proxy(
      requestWith({ [ACCESS_COOKIE]: tokenExpiringIn(-1), [REFRESH_COOKIE]: 'rt' }),
    );

    // The whole reason tokens live in cookies rather than localStorage: an XSS
    // bug must not be able to walk off with a thirty-day refresh token.
    expect(response.cookies.get(REFRESH_COOKIE)?.httpOnly).toBe(true);
    expect(response.cookies.get(ACCESS_COOKIE)?.httpOnly).toBe(true);
  });

  it('forwards the new token to the page being rendered', async () => {
    refreshSucceeds();

    const request = requestWith({
      [ACCESS_COOKIE]: tokenExpiringIn(-1),
      [REFRESH_COOKIE]: 'rt',
    });
    await proxy(request);

    // Without this the page that triggered the renewal still renders with the
    // dead token, so the visitor sees one signed-out page before it takes.
    expect(request.cookies.get(ACCESS_COOKIE)?.value).toBe('fresh-access');
  });
});

describe('when renewal fails', () => {
  it('clears both cookies on a dead session', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    const response = await proxy(
      requestWith({ [ACCESS_COOKIE]: tokenExpiringIn(-1), [REFRESH_COOKIE]: 'revoked' }),
    );

    // Leaving a dead refresh token in place would retry it on every single
    // navigation, and the backend reads a replay as a compromise.
    const header = response.headers.get('set-cookie') ?? '';
    expect(header).toContain(ACCESS_COOKIE);
    expect(header).toContain(REFRESH_COOKIE);
    expect(response.cookies.get(ACCESS_COOKIE)?.value).toBe('');
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe('');
  });

  it('leaves the session alone when the API is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await proxy(
      requestWith({ [ACCESS_COOKIE]: tokenExpiringIn(-1), [REFRESH_COOKIE]: 'rt' }),
    );

    // Signing somebody out because a network blipped is worse than a page that
    // briefly shows less than it should.
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('leaves the session alone on a server error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });

    const response = await proxy(
      requestWith({ [ACCESS_COOKIE]: tokenExpiringIn(-1), [REFRESH_COOKIE]: 'rt' }),
    );

    // A 502 says the API is unwell, not that the session is dead.
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
