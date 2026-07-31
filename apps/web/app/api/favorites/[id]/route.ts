import { NextResponse } from 'next/server';
import { PHONE_REQUIRED, addFavorite, needsPhone, removeFavorite } from '@/lib/api';
import { getAccessToken, phoneGatePath } from '@/lib/session';

/**
 * Proxies the favorite toggle so the browser never sees the access token —
 * it stays in an httpOnly cookie that script cannot read.
 */
type Context = { params: Promise<{ id: string }> };

/**
 * The gate, in a shape a fetch can act on.
 *
 * The proxy cannot redirect the visitor itself — this is a background fetch,
 * not a navigation — so it hands back the code and the destination and lets the
 * button do the navigating.
 */
const phoneRequired = (listingId: string) =>
  NextResponse.json(
    { error: PHONE_REQUIRED, verifyUrl: phoneGatePath(`/e/${listingId}`) },
    { status: 403 },
  );

export async function POST(_request: Request, { params }: Context) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ message: 'Avtorizatsiya talab qilinadi' }, { status: 401 });
  }

  const { id } = await params;
  try {
    await addFavorite(id, token);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (needsPhone(error)) {
      return phoneRequired(id);
    }
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
  } catch (error) {
    if (needsPhone(error)) {
      return phoneRequired(id);
    }
    return NextResponse.json({ message: 'O‘chirib bo‘lmadi' }, { status: 502 });
  }
}
