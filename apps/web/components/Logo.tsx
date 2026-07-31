/**
 * The brand mark: a white sprout — one stem, two leaves — inside a saffron
 * square. Meaning: a harvest coming up out of the ground.
 *
 * Drawn as SVG rather than shipped as a raster so it stays sharp at the 32px
 * the header uses and at favicon size.
 */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="Agromagnat"
      fill="none"
    >
      <rect width="40" height="40" rx="9" fill="var(--color-saffron)" />
      {/* Stem */}
      <path
        d="M20 31V17"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Left leaf */}
      <path
        d="M20 21c-1.5-5-5.5-7-9-6.5.5 5 4 8 9 7.5Z"
        fill="white"
      />
      {/* Right leaf */}
      <path
        d="M20 17c1.5-5.5 5.5-7.5 9-7-.5 5.5-4 8.5-9 8Z"
        fill="white"
      />
    </svg>
  );
}
