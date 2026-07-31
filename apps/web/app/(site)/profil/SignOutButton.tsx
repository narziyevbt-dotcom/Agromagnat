'use client';

import { useState, useTransition } from 'react';
import { t } from '@/lib/strings';
import { signOutAction, signOutEverywhereAction } from './actions';

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void signOutAction())}
      className="tap-target ml-auto inline-flex items-center rounded-lg px-4 text-sm font-medium text-ink-muted ring-1 ring-hairline transition-colors hover:text-danger disabled:opacity-60"
    >
      {pending ? t.common.loading : t.nav.logout}
    </button>
  );
}

/**
 * "Barcha qurilmalardan chiqish".
 *
 * Behind a confirmation because it is not undoable and it logs the person out
 * of the device they are asking from too — but not behind a settings page,
 * because the moment somebody needs it is the moment they have just lost a
 * phone, and that is not when to make them go looking.
 */
export function SignOutEverywhereButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-ink-muted underline-offset-2 transition-colors hover:text-danger hover:underline"
      >
        {t.auth.logoutAll}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-ink-muted">{t.auth.logoutAllHint}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void signOutEverywhereAction())}
        className="tap-target inline-flex items-center rounded-lg bg-danger px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? t.common.loading : t.common.confirm}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-sm text-ink-muted hover:text-ink"
      >
        {t.common.cancel}
      </button>
    </div>
  );
}
