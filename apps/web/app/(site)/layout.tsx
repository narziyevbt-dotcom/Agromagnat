import { Suspense } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { MobileNav } from '@/components/MobileNav';
import { isSignedIn } from '@/lib/session';

/**
 * Public site chrome: forest header, footer, and the mobile tab bar.
 *
 * The dashboard sits outside this group because it has its own shell — a
 * sidebar plus top bar — and stacking both would give it two navigations.
 */
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const signedIn = await isSignedIn();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header reads search params, so it needs a Suspense boundary. */}
      <Suspense fallback={<div className="h-[68px] bg-forest" />}>
        <Header signedIn={signedIn} />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
      <MobileNav />
    </div>
  );
}
