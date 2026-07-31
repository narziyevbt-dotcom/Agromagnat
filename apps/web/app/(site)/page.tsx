import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
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
            <h2 className="text-2xl sm:text-[2rem]">{t.home.latest}</h2>
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
    <section className="px-4 pb-10">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 rounded-[var(--radius-window)] bg-forest px-6 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-14">
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
          className="tap-target group inline-flex shrink-0 items-center gap-3 rounded-full bg-lime py-1.5 pr-1.5 pl-6 text-base font-bold text-forest transition-colors hover:bg-lime-dark"
        >
          {t.nav.add}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-lime transition-transform group-hover:rotate-45">
            <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
          </span>
        </Link>
      </div>
    </section>
  );
}
