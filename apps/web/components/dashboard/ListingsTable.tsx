import Image from 'next/image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import { formatLocation, formatPrice, formatQuantity, formatTimeAgo } from '@/lib/format';
import type { Listing, ListingStatus } from '@/lib/types';

/**
 * Status as a pill with a filled dot, the pattern the reference dashboards use
 * for transaction state. The dot carries the colour, so the pill itself stays
 * quiet enough to sit in a table without competing with the price beside it.
 */
const STATUS: Record<ListingStatus, { label: string; pill: string; dot: string }> = {
  active: { label: 'Faol', pill: 'bg-mint text-harvest', dot: 'bg-harvest' },
  sold: { label: 'Sotildi', pill: 'bg-forest/8 text-forest', dot: 'bg-forest' },
  pending: {
    label: 'Kutilmoqda',
    pill: 'bg-saffron/12 text-saffron-dark',
    dot: 'bg-saffron',
  },
  draft: { label: 'Qoralama', pill: 'bg-canvas text-ink-muted', dot: 'bg-ink-faint' },
  expired: {
    label: 'Muddati tugagan',
    pill: 'bg-canvas text-ink-muted',
    dot: 'bg-ink-faint',
  },
  blocked: { label: 'Bloklangan', pill: 'bg-danger/10 text-danger', dot: 'bg-danger' },
};

export function ListingsTable({ listings }: { listings: Listing[] }) {
  return (
    <section className="rounded-3xl bg-surface shadow-sm ring-1 ring-hairline">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-4 sm:px-6">
        <h2 className="text-lg">So&apos;nggi e&apos;lonlar</h2>
        <Link
          href="/dashboard/elonlar"
          className="rounded-full bg-surface-soft px-3.5 py-1.5 text-xs font-bold text-ink-muted ring-1 ring-hairline transition-colors hover:text-ink"
        >
          Barchasi
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-ink-faint">
          Sizda hali e&apos;lon yo&apos;q.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-hairline text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                <th scope="col" className="px-5 py-3 font-medium sm:px-6">
                  Mahsulot
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Kategoriya
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Hajm
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Narx
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Joylashuv
                </th>
                <th scope="col" className="px-5 py-3 font-medium sm:px-6">
                  Holat
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-hairline">
              {listings.map((listing) => {
                const cover = listing.photos?.[0];
                const status = STATUS[listing.status];

                return (
                  <tr key={listing.id} className="transition-colors hover:bg-surface-soft">
                    <td className="px-5 py-3 sm:px-6">
                      <Link href={`/e/${listing.id}`} className="flex items-center gap-3">
                        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-soft">
                          {cover ? (
                            <Image
                              src={cover.thumbUrl ?? cover.url}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          ) : (
                            <ImageOff
                              className="h-4 w-4 text-ink-faint"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block max-w-[220px] truncate text-sm font-semibold text-ink">
                            {listing.title}
                          </span>
                          <span className="numeric block text-[11px] text-ink-faint">
                            {formatTimeAgo(listing.createdAt)}
                          </span>
                        </span>
                      </Link>
                    </td>

                    <td className="px-3 py-3 text-sm text-ink-muted">
                      {listing.category?.nameUz ?? '—'}
                    </td>

                    <td className="px-3 py-3">
                      <span className="numeric inline-block rounded-full bg-mint px-2.5 py-1 text-xs font-bold text-harvest">
                        {formatQuantity(listing.quantity, listing.quantityUnit)}
                      </span>
                    </td>

                    <td className="numeric px-3 py-3 text-sm font-bold whitespace-nowrap text-harvest">
                      {formatPrice(listing.price, listing.priceUnit)}
                    </td>

                    <td className="px-3 py-3 text-xs whitespace-nowrap text-ink-muted">
                      {formatLocation(listing.region, listing.district)}
                    </td>

                    <td className="px-5 py-3 sm:px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.pill}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                          aria-hidden="true"
                        />
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
