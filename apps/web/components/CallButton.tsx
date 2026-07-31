'use client';

import { formatPhone } from '@/lib/format';
import { t } from '@/lib/strings';

/**
 * The one action that matters. Taps on this are the product's north-star
 * metric, so the counter fires on every press — but it is deliberately
 * fire-and-forget: the tel: link must open whether or not the request lands,
 * because a farmer on 3G losing a call to a failed analytics POST is the exact
 * failure this product cannot have.
 */
export function CallButton({
  listingId,
  phone,
  sellerName,
}: {
  listingId: string;
  phone: string;
  sellerName: string | null;
}) {
  const onClick = () => {
    const body = JSON.stringify({ listingId });

    // sendBeacon survives the page being backgrounded by the dialer.
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/call',
        new Blob([body], { type: 'application/json' }),
      );
    } else {
      void fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => null);
    }
  };

  return (
    <a
      href={`tel:${phone}`}
      onClick={onClick}
      className="tap-target flex flex-1 items-center justify-center gap-2 rounded-lg bg-harvest px-5 py-3 text-base font-semibold text-white transition-colors hover:brightness-110"
      aria-label={`${t.listing.call}${sellerName ? `: ${sellerName}` : ''}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="numeric">{formatPhone(phone)}</span>
    </a>
  );
}
