import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ListingCard } from '@/components/ListingCard';
import { getFavorites } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { t } from '@/lib/strings';

export const metadata: Metadata = {
  title: t.profile.favorites,
  robots: { index: false, follow: false },
};

export default async function FavoritesPage() {
  const token = await getAccessToken();
  if (!token) {
    redirect('/kirish?next=/sevimlilar');
  }

  const listings = await getFavorites(token).catch(() => []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-8">
      <h1 className="mb-4 text-xl sm:text-2xl">{t.profile.favorites}</h1>

      {listings.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-surface p-10 text-center ring-1 ring-hairline">
          <p className="text-lg font-semibold text-ink">{t.profile.noFavorites}</p>
          <p className="mt-1 text-sm text-ink-muted">{t.profile.noFavoritesHint}</p>
          <Link
            href="/qidiruv"
            className="tap-target mt-5 inline-flex items-center rounded-lg px-4 text-sm font-medium text-turquoise ring-1 ring-hairline"
          >
            {t.search.title}
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing) => (
            <li key={listing.id}>
              <ListingCard listing={listing} signedIn />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
