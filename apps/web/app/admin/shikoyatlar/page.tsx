import Link from 'next/link';
import { AdminReportRow } from '@/components/admin/AdminReportRow';
import { getAdminReports } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Search = Promise<{ status?: string }>;

export default async function AdminReportsPage({ searchParams }: { searchParams: Search }) {
  const token = (await getAccessToken())!;
  const params = await searchParams;
  const status = params.status === 'all' ? undefined : 'open';

  const page = await getAdminReports(token, { status }).catch(() => ({
    items: [],
    total: 0,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl">Shikoyatlar</h1>
        <p className="numeric text-sm text-ink-muted">{page.total} ta</p>
      </div>

      <div className="flex gap-1.5">
        <Link
          href="/admin/shikoyatlar"
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            !params.status
              ? 'bg-cobalt text-white'
              : 'bg-white text-ink-muted ring-1 ring-slate-line'
          }`}
        >
          Ochiq
        </Link>
        <Link
          href="/admin/shikoyatlar?status=all"
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            params.status === 'all'
              ? 'bg-cobalt text-white'
              : 'bg-white text-ink-muted ring-1 ring-slate-line'
          }`}
        >
          Barchasi
        </Link>
      </div>

      {page.items.length === 0 ? (
        <div className="rounded-2xl border border-slate-line bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-ink">Shikoyat yo&apos;q</p>
          <p className="mt-1 text-sm text-ink-muted">Navbat toza.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {page.items.map((report) => (
            <li key={report.id}>
              <AdminReportRow report={report} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
