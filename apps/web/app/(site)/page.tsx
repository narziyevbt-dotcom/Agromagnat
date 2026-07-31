import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BentoFeatures } from '@/components/landing/BentoFeatures';
import { Hero } from '@/components/landing/Hero';
import { PartnerBar } from '@/components/landing/PartnerBar';
import { ListingCard } from '@/components/ListingCard';
import { getListings, getPriceTrend } from '@/lib/api';
import { getAccessToken, isSignedIn } from '@/lib/session';
import { t } from '@/lib/strings';

/**
 * Landing page.
 *
 * It still renders a strip of real listings below the marketing sections. The
 * home page is the strongest URL on the domain, and handing a crawler nothing
 * but marketing copy would waste it — the listing feed is what earns the
 * search traffic this business runs on.
 */
export const revalidate = 60;

export default async function HomePage() {
  const signedIn = await isSignedIn();
  const token = signedIn ? await getAccessToken() : undefined;

  const [trend, feed] = await Promise.all([
    getPriceTrend().catch(() => null),
    getListings({ limit: 8 }, token).catch(() => ({
      items: [],
      hasMore: false,
      nextCursor: null,
    })),
  ]);

  return (
    <>
      <Hero />
      <PartnerBar />
      <BentoFeatures trend={trend} />

      {feed.items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-2xl sm:text-3xl">{t.home.latest}</h2>
            <Link
              href="/qidiruv"
              className="inline-flex items-center gap-1 text-sm font-medium text-turquoise hover:underline"
            >
              {t.home.seeAll}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {feed.items.map((listing, index) => (
              <li key={listing.id}>
                <ListingCard listing={listing} signedIn={signedIn} priority={index < 4} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <CtaBand />
    </>
  );
}

function CtaBand() {
  return (
    <section className="bg-cobalt">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl text-white sm:text-3xl">
            Hosilingiz dalada qolib ketmasin
          </h2>
          <p className="mt-2 max-w-lg text-sm text-white/70">
            E&apos;lon joylash 2 daqiqa vaqt oladi va butunlay bepul.
          </p>
        </div>

        <Link
          href="/joylash"
          className="tap-target inline-flex shrink-0 items-center gap-2 rounded-xl bg-lime px-6 py-3.5 text-base font-semibold text-cobalt transition-colors hover:bg-lime-dark"
        >
          {t.nav.add}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
