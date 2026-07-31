'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/strings';
import { Logo } from './Logo';
import { SearchBar } from './SearchBar';

/**
 * Site header. Lime is the only accent, which is what makes it read as the
 * primary action.
 *
 * Over the home page's full-bleed hero it goes transparent and sits on the
 * imagery, the way the reference landing pages do — a solid bar there would cut
 * the photograph off at the top and cost the hero its whole effect. Everywhere
 * else it is an opaque forest bar, because those pages start with content
 * rather than with an image and a floating nav would have nothing to float on.
 */
export function Header({ signedIn }: { signedIn: boolean }) {
  const overHero = usePathname() === '/';

  return (
    <header
      className={
        overHero
          ? 'absolute inset-x-0 top-0 z-40 text-white'
          : 'sticky top-0 z-40 bg-forest text-white'
      }
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          aria-label={t.brand}
        >
          <Logo className="h-8 w-8" />
          <span className="hidden font-[family-name:var(--font-display)] text-lg font-bold sm:block">
            {t.brand}
          </span>
        </Link>

        <div className={`min-w-0 flex-1 ${overHero ? "hidden sm:block" : ""}`}>
          <SearchBar />
        </div>

        <nav className="flex shrink-0 items-center gap-2">
          <Link
            href="/joylash"
            className="tap-target hidden items-center rounded-full bg-lime px-5 text-sm font-bold text-forest transition-colors hover:bg-lime-dark sm:inline-flex"
          >
            + {t.nav.add}
          </Link>

          {/* Desktop only — small screens reach the inbox from the bottom bar. */}
          {signedIn && (
            <Link
              href="/xabarlar"
              className="tap-target hidden items-center justify-center rounded-full px-4 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 sm:inline-flex"
            >
              {t.chat.title}
            </Link>
          )}

          <Link
            href={signedIn ? '/profil' : '/kirish'}
            className="tap-target inline-flex items-center justify-center rounded-full px-4 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10"
          >
            {signedIn ? t.nav.profile : t.nav.login}
          </Link>
        </nav>
      </div>
    </header>
  );
}
