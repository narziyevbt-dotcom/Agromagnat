'use client';

import { useState, useTransition } from 'react';
import { MessageSquare } from 'lucide-react';
import { openChatAction } from '@/app/(site)/xabarlar/actions';
import { t } from '@/lib/strings';

/**
 * "Yozish" on a listing.
 *
 * Deliberately the quieter of the two contact buttons: calling is still how a
 * deal gets done in this market, so the phone keeps the saffron CTA and chat
 * sits beside it in turquoise for the buyer who wants a price in writing.
 */
export function ChatButton({ listingId }: { listingId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = () => {
    setError(null);
    startTransition(async () => {
      // Resolves only on failure — the action redirects into the thread.
      const result = await openChatAction(listingId);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex-1">
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-turquoise px-4 font-semibold text-white transition-colors hover:bg-forest disabled:opacity-60"
      >
        <MessageSquare className="h-5 w-5" aria-hidden="true" />
        {t.chat.write}
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
