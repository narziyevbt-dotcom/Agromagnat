import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCategories, getMe, getRegions } from '@/lib/api';
import { getAccessToken, phoneGatePath } from '@/lib/session';
import { t } from '@/lib/strings';
import { AddListingForm } from './AddListingForm';

export const metadata: Metadata = {
  title: t.addListing.title,
  robots: { index: false, follow: false },
};

export default async function AddListingPage() {
  const token = await getAccessToken();
  if (!token) {
    redirect('/kirish?next=/joylash');
  }

  const [categories, regions, me] = await Promise.all([
    getCategories().catch(() => []),
    getRegions().catch(() => []),
    getMe(token).catch(() => null),
  ]);

  // The gate is enforced by the API on submit, but finding out there is checked
  // here first: photographing a crop, filling six fields and *then* being asked
  // for a phone number is how a seller gives up. Asked before the work, it is
  // one step; asked after, it is a lost listing.
  if (me && !me.phoneVerifiedAt) {
    redirect(phoneGatePath('/joylash'));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
      <h1 className="mb-5 text-xl sm:text-2xl">{t.addListing.title}</h1>
      <AddListingForm categories={categories} regions={regions} />
    </div>
  );
}
