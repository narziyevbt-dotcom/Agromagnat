import { TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * One figure from the dashboard header row.
 *
 * `trendPct` is nullable and renders as nothing when absent. A dashboard that
 * invents a comparison it cannot compute teaches the farmer to distrust every
 * other number on the page.
 */
export function MetricCard({
  label,
  value,
  suffix,
  icon: Icon,
  trendPct = null,
  trendLabel,
  accent = 'cobalt',
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: LucideIcon;
  trendPct?: number | null;
  trendLabel?: string;
  accent?: 'cobalt' | 'turquoise' | 'harvest' | 'saffron';
}) {
  const accents = {
    cobalt: 'bg-cobalt/8 text-cobalt',
    turquoise: 'bg-turquoise/10 text-turquoise',
    harvest: 'bg-harvest/10 text-harvest',
    saffron: 'bg-saffron/12 text-saffron-dark',
  } as const;

  const up = (trendPct ?? 0) >= 0;
  const TrendIcon = up ? TrendingUp : TrendingDown;

  return (
    <article className="rounded-2xl border border-slate-line bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${accents[accent]}`}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>

        {trendPct !== null && (
          <span
            className={`numeric inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
              up ? 'bg-harvest/10 text-harvest' : 'bg-danger/10 text-danger'
            }`}
          >
            <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {up ? '+' : ''}
            {trendPct.toFixed(1)}%
          </span>
        )}
      </div>

      <p className="mt-4 text-xs font-medium text-ink-muted">{label}</p>
      <p className="numeric mt-1 text-2xl leading-tight font-bold text-ink">
        {value}
        {suffix && <span className="ml-1 text-base font-semibold text-ink-muted">{suffix}</span>}
      </p>

      {trendLabel && <p className="mt-1 text-[11px] text-ink-faint">{trendLabel}</p>}
    </article>
  );
}
