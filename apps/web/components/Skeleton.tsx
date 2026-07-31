/**
 * A placeholder with the shape of the thing that is coming.
 *
 * Not a spinner. A spinner says "something is happening"; a skeleton says
 * "this is what will be here, and it will be here", and it reserves the space
 * so nothing below it jumps when the content lands. That second part is the
 * one that shows up in the numbers.
 *
 * `prefers-reduced-motion` turns the shimmer off — a pulsing rectangle is
 * exactly the sort of thing that triggers people who have asked not to see it.
 */
export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`animate-pulse rounded-lg bg-hairline/70 motion-reduce:animate-none ${className}`}
    />
  );
}

/**
 * The chart's placeholder: the real card, with bars where the bars will be.
 *
 * Sized to the chart it replaces so the swap costs no layout shift.
 */
export function ChartSkeleton({ label }: { label?: string }) {
  // Fixed heights rather than random ones — a skeleton that changes shape
  // between renders draws the eye to itself instead of to the page.
  const bars = [62, 78, 45, 88, 56, 70, 40, 82, 51, 66, 74, 48];

  return (
    <section className="rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-hairline sm:p-6">
      {label ? (
        <h2 className="text-lg font-bold text-ink">{label}</h2>
      ) : (
        <Skeleton className="h-6 w-40" />
      )}
      <div
        className="mt-6 flex h-64 items-end gap-2"
        role="status"
        aria-label="Grafik yuklanmoqda"
      >
        {bars.map((height, index) => (
          <Skeleton key={index} className="flex-1" style={{ height: `${height}%` }} />
        ))}
      </div>
    </section>
  );
}
