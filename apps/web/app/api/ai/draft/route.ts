import { NextResponse } from 'next/server';
import { aiDraftListing, ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

/** One sentence in, a filled posting form out. */
export async function POST(request: Request) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Avval tizimga kiring' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text || text.length < 10) {
    return NextResponse.json(
      { error: "Mahsulotingiz haqida bir-ikki jumla yozing" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await aiDraftListing(text, token), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof ApiError ? error.message : "AI hozir javob bermadi, qo'lda to'ldiring";
    return NextResponse.json({ error: message }, { status });
  }
}
