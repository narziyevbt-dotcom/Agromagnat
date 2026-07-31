'use client';

import { useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { ListingCard } from '@/components/ListingCard';
import type { Listing, SearchIntent, SmartSearchResult } from '@/lib/types';

const EXAMPLES = [
  "Samarqanddan 5 tonnadan ko'p kartoshka",
  "12 mingdan arzon pomidor, yetkazib berish bilan",
  'Tasdiqlangan sotuvchidan olma',
];

/**
 * Search by describing what you want, rather than by guessing keywords.
 *
 * Every constraint a buyer states out loud — a region, a wholesale volume, a
 * price ceiling, delivery — is already a filter this feed supports. Keyword
 * search throws all of it away and matches the words against an index, which
 * is why "Samarqanddan 5 tonnadan ko'p kartoshka, 12 mingdan arzon" returns
 * nothing useful on a general classifieds board. Here it becomes five filters.
 *
 * The interpretation is always shown. Natural-language search fails silently
 * otherwise: a misread query returns the wrong listings and looks like an
 * empty market, and the buyer has no way to tell which. Showing what was
 * understood turns a wrong answer into something correctable.
 */
export function SmartSearch({ signedIn }: { signedIn: boolean }) {
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState<SearchIntent | null>(null);
  const [items, setItems] = useState<Listing[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2 || busy) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: trimmed }),
      });
      const data = (await response.json()) as SmartSearchResult & { error?: string };

      if (!response.ok) {
        setError(data.error ?? 'Qidiruv ishlamadi');
        return;
      }
      setIntent(data.intent);
      setItems(data.items);
    } catch {
      setError("Internet uzildi — qayta urinib ko'ring");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setQuery('');
    setIntent(null);
    setItems(null);
    setError(null);
  };

  return (
    <section className="space-y-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(query);
        }}
        className="rounded-[var(--radius-card)] bg-forest p-3 sm:p-4"
      >
        <label
          htmlFor="smart-search"
          className="mb-2 flex items-center gap-2 text-sm font-bold text-white"
        >
          <Sparkles className="h-4 w-4 text-lime" aria-hidden="true" />
          Gapirgandek qidiring
        </label>

        <div className="flex items-center gap-2 rounded-full bg-white p-1.5 pl-4">
          <input
            id="smart-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Masalan: Samarqanddan 5 tonnadan ko'p kartoshka"
            maxLength={300}
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
          {query && (
            <button
              type="button"
              onClick={reset}
              aria-label="Tozalash"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="submit"
            disabled={busy || query.trim().length < 2}
            className="tap-target shrink-0 rounded-full bg-lime px-5 text-sm font-bold text-forest transition-colors hover:bg-lime-dark disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              'Qidirish'
            )}
          </button>
        </div>

        {!intent && (
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery(example);
                    void run(example);
                  }}
                  className="rounded-full px-3 py-1.5 text-xs text-white/70 ring-1 ring-white/20 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {intent && (
        <p className="flex items-start gap-2 rounded-xl bg-mint px-3 py-2 text-sm text-harvest">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Tushundim:</span> {intent.summaryUz}
          </span>
        </p>
      )}

      {items !== null &&
        (items.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((listing, index) => (
              <li key={listing.id}>
                <ListingCard listing={listing} signedIn={signedIn} priority={index < 4} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-muted ring-1 ring-hairline">
            Bu shartlar bo&apos;yicha e&apos;lon topilmadi. Shartlarni kamaytirib
            ko&apos;ring.
          </p>
        ))}
    </section>
  );
}
