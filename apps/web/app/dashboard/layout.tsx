import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import { getMe, getUnreadCount } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Asosiy panel',
  robots: { index: false, follow: false },
};

/**
 * Dashboard shell. Auth is enforced here rather than in each page, so a new
 * dashboard route cannot ship unguarded by omission.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getAccessToken();
  if (!token) {
    redirect('/kirish?next=/dashboard');
  }

  const user = await getMe(token).catch(() => null);
  if (!user) {
    // The cookie outlived the session.
    redirect('/kirish?next=/dashboard');
  }

  // The bell had no source until chat shipped, so it never lit up. A failure
  // here shows no badge rather than blocking the whole shell on it.
  const { unread } = await getUnreadCount(token).catch(() => ({ unread: 0 }));

  return (
    <div className="flex min-h-screen bg-slate-canvas">
      <Sidebar name={user.name} isVerified={user.isVerified} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar unread={unread} />
        <div className="flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  );
}
