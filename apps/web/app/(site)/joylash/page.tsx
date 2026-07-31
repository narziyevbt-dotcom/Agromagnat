import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCategories, getRegions } from '@/lib/api';
import { isSignedIn } from '@/lib/session';
import { t } from '@/lib/strings';
import { AddListingForm } from './AddListingForm';

export const metadata: Metadata = {
  title: t.addListing.title,
  robots: { index: false, follow: false },
};

export default async function AddListingPage() {
  if (!(await isSignedIn())) {
    redirect('/kirish?next=/joylash');
  }

  const [categories, regions] = await Promise.all([
    getCategories().catch(() => []),
    getRegions().catch(() => []),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
      <h1 className="mb-5 text-xl sm:text-2xl">{t.addListing.title}</h1>
      <AddListingForm categories={categories} regions={regions} />
    </div>
  );
}
