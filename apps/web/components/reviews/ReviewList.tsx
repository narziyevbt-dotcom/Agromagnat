import { formatTimeAgo, initials } from '@/lib/format';
import { t } from '@/lib/strings';
import type { SellerReviews } from '@/lib/types';
import { Stars } from './Stars';

/**
 * A seller's reputation: the summary a buyer scans, then the comments they read
 * if the summary is not enough. The histogram is beside the average because a
 * 4.5 built from twenty ratings and a 4.5 built from two are different claims.
 */
export function ReviewList({ reviews }: { reviews: SellerReviews }) {
  const average = Number(reviews.average);
  const total = Object.values(reviews.breakdown).reduce((sum, n) => sum + n, 0);

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-ink">
        {t.reviews.title}
        {total > 0 && (
          <span className="numeric ml-2 text-sm font-normal text-ink-faint">
            {total} {t.reviews.count}
          </span>
        )}
      </h2>

      {total === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-surface p-6 text-center ring-1 ring-hairline">
          <p className="font-semibold text-ink">{t.reviews.empty}</p>
          <p className="mt-1 text-sm text-ink-muted">{t.reviews.emptyHint}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-hairline sm:flex-row sm:items-center">
            <div className="shrink-0 text-center sm:w-32">
              <p className="numeric text-4xl font-bold text-ink">{average.toFixed(1)}</p>
              <Stars value={average} size={18} className="mt-1" />
            </div>

            <dl className="min-w-0 flex-1 space-y-1">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = reviews.breakdown[String(star) as '1'];
                const share = total ? (count / total) * 100 : 0;

                return (
                  <div key={star} className="flex items-center gap-2">
                    <dt className="numeric w-4 shrink-0 text-xs text-ink-faint">{star}</dt>
                    <dd className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas"
                        aria-hidden="true"
                      >
                        <span
                          className="block h-full rounded-full bg-turquoise"
                          style={{ width: `${share}%` }}
                        />
                      </span>
                      <span className="numeric w-6 shrink-0 text-right text-xs text-ink-faint">
                        {count}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <ul className="mt-3 space-y-2">
            {reviews.items.map((review) => (
              <li
                key={review.id}
                className="rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-hairline"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white">
                    {initials(review.author?.name ?? null)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {review.author?.name ?? 'Xaridor'}
                    </p>
                    <p className="numeric text-[11px] text-ink-faint">
                      {formatTimeAgo(review.createdAt)}
                    </p>
                  </div>
                  <Stars value={review.rating} size={14} />
                </div>

                {review.comment && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                    {review.comment}
                  </p>
                )}

                {review.listing && (
                  <p className="mt-1.5 truncate text-[11px] text-ink-faint">
                    {t.chat.aboutListing}: {review.listing.title}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
