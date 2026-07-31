/**
 * The single hostname the site is allowed to advertise about itself.
 *
 * Vercel gives every deployment a `*.vercel.app` alias, and it is easy to end
 * up with that alias in `NEXT_PUBLIC_SITE_URL` — the value is set once during
 * the first test deploy and then quietly outlives it. Browsing through the
 * alias is harmless; putting it in robots.txt, the sitemap or a canonical tag
 * is not. Google would index the deployment host instead of agromagnat.uz,
 * split the ranking of every listing across two hostnames, and keep serving
 * preview URLs long after the branch behind them is gone.
 *
 * So the canonical host is derived, never trusted verbatim: anything that is
 * not a real custom domain falls back to the production domain.
 */
const FALLBACK = 'https://agromagnat.uz';

/** Deployment aliases — usable, but never the address we publish. */
function isDeploymentAlias(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.vercel.app');
}

function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) {
    return FALLBACK;
  }

  let url: URL;
  try {
    // A bare host ("agromagnat.uz") is a common way to fill this in, and
    // `new URL` rejects it — assume https rather than dropping the value.
    url = new URL(configured.includes('://') ? configured : `https://${configured}`);
  } catch {
    return FALLBACK;
  }

  if (isDeploymentAlias(url.hostname)) {
    return FALLBACK;
  }

  // www and the apex are the same site; the apex is the one that gets indexed,
  // and middleware redirects the other onto it.
  const hostname = url.hostname.replace(/^www\./, '');

  // Production is https-only (Vercel answers :80 with a 308), so an http value
  // here would only ever produce canonicals that redirect.
  return `https://${hostname}${url.port ? `:${url.port}` : ''}`;
}

/** Canonical origin, without a trailing slash. */
export const SITE_URL = resolveSiteUrl();

/** Turns an app path into the absolute URL crawlers and share cards need. */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
