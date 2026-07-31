'use client';

import { useTransition } from 'react';
import { t } from '@/lib/strings';
import { signOutAction } from './actions';

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void signOutAction())}
      className="tap-target ml-auto inline-flex items-center rounded-lg px-4 text-sm font-medium text-ink-muted ring-1 ring-hairline hover:text-danger disabled:opacity-60"
    >
      {pending ? t.common.loading : t.nav.logout}
    </button>
  );
}
