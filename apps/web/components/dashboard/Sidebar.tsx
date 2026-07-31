'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  LogOut,
  MessageSquare,
  Package,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { initials } from '@/lib/format';

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Rendered as a muted count on the right of the row. */
  count?: number;
}

interface Group {
  label: string;
  items: Item[];
}

/**
 * Nav grouped under quiet section labels rather than presented as one long
 * list. Six links do not need grouping to be findable; they need it so the eye
 * can skip the two-thirds of the sidebar it is not looking for.
 */
function groups(unread: number, listings: number): Group[] {
  return [
    {
      label: 'Asosiy',
      items: [
        { href: '/dashboard', label: 'Asosiy panel', icon: LayoutDashboard },
        { href: '/dashboard/elonlar', label: "E'lonlarim", icon: Package, count: listings },
        { href: '/dashboard/analitika', label: 'Analitika', icon: BarChart3 },
      ],
    },
    {
      label: 'Bozor',
      items: [
        { href: '/dashboard/narxlar', label: 'Bozor narxlari', icon: LineChart },
        { href: '/xabarlar', label: 'Xabarlar', icon: MessageSquare, count: unread },
      ],
    },
    {
      label: 'Umumiy',
      items: [
        { href: '/dashboard/sozlamalar', label: 'Sozlamalar', icon: Settings },
        { href: '/haqida', label: 'Yordam', icon: LifeBuoy },
      ],
    },
  ];
}

export function Sidebar({
  name,
  isVerified,
  unread = 0,
  listingCount = 0,
}: {
  name: string | null;
  isVerified: boolean;
  unread?: number;
  listingCount?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col rounded-l-[var(--radius-window)] bg-forest lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-6">
        <Logo className="h-9 w-9" />
        <span className="font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight text-white">
          Agromagnat
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {groups(unread, listingCount).map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 pb-2 text-[10px] font-bold tracking-[0.14em] text-white/35 uppercase">
              {group.label}
            </p>

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                // Exact match for the index so it does not stay lit on children.
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
                      className={`tap-target group flex items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors ${
                        active
                          ? 'bg-lime text-forest'
                          : 'text-white/60 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      <Icon className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>

                      {item.count !== undefined && item.count > 0 && (
                        <span
                          className={`numeric ml-auto shrink-0 text-[11px] font-semibold ${
                            active ? 'text-forest/60' : 'text-white/40'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/*
        The promo slot the reference dashboards all carry. Here it sells the
        product's own next action rather than a subscription tier — this
        platform has nothing to upsell, and an empty panel would be worse.
      */}
      <div className="px-3 pb-3">
        <div className="rounded-2xl bg-forest-soft p-4 ring-1 ring-white/8">
          <p className="text-[13px] font-bold text-white">Hosilingiz turibdimi?</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/55">
            E&apos;lon joylash 2 daqiqa vaqt oladi va butunlay bepul.
          </p>
          <Link
            href="/joylash"
            className="mt-3 flex items-center justify-center rounded-xl bg-lime px-3 py-2 text-[12px] font-bold text-forest transition-colors hover:bg-lime-dark"
          >
            E&apos;lon joylash
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-white/8 px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-harvest text-[11px] font-bold text-white">
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-white">
            {name ?? 'Foydalanuvchi'}
          </span>
          <span className="text-[10px] text-white/45">
            {isVerified ? 'Tasdiqlangan Fermer' : 'Fermer'}
          </span>
        </span>
        <Link
          href="/profil"
          aria-label="Profil"
          className="shrink-0 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/8 hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
