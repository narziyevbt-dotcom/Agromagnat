import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListingCard } from '@/components/ListingCard';
import { getListings } from '@/lib/api';
import { initials } from '@/lib/format';
import { getAccessToken, isSignedIn } from '@/lib/session';
import { t } from '@/lib/strings';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const feed = await getListings({ sellerId: id, limit: 1 }).catch(() => null);
  const seller = feed?.items[0]?.seller;

  return {
    title: seller?.name ?? t.listing.seller,
    description: `${seller?.name ?? 'Sotuvchi'} — Agromagnatdagi e'lonlar.`,
  };
}

export default async function SellerPage({ params }: Props) {
  const { id } = await params;
  const signedIn = await isSignedIn();
  const token = signedIn ? await getAccessToken() : undefined;

  const feed = await getListings({ sellerId: id, limit: 24 }, token).catch(() => null);
  if (!feed || feed.items.length === 0) {
    notFound();
  }

  const seller = feed.items[0].seller;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-8">
      <section className="mb-6 flex items-center gap-4 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-hairline">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cobalt text-lg font-bold text-white">
          {initials(seller?.name ?? null)}
        </span>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 truncate text-xl">
            {seller?.name ?? 'Sotuvchi'}
            {seller?.isVerified && (
              <span className="text-turquoise" title={t.listing.verified}>
                ✓
              </span>
            )}
          </h1>
          <p className="numeric text-sm text-ink-muted">
            ★ {Number(seller?.ratingAvg ?? 0).toFixed(1)} · {seller?.salesCount ?? 0}{' '}
            {t.listing.sales}
          </p>
        </div>
      </section>

      <h2 className="mb-3 text-lg font-bold text-ink">{t.listing.otherListings}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {feed.items.map((listing) => (
          <li key={listing.id}>
            <ListingCard listing={listing} signedIn={signedIn} />
          </li>
        ))}
      </ul>
    </div>
  );
}
