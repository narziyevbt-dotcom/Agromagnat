'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createReviewAction } from '@/app/(site)/e/[id]/review-action';
import { t } from '@/lib/strings';
import { StarIcon, Stars } from './Stars';

/**
 * Leaving a rating after a completed deal.
 *
 * Stars first, comment optional. A required comment box roughly halves the
 * number of ratings a marketplace collects, and a rating with no words is still
 * a rating; the buyer who wants to explain will type anyway.
 */
export function ReviewForm({
  listingId,
  sellerId,
  existingRating,
}: {
  listingId: string;
  sellerId: string;
  existingRating: number | null;
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(existingRating !== null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (done) {
    return (
      <div className="rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-hairline">
        <p className="text-sm font-semibold text-ink">{t.reviews.yours}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <Stars value={existingRating ?? rating} size={18} />
          <span className="text-sm text-harvest">{t.reviews.thanks}</span>
        </div>
      </div>
    );
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!rating) {
      setError(t.reviews.ratingLabel);
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await createReviewAction(
        listingId,
        sellerId,
        rating,
        comment.trim() || undefined,
      );
      if (result.needsLogin) {
        router.push(`/kirish?next=/e/${listingId}`);
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  };

  const shown = hovered || rating;

  return (
    <form
      onSubmit={submit}
      className="rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-hairline"
    >
      <p className="text-sm font-semibold text-ink">{t.reviews.leave}</p>

      <div
        className="mt-2 flex items-center gap-1"
        onMouseLeave={() => setHovered(0)}
        role="radiogroup"
        aria-label={t.reviews.ratingLabel}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star}`}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onClick={() => setRating(star)}
            className="tap-target flex items-center justify-center rounded-lg"
          >
            <StarIcon size={26} filled={shown >= star} />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t.reviews.commentPlaceholder}
        aria-label={t.reviews.commentLabel}
        className="mt-3 w-full resize-y rounded-xl bg-canvas px-3 py-2.5 text-[15px] text-ink outline-none ring-1 ring-hairline focus:ring-turquoise"
      />

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      <button
        type="submit"
        disabled={pending || !rating}
        className="tap-target mt-3 flex w-full items-center justify-center rounded-xl bg-saffron px-4 font-semibold text-white transition-colors hover:bg-saffron-dark disabled:opacity-50"
      >
        {pending ? t.chat.sending : t.reviews.submit}
      </button>
    </form>
  );
}
