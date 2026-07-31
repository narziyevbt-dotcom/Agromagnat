'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ImageOff } from 'lucide-react';
import {
  approveListingAction,
  blockListingAction,
  promoteListingAction,
} from '@/app/admin/actions';
import { formatLocation, formatPhone, formatPrice, formatQuantity, formatTimeAgo } from '@/lib/format';
import type { Listing } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Qoralama',
  pending: 'Tekshiruvda',
  active: 'Faol',
  sold: 'Sotilgan',
  expired: 'Muddati tugagan',
  blocked: 'Bloklangan',
};

/**
 * One listing in an admin queue. `mode` decides the action set: the moderation
 * queue needs approve/reject and nothing else, the general list needs
 * promote/block.
 */
export function AdminListingRow({
  listing,
  mode,
}: {
  listing: Listing;
  mode: 'moderation' | 'manage';
}) {
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

  const block = () => {
    // A required reason, gathered the cheapest way that works. The seller
    // reads this text, so the prompt says so.
    const reason = window.prompt(
      "Bloklash sababi (sotuvchi shu matnni o'qiydi):",
    );
    if (reason?.trim()) {
      run(() => blockListingAction(listing.id, reason.trim()));
    }
  };

  const promote = () => {
    const days = window.prompt('TOP muddati, kun (0 — olib tashlash):', '7');
    if (days !== null && /^\d+$/.test(days.trim())) {
      run(() => promoteListingAction(listing.id, parseInt(days.trim(), 10)));
    }
  };

  const promoLive =
    listing.isPromoted &&
    (!listing.promotedUntil || new Date(listing.promotedUntil).getTime() > Date.now());

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-line bg-white p-3 shadow-sm sm:flex-nowrap">
      <Link
        href={`/e/${listing.id}`}
        target="_blank"
        className="relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-canvas"
      >
        {cover ? (
          <Image src={cover.thumbUrl ?? cover.url} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <ImageOff className="h-4 w-4 text-ink-faint" aria-hidden="true" />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/e/${listing.id}`} target="_blank" className="truncate text-sm font-semibold text-ink hover:underline">
            {listing.title}
          </Link>
          {promoLive && (
            <span className="rounded bg-saffron px-1.5 py-0.5 text-[10px] font-bold text-white">TOP</span>
          )}
        </div>
        <p className="numeric text-sm font-bold text-harvest">
          {formatPrice(listing.price, listing.priceUnit)}
          <span className="ml-2 rounded-full bg-harvest/12 px-2 py-0.5 text-[11px] font-semibold">
            {formatQuantity(listing.quantity, listing.quantityUnit)}
          </span>
        </p>
        <p className="truncate text-xs text-ink-muted">
          {formatLocation(listing.region, listing.district)} ·{' '}
          <span className="numeric">{listing.seller ? formatPhone(listing.seller.phone) : '—'}</span> ·{' '}
          <span className="numeric">{formatTimeAgo(listing.createdAt)}</span> ·{' '}
          {STATUS_LABEL[listing.status] ?? listing.status}
        </p>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>

      <div className="flex shrink-0 gap-1.5">
        {mode === 'moderation' ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => approveListingAction(listing.id))}
              className="tap-target rounded-xl bg-harvest px-3 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              Tasdiqlash
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={block}
              className="tap-target rounded-xl px-3 text-xs font-semibold text-danger ring-1 ring-danger/30 hover:bg-danger/5 disabled:opacity-60"
            >
              Rad etish
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={promote}
              className="tap-target rounded-xl px-3 text-xs font-semibold text-saffron-dark ring-1 ring-saffron/40 hover:bg-saffron/5 disabled:opacity-60"
            >
              {promoLive ? 'TOP·off' : 'TOP'}
            </button>
            {listing.status !== 'blocked' && (
              <button
                type="button"
                disabled={pending}
                onClick={block}
                className="tap-target rounded-xl px-3 text-xs font-semibold text-danger ring-1 ring-danger/30 hover:bg-danger/5 disabled:opacity-60"
              >
                Bloklash
              </button>
            )}
            {listing.status === 'blocked' && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => approveListingAction(listing.id))}
                className="tap-target rounded-xl px-3 text-xs font-semibold text-harvest ring-1 ring-harvest/30 hover:bg-harvest/5 disabled:opacity-60"
              >
                Faollashtirish
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
