import { AdminListingRow } from '@/components/admin/AdminListingRow';
import { getAdminListings } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * The moderation queue: everything waiting for a human decision, oldest work
 * first is not needed — newest first matches how complaints arrive.
 */
export default async function ModerationPage() {
  const token = (await getAccessToken())!;
  const page = await getAdminListings(token, { status: 'pending' }).catch(() => ({
    items: [],
    total: 0,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl">Moderatsiya navbati</h1>
        <p className="mt-1 text-sm text-ink-muted">
          <span className="numeric font-semibold text-ink">{page.total}</span> ta
          e&apos;lon qaroringizni kutmoqda.
        </p>
      </div>

      {page.items.length === 0 ? (
        <div className="rounded-2xl border border-slate-line bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-ink">Navbat bo&apos;sh</p>
          <p className="mt-1 text-sm text-ink-muted">
            Tekshiruv kutayotgan e&apos;lon yo&apos;q.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {page.items.map((listing) => (
            <li key={listing.id}>
              <AdminListingRow listing={listing} mode="moderation" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
