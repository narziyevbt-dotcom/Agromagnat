import Link from 'next/link';
import { t } from '@/lib/strings';
import type { Category } from '@/lib/types';

/**
 * Emoji stand in for the icon set until real artwork exists. They cost nothing
 * to ship, render on every Android in the target market, and are trivially
 * swapped for SVGs later — the mapping is by category slug, not by position.
 */
const ICONS: Record<string, string> = {
  mevalar: '🍎',
  sabzavotlar: '🥕',
  poliz: '🍉',
  'quruq-meva': '🍇',
  'don-va-dukkak': '🌾',
  kokatlar: '🌿',
  'urug-va-kochat': '🌱',
  'ogit-va-kimyo': '🧪',
  texnika: '🚜',
  'chorva-ozuqasi': '🐄',
  xizmatlar: '🚚',
  yer: '🏞️',
};

export function CategoryGrid({
  categories,
  limit,
}: {
  categories: Category[];
  limit?: number;
}) {
  const shown = limit ? categories.slice(0, limit) : categories;
  const hasMore = limit !== undefined && categories.length > limit;

  return (
    <section aria-labelledby="categories-heading">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="categories-heading" className="text-lg font-bold text-ink">
          {t.home.categories}
        </h2>
        {hasMore && (
          <Link href="/qidiruv" className="text-sm font-medium text-turquoise hover:underline">
            {t.home.allCategories} →
          </Link>
        )}
      </div>

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {shown.map((category) => (
          <li key={category.id}>
            <Link
              href={`/qidiruv?categoryId=${category.id}`}
              className="tap-target flex h-full flex-col items-center justify-center gap-1.5 rounded-xl bg-surface p-2 ring-1 ring-hairline transition-colors hover:ring-turquoise"
            >
              <span className="text-2xl" aria-hidden="true">
                {ICONS[category.slug] ?? '🌾'}
              </span>
              <span className="text-center text-[11px] leading-tight font-medium text-ink">
                {category.nameUz}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
