import { NextResponse } from 'next/server';
import { getUnreadCount } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

/**
 * The bottom-nav badge. Anonymous visitors get a plain zero rather than a 401 —
 * the nav renders for everyone, and an error in the console on every page load
 * would be noise, not information.
 */
export async function GET() {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ unread: 0 });
  }

  try {
    return NextResponse.json(await getUnreadCount(token), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ unread: 0 });
  }
}
