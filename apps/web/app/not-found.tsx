import Link from 'next/link';
import { t } from '@/lib/strings';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
      <p className="numeric text-5xl font-bold text-hairline">404</p>
      <h1 className="mt-3 text-xl">{t.listing.notFound}</h1>
      <p className="mt-2 text-sm text-ink-muted">{t.listing.notFoundHint}</p>
      <div className="mt-6 flex gap-2">
        <Link
          href="/"
          className="tap-target inline-flex items-center rounded-lg bg-cobalt px-5 text-sm font-semibold text-white"
        >
          {t.nav.home}
        </Link>
        <Link
          href="/qidiruv"
          className="tap-target inline-flex items-center rounded-lg px-5 text-sm font-medium text-cobalt ring-1 ring-hairline"
        >
          {t.search.title}
        </Link>
      </div>
    </div>
  );
}
