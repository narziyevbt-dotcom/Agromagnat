import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { ListingCard } from '@/components/ListingCard';
import { t } from '@/lib/strings';
import type { Category, Listing } from '@/lib/types';
import { CategoryTiles } from './CategoryTiles';
import { HomeSearch } from './HomeSearch';

/**
 * Home for somebody who has an account.
 *
 * The marketing landing is aimed at a visitor deciding whether to trust the
 * site; a farmer who already signed up has decided, and showing them the pitch
 * again every session costs a scroll before they can do anything. So: search,
 * categories, listings — the shape the audience already knows from every other
 * classifieds app they use.
 */
export function SignedInHome({
  name,
  categories,
  listings,
}: {
  name: string | null;
  categories: Category[];
  listings: Listing[];
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 sm:py-6">
      <HomeSearch />

      <CategoryTiles categories={categories} />

      <PostPrompt name={name} />

      <section aria-labelledby="home-feed">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="home-feed" className="text-lg font-bold text-ink">
            {t.home.latest}
          </h2>
          <Link
            href="/qidiruv"
            className="inline-flex items-center gap-1 text-sm font-medium text-harvest hover:underline"
          >
            {t.home.seeAll}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {listings.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing, index) => (
              <li key={listing.id}>
                <ListingCard listing={listing} signedIn priority={index < 4} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-muted ring-1 ring-hairline">
            Hozircha e&apos;lon yo&apos;q. Birinchi bo&apos;lib joylang.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * The one piece of persuasion that stays on the signed-in home, because it is
 * the action the business needs and the one a seller postpones.
 */
function PostPrompt({ name }: { name: string | null }) {
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-mint p-4 ring-1 ring-harvest/15 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-harvest text-white">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold text-forest">
            {name ? `${name}, hosilingiz bormi?` : 'Hosilingiz bormi?'}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Bir jumla yozing — AI e&apos;lonni o&apos;zi to&apos;ldirib beradi.
          </p>
        </div>
      </div>

      <Link
        href="/joylash"
        className="tap-target group inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-lime py-1.5 pr-1.5 pl-5 text-sm font-bold text-forest transition-colors hover:bg-lime-dark sm:self-auto"
      >
        {t.nav.add}
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-lime transition-transform group-hover:rotate-45">
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>
    </section>
  );
}
