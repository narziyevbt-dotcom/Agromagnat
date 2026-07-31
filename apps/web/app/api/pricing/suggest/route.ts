import { NextResponse } from 'next/server';
import { getPriceSuggestion } from '@/lib/api';

/**
 * Proxies the price recommendation so the browser never needs the API's origin
 * — the same reason the AI routes exist. No token: the endpoint is public.
 *
 * A failure returns the "not enough data" shape rather than an error, because
 * that is what the hint renders as anyway and a red box under the price field
 * would read as "your price is wrong".
 */
const UNKNOWN = {
  range: null,
  basis: null,
  sampleSize: 0,
  confidence: 0,
  trendPct: null,
  reasonUz: '',
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    categoryId?: string;
    regionId?: string;
    unit?: string;
    quantity?: number;
  } | null;

  if (!body?.categoryId || !body.unit) {
    return NextResponse.json({ ...UNKNOWN, unit: body?.unit ?? 'kg' });
  }

  try {
    const suggestion = await getPriceSuggestion({
      categoryId: body.categoryId,
      regionId: body.regionId,
      unit: body.unit,
      quantity: body.quantity,
    });
    return NextResponse.json(suggestion, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ...UNKNOWN, unit: body.unit });
  }
}
