'use client';

import { ShieldCheck } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';
import { AuthSubmit, CodeField, PhoneField, ResendTimer } from '@/components/auth/fields';
import { formatPhone } from '@/lib/format';
import { t } from '@/lib/strings';
import {
  type VerifyState,
  confirmVerifyCode,
  resendVerifyCode,
  sendVerifyCode,
} from './actions';

const INITIAL: VerifyState = { step: 'phone' };

export function PhoneVerifyForm({ next, devMode }: { next: string; devMode: boolean }) {
  const [phoneState, submitPhone] = useActionState(sendVerifyCode, INITIAL);
  const [codeState, submitCode] = useActionState(confirmVerifyCode, INITIAL);
  const [resent, setResent] = useState<VerifyState | null>(null);
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  const onCodeStep = phoneState.step === 'code' && !editing;
  const phone = resent?.phone ?? codeState.phone ?? phoneState.phone ?? '';
  const error = onCodeStep ? (resent?.error ?? codeState.error) : phoneState.error;
  const expiresIn = resent?.expiresIn ?? phoneState.expiresIn ?? 0;

  return (
    <div className="mx-auto w-full max-w-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-turquoise/10 text-turquoise">
        <ShieldCheck className="h-6 w-6" aria-hidden="true" />
      </span>

      <h1 className="mt-4 text-2xl">
        {onCodeStep ? t.phoneGate.codeTitle : t.phoneGate.title}
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {onCodeStep ? (
          <>
            <span className="numeric font-medium text-ink">{formatPhone(phone)}</span>{' '}
            {t.phoneGate.codeSubtitle}
          </>
        ) : (
          t.phoneGate.subtitle
        )}
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
        >
          {error}
        </p>
      )}

      {onCodeStep ? (
        <form action={submitCode} className="mt-6 space-y-4">
          <input type="hidden" name="phone" value={phone} />
          <input type="hidden" name="next" value={next} />
          <CodeField />
          {devMode && <p className="text-xs text-ink-faint">{t.auth.devHint}</p>}
          <AuthSubmit label={t.phoneGate.confirm} />
          <ResendTimer
            seconds={expiresIn}
            onResend={() =>
              startTransition(async () => setResent(await resendVerifyCode(phone)))
            }
          />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="tap-target w-full text-center text-sm text-ink-muted hover:text-ink"
          >
            {t.auth.changeNumber}
          </button>
        </form>
      ) : (
        <form
          action={submitPhone}
          onSubmit={() => setEditing(false)}
          className="mt-6 space-y-4"
        >
          <PhoneField defaultValue={phone} />
          <AuthSubmit label={t.phoneGate.submit} />
        </form>
      )}

      {/* Asking for a phone number is the moment trust is either earned or
          lost, so the reason sits on the screen rather than behind a link. */}
      <div className="mt-8 rounded-2xl bg-canvas p-4 ring-1 ring-hairline">
        <p className="text-sm font-semibold text-ink">{t.phoneGate.why}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t.phoneGate.whyBody}</p>
      </div>
    </div>
  );
}
