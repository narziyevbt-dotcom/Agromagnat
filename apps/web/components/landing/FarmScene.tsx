/**
 * Hero artwork: terraced fields under a low sun, with produce crates in the
 * foreground.
 *
 * Drawn rather than photographed on purpose. A stock photo would need a licence
 * the project does not have, and this stays sharp at any size for a few hundred
 * bytes — which matters on the 3G connections the audience is on. Swap it for a
 * commissioned photograph of a real Uzbek farm when one exists; that will carry
 * far more trust than any illustration.
 */
export function FarmScene({
  className = '',
  fill = false,
}: {
  className?: string;
  /** Fills its parent with no frame of its own — used as a hero backdrop. */
  fill?: boolean;
}) {
  return (
    <div
      className={
        fill
          ? `relative h-full w-full overflow-hidden ${className}`
          : `relative aspect-4/3 w-full overflow-hidden rounded-3xl ring-1 ring-white/15 ${className}`
      }
    >
      <svg
        viewBox="0 0 800 600"
        className="h-full w-full"
        role="img"
        aria-label="Quyosh botayotgan dala va hosil solingan yashiklar"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B1D14" />
            <stop offset="45%" stopColor="#2C5B3A" />
            <stop offset="100%" stopColor="#C98A3C" />
          </linearGradient>
          <linearGradient id="far-field" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2C7F5E" />
            <stop offset="100%" stopColor="#1F7A4D" />
          </linearGradient>
          <linearGradient id="mid-field" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1F7A4D" />
            <stop offset="100%" stopColor="#186340" />
          </linearGradient>
          <linearGradient id="near-field" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#17583A" />
            <stop offset="100%" stopColor="#0F4229" />
          </linearGradient>
          <radialGradient id="sun-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#E0932A" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#E0932A" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="800" height="600" fill="url(#sky)" />

        {/* Low sun and its haze */}
        <circle cx="620" cy="170" r="150" fill="url(#sun-glow)" />
        <circle cx="620" cy="170" r="46" fill="#E0932A" opacity="0.9" />

        {/* Distant ridge */}
        <path
          d="M0 250 L120 214 L240 244 L360 200 L480 236 L620 196 L760 232 L800 220 L800 300 L0 300 Z"
          fill="#0B1D14"
          opacity="0.5"
        />

        {/* Field bands, receding to near */}
        <path d="M0 288 Q400 252 800 292 L800 372 Q400 336 0 372 Z" fill="url(#far-field)" />
        <path d="M0 372 Q400 336 800 372 L800 462 Q400 424 0 462 Z" fill="url(#mid-field)" />
        <path d="M0 462 Q400 424 800 462 L800 600 L0 600 Z" fill="url(#near-field)" />

        {/* Furrow lines, converging toward the horizon */}
        <g stroke="#D4E96A" strokeOpacity="0.22" strokeWidth="2" fill="none">
          {Array.from({ length: 11 }, (_, i) => {
            const bottom = -180 + i * 118;
            const top = 300 + i * 22;
            return <path key={i} d={`M${bottom} 600 Q${(bottom + top) / 2} 470 ${top} 372`} />;
          })}
        </g>

        {/* Crop rows on the middle band */}
        <g fill="#D4E96A" opacity="0.5">
          {Array.from({ length: 26 }, (_, i) => (
            <ellipse key={i} cx={16 + i * 31} cy={398 + (i % 3) * 9} rx="9" ry="5" />
          ))}
        </g>

        {/* Foreground crates of produce */}
        <g transform="translate(70 452)">
          <Crate fill="#8A5A2B" />
          <g transform="translate(14 -14)">
            <circle cx="16" cy="10" r="13" fill="#C4452F" />
            <circle cx="44" cy="8" r="14" fill="#C4452F" />
            <circle cx="72" cy="11" r="12" fill="#D4562F" />
          </g>
        </g>

        <g transform="translate(250 486)">
          <Crate fill="#7A4E24" />
          <g transform="translate(14 -14)">
            <circle cx="16" cy="10" r="13" fill="#E0932A" />
            <circle cx="44" cy="8" r="14" fill="#EBA23C" />
            <circle cx="72" cy="11" r="12" fill="#E0932A" />
          </g>
        </g>

        {/* A single sprout, the brand mark motif, standing in the near row */}
        <g transform="translate(600 470)">
          <path d="M0 90 L0 30" stroke="#D4E96A" strokeWidth="5" strokeLinecap="round" />
          <path d="M0 46c-6-20-22-28-36-26 2 20 16 32 36 26Z" fill="#D4E96A" />
          <path d="M0 30c6-22 22-30 36-28-2 22-16 34-36 28Z" fill="#B9D14F" />
        </g>
      </svg>
    </div>
  );
}

function Crate({ fill }: { fill: string }) {
  return (
    <g>
      <rect x="0" y="0" width="104" height="58" rx="6" fill={fill} />
      <rect x="0" y="0" width="104" height="58" rx="6" fill="#000" opacity="0.12" />
      <g stroke="#000" strokeOpacity="0.18" strokeWidth="3">
        <path d="M0 20h104M0 39h104" />
      </g>
    </g>
  );
}
