'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { resolveReportAction } from '@/app/admin/actions';
import { formatPhone, formatTimeAgo } from '@/lib/format';
import type { AdminReport, ReportReason } from '@/lib/types';

const REASON_LABEL: Record<ReportReason, string> = {
  scam: "Firibgarlik",
  wrong_category: "Noto'g'ri kategoriya",
  wrong_price: "Noto'g'ri narx",
  already_sold: 'Allaqachon sotilgan',
  prohibited: 'Taqiqlangan mahsulot',
  spam: 'Spam',
  other: 'Boshqa',
};

export function AdminReportRow({ report }: { report: AdminReport }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const open = report.status === 'open';

  const close = (outcome: 'resolved' | 'rejected') => {
    const note = window.prompt('Izoh (ixtiyoriy):') ?? undefined;
    setError(null);
    startTransition(async () => {
      const result = await resolveReportAction(report.id, outcome, note || undefined);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                report.reason === 'scam' || report.reason === 'prohibited'
                  ? 'bg-danger/10 text-danger'
                  : 'bg-saffron/15 text-saffron-dark'
              }`}
            >
              {REASON_LABEL[report.reason] ?? report.reason}
            </span>
            <span className="numeric text-xs text-ink-faint">
              {formatTimeAgo(report.createdAt)}
            </span>
            {!open && (
              <span className="rounded-full bg-slate-canvas px-2 py-0.5 text-xs text-ink-muted">
                {report.status === 'resolved' ? 'Hal qilingan' : 'Rad etilgan'}
              </span>
            )}
          </p>

          {report.listing && (
            <p className="mt-1.5 truncate text-sm font-semibold text-ink">
              <Link href={`/e/${report.listing.id}`} target="_blank" className="hover:underline">
                {report.listing.title}
              </Link>
              {report.listing.seller && (
                <span className="numeric ml-2 font-normal text-ink-muted">
                  {formatPhone(report.listing.seller.phone)}
                </span>
              )}
            </p>
          )}

          {report.comment && (
            <p className="mt-1 text-sm text-ink-muted">&laquo;{report.comment}&raquo;</p>
          )}
          <p className="numeric mt-1 text-xs text-ink-faint">
            Shikoyatchi: {report.reporter ? formatPhone(report.reporter.phone) : '—'}
          </p>
          {report.resolutionNote && (
            <p className="mt-1 text-xs text-ink-muted">Izoh: {report.resolutionNote}</p>
          )}
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>

        {open && (
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => close('resolved')}
              className="tap-target rounded-xl bg-harvest px-3 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              Hal qilindi
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => close('rejected')}
              className="tap-target rounded-xl px-3 text-xs font-semibold text-ink-muted ring-1 ring-slate-line hover:text-ink disabled:opacity-60"
            >
              Asossiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
