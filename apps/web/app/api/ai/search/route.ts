import { NextResponse } from 'next/server';
import { aiSmartSearch, ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

/**
 * Proxies natural-language search, passing the session token when there is one
 * so favourite flags come back set.
 *
 * The token is optional here, unlike the other AI routes: the endpoint behind
 * it is public on purpose, and a buyer's first query is exactly the moment
 * they have not signed up yet.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    q?: string;
    limit?: number;
  } | null;

  const q = body?.q?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "So'rovni yozing" }, { status: 400 });
  }

  const token = await getAccessToken();

  try {
    return NextResponse.json(await aiSmartSearch(q, body?.limit ?? 20, token), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof ApiError ? error.message : "Qidiruv hozir ishlamadi";
    return NextResponse.json({ error: message }, { status });
  }
}
