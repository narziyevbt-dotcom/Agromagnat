'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Package,
  Settings,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { initials } from '@/lib/format';

const NAV = [
  { href: '/dashboard', label: 'Asosiy panel', icon: LayoutDashboard },
  { href: '/dashboard/elonlar', label: "E'lonlarim", icon: Package },
  { href: '/dashboard/narxlar', label: 'Bozor narxlari', icon: LineChart },
  { href: '/dashboard/xabarlar', label: 'Xabarlar', icon: MessageSquare },
  { href: '/dashboard/analitika', label: 'Analitika', icon: BarChart3 },
  { href: '/dashboard/sozlamalar', label: 'Sozlamalar', icon: Settings },
] as const;

export function Sidebar({
  name,
  isVerified,
}: {
  name: string | null;
  isVerified: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-cobalt lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <Logo className="h-9 w-9" />
        <span className="font-[family-name:var(--font-display)] text-lg font-bold text-white">
          Agromagnat
        </span>
      </Link>

      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {NAV.map((item) => {
            // Exact match for the index so it does not stay lit on every child.
            const active =
              item.href === '/dashboard'
                ? pathname === item.href
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`tap-target flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white/12 text-white'
                      : 'text-white/60 hover:bg-white/6 hover:text-white/90'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  {item.label}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-lime" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/profil"
          className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/8"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-turquoise text-sm font-semibold text-white">
            {initials(name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">
              {name ?? 'Foydalanuvchi'}
            </span>
            <span
              className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                isVerified
                  ? 'bg-turquoise/25 text-turquoise'
                  : 'bg-white/10 text-white/60'
              }`}
            >
              {isVerified ? 'Tasdiqlangan Fermer' : 'Fermer'}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
