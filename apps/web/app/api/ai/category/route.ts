import { NextResponse } from 'next/server';
import { aiSuggestCategory, ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

/**
 * Category suggestion for the posting form, called as the seller types.
 *
 * A route handler rather than a server action because the caller debounces and
 * cancels: an in-flight action cannot be aborted, so every keystroke's work
 * would be paid for even after the answer stopped being wanted.
 *
 * An empty candidate list is the honest answer to "no idea" and the form treats
 * it as such, so every failure here degrades to that rather than to an error.
 */
export async function POST(request: Request) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ candidates: [], source: 'keyword' }, { status: 200 });
  }

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text || text.length < 2) {
    return NextResponse.json({ candidates: [], source: 'keyword' });
  }

  try {
    return NextResponse.json(await aiSuggestCategory(text, token), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    // 429 is worth surfacing — the form shows the Uzbek message. Everything
    // else silently falls back to manual selection.
    if (error instanceof ApiError && error.status === 429) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    return NextResponse.json({ candidates: [], source: 'keyword' });
  }
}
