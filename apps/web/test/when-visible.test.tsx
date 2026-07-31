import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhenVisible } from '@/components/WhenVisible';

/**
 * The gate that keeps a 109 KB chart chunk off a visit that never scrolls to it.
 *
 * Worth testing because both failure modes are silent. Fire too eagerly and the
 * saving quietly disappears — which is exactly what happened with `next/dynamic`
 * on its own. Never fire and the page has a permanent skeleton where its
 * content should be, on a page nobody looks at often enough to notice.
 */

type Observed = {
  callback: IntersectionObserverCallback;
  disconnect: () => void;
  rootMargin: string;
};
let observers: Observed[] = [];

class FakeObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds = [0];
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = () => [];
  observe = vi.fn();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.rootMargin = String(options?.rootMargin ?? '');
    observers.push({ callback, disconnect: this.disconnect, rootMargin: this.rootMargin });
  }
}

const intersect = (isIntersecting: boolean) => {
  act(() => {
    for (const observer of observers) {
      observer.callback(
        [{ isIntersecting } as IntersectionObserverEntry],
        null as unknown as IntersectionObserver,
      );
    }
  });
};

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => vi.unstubAllGlobals());

it('shows the fallback until the anchor comes into view', () => {
  render(<WhenVisible fallback={<p>skeleton</p>}>
    <p>chart</p>
  </WhenVisible>);

  expect(screen.getByText('skeleton')).toBeInTheDocument();
  expect(screen.queryByText('chart')).not.toBeInTheDocument();
});

it('swaps in the content once it does', () => {
  render(<WhenVisible fallback={<p>skeleton</p>}>
    <p>chart</p>
  </WhenVisible>);

  intersect(true);

  expect(screen.getByText('chart')).toBeInTheDocument();
});

it('stays on the fallback while the anchor is still off screen', () => {
  render(<WhenVisible fallback={<p>skeleton</p>}>
    <p>chart</p>
  </WhenVisible>);

  intersect(false);

  expect(screen.getByText('skeleton')).toBeInTheDocument();
});

it('stops observing once it has fired', () => {
  render(<WhenVisible fallback={<p>skeleton</p>}>
    <p>chart</p>
  </WhenVisible>);

  intersect(true);

  // Scrolling back and forth must not unmount a chart somebody is reading, or
  // re-run whatever it was doing when it mounted.
  expect(observers[0].disconnect).toHaveBeenCalled();
});

it('starts loading before the content is on screen', () => {
  render(<WhenVisible fallback={<p>skeleton</p>}>
    <p>chart</p>
  </WhenVisible>);

  // Waiting for the exact moment of visibility means the skeleton is on screen
  // for the whole download, every time.
  expect(observers[0].rootMargin).toBe('200px');
});

describe('without IntersectionObserver', () => {
  it('renders the content rather than a permanent skeleton', () => {
    vi.stubGlobal('IntersectionObserver', undefined);

    render(<WhenVisible fallback={<p>skeleton</p>}>
      <p>chart</p>
    </WhenVisible>);

    // An old browser is the last one that deserves an empty box.
    expect(screen.getByText('chart')).toBeInTheDocument();
  });
});
