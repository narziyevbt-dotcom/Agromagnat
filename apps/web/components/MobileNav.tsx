'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/strings';

/**
 * The five-slot bar from the brand book, shown only on small screens.
 *
 * The middle slot is not a tab — posting a listing is the one action the
 * product exists for, so it is a raised saffron button that outweighs
 * everything beside it.
 */
const TABS = [
  { href: '/', label: t.nav.home, icon: 'home' },
  { href: '/qidiruv', label: t.nav.search, icon: 'search' },
  { href: '/joylash', label: t.nav.add, icon: 'add' },
  { href: '/sevimlilar', label: t.nav.favorites, icon: 'heart' },
  { href: '/profil', label: t.nav.profile, icon: 'user' },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={t.nav.home}
      className="sticky bottom-0 z-40 border-t border-hairline bg-surface sm:hidden"
    >
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const active = pathname === tab.href;

          if (tab.icon === 'add') {
            return (
              <li key={tab.href} className="flex flex-1 items-center justify-center py-1.5">
                <Link
                  href={tab.href}
                  aria-label={tab.label}
                  className="tap-target flex w-[52px] items-center justify-center rounded-xl bg-saffron text-white"
                >
                  <Icon name="add" className="h-7 w-7" />
                </Link>
              </li>
            );
          }

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`tap-target flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] ${
                  active ? 'font-semibold text-cobalt' : 'text-ink-faint'
                }`}
              >
                <Icon name={tab.icon} className="h-6 w-6" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5',
  add: 'M12 5v14M5 12h14',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-3.3 3.6-6 8-6s8 2.7 8 6',
};

function Icon({ name, className }: { name: string; className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? PATHS.home} />
    </svg>
  );
}
