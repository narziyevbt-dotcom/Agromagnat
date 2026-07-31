'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setUserBlockedAction, setUserVerifiedAction } from '@/app/admin/actions';
import { formatPhone, formatTimeAgo, initials } from '@/lib/format';
import type { AdminUser } from '@/lib/types';

export function AdminUserRow({ user }: { user: AdminUser }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = (action: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  const toggleBlock = () => {
    // Blocking pulls the seller's active listings too — the admin should know
    // the blast radius before confirming.
    if (
      user.isBlocked ||
      window.confirm(
        `${user.name ?? formatPhone(user.phone)} bloklansinmi? Faol e'lonlari ham lentadan olinadi.`,
      )
    ) {
      run(() => setUserBlockedAction(user.id, !user.isBlocked));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-line bg-white p-3 shadow-sm sm:flex-nowrap">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white">
        {initials(user.name)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <span className="truncate">{user.name ?? 'Nomsiz'}</span>
          {user.isVerified && <span className="shrink-0 text-turquoise">✓</span>}
          {user.role === 'admin' && (
            <span className="shrink-0 rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
              admin
            </span>
          )}
          {user.isBlocked && (
            <span className="shrink-0 rounded bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">
              bloklangan
            </span>
          )}
        </p>
        <p className="numeric text-xs text-ink-muted">
          {formatPhone(user.phone)} · ro&apos;yxatdan: {formatTimeAgo(user.createdAt)} ·{' '}
          {user.salesCount} sotuv
        </p>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>

      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setUserVerifiedAction(user.id, !user.isVerified))}
          className={`tap-target rounded-xl px-3 text-xs font-semibold disabled:opacity-60 ${
            user.isVerified
              ? 'text-ink-muted ring-1 ring-slate-line hover:text-ink'
              : 'text-turquoise ring-1 ring-turquoise/40 hover:bg-turquoise/5'
          }`}
        >
          {user.isVerified ? 'Belgini olish' : 'Tasdiqlash'}
        </button>
        <button
          type="button"
          disabled={pending || user.role === 'admin'}
          onClick={toggleBlock}
          className={`tap-target rounded-xl px-3 text-xs font-semibold disabled:opacity-40 ${
            user.isBlocked
              ? 'text-harvest ring-1 ring-harvest/30 hover:bg-harvest/5'
              : 'text-danger ring-1 ring-danger/30 hover:bg-danger/5'
          }`}
        >
          {user.isBlocked ? 'Blokdan olish' : 'Bloklash'}
        </button>
      </div>
    </div>
  );
}
