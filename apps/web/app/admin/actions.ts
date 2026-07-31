'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  adminApproveListing,
  adminBlockListing,
  adminPromoteListing,
  adminResolveReport,
  adminSetUserBlocked,
  adminSetUserVerified,
} from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export interface ActionResult {
  error?: string;
}

/**
 * Thin wrappers: read the token, call the API, revalidate the pages that show
 * the changed data. The backend does the authorisation — a forged call from a
 * non-admin gets a 403 there, and the message is surfaced as-is.
 */
async function run(
  action: (token: string) => Promise<unknown>,
  paths: string[],
): Promise<ActionResult> {
  const token = await getAccessToken();
  if (!token) {
    return { error: 'Avtorizatsiya talab qilinadi' };
  }

  try {
    await action(token);
    for (const path of paths) {
      revalidatePath(path);
    }
    return {};
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Amal bajarilmadi',
    };
  }
}

export const approveListingAction = async (id: string) =>
  run((token) => adminApproveListing(id, token), ['/admin/moderatsiya', '/admin', '/admin/elonlar']);

export const blockListingAction = async (id: string, reason: string) =>
  run(
    (token) => adminBlockListing(id, reason, token),
    ['/admin/moderatsiya', '/admin', '/admin/elonlar'],
  );

export const promoteListingAction = async (id: string, days: number) =>
  run((token) => adminPromoteListing(id, days, token), ['/admin/elonlar']);

export const setUserVerifiedAction = async (id: string, value: boolean) =>
  run((token) => adminSetUserVerified(id, value, token), ['/admin/foydalanuvchilar']);

export const setUserBlockedAction = async (id: string, value: boolean) =>
  run(
    (token) => adminSetUserBlocked(id, value, token),
    ['/admin/foydalanuvchilar', '/admin/elonlar', '/admin'],
  );

export const resolveReportAction = async (
  id: string,
  outcome: 'resolved' | 'rejected',
  note?: string,
) => run((token) => adminResolveReport(id, outcome, note, token), ['/admin/shikoyatlar', '/admin']);
