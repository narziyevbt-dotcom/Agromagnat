'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Polling that slows down when nothing is happening.
 *
 * A fixed six-second interval on an open thread is 600 requests an hour, and on
 * a conversation where nobody is typing every one of them comes back empty.
 * Measured on a real browser against a real API, one open chat cost 760
 * requests an hour counting the offer panel — for an audience buying mobile
 * data by the megabyte, on servers we pay for.
 *
 * So the interval grows while the answers are empty and snaps back the moment
 * anything happens. An active conversation still feels immediate, because in an
 * active conversation the poll keeps finding messages and keeps resetting; an
 * idle one drifts out to the ceiling and stays there.
 *
 * Nothing is fetched at all while the tab is in the background. Coming back to
 * it polls at once rather than waiting out the current delay — returning to a
 * tab is the strongest possible signal that somebody wants to see it now.
 */
export interface PollOptions {
  /** Delay after activity. */
  baseMs?: number;
  /** Ceiling for an idle conversation. Bounds how stale the screen can get. */
  maxMs?: number;
  /** How fast the delay grows across empty answers. */
  factor?: number;
  enabled?: boolean;
}

/**
 * @param tick Runs one poll. Return `true` when it found something — that is
 *   what resets the delay. Returning `false` (or throwing) backs it off.
 * @returns `reset`, for activity the poller cannot see: sending a message is
 *   the clearest sign a reply is about to arrive.
 */
export function usePoll(
  tick: () => Promise<boolean>,
  { baseMs = 5_000, maxMs = 30_000, factor = 1.6, enabled = true }: PollOptions = {},
): () => void {
  const delay = useRef(baseMs);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Held in a ref so a caller does not have to memoise it to avoid restarting
  // the loop — the mistake this would otherwise invite is a poll that tears
  // itself down and rebuilds on every render and so never actually fires.
  const latest = useRef(tick);
  latest.current = tick;

  // Set by the effect below. `reset` has to be able to *reschedule*, not just
  // lower the number: a thread that had drifted out to thirty seconds already
  // has a thirty-second timeout in flight, and leaving it alone means the reply
  // to the message just sent still arrives half a minute late.
  const reschedule = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    delay.current = baseMs;
    reschedule.current?.();
  }, [baseMs]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const schedule = (ms: number) => {
      if (cancelled) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(run, ms);
    };

    const run = async () => {
      if (cancelled) return;

      // A backgrounded thread is not being read, and waking a phone radio for
      // it is how an app earns a reputation for eating data. The loop keeps
      // ticking so it is ready the moment the tab comes back.
      if (document.hidden) {
        schedule(delay.current);
        return;
      }

      let found = false;
      try {
        found = await latest.current();
      } catch {
        // A failed poll is not worth surfacing — but it is worth backing off
        // from, so an API that is down is not hammered by every open tab.
      }
      if (cancelled) return;

      delay.current = found ? baseMs : Math.min(maxMs, Math.round(delay.current * factor));
      schedule(delay.current);
    };

    const onVisible = () => {
      if (document.hidden || cancelled) return;
      if (timer.current) clearTimeout(timer.current);
      delay.current = baseMs;
      void run();
    };

    reschedule.current = () => schedule(delay.current);
    schedule(delay.current);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      reschedule.current = null;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [baseMs, maxMs, factor, enabled]);

  return reset;
}
