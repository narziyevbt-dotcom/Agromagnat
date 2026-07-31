'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Plus, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Dashboard top bar: search with a Cmd+K shortcut, the lime quick action,
 * notifications and the language toggle.
 */
export function TopBar({ unread = 0 }: { unread?: number }) {
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
    <header className="sticky top-0 z-30 border-b border-slate-line bg-white/85 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <form onSubmit={submit} role="search" className="min-w-0 flex-1 max-w-md">
          <label htmlFor="dash-search" className="sr-only">
            Qidirish
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
              aria-hidden="true"
            />
            <input
              id="dash-search"
              ref={input}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="E'lon, kategoriya yoki hudud..."
              className="tap-target w-full rounded-xl border border-slate-line bg-slate-canvas pr-16 pl-9 text-sm text-ink placeholder:text-ink-faint focus:border-turquoise focus:bg-white"
            />
            <kbd
              className="numeric pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-line bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-faint sm:block"
              aria-hidden="true"
            >
              ⌘K
            </kbd>
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/joylash"
            className="tap-target inline-flex items-center gap-1.5 rounded-xl bg-lime px-4 text-sm font-semibold text-cobalt transition-colors hover:bg-lime-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Yangi e&apos;lon qo&apos;shish</span>
            <span className="sm:hidden">E&apos;lon</span>
          </Link>

          <button
            type="button"
            aria-label={`Bildirishnomalar${unread ? `: ${unread} ta o'qilmagan` : ''}`}
            className="tap-target relative inline-flex items-center justify-center rounded-xl border border-slate-line text-ink-muted transition-colors hover:bg-slate-canvas"
          >
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            {unread > 0 && (
              // Turquoise, matching the bottom-nav badge. Danger red is reserved
              // for errors and falling prices; unread messages are neither.
              <span className="numeric absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-turquoise px-1 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* Toggles local state only for now — the UZ/RU content switch is a
              separate piece of work on the backend translation fields. */}
          <div
            className="flex overflow-hidden rounded-xl border border-slate-line"
            role="group"
            aria-label="Til"
          >
            {(['UZ', 'RU'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={`px-2.5 py-2 text-xs font-semibold transition-colors ${
                  lang === code
                    ? 'bg-cobalt text-white'
                    : 'bg-white text-ink-muted hover:bg-slate-canvas'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
