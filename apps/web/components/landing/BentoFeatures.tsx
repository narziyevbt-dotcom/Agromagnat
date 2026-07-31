import { Mic, PhoneCall, TrendingDown, TrendingUp } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import type { PriceTrend } from '@/lib/types';

/**
 * Bento grid of the three things that make this different from a general
 * classifieds board: a price index, voice posting, and a direct line to the
 * farmer.
 *
 * Card A shows real medians pulled from live listings rather than a mock —
 * a price widget that lies is worse than none.
 */
export function BentoFeatures({ trend }: { trend: PriceTrend | null }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl sm:text-[2.75rem] sm:leading-[1.08]">Nima uchun Agromagnat</h2>
        <p className="mt-3 text-base text-ink-muted">
          Oddiy e&apos;lonlar taxtasi emas — hajm, mavsum va narx bo&apos;yicha
          ishlaydigan agro bozor.
        </p>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <PriceIndexCard trend={trend} />
        <VoiceCard />
        <DirectContactCard />
      </div>
    </section>
  );
}

/** Card A — live market price index with month-over-month movement. */
function PriceIndexCard({ trend }: { trend: PriceTrend | null }) {
  const rows = buildRows(trend);

  return (
    <article className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-hairline lg:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl">Bozor narxlari indeksi</h3>
          <p className="mt-1.5 text-sm text-ink-muted">
            Har kuni yangilanadigan real narxlar — bozorga bormasdan bilib turasiz.
          </p>
        </div>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-[11px] font-bold text-harvest sm:flex">
          Jonli
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-surface-soft p-6 text-center text-sm text-ink-faint">
          Narx indeksi hozircha yig&apos;ilmoqda.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {rows.map((row) => (
            <li
              key={row.slug}
              className="flex items-center justify-between rounded-2xl bg-surface-soft px-4 py-3"
            >
              <span className="text-sm font-medium text-ink">{row.nameUz}</span>
              <span className="flex items-center gap-3">
                <span className="numeric text-base font-bold text-harvest">
                  {/* Explicit string — JSX drops the space before a line break. */}
                  {`${formatMoney(row.price)} so’m/kg`}
                </span>
                <TrendChip value={row.changePct} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** Green for a rise, red for a fall — the seller's perspective, not the buyer's. */
function TrendChip({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="numeric w-16 text-right text-xs text-ink-faint">—</span>;
  }

  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <span
      className={`numeric inline-flex w-16 items-center justify-end gap-1 text-xs font-semibold ${
        up ? 'text-harvest' : 'text-danger'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {up ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}

/** Card B — voice-to-listing. */
function VoiceCard() {
  return (
    <article className="flex flex-col rounded-3xl bg-forest p-6 text-white shadow-sm">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime text-forest">
        <Mic className="h-5 w-5" aria-hidden="true" />
      </span>

      <h3 className="mt-4 text-xl text-white">Ovoz bilan e&apos;lon</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/70">
        Yozishning hojati yo&apos;q. Mikrofonni bosib gapiring — sun&apos;iy intellekt
        sarlavha, hajm va narxni o&apos;zi to&apos;ldiradi.
      </p>

      {/* Waveform standing in for a recording in progress. */}
      <div className="mt-auto flex items-end gap-1 pt-6" aria-hidden="true">
        {[14, 26, 38, 22, 44, 30, 18, 36, 24, 40, 16, 28, 20, 34].map((height, index) => (
          <span
            key={index}
            className="w-1.5 rounded-full bg-lime/70"
            style={{ height: `${height}px` }}
          />
        ))}
      </div>

      <p className="numeric mt-3 text-xs text-white/50">00:07 · yozilmoqda</p>
    </article>
  );
}

/** Card C — direct contact. */
function DirectContactCard() {
  return (
    <article className="relative rounded-3xl bg-lime p-6 lg:col-span-3">
      <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr_auto]">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest/12 text-forest">
          <PhoneCall className="h-5 w-5" aria-hidden="true" />
        </span>

        <div>
          <h3 className="text-xl text-forest">To&apos;g&apos;ridan-to&apos;g&apos;ri aloqa</h3>
          <p className="mt-1.5 max-w-xl text-sm text-forest/70">
            Xaridor bir bosishda fermerga qo&apos;ng&apos;iroq qiladi. Oradagi hech kim
            narxni tushirmaydi, komissiya olmaydi.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-white">
          <PhoneCall className="h-4 w-4" aria-hidden="true" />
          <span className="numeric text-sm font-bold">+998 90 123-45-67</span>
        </div>
      </div>
    </article>
  );
}

interface Row {
  slug: string;
  nameUz: string;
  price: number;
  changePct: number | null;
}

/**
 * Latest month with data per category, plus its change against the previous
 * month that had data. Months with no listings are skipped rather than treated
 * as a zero, which would render as a 100% crash.
 */
function buildRows(trend: PriceTrend | null): Row[] {
  if (!trend?.categories.length) {
    return [];
  }

  return trend.categories.flatMap((category) => {
    const series = trend.points
      .map((point) => point.values[category.slug])
      .filter((value): value is number => value !== null && value !== undefined);

    if (!series.length) {
      return [];
    }

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
