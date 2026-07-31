import Image from 'next/image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import { formatLocation, formatPrice, formatQuantity, formatTimeAgo } from '@/lib/format';
import type { Listing, ListingStatus } from '@/lib/types';

const STATUS: Record<ListingStatus, { label: string; className: string }> = {
  active: { label: 'Faol', className: 'bg-harvest/10 text-harvest' },
  sold: { label: 'Sotildi', className: 'bg-cobalt/8 text-cobalt' },
  pending: { label: 'Kutilmoqda', className: 'bg-saffron/15 text-saffron-dark' },
  draft: { label: 'Qoralama', className: 'bg-slate-100 text-ink-muted' },
  expired: { label: 'Muddati tugagan', className: 'bg-slate-100 text-ink-muted' },
  blocked: { label: 'Bloklangan', className: 'bg-danger/10 text-danger' },
};

export function ListingsTable({ listings }: { listings: Listing[] }) {
  return (
    <section className="rounded-2xl border border-slate-line bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-line px-5 py-4 sm:px-6">
        <h2 className="text-lg">So&apos;nggi e&apos;lonlar</h2>
        <Link
          href="/dashboard/elonlar"
          className="text-sm font-medium text-turquoise hover:underline"
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
              <tr className="border-b border-slate-line text-xs text-ink-faint">
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

            <tbody className="divide-y divide-slate-line">
              {listings.map((listing) => {
                const cover = listing.photos?.[0];
                const status = STATUS[listing.status];

                return (
                  <tr key={listing.id} className="transition-colors hover:bg-slate-canvas">
                    <td className="px-5 py-3 sm:px-6">
                      <Link href={`/e/${listing.id}`} className="flex items-center gap-3">
                        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-canvas">
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
                      <span className="numeric inline-block rounded-full bg-harvest/12 px-2.5 py-1 text-xs font-semibold text-harvest">
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
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                      >
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
