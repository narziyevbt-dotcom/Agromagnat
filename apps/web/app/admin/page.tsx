import Link from 'next/link';
import { Eye, Flag, Package, PhoneCall, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { getAdminOverview } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { getAccessToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const token = (await getAccessToken())!;
  const stats = await getAdminOverview(token).catch(() => null);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h1 className="text-2xl">Boshqaruv paneli</h1>

      {/* The two queues that need a human are surfaced first, as calls to
          action rather than statistics. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <QueueCard
          href="/admin/moderatsiya"
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          count={stats?.pendingListings ?? 0}
          label="Tekshiruv kutayotgan e'lonlar"
          cta="Moderatsiyaga o'tish"
        />
        <QueueCard
          href="/admin/shikoyatlar"
          icon={<Flag className="h-5 w-5" aria-hidden="true" />}
          count={stats?.openReports ?? 0}
          label="Ochiq shikoyatlar"
          cta="Shikoyatlarni ko'rish"
          danger
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Jami foydalanuvchilar"
          value={formatMoney(stats?.totalUsers ?? 0)}
          icon={Users}
          accent="forest"
        />
        <MetricCard
          label="Yangi (7 kun)"
          value={formatMoney(stats?.newUsers7d ?? 0)}
          icon={UserPlus}
          accent="turquoise"
        />
        <MetricCard
          label="Faol e'lonlar"
          value={formatMoney(stats?.activeListings ?? 0)}
          icon={Package}
          accent="harvest"
        />
        <MetricCard
          label="Qo'ng'iroqlar (jami)"
          value={formatMoney(stats?.totalCalls ?? 0)}
          icon={PhoneCall}
          accent="saffron"
        />
      </div>

      <div className="rounded-2xl border border-slate-line bg-white p-5 shadow-sm">
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Eye className="h-4 w-4" aria-hidden="true" />
          Jami ko&apos;rishlar:{' '}
          <span className="numeric font-semibold text-ink">
            {formatMoney(stats?.totalViews ?? 0)}
          </span>
        </p>
      </div>
    </div>
  );
}

function QueueCard({
  href,
  icon,
  count,
  label,
  cta,
  danger = false,
}: {
  href: string;
  icon: React.ReactNode;
  count: number;
  label: string;
  cta: string;
  danger?: boolean;
}) {
  const hot = count > 0;

  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:border-turquoise ${
        hot && danger ? 'border-danger/40' : 'border-slate-line'
      }`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          hot
            ? danger
              ? 'bg-danger/10 text-danger'
              : 'bg-saffron/15 text-saffron-dark'
            : 'bg-slate-canvas text-ink-faint'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="numeric block text-2xl font-bold text-ink">{count}</span>
        <span className="block text-sm text-ink-muted">{label}</span>
      </span>
      <span className="shrink-0 text-sm font-medium text-turquoise">{cta} →</span>
    </Link>
  );
}
