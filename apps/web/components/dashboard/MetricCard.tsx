import { ArrowDownRight, ArrowUpRight, MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * One figure from the dashboard header row.
 *
 * The figure is the card. Everything else — the icon chip, the label, the
 * delta — is sized to stay out of its way, which is why the number runs at
 * 2.5rem in extra-bold while the label sits at 12px in a muted grey.
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
  accent = 'forest',
  featured = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: LucideIcon;
  trendPct?: number | null;
  trendLabel?: string;
  accent?: 'forest' | 'turquoise' | 'harvest' | 'saffron';
  /** Fills the card lime — at most one per row, the way the references do it. */
  featured?: boolean;
}) {
  const chips = {
    forest: 'bg-forest/8 text-forest',
    turquoise: 'bg-turquoise/10 text-turquoise',
    harvest: 'bg-mint text-harvest',
    saffron: 'bg-saffron/12 text-saffron-dark',
  } as const;

  const up = (trendPct ?? 0) >= 0;
  const TrendIcon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <article
      className={`rounded-3xl p-5 transition-shadow ${
        featured
          ? 'bg-lime text-forest'
          : 'bg-surface shadow-sm ring-1 ring-hairline hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
              featured ? 'bg-forest/12 text-forest' : chips[accent]
            }`}
          >
            <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
          </span>
          <p
            className={`text-[13px] font-semibold ${
              featured ? 'text-forest/75' : 'text-ink-muted'
            }`}
          >
            {label}
          </p>
        </div>

        <MoreHorizontal
          className={`h-4 w-4 ${featured ? 'text-forest/40' : 'text-ink-faint'}`}
          aria-hidden="true"
        />
      </div>

      <p
        className={`figure-xl mt-4 text-[2.1rem] ${
          featured ? 'text-forest' : 'text-ink'
        }`}
      >
        {value}
        {suffix && (
          <span
            className={`ml-1.5 text-base font-semibold tracking-normal ${
              featured ? 'text-forest/60' : 'text-ink-faint'
            }`}
          >
            {suffix}
          </span>
        )}
      </p>

      {trendPct !== null && (
        <p className="mt-3 flex items-center gap-2">
          <span
            className={`numeric inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-bold ${
              up ? 'bg-mint text-harvest' : 'bg-danger/10 text-danger'
            }`}
          >
            <TrendIcon className="h-3 w-3" aria-hidden="true" />
            {up ? '+' : ''}
            {trendPct.toFixed(1)}%
          </span>
          {trendLabel && (
            <span
              className={`text-[11px] ${featured ? 'text-forest/55' : 'text-ink-faint'}`}
            >
              {trendLabel}
            </span>
          )}
        </p>
      )}
    </article>
  );
}
