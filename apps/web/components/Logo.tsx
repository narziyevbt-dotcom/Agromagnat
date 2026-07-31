/**
 * The brand mark: a sprout — one stem, two leaves — inside a rounded square.
 * Meaning: a harvest coming up out of the ground.
 *
 * The tile is lime with a forest sprout, so the mark carries the same pair as
 * every primary action in the product. It was saffron on a white sprout while
 * the palette led with cobalt; against forest chrome that orange was the only
 * warm thing on the screen and read as a leftover from another brand.
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
      <rect width="40" height="40" rx="11" fill="var(--color-lime)" />
      {/* Stem */}
      <path
        d="M20 31V17"
        stroke="var(--color-forest)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Left leaf */}
      <path
        d="M20 21c-1.5-5-5.5-7-9-6.5.5 5 4 8 9 7.5Z"
        fill="var(--color-forest)"
      />
      {/* Right leaf */}
      <path
        d="M20 17c1.5-5.5 5.5-7.5 9-7-.5 5.5-4 8.5-9 8Z"
        fill="var(--color-forest)"
      />
    </svg>
  );
}
