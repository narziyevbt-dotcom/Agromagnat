import Link from 'next/link';
import { CategoryGrid } from '@/components/CategoryGrid';
import { ListingCard } from '@/components/ListingCard';
import { getCategories, getListings } from '@/lib/api';
import { isSignedIn, getAccessToken } from '@/lib/session';
import { t } from '@/lib/strings';

/**
 * Home. Rendered on the server so the newest listings are in the HTML —
 * a classifieds site lives on search traffic, and a client-rendered feed is
 * invisible to a crawler.
 */
export const revalidate = 60;

export default async function HomePage() {
  const signedIn = await isSignedIn();
  const token = signedIn ? await getAccessToken() : undefined;

  // Reference data and the feed are independent; fetch them together.
  const [categories, feed] = await Promise.all([
    getCategories().catch(() => []),
    getListings({ limit: 24 }, token).catch(() => ({
      items: [],
      hasMore: false,
      nextCursor: null,
    })),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-8">
      <section className="mb-8 overflow-hidden rounded-[var(--radius-card)] bg-cobalt px-5 py-8 text-white sm:px-8 sm:py-10">
        <h1 className="max-w-2xl text-2xl leading-tight sm:text-4xl">
          {t.home.heroTitle}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
          {t.home.heroSubtitle}
        </p>
        <Link
          href="/joylash"
          className="tap-target mt-5 inline-flex items-center rounded-lg bg-saffron px-5 text-sm font-semibold text-white transition-colors hover:bg-saffron-dark"
        >
          + {t.nav.add}
        </Link>
      </section>

      {categories.length > 0 && (
        <div className="mb-8">
          <CategoryGrid categories={categories} limit={8} />
        </div>
      )}

      <section aria-labelledby="latest-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="latest-heading" className="text-lg font-bold text-ink">
            {t.home.latest}
          </h2>
          <Link
            href="/qidiruv"
            className="text-sm font-medium text-turquoise hover:underline"
          >
            {t.home.seeAll} →
          </Link>
        </div>

        {feed.items.length === 0 ? (
          <div className="rounded-[var(--radius-card)] bg-surface p-8 text-center ring-1 ring-hairline">
            <p className="text-ink-muted">{t.search.resultsEmpty}</p>
            <p className="mt-1 text-sm text-ink-faint">{t.profile.noListingsHint}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {feed.items.map((listing, index) => (
              <li key={listing.id}>
                <ListingCard
                  listing={listing}
                  signedIn={signedIn}
                  priority={index < 4}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
