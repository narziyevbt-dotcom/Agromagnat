import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { SearchFilters } from '@/components/SearchFilters';
import { SmartSearch } from '@/components/SmartSearch';
import { getCategories, getListings, getRegions } from '@/lib/api';
import { getAccessToken, isSignedIn } from '@/lib/session';
import { t } from '@/lib/strings';
import type { ListingFilters, ListingSort } from '@/lib/types';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: t.search.title,
  description: "Fermer mahsulotlarini hudud, hajm va narx bo'yicha qidiring.",
};

const one = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const num = (value: string | string[] | undefined): number | undefined => {
  const parsed = Number(one(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

function toFilters(params: Record<string, string | string[] | undefined>): ListingFilters {
  const sort = one(params.sort);
  return {
    q: one(params.q),
    categoryId: one(params.categoryId),
    regionId: one(params.regionId),
    districtId: one(params.districtId),
    priceMin: num(params.priceMin),
    priceMax: num(params.priceMax),
    quantityMin: num(params.quantityMin),
    verifiedOnly: one(params.verifiedOnly) === 'true' || undefined,
    withDelivery: one(params.withDelivery) === 'true' || undefined,
    sort: (['newest', 'cheapest', 'expensive'] as const).includes(sort as ListingSort)
      ? (sort as ListingSort)
      : undefined,
    cursor: one(params.cursor),
    limit: 24,
  };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = toFilters(params);

  const [categories, regions, signedIn] = await Promise.all([
    getCategories().catch(() => []),
    getRegions().catch(() => []),
    isSignedIn(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-8">
      <h1 className="mb-4 text-xl sm:text-2xl">
        {filters.q ? `"${filters.q}"` : t.search.title}
      </h1>

      {/* Above the filter bar rather than replacing it. The panel answers the
          buyer who can describe what they want; the filters serve the one who
          would rather point at it, and taking either away costs a real user. */}
      <SmartSearch signedIn={signedIn} />

      <div className="mt-5">
        <Suspense fallback={<div className="h-11" />}>
          <SearchFilters categories={categories} regions={regions} />
        </Suspense>
      </div>

      <div className="mt-5">
        <Suspense key={JSON.stringify(filters)} fallback={<ResultsSkeleton />}>
          <Results filters={filters} params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Results({
  filters,
  params,
}: {
  filters: ListingFilters;
  params: Record<string, string | string[] | undefined>;
}) {
  const signedIn = await isSignedIn();
  const token = signedIn ? await getAccessToken() : undefined;

  const feed = await getListings(filters, token).catch(() => null);

  if (!feed) {
    return (
      <p className="rounded-[var(--radius-card)] bg-surface p-8 text-center text-ink-muted ring-1 ring-hairline">
        {t.common.error}
      </p>
    );
  }

  if (feed.items.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-surface p-10 text-center ring-1 ring-hairline">
        <p className="text-lg font-semibold text-ink">{t.search.resultsEmpty}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          {t.search.resultsEmptyHint}
        </p>
        <Link
          href="/qidiruv"
          className="tap-target mt-5 inline-flex items-center rounded-lg px-4 text-sm font-medium text-turquoise ring-1 ring-hairline"
        >
          {t.search.reset}
        </Link>
      </div>
    );
  }

  // "Next page" is a link, not a button — it keeps the results crawlable and
  // works with the back button without any client state.
  const nextParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single && key !== 'cursor') {
      nextParams.set(key, single);
    }
  }
  if (feed.nextCursor) {
    nextParams.set('cursor', feed.nextCursor);
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {feed.items.map((listing, index) => (
          <li key={listing.id}>
            <ListingCard listing={listing} signedIn={signedIn} priority={index < 4} />
          </li>
        ))}
      </ul>

      {feed.hasMore && feed.nextCursor && (
        <div className="mt-6 flex justify-center">
          <Link
            href={`/qidiruv?${nextParams.toString()}`}
            className="tap-target inline-flex items-center rounded-lg bg-surface px-6 text-sm font-semibold text-forest ring-1 ring-hairline hover:ring-turquoise"
          >
            {t.search.loadMore}
          </Link>
        </div>
      )}
    </>
  );
}

function ResultsSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <li key={index}>
          <ListingCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
