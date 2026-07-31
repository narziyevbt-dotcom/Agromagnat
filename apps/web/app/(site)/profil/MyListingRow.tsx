'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { formatPrice, formatQuantity } from '@/lib/format';
import { t } from '@/lib/strings';
import type { Listing, ListingStatus } from '@/lib/types';
import { deleteListingAction, markSoldAction } from './actions';

const STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'Qoralama',
  pending: 'Tekshiruvda',
  active: 'Faol',
  sold: 'Sotilgan',
  expired: 'Muddati tugagan',
  blocked: 'Bloklangan',
};

const STATUS_STYLE: Record<ListingStatus, string> = {
  draft: 'bg-ink-faint/15 text-ink-muted',
  pending: 'bg-saffron/15 text-saffron-dark',
  active: 'bg-harvest/12 text-harvest',
  sold: 'bg-cobalt/10 text-cobalt',
  expired: 'bg-ink-faint/15 text-ink-muted',
  blocked: 'bg-danger/10 text-danger',
};

export function MyListingRow({ listing }: { listing: Listing }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const cover = listing.photos?.[0];

  const run = (action: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-3 ring-1 ring-hairline">
      <Link
        href={`/e/${listing.id}`}
        className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-canvas"
      >
        {cover && (
          <Image
            src={cover.thumbUrl ?? cover.url}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={`/e/${listing.id}`} className="block">
          <p className="truncate text-sm font-semibold text-ink">{listing.title}</p>
        </Link>
        <p className="numeric text-sm font-bold text-harvest">
          {formatPrice(listing.price, listing.priceUnit)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[listing.status]}`}
          >
            {STATUS_LABEL[listing.status]}
          </span>
          <span className="numeric rounded-full bg-harvest/12 px-2 py-0.5 text-[11px] font-semibold text-harvest">
            {formatQuantity(listing.quantity, listing.quantityUnit)}
          </span>
          <span className="numeric text-[11px] text-ink-faint">
            👁 {listing.viewCount} · 📞 {listing.callCount}
          </span>
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>

      <div className="flex shrink-0 flex-col gap-1">
        {listing.status === 'active' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => markSoldAction(listing.id))}
            className="rounded-md px-2 py-1.5 text-xs font-medium text-harvest ring-1 ring-hairline hover:bg-harvest/5 disabled:opacity-60"
          >
            {t.profile.markSold}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(t.profile.confirmDelete)) {
              run(() => deleteListingAction(listing.id));
            }
          }}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-ink-muted ring-1 ring-hairline hover:text-danger disabled:opacity-60"
        >
          {t.profile.delete}
        </button>
      </div>
    </div>
  );
}
