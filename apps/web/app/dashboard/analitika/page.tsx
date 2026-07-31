import Link from 'next/link';
import { PhoneCall } from 'lucide-react';
import { getMyListings } from '@/lib/api';
import { formatQuantity, formatTimeAgo } from '@/lib/format';
import { getAccessToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Per-listing analytics, organised around the one number the book calls the
 * north star: calls per active listing. Views flatter; calls are a buyer
 * picking up the phone.
 */
export default async function AnalyticsPage() {
  const token = (await getAccessToken())!;
  const page = await getMyListings(token, { limit: 50 }).catch(() => ({
    items: [],
    hasMore: false,
    nextCursor: null,
  }));

  const active = page.items.filter((listing) => listing.status === 'active');
  const totalCalls = page.items.reduce((sum, listing) => sum + listing.callCount, 0);
  const totalViews = page.items.reduce((sum, listing) => sum + listing.viewCount, 0);
  const callsPerActive = active.length ? totalCalls / active.length : null;

  // Sorted by calls: the list doubles as "which of my listings actually work".
  const ranked = [...page.items].sort((a, b) => b.callCount - a.callCount);
  const maxCalls = Math.max(1, ...ranked.map((listing) => listing.callCount));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl">Analitika</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Qaysi e&apos;loningiz ishlayapti — raqamlar bilan.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-line bg-cobalt p-5 text-white shadow-sm">
        <p className="flex items-center gap-2 text-sm text-white/75">
          <PhoneCall className="h-4 w-4" aria-hidden="true" />
          Bosh ko&apos;rsatkich: faol e&apos;lon boshiga qo&apos;ng&apos;iroq
        </p>
        <p className="numeric mt-2 text-4xl font-bold">
          {callsPerActive === null ? '—' : callsPerActive.toFixed(1)}
        </p>
        <p className="mt-1 text-xs text-white/60">
          {callsPerActive === null
            ? "Faol e'lon yo'q — bu ko'rsatkich e'lon joylagach paydo bo'ladi."
            : callsPerActive >= 1
              ? "Yaxshi: haftasiga e'lon boshiga 1+ qo'ng'iroq — sog'lom bozor belgisi."
              : "1 dan past — sarlavha va rasmlarni yaxshilash yoki narxni ko'rib chiqish foyda beradi."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Faol e'lonlar" value={String(active.length)} />
        <Stat label="Jami ko'rishlar" value={String(totalViews)} />
        <Stat label="Jami qo'ng'iroqlar" value={String(totalCalls)} />
      </div>

      <section className="rounded-2xl border border-slate-line bg-white shadow-sm">
        <h2 className="border-b border-slate-line px-5 py-4 text-lg">
          E&apos;lonlar bo&apos;yicha
        </h2>

        {ranked.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">
            Hali ma&apos;lumot yo&apos;q.
          </p>
        ) : (
          <ul className="divide-y divide-slate-line">
            {ranked.map((listing) => (
              <li key={listing.id} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/e/${listing.id}`}
                    className="block truncate text-sm font-semibold text-ink hover:underline"
                  >
                    {listing.title}
                  </Link>
                  <p className="numeric text-xs text-ink-faint">
                    {formatQuantity(listing.quantity, listing.quantityUnit)} ·{' '}
                    {formatTimeAgo(listing.createdAt)} ·{' '}
                    {listing.status === 'active' ? 'faol' : listing.status}
                  </p>
                  {/* Call bar, scaled to the best performer. */}
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-canvas">
                    <div
                      className="h-full rounded-full bg-harvest"
                      style={{ width: `${(listing.callCount / maxCalls) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="numeric shrink-0 text-right text-sm">
                  <p className="font-bold text-harvest">📞 {listing.callCount}</p>
                  <p className="text-xs text-ink-faint">👁 {listing.viewCount}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-line bg-white p-4 shadow-sm">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="numeric mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
