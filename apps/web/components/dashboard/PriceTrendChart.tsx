'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/lib/format';
import type { PriceTrend } from '@/lib/types';

/**
 * Six-month median price per category.
 *
 * Colours come from the brand palette rather than Recharts' defaults, and are
 * assigned by index so a category always keeps the same colour across the
 * legend, the bars and the tooltip.
 */
const SERIES_COLORS = ['#1F7A4D', '#2FA36A', '#1D7F8C', '#C2DA51', '#C4452F'];

const MONTHS_SHORT = [
  'Yan',
  'Fev',
  'Mar',
  'Apr',
  'May',
  'Iyn',
  'Iyl',
  'Avg',
  'Sen',
  'Okt',
  'Noy',
  'Dek',
];

/** "2026-07" -> "Iyl" */
function monthLabel(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return MONTHS_SHORT[index] ?? month;
}

interface Row {
  month: string;
  [slug: string]: string | number | null;
}

export function PriceTrendChart({ trend }: { trend: PriceTrend | null }) {
  const [mode, setMode] = useState<'bar' | 'line'>('bar');

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

  const data: Row[] = trend.points.map((point) => ({
    month: monthLabel(point.month),
    ...point.values,
  }));

  const Chart = mode === 'bar' ? BarChart : LineChart;

  return (
    <section className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-hairline sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg">Bozor narxlari o&apos;zgarishi</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Oxirgi 6 oy, mediana narx (so&apos;m/kg)
          </p>
        </div>

        {/* Pill segmented control, the shape every reference dashboard uses
            for "this switches the view" as opposed to "this submits". */}
        <div
          className="flex items-center rounded-full bg-surface-soft p-1 ring-1 ring-hairline"
          role="group"
          aria-label="Grafik turi"
        >
          {(['bar', 'line'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              aria-pressed={mode === option}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                mode === option
                  ? 'bg-forest text-white shadow-sm'
                  : 'text-ink-faint hover:text-ink'
              }`}
            >
              {option === 'bar' ? 'Ustun' : 'Chiziq'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            {/* One gradient per series: solid at the cap, fading toward the
                baseline, so a column reads as growing out of the axis rather
                than as a block sitting on it. */}
            <defs>
              {SERIES_COLORS.map((color, index) => (
                <linearGradient
                  key={index}
                  id={`bar-${index}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.28} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="4 6" stroke="#E4E9E4" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: '#8B978F', fontSize: 12, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tick={{ fill: '#8B978F', fontSize: 12, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={64}
              tickFormatter={(value: number) => formatMoney(value)}
            />
            <Tooltip
              cursor={{ fill: 'rgba(11,29,20,0.04)' }}
              /* Dark floating card, the treatment every reference uses — it
                 lifts off a white chart in a way a white tooltip cannot. */
              contentStyle={{
                borderRadius: 14,
                border: 'none',
                background: '#0B1D14',
                boxShadow: '0 12px 28px -8px rgba(11,29,20,0.45)',
                fontSize: 12,
                padding: '10px 12px',
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}
              itemStyle={{ color: '#FFFFFF', fontWeight: 600 }}
              formatter={(value, name) =>
                [`${formatMoney(Number(value))} so'm/kg`, String(name)] as [string, string]
              }
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 12 }}
            />

            {trend.categories.map((category, index) =>
              mode === 'bar' ? (
                <Bar
                  key={category.slug}
                  dataKey={category.slug}
                  name={category.nameUz}
                  fill={`url(#bar-${index % SERIES_COLORS.length})`}
                  radius={[10, 10, 10, 10]}
                  maxBarSize={26}
                />
              ) : (
                <Line
                  key={category.slug}
                  type="monotone"
                  dataKey={category.slug}
                  name={category.nameUz}
                  stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  // A month with no listings is a gap, not a zero — joining
                  // across it would draw a crash that never happened.
                  connectNulls={false}
                />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
