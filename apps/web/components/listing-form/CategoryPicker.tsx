'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import type { Category, CategoryCandidate } from '@/lib/types';

/** Above this the suggestion is applied outright; below it, only offered. */
const AUTO_SELECT = 0.75;
const DEBOUNCE_MS = 500;

/**
 * Category selection, automatic first and manual always.
 *
 * As the seller names the product, the API is asked which category it belongs
 * to. A confident answer is applied on its own — that is the whole point, and
 * it is reversible in one tap. A hesitant answer is offered as chips instead of
 * being applied, because silently putting a listing in the wrong category is
 * worse than asking.
 *
 * The manual grid never goes away. Auto-selection that cannot be overridden is
 * how a seller ends up posting a tractor under vegetables and giving up.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  productText,
  error,
}: {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  /** What the seller has typed as the title — the classifier's input. */
  productText: string;
  error?: string;
}) {
  const [candidates, setCandidates] = useState<CategoryCandidate[]>([]);
  const [thinking, setThinking] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  /** Set once the seller picks by hand — suppresses further auto-selection. */
  const chosenByHand = useRef(false);
  /** Last text we auto-applied for, so re-renders do not re-apply. */
  const appliedFor = useRef('');

  const selected = categories.find((category) => category.id === value) ?? null;

  useEffect(() => {
    const text = productText.trim();
    if (text.length < 3) {
      setCandidates([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setThinking(true);
      try {
        const response = await fetch('/api/ai/category', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        if (!response.ok) return;

        const data = (await response.json()) as { candidates?: CategoryCandidate[] };
        const found = data.candidates ?? [];
        setCandidates(found);

        const best = found[0];
        if (
          best &&
          best.confidence >= AUTO_SELECT &&
          !chosenByHand.current &&
          appliedFor.current !== text
        ) {
          appliedFor.current = text;
          onChange(best.categoryId);
        }
      } catch {
        // Aborted or offline — the manual grid is right there.
      } finally {
        setThinking(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // onChange is stable enough in practice; re-running on it would refire the
    // request on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productText]);

  const offered = candidates.filter((candidate) => candidate.categoryId !== value).slice(0, 3);

  return (
    <div>
      <input type="hidden" name="categoryId" value={value} />

      {selected ? (
        <div className="flex items-center gap-3 rounded-xl bg-mint p-2.5 ring-1 ring-harvest/20">
          <CategoryIcon slug={selected.slug} className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-forest">{selected.nameUz}</p>
            {candidates[0]?.categoryId === selected.id && candidates[0].reasonUz && (
              <p className="flex items-center gap-1 text-[11px] text-harvest">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                AI tanladi — {candidates[0].reasonUz}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              chosenByHand.current = true;
              setManualOpen(true);
            }}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-harvest ring-1 ring-harvest/30 transition-colors hover:bg-harvest hover:text-white"
          >
            O&apos;zgartirish
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setManualOpen((open) => !open)}
          className="tap-target flex w-full items-center justify-between rounded-xl bg-canvas px-3 text-left text-sm text-ink-muted ring-1 ring-hairline"
        >
          {thinking ? 'AI kategoriyani tanlayapti...' : 'Kategoriyani tanlang'}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${manualOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}

      {offered.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">
            {selected ? 'Balki:' : 'Taklif:'}
          </span>
          {offered.map((candidate) => (
            <button
              key={candidate.categoryId}
              type="button"
              onClick={() => {
                chosenByHand.current = true;
                onChange(candidate.categoryId);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-forest ring-1 ring-hairline transition-colors hover:ring-harvest"
            >
              <Sparkles className="h-3 w-3 text-harvest" aria-hidden="true" />
              {candidate.nameUz}
            </button>
          ))}
        </div>
      )}

      {(manualOpen || !selected) && (
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => {
                  chosenByHand.current = true;
                  onChange(category.id);
                  setManualOpen(false);
                }}
                className={`relative flex h-full w-full flex-col items-center gap-1 rounded-xl p-2 pt-2.5 text-center ring-1 transition-colors ${
                  category.id === value
                    ? 'bg-mint ring-harvest'
                    : 'bg-surface ring-hairline hover:ring-harvest/50'
                }`}
              >
                <CategoryIcon slug={category.slug} className="h-9 w-9" />
                <span className="text-[10px] leading-tight font-medium text-ink">
                  {category.nameUz}
                </span>
                {category.id === value && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-harvest text-white">
                    <Check className="h-2.5 w-2.5" aria-hidden="true" />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
