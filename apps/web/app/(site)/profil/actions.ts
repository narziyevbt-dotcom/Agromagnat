'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteListing, logout, logoutEverywhere, markListingSold } from '@/lib/api';
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

/**
 * Signs out everywhere — the answer to a lost phone.
 *
 * Ordinary logout drops the one refresh token in front of it; this drops every
 * one the account holds, so a session left open on a borrowed computer or a
 * stolen handset dies with it. Without it the only remedy for a lost phone in
 * a marketplace that carries a person's contact details is waiting thirty days
 * for the token to expire.
 */
export async function signOutEverywhereAction(): Promise<void> {
  const accessToken = await getAccessToken();

  if (accessToken) {
    await logoutEverywhere(accessToken).catch(() => null);
    // The access tokens themselves are stateless and outlive the revocation by
    // up to their fifteen minutes; blacklisting this one closes the near end.
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      await logout(refreshToken, accessToken).catch(() => null);
    }
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
