'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Flag,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { initials } from '@/lib/format';

const NAV = [
  { href: '/admin', label: 'Umumiy', icon: LayoutDashboard },
  { href: '/admin/moderatsiya', label: 'Moderatsiya', icon: ShieldCheck },
  { href: '/admin/elonlar', label: "E'lonlar", icon: Package },
  { href: '/admin/foydalanuvchilar', label: 'Foydalanuvchilar', icon: Users },
  { href: '/admin/shikoyatlar', label: 'Shikoyatlar', icon: Flag },
  { href: '/admin/baholar', label: 'Baholar', icon: Star },
] as const;

export function AdminSidebar({ name }: { name: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-cobalt lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <Logo className="h-8 w-8" />
        <span className="font-[family-name:var(--font-display)] text-base font-bold text-white">
          Agromagnat{' '}
          <span className="rounded bg-danger/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
            admin
          </span>
        </span>
      </Link>

      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const active =
              item.href === '/admin'
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
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-turquoise text-xs font-semibold text-white">
            {initials(name)}
          </span>
          <span className="truncate text-sm text-white/85">{name ?? 'Admin'}</span>
        </div>
      </div>
    </aside>
  );
}
