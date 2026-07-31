import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CallButton } from '@/components/CallButton';
import { FavoriteButton } from '@/components/FavoriteButton';
import { PhotoGallery } from '@/components/PhotoGallery';
import { ReportButton } from '@/components/ReportButton';
import { SeasonStrip } from '@/components/SeasonStrip';
import { ApiError, getListing } from '@/lib/api';
import {
  formatDate,
  formatDelivery,
  formatLocation,
  formatMoney,
  formatPrice,
  formatQuantity,
  formatTimeAgo,
  initials,
} from '@/lib/format';
import { getAccessToken, isSignedIn } from '@/lib/session';
import { t } from '@/lib/strings';
import type { Listing } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

async function load(id: string): Promise<Listing | null> {
  try {
    const token = await getAccessToken();
    return await getListing(id, token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Per-listing metadata. This is the page that has to rank: a buyer searching
 * "urgut pomidor optom" should land here, not on the home page.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await load(id).catch(() => null);

  if (!listing) {
    return { title: t.listing.notFound, robots: { index: false, follow: false } };
  }

  const where = formatLocation(listing.region, listing.district);
  const price = formatPrice(listing.price, listing.priceUnit);
  const volume = formatQuantity(listing.quantity, listing.quantityUnit);
  const description = `${volume} · ${price} · ${where}. ${listing.description ?? ''}`.trim();

  return {
    title: `${listing.title} — ${price}`,
    description: description.slice(0, 300),
    openGraph: {
      title: listing.title,
      description: description.slice(0, 300),
      images: listing.photos?.[0] ? [listing.photos[0].url] : undefined,
      type: 'website',
    },
    // Sold and expired listings stay reachable by link but leave the index.
    robots:
      listing.status === 'active'
        ? { index: true, follow: true }
        : { index: false, follow: true },
  };
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  const listing = await load(id);

  if (!listing) {
    notFound();
  }

  const signedIn = await isSignedIn();
  const inactive = listing.status !== 'active';

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <PhotoGallery photos={listing.photos ?? []} title={listing.title} />
        </div>

        <div className="flex flex-col gap-5">
          {inactive && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {listing.status === 'sold' ? t.listing.sold : t.listing.expired}
            </p>
          )}

          <div>
            <h1 className="text-xl leading-tight sm:text-2xl">{listing.title}</h1>
            <p className="numeric mt-1 text-xs text-ink-faint">
              {formatTimeAgo(listing.createdAt)} · {listing.viewCount} {t.listing.views}
            </p>
          </div>

          <div>
            <p className="numeric text-3xl font-bold text-harvest">
              {formatPrice(listing.price, listing.priceUnit)}
            </p>
            {listing.wholesalePrice && (
              <p className="numeric mt-1 text-sm text-ink-muted">
                {t.listing.wholesalePrice}:{' '}
                <span className="font-semibold text-harvest">
                  {formatMoney(listing.wholesalePrice)}
                  {/* Explicit — JSX drops the space before a line break. */}
                  {' so’m'}
                </span>
              </p>
            )}
          </div>

          {/* 2×2 specification grid from the design spec. */}
          <dl className="grid grid-cols-2 gap-3">
            <Spec label={t.listing.volume}>
              {formatQuantity(listing.quantity, listing.quantityUnit)}
            </Spec>
            <Spec label={t.listing.minOrder}>
              {listing.minOrder
                ? formatQuantity(listing.minOrder, listing.quantityUnit)
                : '—'}
            </Spec>
            <Spec label={t.listing.harvestDate}>
              {listing.harvestDate ? formatDate(listing.harvestDate) : '—'}
            </Spec>
            <Spec label={t.listing.delivery} mono={false}>
              {formatDelivery(listing.delivery)}
            </Spec>
          </dl>

          <p className="text-sm text-ink-muted">
            📍 {formatLocation(listing.region, listing.district)}
          </p>

          <SeasonStrip months={listing.seasonMonths} />

          {listing.seller && (
            <Link
              href={`/sotuvchi/${listing.seller.id}`}
              className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-3 ring-1 ring-hairline transition-colors hover:ring-turquoise"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cobalt text-sm font-semibold text-white">
                {initials(listing.seller.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-semibold text-ink">
                    {listing.seller.name ?? 'Sotuvchi'}
                  </span>
                  {listing.seller.isVerified && (
                    <span className="shrink-0 text-turquoise" title={t.listing.verified}>
                      ✓
                    </span>
                  )}
                </span>
                <span className="numeric block text-xs text-ink-muted">
                  ★ {Number(listing.seller.ratingAvg).toFixed(1)} ·{' '}
                  {listing.seller.salesCount} {t.listing.sales}
                </span>
              </span>
            </Link>
          )}

          {listing.seller && !inactive && (
            <div className="flex gap-2">
              <CallButton
                listingId={listing.id}
                phone={listing.seller.phone}
                sellerName={listing.seller.name}
              />
              <FavoriteButton
                listingId={listing.id}
                initial={listing.isFavorite ?? false}
                signedIn={signedIn}
                large
              />
            </div>
          )}
        </div>
      </div>

      {listing.description && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-bold text-ink">{t.listing.description}</h2>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-muted">
            {listing.description}
          </p>
        </section>
      )}

      <div className="mt-8">
        <ReportButton listingId={listing.id} />
      </div>

      <ListingJsonLd listing={listing} />
    </div>
  );
}

function Spec({
  label,
  children,
  mono = true,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface p-3 ring-1 ring-hairline">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className={`mt-0.5 font-semibold text-ink ${mono ? 'numeric' : ''}`}>
        {children}
      </dd>
    </div>
  );
}

/**
 * Product structured data, so a listing can show its price and availability
 * directly in a Google result rather than as a plain blue link.
 */
function ListingJsonLd({ listing }: { listing: Listing }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description ?? undefined,
    image: listing.photos?.map((photo) => photo.url),
    category: listing.category?.nameUz,
    offers: {
      '@type': 'Offer',
      price: Number(listing.price),
      priceCurrency: 'UZS',
      availability:
        listing.status === 'active'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      areaServed: formatLocation(listing.region, listing.district),
      seller: {
        '@type': 'Person',
        name: listing.seller?.name ?? undefined,
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
