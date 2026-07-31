import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Sends www onto the apex.
 *
 * Both hostnames are attached to the project, so without this the same listing
 * is reachable at two addresses — duplicate content for Google and two
 * different origins for anything that keys off the host. The apex wins because
 * that is what the brand, the print material and the sitemap all say.
 *
 * This does not remove the need for a `www` DNS record at the registrar: with
 * no record the browser never reaches Vercel at all, and there is nothing here
 * to redirect.
 */
export function middleware(request: NextRequest): NextResponse {
  const host = request.headers.get('host') ?? '';

  if (host.startsWith('www.')) {
    const url = request.nextUrl.clone();
    url.host = host.slice(4);
    url.protocol = 'https';
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  // Static assets are served straight off the CDN; routing them through
  // middleware would add a hop to every image and chunk for no benefit.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)'],
};
