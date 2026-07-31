import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isSignedIn } from '@/lib/session';
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
  if (await isSignedIn()) {
    redirect('/profil');
  }

  const { next } = await searchParams;
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/';

  return (
    <div className="mx-auto flex max-w-7xl items-start justify-center px-4 py-10 sm:py-16">
      <LoginForm next={safeNext} devMode={process.env.NODE_ENV !== 'production'} />
    </div>
  );
}
