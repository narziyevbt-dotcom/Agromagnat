import { Eye, Package, PhoneCall, Wallet } from 'lucide-react';
import { ListingsTable } from '@/components/dashboard/ListingsTable';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { PriceTrendChart } from '@/components/dashboard/PriceTrendChart';
import { getMyListings, getPriceTrend, getSellerStats } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { getAccessToken } from '@/lib/session';

/** Never cached — these are the caller's own live numbers. */
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // The layout has already established a session before this renders.
  const token = (await getAccessToken())!;

  const [stats, trend, listings] = await Promise.all([
    getSellerStats(token).catch(() => null),
    getPriceTrend().catch(() => null),
    getMyListings(token, { limit: 8 }).catch(() => ({
      items: [],
      hasMore: false,
      nextCursor: null,
    })),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl">Asosiy panel</h1>
        <p className="mt-1 text-sm text-ink-muted">
          E&apos;lonlaringiz va bozor holati bir qarashda.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Faol e'lonlar"
          value={String(stats?.activeListings ?? 0)}
          suffix="ta"
          icon={Package}
          accent="cobalt"
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
        />
      </div>

      <PriceTrendChart trend={trend} />

      <ListingsTable listings={listings.items} />
    </div>
  );
}
