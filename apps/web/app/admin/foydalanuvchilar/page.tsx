import { AdminUserRow } from '@/components/admin/AdminUserRow';
import { getAdminUsers } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Search = Promise<{ q?: string; page?: string }>;

export default async function AdminUsersPage({ searchParams }: { searchParams: Search }) {
  const token = (await getAccessToken())!;
  const params = await searchParams;

  const page = await getAdminUsers(token, {
    q: params.q,
    page: Math.max(1, parseInt(params.page ?? '1', 10) || 1),
  }).catch(() => ({ items: [], total: 0 }));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl">Foydalanuvchilar</h1>
        <p className="numeric text-sm text-ink-muted">{page.total} ta</p>
      </div>

      <form action="/admin/foydalanuvchilar" method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Telefon yoki ism bo'yicha..."
          className="tap-target min-w-0 flex-1 rounded-xl border border-slate-line bg-white px-3 text-sm"
        />
        <button
          type="submit"
          className="tap-target rounded-xl bg-cobalt px-4 text-sm font-semibold text-white"
        >
          Qidirish
        </button>
      </form>

      {page.items.length === 0 ? (
        <p className="rounded-2xl border border-slate-line bg-white p-10 text-center text-sm text-ink-muted shadow-sm">
          Hech kim topilmadi.
        </p>
      ) : (
        <ul className="space-y-2">
          {page.items.map((user) => (
            <li key={user.id}>
              <AdminUserRow user={user} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
