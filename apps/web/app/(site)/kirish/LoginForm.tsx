'use client';

import { useActionState, useState, useTransition } from 'react';
import { AuthSubmit, CodeField, PhoneField, ResendTimer } from '@/components/auth/fields';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { formatPhone } from '@/lib/format';
import { t } from '@/lib/strings';
import { type AuthState, confirmCode, googleSignInAction, resendCode, sendCode } from './actions';

const INITIAL: AuthState = { step: 'phone' };

/**
 * One screen for signing in and signing up.
 *
 * There is no separate "register" page and there never was a reason for one:
 * the site cannot know whether a number is new until the code is confirmed, so
 * asking the visitor to declare it up front makes them guess at something we
 * are about to find out anyway. Both doors — Google and phone — land in the
 * same account model; only the proof differs.
 */
export function LoginForm({
  next,
  devMode,
  googleClientId,
}: {
  next: string;
  devMode: boolean;
  googleClientId: string | null;
}) {
  const [phoneState, submitPhone] = useActionState(sendCode, INITIAL);
  const [codeState, submitCode] = useActionState(confirmCode, INITIAL);

  // Set by "Raqamni o'zgartirish" and by a resend, which both need to override
  // whichever step the last server response put us on.
  const [editing, setEditing] = useState(false);
  const [resent, setResent] = useState<AuthState | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const onCodeStep = phoneState.step === 'code' && !editing;
  const phone = resent?.phone ?? codeState.phone ?? phoneState.phone ?? '';
  const error =
    googleError ?? (onCodeStep ? (resent?.error ?? codeState.error) : phoneState.error);
  const expiresIn = resent?.expiresIn ?? phoneState.expiresIn ?? 0;

  const onGoogle = (idToken: string) => {
    setGoogleError(null);
    startTransition(async () => {
      const result = await googleSignInAction(idToken, next);
      if (result?.error) {
        setGoogleError(result.error);
      }
    });
  };

  const onResend = () => {
    startTransition(async () => {
      setResent(await resendCode(phone));
    });
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-2xl">{onCodeStep ? t.auth.codeTitle : t.auth.title}</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {onCodeStep ? (
          <>
            <span className="numeric font-medium text-ink">{formatPhone(phone)}</span>{' '}
            {t.auth.codeSubtitle}
          </>
        ) : (
          t.auth.subtitle
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
          <AuthSubmit label={t.auth.finish} />
          <ResendTimer seconds={expiresIn} onResend={onResend} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="tap-target w-full text-center text-sm text-ink-muted hover:text-ink"
          >
            {t.auth.changeNumber}
          </button>
        </form>
      ) : (
        <>
          {/* Google first: it is one tap for anyone signed in on an Android
              phone, which is most of this market, and it costs us no SMS. */}
          {googleClientId && (
            <div className="mt-6 space-y-4">
              <GoogleButton clientId={googleClientId} onCredential={onGoogle} disabled={busy} />
              <div className="flex items-center gap-3 text-xs text-ink-faint">
                <span className="h-px flex-1 bg-hairline" />
                {t.auth.or}
                <span className="h-px flex-1 bg-hairline" />
              </div>
            </div>
          )}

          <form
            action={submitPhone}
            onSubmit={() => setEditing(false)}
            className="mt-4 space-y-4"
          >
            <PhoneField defaultValue={phone} />
            <AuthSubmit label={t.auth.continue} />
          </form>
        </>
      )}
    </div>
  );
}
