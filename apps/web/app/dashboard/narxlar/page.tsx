import { TrendingDown, TrendingUp } from 'lucide-react';
import { PriceTrendChartLazy } from '@/components/dashboard/PriceTrendChartLazy';
import { getPriceTrend, getRegions } from '@/lib/api';
import { formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Search = Promise<{ regionId?: string }>;

/**
 * The market-price page: the six-month chart plus this month's medians with
 * their month-over-month movement, optionally narrowed to one region.
 *
 * This is the screen the book wants farmers returning to daily — "know the
 * market price without going to the bazaar".
 */
export default async function MarketPricesPage({ searchParams }: { searchParams: Search }) {
  const { regionId } = await searchParams;

  const [regions, trend] = await Promise.all([
    getRegions().catch(() => []),
    getPriceTrend(undefined, regionId || undefined).catch(() => null),
  ]);

  const rows = latestRows(trend);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Bozor narxlari</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Faol e&apos;lonlardan hisoblangan mediana — bozorga bormasdan bilib turasiz.
          </p>
        </div>

        {/* GET form: the chosen region lives in the URL, shareable like any filter. */}
        <form action="/dashboard/narxlar" method="get">
          <label className="sr-only" htmlFor="regionId">
            Hudud
          </label>
          <select
            id="regionId"
            name="regionId"
            defaultValue={regionId ?? ''}
            className="tap-target rounded-xl border border-slate-line bg-white px-3 text-sm"
          >
            <option value="">Butun O&apos;zbekiston</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.nameUz}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="tap-target ml-2 rounded-xl bg-forest px-4 text-sm font-semibold text-white"
          >
            Ko&apos;rish
          </button>
        </form>
      </div>

      {rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {rows.map((row) => (
            <div
              key={row.slug}
              className="rounded-2xl border border-slate-line bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-ink-muted">{row.nameUz}</p>
              <p className="numeric mt-1 text-xl font-bold text-harvest">
                {`${formatMoney(row.price)} so’m/kg`}
              </p>
              {row.changePct !== null && (
                <p
                  className={`numeric mt-1 inline-flex items-center gap-1 text-xs font-semibold ${
                    row.changePct >= 0 ? 'text-harvest' : 'text-danger'
                  }`}
                >
                  {row.changePct >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {row.changePct >= 0 ? '+' : ''}
                  {row.changePct.toFixed(1)}% o&apos;tgan oyga nisbatan
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <PriceTrendChartLazy trend={trend} />

      <p className="text-xs text-ink-faint">
        Narxlar so&apos;m/kg da, faqat kilogramm bilan narxlangan e&apos;lonlardan
        hisoblanadi. Ma&apos;lumot kam bo&apos;lgan oylar grafikda bo&apos;sh qoladi.
      </p>
    </div>
  );
}

interface Row {
  slug: string;
  nameUz: string;
  price: number;
  changePct: number | null;
}

/** Latest month with data per category, vs the previous month that had data. */
function latestRows(
  trend: Awaited<ReturnType<typeof getPriceTrend>> | null,
): Row[] {
  if (!trend?.categories.length) {
    return [];
  }

  return trend.categories.flatMap((category) => {
    const series = trend.points
      .map((point) => point.values[category.slug])
      .filter((value): value is number => value !== null && value !== undefined);

    if (!series.length) return [];

    const latest = series[series.length - 1];
    const previous = series.length > 1 ? series[series.length - 2] : null;

    return [
      {
        slug: category.slug,
        nameUz: category.nameUz,
        price: latest,
        changePct:
          previous && previous > 0
            ? Math.round(((latest - previous) / previous) * 1000) / 10
            : null,
      },
    ];
  });
}
