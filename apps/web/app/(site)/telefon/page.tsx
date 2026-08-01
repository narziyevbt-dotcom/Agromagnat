import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthMethods, getMe } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { t } from '@/lib/strings';
import { PhoneVerifyForm } from './PhoneVerifyForm';

export const metadata: Metadata = {
  title: t.phoneGate.title,
  robots: { index: false, follow: false },
};

/**
 * Where every refused action sends the visitor.
 *
 * A route rather than a modal, for one reason that outweighs the extra
 * navigation: the refusal can arrive from a server action, a route handler or
 * a full page load, and a URL is the only target all three can reach. It also
 * survives a reload mid-flow, which a sheet held in React state does not.
 */
export default async function VerifyPhonePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/';

  const token = await getAccessToken();
  if (!token) {
    redirect(`/kirish?next=/telefon`);
  }

  // Checked against the account rather than the token: somebody who verified
  // on their phone and then opened this link on a laptop still holds an access
  // token that says otherwise, and sending them round the SMS loop again would
  // cost us money to tell them something we already know.
  const [me, methods] = await Promise.all([
    getMe(token).catch(() => null),
    getAuthMethods().catch(() => ({ telegram: false, google: false })),
  ]);
  if (me?.phoneVerifiedAt) {
    redirect(safeNext);
  }

  return (
    <div className="mx-auto flex max-w-7xl items-start justify-center px-4 py-10 sm:py-16">
      <PhoneVerifyForm
        next={safeNext}
        devMode={process.env.NODE_ENV !== 'production'}
        telegramEnabled={methods.telegram}
      />
    </div>
  );
}
