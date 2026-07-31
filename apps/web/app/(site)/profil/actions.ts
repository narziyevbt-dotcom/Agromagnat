'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteListing, logout, markListingSold } from '@/lib/api';
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
