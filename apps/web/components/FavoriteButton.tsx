'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { t } from '@/lib/strings';

/**
 * Optimistic save toggle.
 *
 * The flag flips immediately and rolls back only if the request fails —
 * on a 3G connection, waiting for a round trip before the heart fills makes
 * the tap feel broken.
 */
export function FavoriteButton({
  listingId,
  initial,
  signedIn,
  large = false,
}: {
  listingId: string;
  initial: boolean;
  signedIn: boolean;
  large?: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!signedIn) {
      router.push(`/kirish?next=/e/${listingId}`);
      return;
    }

    const next = !saved;
    setSaved(next);

    try {
      const response = await fetch(`/api/favorites/${listingId}`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!response.ok) {
        throw new Error('failed');
      }
      startTransition(() => router.refresh());
    } catch {
      setSaved(!next);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? t.listing.saved : t.listing.save}
      className={`tap-target flex items-center justify-center rounded-full bg-surface/90 backdrop-blur-sm ring-1 ring-hairline transition-colors hover:bg-surface ${
        large ? 'h-12 w-12' : 'h-9 w-9 min-h-0 min-w-0'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={large ? 'h-6 w-6' : 'h-5 w-5'}
        fill={saved ? 'var(--color-danger)' : 'none'}
        stroke={saved ? 'var(--color-danger)' : 'var(--color-ink-muted)'}
        strokeWidth={2}
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    </button>
  );
}
