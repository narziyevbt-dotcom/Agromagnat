import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePoll } from '@/lib/usePoll';

/**
 * The back-off that turned 760 requests an hour per open chat into a fraction
 * of that.
 *
 * Both directions are worth pinning down. Back off too eagerly and a live
 * conversation goes quiet — a reply that takes thirty seconds to appear is a
 * broken chat. Back off too little and the saving evaporates, silently, on
 * somebody else's server bill.
 */

const hidden = (value: boolean) =>
  Object.defineProperty(document, 'hidden', { value, configurable: true });

beforeEach(() => {
  vi.useFakeTimers();
  hidden(false);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Advances the clock and lets the awaited poll settle. */
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('while messages are arriving', () => {
  it('stays at the base delay', async () => {
    const tick = vi.fn(async () => true);
    renderHook(() => usePoll(tick, { baseMs: 5_000, maxMs: 30_000 }));

    await advance(5_000);
    expect(tick).toHaveBeenCalledTimes(1);
    await advance(5_000);
    expect(tick).toHaveBeenCalledTimes(2);
    await advance(5_000);

    // An active conversation must not be slowed down by the thing that exists
    // to slow down an inactive one.
    expect(tick).toHaveBeenCalledTimes(3);
  });
});

describe('while nothing is arriving', () => {
  it('grows the delay with each empty answer', async () => {
    const tick = vi.fn(async () => false);
    renderHook(() => usePoll(tick, { baseMs: 5_000, maxMs: 30_000, factor: 2 }));

    await advance(5_000);
    expect(tick).toHaveBeenCalledTimes(1);

    // The next one is ten seconds out, not five.
    await advance(5_000);
    expect(tick).toHaveBeenCalledTimes(1);
    await advance(5_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('never grows past the ceiling', async () => {
    const tick = vi.fn(async () => false);
    renderHook(() => usePoll(tick, { baseMs: 1_000, maxMs: 4_000, factor: 2 }));

    // 1s, 2s, 4s, then 4s forever — the ceiling is what bounds how stale the
    // screen can get before somebody touches it.
    await advance(1_000 + 2_000 + 4_000);
    expect(tick).toHaveBeenCalledTimes(3);

    await advance(4_000);
    expect(tick).toHaveBeenCalledTimes(4);
    await advance(4_000);
    expect(tick).toHaveBeenCalledTimes(5);
  });

  it('snaps back to the base delay as soon as something arrives', async () => {
    let found = false;
    const tick = vi.fn(async () => found);
    renderHook(() => usePoll(tick, { baseMs: 1_000, maxMs: 8_000, factor: 2 }));

    await advance(1_000 + 2_000);
    expect(tick).toHaveBeenCalledTimes(2);

    found = true;
    await advance(4_000);
    expect(tick).toHaveBeenCalledTimes(3);

    // Back at one second, not still at eight.
    await advance(1_000);
    expect(tick).toHaveBeenCalledTimes(4);
  });

  it('backs off from a failing poll instead of hammering it', async () => {
    const tick = vi.fn(async () => {
      throw new Error('offline');
    });
    renderHook(() => usePoll(tick, { baseMs: 1_000, maxMs: 8_000, factor: 2 }));

    await advance(1_000);
    expect(tick).toHaveBeenCalledTimes(1);

    // An API that is down must not be retried by every open tab every second.
    await advance(1_000);
    expect(tick).toHaveBeenCalledTimes(1);
    await advance(1_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});

describe('when the tab is in the background', () => {
  it('fetches nothing', async () => {
    hidden(true);
    const tick = vi.fn(async () => true);
    renderHook(() => usePoll(tick, { baseMs: 1_000 }));

    await advance(5_000);

    // Waking a phone radio for a thread nobody is looking at is how an app
    // earns a reputation for eating data.
    expect(tick).not.toHaveBeenCalled();
  });

  it('polls at once when the tab comes back', async () => {
    hidden(true);
    const tick = vi.fn(async () => true);
    renderHook(() => usePoll(tick, { baseMs: 10_000 }));

    await advance(10_000);
    expect(tick).not.toHaveBeenCalled();

    hidden(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });

    // Returning to a tab is the strongest signal somebody wants to see it now;
    // making them wait out the current delay is the wrong answer.
    expect(tick).toHaveBeenCalledTimes(1);
  });
});

describe('reset', () => {
  it('drops the delay back to the floor', async () => {
    const tick = vi.fn(async () => false);
    const { result } = renderHook(() => usePoll(tick, { baseMs: 1_000, maxMs: 8_000, factor: 2 }));

    await advance(1_000 + 2_000 + 4_000);
    expect(tick).toHaveBeenCalledTimes(3);

    // Sending a message is the one signal the poller cannot see for itself.
    act(() => result.current());

    await advance(1_000);
    expect(tick).toHaveBeenCalledTimes(4);
  });
});

it('stops when unmounted', async () => {
  const tick = vi.fn(async () => true);
  const { unmount } = renderHook(() => usePoll(tick, { baseMs: 1_000 }));

  await advance(1_000);
  expect(tick).toHaveBeenCalledTimes(1);

  unmount();
  await advance(5_000);

  // A leaked interval keeps a whole component tree alive and keeps calling the
  // API from a page the person has already left.
  expect(tick).toHaveBeenCalledTimes(1);
});
