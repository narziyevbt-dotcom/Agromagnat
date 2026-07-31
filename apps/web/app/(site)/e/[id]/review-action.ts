'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, createReview } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export interface ReviewResult {
  ok?: boolean;
  error?: string;
  needsLogin?: boolean;
}

export async function createReviewAction(
  listingId: string,
  sellerId: string,
  rating: number,
  comment?: string,
): Promise<ReviewResult> {
  const token = await getAccessToken();
  if (!token) {
    return { needsLogin: true };
  }

  try {
    await createReview(listingId, rating, comment, token);
    // The seller's average is denormalised, so their profile has to be refetched
    // rather than served from the ISR copy taken before the rating landed.
    revalidatePath(`/sotuvchi/${sellerId}`);
    revalidatePath(`/e/${listingId}`);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Baho yuborilmadi',
    };
  }
}
