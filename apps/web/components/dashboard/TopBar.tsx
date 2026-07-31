'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, HelpCircle, Plus, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { initials } from '@/lib/format';

/**
 * Dashboard top bar: search with a Cmd+K shortcut, the lime quick action,
 * circular utility buttons and the language toggle.
 *
 * The utilities are round rather than square. Nothing else on the page is a
 * circle, so the shape alone separates "tools that sit here permanently" from
 * the rectangular content beneath them.
 */
export function TopBar({
  unread = 0,
  name = null,
}: {
  unread?: number;
  name?: string | null;
}) {
  const [query, setQuery] = useState('');
  const [lang, setLang] = useState<'UZ' | 'RU'>('UZ');
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === input.current) {
        input.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/qidiruv?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 rounded-tr-[var(--radius-window)] bg-surface-soft/85 px-4 py-3.5 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <form onSubmit={submit} role="search" className="min-w-0 max-w-sm flex-1">
          <label htmlFor="dash-search" className="sr-only">
            Qidirish
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-faint"
              aria-hidden="true"
            />
            <input
              id="dash-search"
              ref={input}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Qidirish..."
              className="tap-target w-full rounded-full bg-surface pr-16 pl-10 text-sm text-ink ring-1 ring-hairline placeholder:text-ink-faint focus:ring-harvest"
            />
            <kbd
              className="numeric pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-md bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint sm:block"
              aria-hidden="true"
            >
              ⌘K
            </kbd>
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/joylash"
            className="tap-target inline-flex items-center gap-1.5 rounded-full bg-lime px-4 text-[13px] font-bold text-forest transition-colors hover:bg-lime-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Yangi e&apos;lon</span>
          </Link>

          <RoundButton label="Yordam">
            <HelpCircle className="h-[17px] w-[17px]" aria-hidden="true" />
          </RoundButton>

          <Link
            href="/xabarlar"
            aria-label={`Bildirishnomalar${unread ? `: ${unread} ta o'qilmagan` : ''}`}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-muted ring-1 ring-hairline transition-colors hover:text-ink"
          >
            <Bell className="h-[17px] w-[17px]" aria-hidden="true" />
            {unread > 0 && (
              // Harvest, not red: an unread message is not an error state.
              <span className="numeric absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-harvest px-1 text-[10px] font-bold text-white ring-2 ring-surface-soft">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>

          {/* Local state only for now — the UZ/RU content switch is separate
              work on the backend translation fields. */}
          <div
            className="flex items-center rounded-full bg-surface p-0.5 ring-1 ring-hairline"
            role="group"
            aria-label="Til"
          >
            {(['UZ', 'RU'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                  lang === code ? 'bg-forest text-white' : 'text-ink-faint hover:text-ink'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <Link
            href="/profil"
            aria-label="Profil"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-bold text-white"
          >
            {initials(name)}
          </Link>
        </div>
      </div>
    </header>
  );
}

function RoundButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="hidden h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-muted ring-1 ring-hairline transition-colors hover:text-ink sm:inline-flex"
    >
      {children}
    </button>
  );
}
