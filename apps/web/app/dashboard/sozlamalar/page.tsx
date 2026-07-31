import { redirect } from 'next/navigation';
import { SignOutButton } from '@/app/(site)/profil/SignOutButton';
import { getMe, getRegions } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { SettingsForm } from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const token = (await getAccessToken())!;
  const [user, regions] = await Promise.all([
    getMe(token).catch(() => null),
    getRegions().catch(() => []),
  ]);

  if (!user) {
    redirect('/kirish?next=/dashboard/sozlamalar');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl">Sozlamalar</h1>

      <section className="rounded-2xl border border-slate-line bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg">Profil</h2>
        <SettingsForm user={user} regions={regions} />
      </section>

      <section className="rounded-2xl border border-slate-line bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg">Til</h2>
        <p className="text-sm text-ink-muted">
          Interfeys hozircha o&apos;zbek tilida. Rus tilidagi versiya ustida
          ishlayapmiz.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-line bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg">Hisob</h2>
        <SignOutButton />
      </section>
    </div>
  );
}
