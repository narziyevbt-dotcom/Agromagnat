import Link from 'next/link';
import { ArrowRight, TrendingDown, Users } from 'lucide-react';
import { FarmScene } from './FarmScene';

/**
 * Split hero: copy left, imagery right with glass stat cards floating over it.
 *
 * The headline is the product's promise verbatim — "from soil to table, without
 * a middleman" is what a farmer is actually buying, not a feature list.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-cobalt">
      {/* Warm wash behind the imagery so the panel does not read as a flat block. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full bg-turquoise/20 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:gap-12 lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85 ring-1 ring-white/15">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" />
            O&apos;zbekiston bo&apos;ylab agro bozor
          </span>

          <h1 className="mt-5 text-4xl leading-[1.08] text-white sm:text-5xl lg:text-6xl">
            Yerdan dasturxongacha{' '}
            <span className="text-lime">vositachisiz</span>
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
            Hosilingizni to&apos;g&apos;ridan-to&apos;g&apos;ri xaridorga soting. Dallol yo&apos;q,
            komissiya yo&apos;q — xaridor sizga o&apos;zi qo&apos;ng&apos;iroq qiladi.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/kirish"
              className="tap-target inline-flex items-center justify-center gap-2 rounded-xl bg-lime px-6 py-3.5 text-base font-semibold text-cobalt transition-colors hover:bg-lime-dark"
            >
              Boshlash / Ro&apos;yxatdan o&apos;tish
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/qidiruv"
              className="tap-target inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-base font-medium text-white ring-1 ring-white/25 transition-colors hover:bg-white/10"
            >
              E&apos;lonlarni ko&apos;rish
            </Link>
          </div>
        </div>

        <div className="relative">
          <FarmScene />

          {/* Glass stat widgets, deliberately offset so they read as layered
              over the scene rather than as part of a grid. */}
          <GlassStat
            className="absolute -left-2 top-6 sm:left-4 sm:top-10"
            icon={<Users className="h-4 w-4" aria-hidden="true" />}
            value="50 000+"
            label="Fermerlar"
          />
          <GlassStat
            className="absolute -right-1 bottom-6 sm:right-4 sm:bottom-10"
            icon={<TrendingDown className="h-4 w-4" aria-hidden="true" />}
            value="35%"
            label="Tejamkorlik"
            accent
          />
        </div>
      </div>
    </section>
  );
}

function GlassStat({
  icon,
  value,
  label,
  className = '',
  accent = false,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-white/12 p-4 shadow-lg ring-1 ring-white/20 backdrop-blur-md ${className}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            accent ? 'bg-lime text-cobalt' : 'bg-white/20 text-white'
          }`}
        >
          {icon}
        </span>
        <div>
          <p className="numeric text-lg leading-none font-bold text-white">{value}</p>
          <p className="mt-1 text-[11px] leading-none text-white/70">{label}</p>
        </div>
      </div>
    </div>
  );
}
