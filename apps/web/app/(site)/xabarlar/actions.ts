'use server';

import { redirect } from 'next/navigation';
import { ApiError, needsPhone, openChat, sendMessage } from '@/lib/api';
import { getAccessToken, phoneGatePath } from '@/lib/session';
import type { ChatMessage } from '@/lib/types';

/**
 * Opens the conversation about a listing and goes there.
 *
 * The backend returns the existing thread when there is one, so pressing
 * "Yozish" a second time lands in the same history rather than a blank screen.
 */
export async function openChatAction(listingId: string): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    redirect(`/kirish?next=/e/${listingId}`);
  }

  let chatId: string;
  try {
    chatId = (await openChat(listingId, token)).id;
  } catch (error) {
    // A Google account with no phone gets here. Sending it to the verification
    // screen is the whole point of the gate — showing "403" would be true and
    // useless. `redirect` throws, so it leaves the catch rather than falling
    // through to the error return.
    if (needsPhone(error)) {
      redirect(phoneGatePath(`/e/${listingId}`));
    }
    return {
      error: error instanceof ApiError ? error.message : 'Suhbatni ochib bo‘lmadi',
    };
  }

  redirect(`/xabarlar/${chatId}`);
}

export async function sendMessageAction(
  chatId: string,
  body: string,
  clientId: string,
): Promise<{ message?: ChatMessage; error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    return { error: 'Avtorizatsiya talab qilinadi' };
  }

  const text = body.trim();
  if (!text) {
    return { error: 'Xabar bo‘sh' };
  }

  try {
    return { message: await sendMessage(chatId, text, clientId, token) };
  } catch (error) {
    // The clientId means the caller can retry this verbatim without
    // risking a duplicate, so the UI offers exactly that.
    return {
      error: error instanceof ApiError ? error.message : 'Xabar yuborilmadi',
    };
  }
}
