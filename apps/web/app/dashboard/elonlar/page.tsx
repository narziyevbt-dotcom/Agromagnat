import Link from 'next/link';
import { MyListingRow } from '@/app/(site)/profil/MyListingRow';
import { getMyListings } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import type { ListingStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const FILTERS: Array<{ value: ListingStatus | ''; label: string }> = [
  { value: '', label: 'Barchasi' },
  { value: 'active', label: 'Faol' },
  { value: 'pending', label: 'Tekshiruvda' },
  { value: 'sold', label: 'Sotilgan' },
  { value: 'expired', label: 'Muddati tugagan' },
  { value: 'blocked', label: 'Bloklangan' },
];

type Search = Promise<{ status?: string }>;

/**
 * The seller's own listings, filterable by status. /listings/me returns every
 * status in one page (a seller's catalogue is small), so the filter is applied
 * here rather than with another round trip.
 */
export default async function MyListingsPage({ searchParams }: { searchParams: Search }) {
  const token = (await getAccessToken())!;
  const { status } = await searchParams;

  const page = await getMyListings(token, { limit: 50 }).catch(() => ({
    items: [],
    hasMore: false,
    nextCursor: null,
  }));

  const items = status
    ? page.items.filter((listing) => listing.status === status)
    : page.items;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl">E&apos;lonlarim</h1>
        <p className="numeric text-sm text-ink-muted">{items.length} ta</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={
              filter.value
                ? `/dashboard/elonlar?status=${filter.value}`
                : '/dashboard/elonlar'
            }
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              (status ?? '') === filter.value
                ? 'bg-forest text-white'
                : 'bg-white text-ink-muted ring-1 ring-slate-line hover:text-ink'
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-line bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-ink">
            {status ? 'Bu holatda e’lon yo‘q' : 'Sizda hali e’lon yo‘q'}
          </p>
          <Link
            href="/joylash"
            className="tap-target mt-4 inline-flex items-center rounded-xl bg-lime px-5 text-sm font-semibold text-forest hover:bg-lime-dark"
          >
            + Yangi e&apos;lon
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((listing) => (
            <li key={listing.id}>
              <MyListingRow listing={listing} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
