import { NextResponse } from 'next/server';
import { aiAssist, ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

interface AssistBody {
  question?: string;
  history?: Array<{ role?: string; content?: string }>;
}

/** The help assistant. History is bounded here as well as on the API. */
export async function POST(request: Request) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Avval tizimga kiring' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AssistBody | null;
  const question = body?.question?.trim();
  if (!question) {
    return NextResponse.json({ error: 'Savolingizni yozing' }, { status: 400 });
  }

  const history = (body?.history ?? [])
    .filter(
      (turn): turn is { role: 'user' | 'assistant'; content: string } =>
        (turn.role === 'user' || turn.role === 'assistant') && Boolean(turn.content),
    )
    .slice(-6);

  try {
    return NextResponse.json(await aiAssist(question, history, token), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof ApiError ? error.message : 'Yordamchi hozir javob bera olmadi';
    return NextResponse.json({ error: message }, { status });
  }
}
