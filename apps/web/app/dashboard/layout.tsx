import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import { getMe, getMyListings, getUnreadCount } from '@/lib/api';
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

  // The bell had no source until chat shipped, so it never lit up. Neither of
  // these blocks the shell: a failure shows no badge and no count.
  const [{ unread }, listings] = await Promise.all([
    getUnreadCount(token).catch(() => ({ unread: 0 })),
    getMyListings(token, { limit: 50 }).catch(() => ({
      items: [],
      hasMore: false,
      nextCursor: null,
    })),
  ]);

  const activeListings = listings.items.filter(
    (listing) => listing.status === 'active',
  ).length;

  /*
   * The app sits in a window inset from the page rather than filling the
   * viewport edge to edge.
   *
   * That inset is doing work, not decoration: it puts a neutral margin around
   * a dense screen so the eye has somewhere to rest, and it makes the dark
   * sidebar read as one edge of a single object instead of as a stripe painted
   * down the side of the browser. Below `lg` the window loses its margin and
   * goes full-bleed — on a phone, giving up 32px of width to a shadow is a
   * trade nobody wants.
   */
  return (
    <div className="min-h-screen bg-canvas lg:p-4">
      <div className="app-window flex min-h-screen overflow-hidden lg:min-h-[calc(100vh-2rem)]">
        <Sidebar
          name={user.name}
          isVerified={user.isVerified}
          unread={unread}
          listingCount={activeListings}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar unread={unread} name={user.name} />
          <div className="flex-1 px-4 pb-6 sm:px-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
