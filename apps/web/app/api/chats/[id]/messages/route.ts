import { NextResponse } from 'next/server';
import { getMessages } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

/** Messages pulled per poll. Enough to catch up after a short disconnect. */
const POLL_LIMIT = 20;

type Context = { params: Promise<{ id: string }> };

/**
 * The open thread's two client-side reads: polling for new messages (`since`)
 * and paging backwards through history (`cursor`).
 *
 * It exists for two reasons. The token stays in an httpOnly cookie, so the
 * browser cannot call the API directly; and `since` filters the page down to
 * genuinely new messages before it crosses the slow hop. The upstream request
 * costs the same either way, but the farmer on a 3G connection downloads a few
 * hundred bytes per poll instead of the whole tail of the conversation.
 */
export async function GET(request: Request, { params }: Context) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ message: 'Avtorizatsiya talab qilinadi' }, { status: 401 });
  }

  const { id } = await params;
  const search = new URL(request.url).searchParams;
  const cursor = search.get('cursor') ?? undefined;
  const since = search.get('since');
  const sinceTime = since ? Date.parse(since) : NaN;

  try {
    const page = await getMessages(id, token, { limit: POLL_LIMIT, cursor });
    const items =
      !cursor && Number.isFinite(sinceTime)
        ? page.items.filter((message) => Date.parse(message.createdAt) > sinceTime)
        : page.items;

    return NextResponse.json(
      { items, nextCursor: page.nextCursor, hasMore: page.hasMore },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ message: 'Xabarlarni olib bo‘lmadi' }, { status: 502 });
  }
}
