import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe, getMyListings } from '@/lib/api';
import { formatPhone, initials } from '@/lib/format';
import { getAccessToken } from '@/lib/session';
import { t } from '@/lib/strings';
import { MyListingRow } from './MyListingRow';
import { SignOutButton, SignOutEverywhereButton } from './SignOutButton';

export const metadata: Metadata = {
  title: t.profile.title,
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const token = await getAccessToken();
  if (!token) {
    redirect('/kirish?next=/profil');
  }

  const [user, listings] = await Promise.all([
    getMe(token).catch(() => null),
    getMyListings(token, { limit: 50 }).catch(() => ({
      items: [],
      hasMore: false,
      nextCursor: null,
    })),
  ]);

  if (!user) {
    // The cookie outlived the session — send them back through login.
    redirect('/kirish?next=/profil');
  }

  const active = listings.items.filter((listing) => listing.status === 'active');
  const views = listings.items.reduce((sum, listing) => sum + listing.viewCount, 0);
  const calls = listings.items.reduce((sum, listing) => sum + listing.callCount, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:py-8">
      <section className="rounded-[var(--radius-card)] bg-forest p-5 text-white sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-bold">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl text-white">{user.name ?? 'Foydalanuvchi'}</h1>
            <p className="numeric truncate text-sm text-white/75">
              {formatPhone(user.phone) || user.email}
            </p>
            {user.isVerified && (
              <p className="mt-0.5 text-xs font-medium text-turquoise">
                ✓ {t.listing.verified}
              </p>
            )}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3">
          <Stat label={t.profile.activeListings} value={active.length} />
          <Stat label={t.profile.totalViews} value={views} />
          <Stat label={t.profile.totalCalls} value={calls} />
        </dl>
      </section>

      {/* The one thing standing between this account and the whole product.
          It sits above the actions rather than beside them because every one
          of those actions is refused until it is done. */}
      {!user.phoneVerifiedAt && (
        <Link
          href="/telefon?next=/profil"
          className="mt-4 flex items-center gap-3 rounded-2xl bg-saffron/10 p-4 ring-1 ring-saffron/30 transition-colors hover:bg-saffron/15"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-saffron/20 text-lg">
            📱
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">
              {t.phoneGate.title}
            </span>
            <span className="mt-0.5 block text-sm text-ink-muted">
              {t.phoneGate.subtitle}
            </span>
          </span>
        </Link>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/sevimlilar"
          className="tap-target inline-flex items-center rounded-lg bg-surface px-4 text-sm font-medium text-ink ring-1 ring-hairline hover:ring-turquoise"
        >
          {t.profile.favorites}
        </Link>
        <Link
          href="/joylash"
          className="tap-target inline-flex items-center rounded-lg bg-lime px-4 text-sm font-semibold text-forest hover:bg-lime-dark"
        >
          + {t.nav.add}
        </Link>
        <SignOutButton />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-ink">{t.profile.myListings}</h2>

        {listings.items.length === 0 ? (
          <div className="rounded-[var(--radius-card)] bg-surface p-8 text-center ring-1 ring-hairline">
            <p className="font-semibold text-ink">{t.profile.noListings}</p>
            <p className="mt-1 text-sm text-ink-muted">{t.profile.noListingsHint}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {listings.items.map((listing) => (
              <li key={listing.id}>
                <MyListingRow listing={listing} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 border-t border-hairline pt-5">
        <SignOutEverywhereButton />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <dt className="text-xs text-white/70">{label}</dt>
      <dd className="numeric mt-0.5 text-xl font-bold text-white">{value}</dd>
    </div>
  );
}
