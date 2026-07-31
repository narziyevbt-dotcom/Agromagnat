'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, createOffer, getOffers, respondToOffer } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import type { Offer } from '@/lib/types';

export interface OfferState {
  offers?: Offer[];
  error?: string;
}

const message = (error: unknown, fallback: string): string =>
  error instanceof ApiError ? error.message : fallback;

/**
 * Server actions rather than route handlers, unlike the AI endpoints.
 *
 * Nothing here is debounced or cancellable — each is one deliberate tap — and
 * accepting an offer changes a listing's state, so it has to be able to
 * revalidate the pages that render it. A route handler could not.
 */
export async function loadOffersAction(chatId: string): Promise<OfferState> {
  const token = await getAccessToken();
  if (!token) return { error: 'Avval tizimga kiring' };

  try {
    return { offers: await getOffers(chatId, token) };
  } catch (error) {
    return { error: message(error, "Takliflarni yuklab bo'lmadi") };
  }
}

export async function createOfferAction(
  chatId: string,
  amount: number,
  note?: string,
): Promise<OfferState> {
  const token = await getAccessToken();
  if (!token) return { error: 'Avval tizimga kiring' };

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Narxni kiriting' };
  }

  try {
    await createOffer(chatId, { amount, ...(note ? { note } : {}) }, token);
    return { offers: await getOffers(chatId, token) };
  } catch (error) {
    return { error: message(error, 'Taklif yuborilmadi') };
  }
}

export async function respondToOfferAction(
  chatId: string,
  offerId: string,
  action: 'accept' | 'decline' | 'withdraw',
): Promise<OfferState> {
  const token = await getAccessToken();
  if (!token) return { error: 'Avval tizimga kiring' };

  try {
    await respondToOffer(offerId, action, token);

    // Accepting sells the listing, which changes the feed, the seller's own
    // listing rows and the listing page itself. Revalidating only on accept
    // keeps a decline from paying for four cache purges.
    if (action === 'accept') {
      revalidatePath('/');
      revalidatePath('/profil');
      revalidatePath('/dashboard');
    }

    return { offers: await getOffers(chatId, token) };
  } catch (error) {
    return { error: message(error, 'Amal bajarilmadi') };
  }
}
