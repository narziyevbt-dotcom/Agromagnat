'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteListing, logout, markListingSold, renewListing } from '@/lib/api';
import { clearSession, getAccessToken, getRefreshToken } from '@/lib/session';

export async function signOutAction(): Promise<void> {
  const refreshToken = await getRefreshToken();
  const accessToken = await getAccessToken();

  if (refreshToken) {
    // A failure here still clears the local session — the user asked to leave,
    // and the tokens expire on their own.
    await logout(refreshToken, accessToken).catch(() => null);
  }

  await clearSession();
  redirect('/');
}

export async function markSoldAction(listingId: string): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    return { error: 'Avtorizatsiya talab qilinadi' };
  }

  try {
    await markListingSold(listingId, token);
    revalidatePath('/profil');
    return {};
  } catch {
    return { error: 'Amal bajarilmadi' };
  }
}

export async function renewListingAction(listingId: string): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    return { error: 'Avtorizatsiya talab qilinadi' };
  }

  try {
    await renewListing(listingId, token);
    // Both paths: the same row renders on /profil and in the dashboard, and a
    // seller who renews in one place and switches to the other should not be
    // shown the state they just changed.
    revalidatePath('/profil');
    revalidatePath('/dashboard/elonlar');
    return {};
  } catch {
    return { error: 'Qayta joylab bo\'lmadi' };
  }
}

export async function deleteListingAction(listingId: string): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    return { error: 'Avtorizatsiya talab qilinadi' };
  }

  try {
    await deleteListing(listingId, token);
    revalidatePath('/profil');
    return {};
  } catch {
    return { error: "O'chirib bo'lmadi" };
  }
}
