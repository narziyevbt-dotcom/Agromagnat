import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The second lock on state-changing requests.
 *
 * `SameSite=Lax` already stops a browser attaching session cookies to a
 * cross-site POST, so this is defence in depth — but the first lock has gaps a
 * sibling subdomain fits through, and it is one cookie option away from being
 * silently removed. This is cheap and it fails closed.
 *
 * The trap in both directions: too strict and `curl`, health probes and the
 * app's own server-to-server calls break; too loose and it is not a lock.
 */
const current = vi.hoisted(() => ({ value: new Map<string, string>() }));

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (key: string) => current.value.get(key) ?? null }),
}));

const { isSameOrigin } = await import('@/lib/same-origin');

const withHeaders = (entries: Record<string, string>) => {
  current.value = new Map(Object.entries(entries));
};

beforeEach(() => withHeaders({}));

describe('Sec-Fetch-Site', () => {
  it('refuses a request another site made', async () => {
    // The whole point: a form on somebody else's page posting here with the
    // visitor's cookies attached.
    withHeaders({ 'sec-fetch-site': 'cross-site' });

    expect(await isSameOrigin()).toBe(false);
  });

  it('allows our own pages', async () => {
    withHeaders({ 'sec-fetch-site': 'same-origin' });

    expect(await isSameOrigin()).toBe(true);
  });

  it('allows a direct navigation', async () => {
    // "none" is somebody typing the address or opening a bookmark.
    withHeaders({ 'sec-fetch-site': 'none' });

    expect(await isSameOrigin()).toBe(true);
  });

  it('is trusted over a forged Origin', async () => {
    // Script cannot set Sec-Fetch-Site; it is the browser's word, so it wins.
    withHeaders({ 'sec-fetch-site': 'same-origin', origin: 'https://evil.example' });

    expect(await isSameOrigin()).toBe(true);
  });
});

describe('Origin, for anything that does not send Sec-Fetch-Site', () => {
  it('refuses a mismatched host', async () => {
    withHeaders({ origin: 'https://evil.example', host: 'agromagnat.uz' });

    expect(await isSameOrigin()).toBe(false);
  });

  it('allows a matching host', async () => {
    withHeaders({ origin: 'https://agromagnat.uz', host: 'agromagnat.uz' });

    expect(await isSameOrigin()).toBe(true);
  });

  it('refuses a malformed Origin', async () => {
    // Not something a browser sends, so it is not something to wave through.
    withHeaders({ origin: 'not a url', host: 'agromagnat.uz' });

    expect(await isSameOrigin()).toBe(false);
  });

  it('refuses when the host is unknown', async () => {
    withHeaders({ origin: 'https://agromagnat.uz' });

    expect(await isSameOrigin()).toBe(false);
  });
});

describe('requests from outside a browser', () => {
  it('allows a request with neither header', async () => {
    // curl, a health probe, the app's own server-to-server calls. None of these
    // is a browser being tricked, and blocking them buys nothing.
    expect(await isSameOrigin()).toBe(true);
  });
});
