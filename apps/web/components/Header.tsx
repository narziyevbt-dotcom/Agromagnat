import Link from 'next/link';
import { t } from '@/lib/strings';
import { Logo } from './Logo';
import { SearchBar } from './SearchBar';

/**
 * Cobalt header. The saffron "E'lon joylash" button is the only saffron element
 * on the page — that is what makes it read as the primary action.
 */
export function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 bg-cobalt text-white">
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

        <div className="min-w-0 flex-1">
          <SearchBar />
        </div>

        <nav className="flex shrink-0 items-center gap-2">
          <Link
            href="/joylash"
            className="tap-target hidden items-center rounded-lg bg-lime px-4 text-sm font-semibold text-cobalt transition-colors hover:bg-lime-dark sm:inline-flex"
          >
            + {t.nav.add}
          </Link>

          <Link
            href={signedIn ? '/profil' : '/kirish'}
            className="tap-target inline-flex items-center justify-center rounded-lg px-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
          >
            {signedIn ? t.nav.profile : t.nav.login}
          </Link>
        </nav>
      </div>
    </header>
  );
}
