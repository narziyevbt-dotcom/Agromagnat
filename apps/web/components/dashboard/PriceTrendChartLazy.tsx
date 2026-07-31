'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/Skeleton';
import { WhenVisible } from '@/components/WhenVisible';
import type { PriceTrend } from '@/lib/types';

/**
 * The chart, fetched only when a page that has one is opened.
 *
 * Recharts and its d3 dependencies are 384 KB unminified — by a wide margin the
 * largest thing this application ships, and larger than the entire rest of the
 * dashboard put together. Imported directly it sat in `/dashboard`'s first
 * load: 271 KB of script and 660 ms of blocking time against 156–170 KB and
 * ~130 ms everywhere else, for a graph below the fold that most visits to that
 * page never scroll to.
 *
 * `ssr: false` on top of the split. The chart is behind a login, so nothing
 * here needs to be in the HTML for Google, and server-rendering an SVG only to
 * hydrate it again costs twice for no gain.
 *
 * Splitting alone was not enough — `next/dynamic` starts its fetch on mount,
 * so the bytes still landed inside the page load, just a round trip later.
 * `WhenVisible` is what actually keeps them off a visit that never scrolls.
 */
const PriceTrendChart = dynamic(
  () => import('./PriceTrendChart').then((module) => module.PriceTrendChart),
  {
    ssr: false,
    // Same card, same height. The chart drops into a space already reserved
    // for it, so arriving costs no layout shift.
    loading: () => <ChartSkeleton />,
  },
);

export function PriceTrendChartLazy({ trend }: { trend: PriceTrend | null }) {
  // The empty state is drawn here rather than inside the chart, so a new seller
  // with no price history behind their categories never downloads the chunk at
  // all — they would only have been shown this paragraph.
  if (!trend?.categories.length || !trend.points.length) {
    return (
      <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-hairline">
        <h2 className="text-lg">Bozor narxlari</h2>
        <p className="mt-6 rounded-2xl bg-surface-soft p-8 text-center text-sm text-ink-faint">
          Narx ma&apos;lumotlari hozircha yetarli emas.
        </p>
      </section>
    );
  }

  return (
    <WhenVisible fallback={<ChartSkeleton label="Bozor narxlari" />}>
      <PriceTrendChart trend={trend} />
    </WhenVisible>
  );
}
