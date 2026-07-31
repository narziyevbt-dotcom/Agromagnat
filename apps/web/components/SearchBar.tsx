'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { t } from '@/lib/strings';

/** Header search. Submits to /qidiruv, preserving any active region filter. */
export function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get('q') ?? '');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams();
    const trimmed = value.trim();
    if (trimmed) {
      next.set('q', trimmed);
    }
    const region = params.get('regionId');
    if (region) {
      next.set('regionId', region);
    }
    router.push(`/qidiruv${next.toString() ? `?${next}` : ''}`);
  };

  return (
    <form onSubmit={submit} role="search">
      <label htmlFor="site-search" className="sr-only">
        {t.search.placeholder}
      </label>
      <div className="relative">
        <input
          id="site-search"
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t.home.searchPlaceholder}
          className="tap-target w-full rounded-lg bg-white/95 px-4 pr-11 text-[15px] text-ink placeholder:text-ink-faint focus:bg-white"
        />
        <button
          type="submit"
          aria-label={t.search.title}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:text-cobalt"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </form>
  );
}
