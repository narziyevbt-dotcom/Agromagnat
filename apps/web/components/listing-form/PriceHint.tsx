'use client';

import { useEffect, useState } from 'react';
import { Info, TrendingDown, TrendingUp } from 'lucide-react';
import type { PriceSuggestion } from '@/lib/types';

/** Below this the hint hedges rather than presenting itself as the market price. */
const CONFIDENT = 0.5;

const DEBOUNCE_MS = 400;

/**
 * The market price, under the price field.
 *
 * This is the answer to "why not just use OLX". A general classifieds board can
 * tell a farmer what other people are asking; it cannot tell them what tomatoes
 * in their district actually sold for over the last two months, because it does
 * not know that a listing has a volume, a unit and a harvest behind it. This
 * one number is the platform's whole argument, so it sits where the decision is
 * made rather than on a separate analytics page.
 *
 * It never writes to the price field. A farmer's price is theirs; the tap that
 * accepts the suggestion has to be deliberate, and the range is shown alongside
 * so accepting the median is visibly a choice among several defensible numbers.
 */
export function PriceHint({
  categoryId,
  regionId,
  unit,
  quantity,
  onApply,
}: {
  categoryId: string;
  regionId?: string;
  unit: string;
  quantity?: number;
  onApply: (price: string) => void;
}) {
  const [data, setData] = useState<PriceSuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!categoryId || !unit) {
      setData(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/pricing/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId, regionId, unit, quantity }),
          signal: controller.signal,
        });
        if (response.ok) setData((await response.json()) as PriceSuggestion);
      } catch {
        // Aborted or offline. The field works without a hint.
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [categoryId, regionId, unit, quantity]);

  if (loading && !data) {
    return <p className="mt-1.5 text-xs text-ink-faint">Bozor narxi tekshirilmoqda...</p>;
  }

  // No data is a normal state for a young category, not an error worth a box.
  if (!data?.range) return null;

  const confident = data.confidence >= CONFIDENT;
  const suggested = Math.round(Number(data.range.suggested));

  return (
    <div
      className={`mt-2 rounded-xl p-3 ring-1 ${
        confident ? 'bg-mint ring-harvest/20' : 'bg-canvas ring-hairline'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`text-xs font-bold ${confident ? 'text-harvest' : 'text-ink-muted'}`}
        >
          {confident ? 'Bozor narxi' : 'Taxminiy narx'}
        </span>

        {data.trendPct !== null && Math.abs(data.trendPct) >= 3 && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              data.trendPct > 0 ? 'bg-harvest/10 text-harvest' : 'bg-danger/10 text-danger'
            }`}
          >
            {data.trendPct > 0 ? (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            {Math.abs(Math.round(data.trendPct))}%
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
        <button
          type="button"
          onClick={() => onApply(String(suggested))}
          className="numeric rounded-lg bg-forest px-2.5 py-1 text-sm font-bold text-lime transition-colors hover:bg-forest-soft"
        >
          {suggested.toLocaleString('ru-RU').replace(/ /g, ' ')} so&apos;m
        </button>
        <span className="numeric text-xs text-ink-muted">
          {Math.round(Number(data.range.min)).toLocaleString('ru-RU').replace(/ /g, ' ')}
          {' — '}
          {Math.round(Number(data.range.max)).toLocaleString('ru-RU').replace(/ /g, ' ')}
          {` so'm/${unit}`}
        </span>
      </div>

      {/* The provenance sentence. A number with no basis is a number to argue
          with; "34 sales in your region" is one to trust or to reject on the
          merits. It comes from the API so it can never disagree with the
          figures above it. */}
      <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-muted">
        <Info className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
        {data.reasonUz}
      </p>
    </div>
  );
}
