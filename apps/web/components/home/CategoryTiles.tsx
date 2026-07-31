import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { t } from '@/lib/strings';
import type { Category } from '@/lib/types';

/**
 * The category grid, sitting between the search box and the feed.
 *
 * Four across on a phone rather than three: twelve categories then fit in three
 * rows, so the whole taxonomy is visible without scrolling and the feed starts
 * above the fold. Each tile is a full card rather than a bare icon — the tap
 * target is the whole thing, which matters for a thumb in a field.
 */
export function CategoryTiles({ categories }: { categories: Category[] }) {
  if (!categories.length) return null;

  return (
    <section aria-labelledby="home-categories">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="home-categories" className="text-lg font-bold text-ink">
          {t.home.categories}
        </h2>
        <Link
          href="/qidiruv"
          className="inline-flex items-center gap-1 text-sm font-medium text-harvest hover:underline"
        >
          {t.home.allCategories}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3 lg:grid-cols-12">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={`/qidiruv?categoryId=${category.id}`}
              className="tap-target flex h-full flex-col items-center justify-start gap-1.5 rounded-2xl bg-surface p-2 pt-3 ring-1 ring-hairline transition-all hover:-translate-y-0.5 hover:ring-harvest sm:p-3"
            >
              <CategoryIcon slug={category.slug} className="h-11 w-11 sm:h-12 sm:w-12" />
              <span className="text-center text-[11px] leading-tight font-medium text-ink sm:text-xs">
                {category.nameUz}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
