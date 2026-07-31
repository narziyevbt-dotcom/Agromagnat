import { NextResponse } from 'next/server';
import { collectTelegramSignIn } from '@/lib/api';
import { setSession } from '@/lib/session';

/**
 * Polled while the person is away in Telegram.
 *
 * The tokens are turned into httpOnly cookies here and never reach the page's
 * own script — the same rule as every other way into this site. The browser
 * only ever learns "ready" or "not yet".
 */
export async function GET(request: Request) {
  const ticket = new URL(request.url).searchParams.get('ticket');
  if (!ticket) {
    return NextResponse.json({ message: 'ticket kerak' }, { status: 400 });
  }

  try {
    const tokens = await collectTelegramSignIn(ticket);
    if (!tokens) {
      // Ordinary: they are still deciding. Not an error, and not logged as one.
      return NextResponse.json({ pending: true });
    }

    await setSession(tokens.accessToken, tokens.refreshToken);
    return NextResponse.json({ ready: true, isNewUser: tokens.isNewUser });
  } catch {
    // A dead ticket looks the same as a slow one from here, and the client is
    // already counting down its own two minutes.
    return NextResponse.json({ pending: true });
  }
}
