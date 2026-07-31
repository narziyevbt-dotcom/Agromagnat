/**
 * The twelve category icons, drawn rather than set in emoji.
 *
 * Emoji were the placeholder and they had two problems that matter here: they
 * render as a different picture on every Android skin in the market, and they
 * are flat next to a UI that is not. These are dimensional — each sits on a
 * lit disc, with a highlight from the top-left and a shadow opposite — so the
 * grid reads as a set of objects rather than as a row of characters.
 *
 * SVG rather than raster: the whole set is a few kilobytes, which is the right
 * trade on a 3G connection, and it stays sharp from the 28px of a filter chip
 * to the 44px of the home grid.
 */

type IconProps = { className?: string };

/** The lit disc every icon stands on. Two stops plus an inner highlight. */
function Disc({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`disc-${id}`} cx="0.32" cy="0.26" r="0.85">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#disc-${id})`} />
      {/* Specular arc — this is what makes the disc read as a sphere. */}
      <path
        d="M12 22a24 24 0 0 1 32-9 26 26 0 0 0-34 15Z"
        fill="#fff"
        opacity="0.28"
      />
    </>
  );
}

function Frame({ children, className = 'h-11 w-11' }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

const Mevalar = ({ className }: IconProps) => (
  <Frame className={className}>
    <Disc id="meva" from="#F6D8CE" to="#E8A48C" />
    <path d="M32 20c-3-4-9-5-12-1" stroke="#5C3A22" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M32 21c2-5 8-6 11-3-1 5-6 7-11 3Z" fill="#3F8A52" />
    <circle cx="27" cy="37" r="12" fill="#D4462F" />
    <circle cx="38" cy="37" r="12" fill="#C13A26" />
    <ellipse cx="24" cy="32" rx="4" ry="3" fill="#fff" opacity="0.45" transform="rotate(-25 24 32)" />
  </Frame>
);

const Sabzavotlar = ({ className }: IconProps) => (
  <Frame className={className}>
    <Disc id="sabz" from="#FFE3C2" to="#F3B168" />
    <path d="M32 52c-6-6-11-14-9-20 6-2 14 3 20 9-3 6-7 9-11 11Z" fill="#E8802A" />
    <path d="M32 52c-4-8-6-15-9-20 8 4 14 10 20 9-3 6-7 9-11 11Z" fill="#D46E1E" opacity="0.5" />
    <path d="M24 30c-2-6 0-11 4-13 2 5 1 10-4 13Z" fill="#3F8A52" />
    <path d="M25 30c-5-3-10-3-13-1 3 4 8 5 13 1Z" fill="#2F7040" />
  </Frame>
);

const Poliz = ({ className }: IconProps) => (
  <Frame className={className}>
    <Disc id="poliz" from="#D9F0C9" to="#8FC46B" />
    <circle cx="32" cy="34" r="19" fill="#2F7040" />
    <path d="M32 15a19 19 0 0 1 0 38 19 19 0 0 0 0-38Z" fill="#245932" />
    {/* The cut face — a melon is only recognisable once you can see inside it. */}
    <path d="M13 34a19 19 0 0 0 38 0Z" fill="#E04A34" />
    <g fill="#2A2118">
      <circle cx="26" cy="41" r="1.6" />
      <circle cx="34" cy="44" r="1.6" />
      <circle cx="41" cy="40" r="1.6" />
    </g>
  </Frame>
);

const QuruqMeva = ({ className }: IconProps) => (
  <Frame className={className}>
    <Disc id="quruq" from="#EFD9F2" to="#B98BC7" />
    <g fill="#6E3F86">
      <circle cx="32" cy="24" r="6" />
      <circle cx="25" cy="34" r="6" />
      <circle cx="39" cy="34" r="6" />
      <circle cx="32" cy="43" r="6" />
    </g>
    <g fill="#8F5CA6" opacity="0.7">
      <circle cx="30" cy="22" r="2" />
      <circle cx="23" cy="32" r="2" />
      <circle cx="37" cy="32" r="2" />
    </g>
    <path d="M32 18c1-5 5-7 8-6-1 5-4 7-8 6Z" fill="#3F8A52" />
  </Frame>
);

const DonVaDukkak = ({ className }: IconProps) => (
  <Frame className={className}>
    <Disc id="don" from="#FBEBC0" to="#E0AE45" />
    <path d="M32 52V22" stroke="#8A5A2B" strokeWidth="3" strokeLinecap="round" />
    <g fill="#D99A2B">
      {[0, 1, 2, 3].map((row) => (
        <g key={row}>
          <ellipse cx="26" cy={26 + row * 7} rx="6" ry="3.4" transform={`rotate(-28 26 ${26 + row * 7})`} />
          <ellipse cx="38" cy={26 + row * 7} rx="6" ry="3.4" transform={`rotate(28 38 ${26 + row * 7})`} />
        </g>
      ))}
    </g>
    <ellipse cx="32" cy="20" rx="3.4" ry="6" fill="#EBB53F" />
  </Frame>
);

const Kokatlar = ({ className }: IconProps) => (
  <Frame className={className}>
    <Disc id="kokat" from="#DEF3D2" to="#7FBB6A" />
    <path d="M32 52V26" stroke="#2F7040" strokeWidth="3" strokeLinecap="round" />
    <path d="M32 34c-7-4-14-2-17 2 5 4 12 4 17-2Z" fill="#3F8A52" />
    <path d="M32 28c7-5 14-3 17 1-5 5-12 5-17-1Z" fill="#4E9C5E" />
    <path d="M32 42c-6-3-12-1-14 3 4 3 10 3 14-3Z" fill="#2F7040" />
  </Frame>
);

const UrugVaKochat = ({ className }: IconProps) => (
  <Frame className={className}>
    <Disc id="urug" from="#E4F1D8" to="#9CC97C" />
    <path d="M18 46h28l-3 8H21Z" fill="#8A5A2B" />
    <path d="M18 46h28l-1.5 4H19.5Z" fill="#6E4620" />
    <path d="M32 46V28" stroke="#2F7040" strokeWidth="3" strokeLinecap="round" />
    <path d="M32 34c-6-4-12-2-14 2 4 4 10 4 14-2Z" fill="#3F8A52" />
    <path d="M32 28c5-5 11-4 13 0-4 4-9 5-13 0Z" fill="#57A868" />
  </Frame>
);

const OgitVaKimyo = ({ className }: IconProps) => (
  <Frame className={className}>
    <Disc id="ogit" from="#CFE7F5" to="#6FA8CE" />
    <path d="M27 16h10v10l8 20a5 5 0 0 1-4.6 7H23.6A5 5 0 0 1 19 46l8-20Z" fill="#E9F2F7" />
    <path d="M22 38h20l3 8a5 5 0 0 1-4.6 5H23.6A5 5 0 0 1 19 46Z" fill="#1D7F8C" />
    <rect x="25" y="12" width="14" height="5" rx="2.5" fill="#3E5866" />
    <ellipse cx="29" cy="30" rx="2.5" ry="5" fill="#fff" opacity="0.7" />
  </Frame>
);

const Texnika = ({ className }: IconProps) => (
  <Frame className={className}>
    <Disc id="texnika" from="#FFE0B8" to="#E0932A" />
    <path d="M22 30h13l4 8h6a3 3 0 0 1 3 3v6H18V33a3 3 0 0 1 3-3Z" fill="#C4452F" />
    <path d="M24 32h9v6h-9Z" fill="#9CD4E2" />
    <circle cx="24" cy="46" r="8" fill="#2A2118" />
    <circle cx="24" cy="46" r="3.5" fill="#6B6157" />
    <circle cx="43" cy="48" r="5.5" fill="#2A2118" />
    <circle cx="43" cy="48" r="2.4" fill="#6B6157" />
    <path d="M35 22h4v8h-4Z" fill="#3E3831" />
  </Frame>
);

const ChorvaOzuqasi = ({ className }: IconProps) => (
  <Frame className={className}>
    <Disc id="chorva" from="#F7E8C6" to="#D9B25E" />
    <ellipse cx="32" cy="38" rx="18" ry="14" fill="#C99A33" />
    <ellipse cx="32" cy="34" rx="18" ry="12" fill="#E0B448" />
    <g stroke="#A87F22" strokeWidth="1.6" opacity="0.7">
      <path d="M18 32c6-4 12-5 18-3M20 40c7-4 14-5 22-3M24 26c5-2 10-2 15 0" />
    </g>
  </Frame>
);

const Xizmatlar = ({ className }: IconProps) => (
  <Frame className={className}>
    <Disc id="xizmat" from="#CFE9EC" to="#5FA6B0" />
    <path d="M14 28h20v18H14Z" fill="#EEF3F4" />
    <path d="M34 33h9l7 7v6H34Z" fill="#1D7F8C" />
    <path d="M36 35h6l4.5 5H36Z" fill="#9CD4E2" />
    <circle cx="22" cy="47" r="5.5" fill="#2A2118" />
    <circle cx="22" cy="47" r="2.3" fill="#6B6157" />
    <circle cx="43" cy="47" r="5.5" fill="#2A2118" />
    <circle cx="43" cy="47" r="2.3" fill="#6B6157" />
  </Frame>
);

const Yer = ({ className }: IconProps) => (
  <Frame className={className}>
    <Disc id="yer" from="#DCEFD6" to="#84B673" />
    <path d="M6 40q26-10 52 0v6q-26-9-52 0Z" fill="#3F8A52" />
    <path d="M6 46q26-9 52 0v8H6Z" fill="#2F7040" />
    <path d="M8 54q24-10 48 0Z" fill="#1F5A33" />
    <path d="M18 40 8 54M32 38 26 54M46 40l10 14" stroke="#D4E96A" strokeWidth="1.6" opacity="0.5" />
    <circle cx="46" cy="22" r="7" fill="#E0932A" />
  </Frame>
);

const BY_SLUG: Record<string, (props: IconProps) => React.ReactElement> = {
  mevalar: Mevalar,
  sabzavotlar: Sabzavotlar,
  poliz: Poliz,
  'quruq-meva': QuruqMeva,
  'don-va-dukkak': DonVaDukkak,
  kokatlar: Kokatlar,
  'urug-va-kochat': UrugVaKochat,
  'ogit-va-kimyo': OgitVaKimyo,
  texnika: Texnika,
  'chorva-ozuqasi': ChorvaOzuqasi,
  xizmatlar: Xizmatlar,
  yer: Yer,
};

/** Falls back to the wheat icon, which is the least wrong thing for agro. */
export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = BY_SLUG[slug] ?? DonVaDukkak;
  return <Icon className={className} />;
}
