/**
 * A rating, drawn as five stars.
 *
 * Turquoise rather than the usual gold. Saffron is reserved for CTAs and the
 * TOP badge, and a row of saffron stars on every card would drain the colour of
 * the meaning the whole palette rests on. Turquoise already carries the
 * verified badge, so trust signals stay one colour.
 *
 * Half-stars are done by clipping a filled row over an empty one rather than by
 * rounding: a 4.4 that renders as four and a half stars is honest, and a 4.4
 * rounded up to five is the kind of small lie that makes a whole rating system
 * worth ignoring.
 */
export function Stars({
  value,
  size = 16,
  className = '',
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));

  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size * 5, height: size }}
      role="img"
      aria-label={`${clamped.toFixed(1)} / 5`}
    >
      <Row size={size} filled={false} />
      <span
        className="absolute left-0 top-0 overflow-hidden"
        style={{ width: `${(clamped / 5) * 100}%`, height: size }}
      >
        <Row size={size} filled />
      </span>
    </span>
  );
}

function Row({ size, filled }: { size: number; filled: boolean }) {
  return (
    <span className="flex" style={{ width: size * 5, height: size }}>
      {[0, 1, 2, 3, 4].map((index) => (
        <StarIcon key={index} size={size} filled={filled} />
      ))}
    </span>
  );
}

/** One star. Used on its own by the rating picker, where each is a control. */
export function StarIcon({ size, filled }: { size: number; filled: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'var(--color-turquoise)' : 'none'}
      stroke={filled ? 'var(--color-turquoise)' : 'var(--color-hairline)'}
      strokeWidth={1.5}
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3Z" />
    </svg>
  );
}
