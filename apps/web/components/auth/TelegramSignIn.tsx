'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/lib/strings';

/** How often to ask whether the bot has the number yet. */
const POLL_MS = 2_000;

type Phase = 'idle' | 'waiting' | 'error';

/**
 * "Telegram orqali kirish" — the free door.
 *
 * Every other way of proving a phone number costs money. This one costs
 * nothing and proves more: the number comes from Telegram's own contact card,
 * verified when the account was made, so there is no code to send, mistype or
 * wait for on a weak signal.
 *
 * The shape is unavoidably a hand-off — the person leaves for Telegram and
 * comes back — so the screen has to hold its place while they are gone. It
 * polls, it says plainly what to do over there, and it offers the link again
 * for the very common case of a popup that never opened.
 */
export function TelegramSignIn({ next }: { next: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const poll = useCallback(
    (ticket: string, until: number) => {
      timer.current = setTimeout(async () => {
        if (Date.now() > until) {
          setPhase('error');
          setError(t.auth.telegramExpired);
          return;
        }

        try {
          const response = await fetch(
            `/api/telegram/session?ticket=${encodeURIComponent(ticket)}`,
          );
          const data = (await response.json()) as { ready?: boolean };

          if (data.ready) {
            // The cookies are already set by the route handler; refresh so the
            // server re-renders this page as a signed-in one.
            router.replace(next);
            router.refresh();
            return;
          }
        } catch {
          // A dropped poll on a weak connection is not a failure — the next one
          // is two seconds away and the ticket is still good.
        }

        poll(ticket, until);
      }, POLL_MS);
    },
    [next, router],
  );

  const begin = async () => {
    setError(null);
    setPhase('waiting');

    try {
      const response = await fetch('/api/telegram/start', { method: 'POST' });
      if (!response.ok) {
        throw new Error('start failed');
      }
      const { ticket, deepLink, expiresIn } = (await response.json()) as {
        ticket: string;
        deepLink: string;
        expiresIn: number;
      };

      setLink(deepLink);
      // `_blank` rather than a navigation: on a phone this hands off to the
      // Telegram app and leaves this page where it is, which is what lets it
      // still be polling when they come back.
      window.open(deepLink, '_blank', 'noopener');
      poll(ticket, Date.now() + expiresIn * 1000);
    } catch {
      setPhase('error');
      setError(t.auth.telegramFailed);
    }
  };

  if (phase === 'waiting') {
    return (
      <div className="rounded-2xl bg-canvas p-4 ring-1 ring-hairline">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-turquoise/30 border-t-turquoise motion-reduce:animate-none"
          />
          {t.auth.telegramWaiting}
        </p>
        <p className="mt-1.5 text-sm text-ink-muted">{t.auth.telegramHint}</p>

        {/* Popups are blocked more often than not on mobile browsers, and a
            person staring at an unchanged screen assumes it is broken. */}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener"
            className="mt-3 inline-block text-sm font-medium text-turquoise hover:underline"
          >
            {t.auth.telegramOpenAgain}
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={begin}
        className="tap-target flex w-full items-center justify-center gap-2.5 rounded-full bg-[#229ED9] px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
      >
        <TelegramMark />
        {t.auth.telegramButton}
      </button>
      <p className="mt-2 text-center text-xs text-ink-faint">{t.auth.telegramFree}</p>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function TelegramMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.3 18.6 20c-.25 1.1-.9 1.37-1.83.85l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.14L18 5.72c.4-.36-.09-.56-.63-.2L5.8 13.06.86 11.5c-1.07-.33-1.1-1.07.23-1.6l19.1-7.36c.9-.33 1.68.2 1.71 1.76Z" />
    </svg>
  );
}
