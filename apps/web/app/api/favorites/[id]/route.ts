import { NextResponse } from 'next/server';
import { addFavorite, removeFavorite } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

/**
 * Proxies the favorite toggle so the browser never sees the access token —
 * it stays in an httpOnly cookie that script cannot read.
 */
type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Context) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ message: 'Avtorizatsiya talab qilinadi' }, { status: 401 });
  }

  const { id } = await params;
  try {
    await addFavorite(id, token);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ message: 'Saqlab bo‘lmadi' }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ message: 'Avtorizatsiya talab qilinadi' }, { status: 401 });
  }

  const { id } = await params;
  try {
    await removeFavorite(id, token);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ message: 'O‘chirib bo‘lmadi' }, { status: 502 });
  }
}
