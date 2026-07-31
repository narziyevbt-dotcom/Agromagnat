import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import { getMe } from '@/lib/api';
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

  return (
    <div className="flex min-h-screen bg-slate-canvas">
      <Sidebar name={user.name} isVerified={user.isVerified} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  );
}
