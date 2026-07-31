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
const SERIES_COLORS = ['#1F7A4D', '#1D7F8C', '#E0932A', '#0A3A55', '#C4452F'];

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
      <section className="rounded-2xl border border-slate-line bg-white p-6 shadow-sm">
        <h2 className="text-lg">Bozor narxlari</h2>
        <p className="mt-6 rounded-xl bg-slate-canvas p-8 text-center text-sm text-ink-faint">
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
    <section className="rounded-2xl border border-slate-line bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg">Bozor narxlari o&apos;zgarishi</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Oxirgi 6 oy, mediana narx (so&apos;m/kg)
          </p>
        </div>

        <div
          className="flex overflow-hidden rounded-xl border border-slate-line"
          role="group"
          aria-label="Grafik turi"
        >
          {(['bar', 'line'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              aria-pressed={mode === option}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${
                mode === option
                  ? 'bg-cobalt text-white'
                  : 'bg-white text-ink-muted hover:bg-slate-canvas'
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
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: '#5B6B75', fontSize: 12, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#5B6B75', fontSize: 12, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              width={64}
              tickFormatter={(value: number) => formatMoney(value)}
            />
            <Tooltip
              cursor={{ fill: 'rgba(10,58,85,0.04)' }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 16px rgba(10,58,85,0.08)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
              formatter={(value, name) =>
                [`${formatMoney(Number(value))} so'm/kg`, String(name)] as [string, string]
              }
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />

            {trend.categories.map((category, index) =>
              mode === 'bar' ? (
                <Bar
                  key={category.slug}
                  dataKey={category.slug}
                  name={category.nameUz}
                  fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
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
