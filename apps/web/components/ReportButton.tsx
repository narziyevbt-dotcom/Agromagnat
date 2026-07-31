'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { reportListingAction } from '@/app/(site)/e/[id]/report-action';
import type { ReportReason } from '@/lib/types';

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'scam', label: 'Firibgarlik' },
  { value: 'wrong_price', label: "Narx noto'g'ri" },
  { value: 'already_sold', label: 'Allaqachon sotilgan' },
  { value: 'wrong_category', label: "Kategoriya noto'g'ri" },
  { value: 'prohibited', label: 'Taqiqlangan mahsulot' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Boshqa' },
];

/**
 * The complaint flow, kept to two taps: open, pick a reason, done. The book's
 * risk chapter is blunt that one un-actioned scam travels through a whole
 * village — the button has to be effortless enough that people actually use it.
 */
export function ReportButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (reason: ReportReason) => {
    setError(null);
    startTransition(async () => {
      const result = await reportListingAction(listingId, reason);
      if (result.needsLogin) {
        router.push(`/kirish?next=/e/${listingId}`);
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
      setOpen(false);
    });
  };

  if (done) {
    return (
      <p className="text-xs text-harvest">
        Shikoyatingiz qabul qilindi — tez orada ko&apos;rib chiqamiz.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-xs text-ink-faint underline-offset-2 hover:text-danger hover:underline"
      >
        E&apos;lon haqida shikoyat qilish
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Shikoyat sababi">
          {REASONS.map((reason) => (
            <button
              key={reason.value}
              type="button"
              disabled={pending}
              onClick={() => submit(reason.value)}
              className="rounded-full bg-surface px-3 py-1.5 text-xs text-ink-muted ring-1 ring-hairline hover:text-danger hover:ring-danger/40 disabled:opacity-60"
            >
              {reason.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
