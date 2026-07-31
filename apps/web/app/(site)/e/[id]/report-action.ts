'use server';

import { ApiError, reportListing } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import type { ReportReason } from '@/lib/types';

export interface ReportResult {
  ok?: boolean;
  error?: string;
  needsLogin?: boolean;
}

export async function reportListingAction(
  listingId: string,
  reason: ReportReason,
  comment?: string,
): Promise<ReportResult> {
  const token = await getAccessToken();
  if (!token) {
    // The client sends the visitor to login instead of showing an error —
    // wanting to complain is exactly the moment to capture an account.
    return { needsLogin: true };
  }

  try {
    await reportListing(listingId, reason, comment, token);
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      // Already reported — from the user's point of view, mission accomplished.
      return { ok: true };
    }
    return {
      error: error instanceof ApiError ? error.message : 'Shikoyat yuborilmadi',
    };
  }
}
