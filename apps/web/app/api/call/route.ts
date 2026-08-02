import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/same-origin';
import { registerCall } from '@/lib/api';

/**
 * Records a tap on the call button — the north-star metric.
 *
 * Always answers 204, even on failure. The client fires this via sendBeacon
 * while the dialer is opening; there is nothing useful it could do with an
 * error, and the call itself must never be held up by analytics.
 */
export async function POST(request: Request) {
  if (!(await isSameOrigin())) {
    return NextResponse.json({ message: 'Cross-site so‘rov rad etildi' }, { status: 403 });
  }
  try {
    const { listingId } = (await request.json()) as { listingId?: string };
    if (listingId) {
      await registerCall(listingId);
    }
  } catch {
    // Deliberately swallowed — see above.
  }
  return new NextResponse(null, { status: 204 });
}
