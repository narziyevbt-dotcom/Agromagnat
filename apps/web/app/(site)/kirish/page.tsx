import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { t } from '@/lib/strings';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: t.auth.title,
  // A login form has nothing to offer a search engine.
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/';

  // Confirming the code creates the session, and the action's response
  // re-renders this page — so a blanket "signed in? go to /profil" sent people
  // away before the name step could draw, and every new seller ended up called
  // "Foydalanuvchi". A signed-in visitor without a name is mid-sign-up and
  // belongs here; one with a name has nothing left to do.
  const token = await getAccessToken();
  const me = token ? await getMe(token).catch(() => null) : null;
  if (me?.name) {
    redirect('/profil');
  }

  return (
    <div className="mx-auto flex max-w-7xl items-start justify-center px-4 py-10 sm:py-16">
      <LoginForm
        next={safeNext}
        // Reopening the tab mid-sign-up lands back on the question that was
        // left unanswered rather than on a phone field they have already used.
        startAtName={Boolean(me)}
        devMode={process.env.NODE_ENV !== 'production'}
        // Absent in a fresh checkout, and then the Google button simply is not
        // there — a dead button that fails on tap is worse than one door.
        googleClientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null}
      />
    </div>
  );
}
