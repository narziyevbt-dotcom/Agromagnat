import Link from 'next/link';
import { ArrowRight, ArrowUpRight, TrendingDown, Users } from 'lucide-react';
import { HeroMedia } from './HeroMedia';

/**
 * Full-bleed hero: imagery edge to edge, copy sitting on top of it.
 *
 * The earlier split layout put the picture in a box beside the text, which made
 * it read as an illustration accompanying an argument. Filling the frame makes
 * the field itself the first thing on the page — the product is produce, and
 * the fastest way to say so is to show it before saying anything.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden rounded-b-[var(--radius-window)] bg-forest">
      <HeroMedia />

      <div className="relative mx-auto flex min-h-[600px] max-w-7xl flex-col justify-end px-4 pt-28 pb-12 sm:min-h-[700px] sm:px-6 sm:pb-20">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-xs font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-lime" />
          O&apos;zbekiston bo&apos;ylab agro bozor
        </span>

        {/* Light weight at a large size, the way the references set their
            headlines — bold at this scale shouts instead of speaking. */}
        <h1 className="mt-5 max-w-3xl text-[2.6rem] leading-[1.04] font-semibold text-white sm:text-6xl">
          Yerdan dasturxongacha{' '}
          <span className="text-lime">vositachisiz</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
          Hosilingizni to&apos;g&apos;ridan-to&apos;g&apos;ri xaridorga soting. Dallol
          yo&apos;q, komissiya yo&apos;q — xaridor sizga o&apos;zi qo&apos;ng&apos;iroq
          qiladi.
        </p>

        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          {/* Pill with the arrow in its own dark circle — the reference CTA. */}
          <Link
            href="/kirish"
            className="tap-target group inline-flex items-center gap-3 rounded-full bg-lime py-1.5 pr-1.5 pl-6 text-base font-bold text-forest transition-colors hover:bg-lime-dark"
          >
            Boshlash
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-lime transition-transform group-hover:rotate-45">
              <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
            </span>
          </Link>

          <Link
            href="/qidiruv"
            className="tap-target inline-flex items-center gap-2 rounded-full px-6 text-base font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            E&apos;lonlarni ko&apos;rish
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Glass stats, anchored to the bottom-right the way Farmora's mission
            card is — out of the headline's way, still inside the image. */}
        <div className="mt-10 grid w-fit grid-cols-2 gap-3 sm:absolute sm:right-6 sm:bottom-16 sm:mt-0">
          <GlassStat
            icon={<Users className="h-4 w-4" aria-hidden="true" />}
            value="50 000+"
            label="Fermerlar"
          />
          <GlassStat
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
  accent = false,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20 backdrop-blur-md">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          accent ? 'bg-lime text-forest' : 'bg-white/20 text-white'
        }`}
      >
        {icon}
      </span>
      <p className="numeric mt-2.5 text-xl leading-none font-extrabold text-white">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-none text-white/65">{label}</p>
    </div>
  );
}
