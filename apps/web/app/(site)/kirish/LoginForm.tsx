'use client';

import { useActionState, useState, useTransition } from 'react';
import { AuthSubmit, CodeField, PhoneField, ResendTimer } from '@/components/auth/fields';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { TelegramSignIn } from '@/components/auth/TelegramSignIn';
import { formatPhone } from '@/lib/format';
import { t } from '@/lib/strings';
import {
  type AuthState,
  confirmCode,
  googleSignInAction,
  resendCode,
  saveName,
  sendCode,
} from './actions';

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
  next: next_,
  devMode,
  googleClientId,
  telegramEnabled = false,
  startAtName = false,
}: {
  next: string;
  devMode: boolean;
  googleClientId: string | null;
  /** The bot is configured, so the free door can be offered. */
  telegramEnabled?: boolean;
  /** The session exists but the account has no name yet. */
  startAtName?: boolean;
}) {
  const [phoneState, submitPhone] = useActionState(sendCode, INITIAL);
  const [codeState, submitCode] = useActionState(confirmCode, INITIAL);
  const [nameState, submitName] = useActionState(saveName, INITIAL);

  // Set by "Raqamni o'zgartirish" and by a resend, which both need to override
  // whichever step the last server response put us on.
  const [editing, setEditing] = useState(false);
  const [resent, setResent] = useState<AuthState | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  // The name step is terminal: once the code is confirmed there is a session,
  // so nothing may send the person back to a phone or a code field.
  const onNameStep = startAtName || codeState.step === 'name' || nameState.step === 'name';
  const onCodeStep = !onNameStep && phoneState.step === 'code' && !editing;

  const phone = resent?.phone ?? codeState.phone ?? phoneState.phone ?? '';
  const next = nameState.next ?? codeState.next ?? next_;
  const error = onNameStep
    ? nameState.error
    : (googleError ?? (onCodeStep ? (resent?.error ?? codeState.error) : phoneState.error));
  const expiresIn = resent?.expiresIn ?? phoneState.expiresIn ?? 0;

  const onGoogle = (idToken: string) => {
    setGoogleError(null);
    startTransition(async () => {
      const result = await googleSignInAction(idToken, next_);
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
      <h1 className="text-2xl">
        {onNameStep ? t.auth.nameTitle : onCodeStep ? t.auth.codeTitle : t.auth.title}
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {onNameStep ? (
          t.auth.nameSubtitle
        ) : onCodeStep ? (
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

      {onNameStep ? (
        <form action={submitName} className="mt-6 space-y-4">
          <input type="hidden" name="phone" value={phone} />
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink">
              {t.auth.nameLabel}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              autoFocus
              required
              minLength={2}
              maxLength={120}
              placeholder="Anvar aka"
              className="tap-target w-full rounded-lg bg-surface px-3 text-lg outline-none ring-1 ring-hairline transition-shadow focus:ring-2 focus:ring-turquoise"
            />
          </div>
          <AuthSubmit label={t.auth.finish} />
        </form>
      ) : onCodeStep ? (
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
          {/* Ordered by what it costs the visitor and what it costs us.
              Telegram is instant, proves the number outright, and is free on
              both sides; Google is one tap but leaves the phone still to
              collect; the SMS field is last because it is the slowest for a
              farmer on a weak signal and the only one we pay for. */}
          {telegramEnabled && (
            <div className="mt-6">
              <TelegramSignIn next={next_} />
            </div>
          )}

          {(googleClientId || telegramEnabled) && (
            <div className="mt-4 flex items-center gap-3 text-xs text-ink-faint">
              <span className="h-px flex-1 bg-hairline" />
              {t.auth.or}
              <span className="h-px flex-1 bg-hairline" />
            </div>
          )}

          {googleClientId && (
            <div className="mt-4">
              <GoogleButton clientId={googleClientId} onCredential={onGoogle} disabled={busy} />
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
