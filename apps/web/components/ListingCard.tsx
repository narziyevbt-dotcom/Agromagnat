import Image from 'next/image';
import Link from 'next/link';
import { formatLocation, formatPrice, formatQuantity, formatTimeAgo } from '@/lib/format';
import { t } from '@/lib/strings';
import type { Listing } from '@/lib/types';
import { FavoriteButton } from './FavoriteButton';

/**
 * The card the whole product is built around.
 *
 * The volume chip is as prominent as the price. That pairing is the reason
 * Agromagnat exists rather than a generic classifieds board: a buyer needs to
 * know "12 t" as urgently as "14 000 so'm/kg", and a general board makes volume
 * a line of free text nobody can filter on.
 */
export function ListingCard({
  listing,
  signedIn = false,
  priority = false,
}: {
  listing: Listing;
  signedIn?: boolean;
  priority?: boolean;
}) {
  const cover = listing.photos?.[0];
  const image = cover?.thumbUrl ?? cover?.url;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface ring-1 ring-hairline transition-shadow hover:shadow-[0_4px_20px_rgba(10,58,85,0.08)]">
      <Link
        href={`/e/${listing.id}`}
        className="relative block aspect-4/3 overflow-hidden bg-canvas"
      >
        {image ? (
          <Image
            src={image}
            alt={listing.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            {t.listing.noPhoto}
          </div>
        )}

        {listing.isPromoted && (
          <span className="absolute left-2 top-2 rounded-md bg-saffron px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            {t.listing.topBadge}
          </span>
        )}
      </Link>

      {/* Outside the Link so it is its own control, not a nested interactive. */}
      <div className="absolute right-2 top-2">
        <FavoriteButton
          listingId={listing.id}
          initial={listing.isFavorite ?? false}
          signedIn={signedIn}
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link href={`/e/${listing.id}`} className="min-w-0">
          <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold text-ink">
            {listing.title}
          </h3>
        </Link>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <span className="numeric text-lg font-bold text-harvest">
            {formatPrice(listing.price, listing.priceUnit)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* The green volume chip — the product's signature element. */}
          <span className="numeric rounded-full bg-harvest/12 px-2.5 py-1 text-sm font-semibold text-harvest">
            {formatQuantity(listing.quantity, listing.quantityUnit)}
          </span>
          {listing.seller?.isVerified && (
            <span
              className="rounded-full bg-turquoise/12 px-2 py-1 text-xs font-medium text-turquoise"
              title={t.listing.verified}
            >
              ✓ {t.listing.verified}
            </span>
          )}
        </div>

        <p className="truncate text-xs text-ink-muted">
          {formatLocation(listing.region, listing.district)}
        </p>
        <p className="numeric text-xs text-ink-faint">{formatTimeAgo(listing.createdAt)}</p>
      </div>
    </article>
  );
}

/** Matches the card's shape so the grid does not jump when data arrives. */
export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface ring-1 ring-hairline">
      <div className="aspect-4/3 animate-pulse bg-canvas" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-canvas" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-canvas" />
        <div className="h-6 w-16 animate-pulse rounded-full bg-canvas" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-canvas" />
      </div>
    </div>
  );
}
