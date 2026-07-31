'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Renders its children the first time they come near the viewport.
 *
 * The point is not the render — it is the code. A `next/dynamic` import fires
 * as soon as the component mounts, so splitting a heavy chart into its own
 * chunk moves the download later without removing it from the page load: the
 * bytes still arrive, now over an extra round trip. Measured on `/dashboard`,
 * splitting the chart out on its own changed 271 KB and 660 ms of blocking
 * into 273 KB and 760 ms — worse, not better.
 *
 * Behind this it is only fetched by a visit that scrolls far enough to want it.
 *
 * `rootMargin` starts the fetch a little early, so by the time the chart is
 * actually on screen it is usually already there. Without it the skeleton is
 * visible for as long as the download takes, every time, which trades one
 * annoyance for another.
 */
export function WhenVisible({
  children,
  fallback,
  rootMargin = '200px',
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
  rootMargin?: string;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = anchor.current;
    if (!element) return;

    // No IntersectionObserver means an old browser, and an old browser is the
    // last one to deserve a permanently empty box: render everything at once.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          // One-way. Scrolling back and forth must not unmount a chart the
          // person is reading, or re-run whatever it was doing.
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return <div ref={anchor}>{visible ? children : fallback}</div>;
}
