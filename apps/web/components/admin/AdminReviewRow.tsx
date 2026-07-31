'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { hideReviewAction } from '@/app/admin/actions';
import { Stars } from '@/components/reviews/Stars';
import { formatTimeAgo } from '@/lib/format';
import { t } from '@/lib/strings';
import type { Review } from '@/lib/types';

export function AdminReviewRow({ review }: { review: Review }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      const result = await hideReviewAction(review.id, !review.isHidden, review.sellerId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        review.isHidden ? 'border-danger/30 opacity-70' : 'border-slate-line'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Stars value={review.rating} size={15} />
            <span className="numeric text-sm font-semibold text-ink">{review.rating}/5</span>
            {review.isHidden && (
              <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">
                {t.reviews.hidden}
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-ink-muted">
            {review.author?.name ?? 'Xaridor'} →{' '}
            <Link
              href={`/sotuvchi/${review.sellerId}`}
              className="underline underline-offset-2 hover:text-forest"
            >
              sotuvchi
            </Link>
            <span className="numeric"> · {formatTimeAgo(review.createdAt)}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`tap-target shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${
            review.isHidden
              ? 'bg-harvest/10 text-harvest hover:bg-harvest/15'
              : 'bg-danger/10 text-danger hover:bg-danger/15'
          }`}
        >
          {review.isHidden ? 'Tiklash' : 'Yashirish'}
        </button>
      </div>

      {review.comment && (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
          {review.comment}
        </p>
      )}

      {review.listing && (
        <Link
          href={`/e/${review.listingId}`}
          className="mt-1.5 block truncate text-[11px] text-ink-faint underline-offset-2 hover:text-forest hover:underline"
        >
          {review.listing.title}
        </Link>
      )}

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
