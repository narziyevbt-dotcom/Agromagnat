import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { getMe } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

/**
 * The role check lives in the layout, so no admin page can ship unguarded by
 * omission. Note this is UI-level convenience only — the real enforcement is
 * the backend's RolesGuard, which 403s a non-admin token regardless of what
 * the browser renders.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getAccessToken();
  if (!token) {
    redirect('/kirish?next=/admin');
  }

  const user = await getMe(token).catch(() => null);
  if (!user || user.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen bg-slate-canvas">
      <AdminSidebar name={user.name} />
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</div>
    </div>
  );
}
