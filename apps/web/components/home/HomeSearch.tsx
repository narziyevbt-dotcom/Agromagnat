'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { t } from '@/lib/strings';

const QUICK: Array<{ label: string; q: string }> = [
  { label: 'Pomidor', q: 'pomidor' },
  { label: 'Kartoshka', q: 'kartoshka' },
  { label: 'Olma', q: 'olma' },
  { label: "Bug'doy", q: "bug'doy" },
  { label: 'Traktor', q: 'traktor' },
];

/**
 * The first thing a signed-in seller sees. Big, single-purpose, and above
 * everything else — the shape every classifieds app in this market uses,
 * because the audience arrives knowing what they want to find.
 *
 * The quick chips are not decoration: they are the five things most searched
 * for, and tapping one is faster than typing on a phone keyboard in a field.
 */
export function HomeSearch() {
  const router = useRouter();
  const [value, setValue] = useState('');

  const go = (query: string) => {
    const trimmed = query.trim();
    router.push(trimmed ? `/qidiruv?q=${encodeURIComponent(trimmed)}` : '/qidiruv');
  };

  return (
    <section className="rounded-[var(--radius-window)] bg-forest px-4 py-6 sm:px-8 sm:py-8">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          go(value);
        }}
      >
        <label htmlFor="home-search" className="sr-only">
          {t.search.placeholder}
        </label>

        <div className="flex items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-sm">
          <Search className="h-5 w-5 shrink-0 text-ink-faint" aria-hidden="true" />
          <input
            id="home-search"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t.home.searchPlaceholder}
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            className="tap-target shrink-0 rounded-full bg-lime px-5 text-sm font-bold text-forest transition-colors hover:bg-lime-dark"
          >
            {t.search.title}
          </button>
        </div>
      </form>

      <ul className="mt-3 flex flex-wrap gap-2">
        {QUICK.map((chip) => (
          <li key={chip.q}>
            <button
              type="button"
              onClick={() => go(chip.q)}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-white/75 ring-1 ring-white/20 transition-colors hover:bg-white/10 hover:text-white"
            >
              {chip.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
