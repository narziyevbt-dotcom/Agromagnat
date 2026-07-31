import { AdminReviewRow } from '@/components/admin/AdminReviewRow';
import { getAdminReviews } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { t } from '@/lib/strings';

export const dynamic = 'force-dynamic';

/**
 * The review queue. Ratings move a seller's public average, which makes them
 * worth abusing — a competitor buying one lot to leave a one-star is the
 * predictable attack, and hiding the review is the answer.
 */
export default async function AdminReviewsPage() {
  const token = (await getAccessToken())!;
  const page = await getAdminReviews(token).catch(() => ({ items: [], total: 0 }));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl">{t.reviews.title}</h1>
        <p className="numeric text-sm text-ink-muted">{page.total} ta</p>
      </div>

      {page.items.length === 0 ? (
        <div className="rounded-2xl border border-slate-line bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-ink">{t.reviews.empty}</p>
          <p className="mt-1 text-sm text-ink-muted">Navbat toza.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {page.items.map((review) => (
            <li key={review.id}>
              <AdminReviewRow review={review} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
