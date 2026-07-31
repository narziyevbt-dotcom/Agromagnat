import { CalendarDays, Eye, Package, PhoneCall, Wallet } from 'lucide-react';
import { ListingsTable } from '@/components/dashboard/ListingsTable';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { PriceTrendChartLazy } from '@/components/dashboard/PriceTrendChartLazy';
import { getMe, getMyListings, getPriceTrend, getSellerStats } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { getAccessToken } from '@/lib/session';

/** Never cached — these are the caller's own live numbers. */
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // The layout has already established a session before this renders.
  const token = (await getAccessToken())!;

  const [stats, trend, listings, user] = await Promise.all([
    getSellerStats(token).catch(() => null),
    getPriceTrend().catch(() => null),
    getMyListings(token, { limit: 8 }).catch(() => ({
      items: [],
      hasMore: false,
      nextCursor: null,
    })),
    getMe(token).catch(() => null),
  ]);

  const today = new Date().toLocaleDateString('uz-UZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 py-1">
        <div>
          <h1 className="text-[1.75rem] leading-tight">
            Xush kelibsiz{user?.name ? `, ${user.name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            E&apos;lonlaringiz va bozor holati bir qarashda.
          </p>
        </div>

        <span className="numeric inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-xs font-semibold text-ink-muted ring-1 ring-hairline">
          <CalendarDays className="h-4 w-4 text-ink-faint" aria-hidden="true" />
          {today}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Faol e'lonlar"
          value={String(stats?.activeListings ?? 0)}
          suffix="ta"
          icon={Package}
          accent="forest"
        />
        <MetricCard
          label="Umumiy ko'rishlar"
          value={formatMoney(stats?.totalViews ?? 0)}
          icon={Eye}
          accent="turquoise"
          trendPct={stats?.viewsTrendPct ?? null}
          trendLabel={
            stats?.viewsTrendPct === null || stats?.viewsTrendPct === undefined
              ? undefined
              : "o'tgan oyga nisbatan"
          }
        />
        <MetricCard
          label="Qo'ng'iroqlar"
          value={formatMoney(stats?.totalCalls ?? 0)}
          suffix="ta"
          icon={PhoneCall}
          accent="saffron"
        />
        <MetricCard
          label="O'rtacha narx indeksi"
          value={stats?.avgPrice ? formatMoney(stats.avgPrice) : '—'}
          suffix={stats?.avgPrice ? `so'm/${stats.avgPriceUnit ?? 'kg'}` : undefined}
          icon={Wallet}
          accent="harvest"
          featured
        />
      </div>

      <PriceTrendChartLazy trend={trend} />

      <ListingsTable listings={listings.items} />
    </div>
  );
}
