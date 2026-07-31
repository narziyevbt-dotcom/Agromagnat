import Link from 'next/link';
import { AdminListingRow } from '@/components/admin/AdminListingRow';
import { getAdminListings } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: '', label: 'Barchasi' },
  { value: 'active', label: 'Faol' },
  { value: 'pending', label: 'Tekshiruvda' },
  { value: 'blocked', label: 'Bloklangan' },
  { value: 'sold', label: 'Sotilgan' },
  { value: 'expired', label: 'Muddati tugagan' },
] as const;

type Search = Promise<{ q?: string; status?: string; page?: string }>;

export default async function AdminListingsPage({ searchParams }: { searchParams: Search }) {
  const token = (await getAccessToken())!;
  const params = await searchParams;
  const pageNum = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  const page = await getAdminListings(token, {
    q: params.q,
    status: params.status || undefined,
    page: pageNum,
  }).catch(() => ({ items: [], total: 0 }));

  const query = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, page: undefined, ...changes })) {
      if (value) next.set(key, value);
    }
    const text = next.toString();
    return `/admin/elonlar${text ? `?${text}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl">E&apos;lonlar</h1>
        <p className="numeric text-sm text-ink-muted">{page.total} ta</p>
      </div>

      {/* GET form — the filter state stays in the URL, shareable between admins. */}
      <form action="/admin/elonlar" method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Sarlavha yoki sotuvchi telefoni..."
          className="tap-target min-w-0 flex-1 rounded-xl border border-slate-line bg-white px-3 text-sm"
        />
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <button
          type="submit"
          className="tap-target rounded-xl bg-forest px-4 text-sm font-semibold text-white"
        >
          Qidirish
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((status) => (
          <Link
            key={status.value}
            href={query({ status: status.value || undefined })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              (params.status ?? '') === status.value
                ? 'bg-forest text-white'
                : 'bg-white text-ink-muted ring-1 ring-slate-line hover:text-ink'
            }`}
          >
            {status.label}
          </Link>
        ))}
      </div>

      {page.items.length === 0 ? (
        <p className="rounded-2xl border border-slate-line bg-white p-10 text-center text-sm text-ink-muted shadow-sm">
          Hech narsa topilmadi.
        </p>
      ) : (
        <ul className="space-y-2">
          {page.items.map((listing) => (
            <li key={listing.id}>
              <AdminListingRow listing={listing} mode="manage" />
            </li>
          ))}
        </ul>
      )}

      {page.total > 30 && (
        <div className="flex justify-center gap-2">
          {pageNum > 1 && (
            <Link href={query({ page: String(pageNum - 1) })} className="tap-target inline-flex items-center rounded-xl bg-white px-4 text-sm ring-1 ring-slate-line">
              ← Oldingi
            </Link>
          )}
          {pageNum * 30 < page.total && (
            <Link href={query({ page: String(pageNum + 1) })} className="tap-target inline-flex items-center rounded-xl bg-white px-4 text-sm ring-1 ring-slate-line">
              Keyingi →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
