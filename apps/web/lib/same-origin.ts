import { headers } from 'next/headers';

/**
 * Refuses a state-changing request that another site made on the visitor's
 * behalf.
 *
 * `SameSite=Lax` on the session cookies already stops most of this: the browser
 * will not attach them to a cross-site POST. This is the second lock, and it is
 * worth having because the first one has gaps — a sibling subdomain is
 * same-site as far as cookies are concerned, and "lax" is a default that a
 * future change to one cookie could quietly undo.
 *
 * Server actions get this from Next already; route handlers do not, and every
 * mutating handler here authenticates from a cookie. That combination is the
 * textbook shape of a CSRF hole.
 *
 * `Sec-Fetch-Site` is the modern check and needs no configuration — the browser
 * sets it and script cannot. `Origin` is the fallback for anything that does
 * not send it. A request with neither is not a browser doing a cross-site
 * form post, so it is allowed: blocking it would break `curl`, health probes
 * and the app's own server-to-server calls for no security gain.
 */
export async function isSameOrigin(): Promise<boolean> {
  const list = await headers();

  const site = list.get('sec-fetch-site');
  if (site) {
    // "none" is a direct navigation; "same-origin" and "same-site" are ours.
    return site !== 'cross-site';
  }

  const origin = list.get('origin');
  if (!origin) {
    return true;
  }

  const host = list.get('host');
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    // A malformed Origin is not something a browser sends.
    return false;
  }
}
