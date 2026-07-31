import { NextResponse } from 'next/server';
import { getDistricts } from '@/lib/api';

/** Feeds the region → district cascade in the filter panel. */
export async function GET(request: Request) {
  const regionId = new URL(request.url).searchParams.get('regionId');
  if (!regionId) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    return NextResponse.json(await getDistricts(regionId));
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
