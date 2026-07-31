import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

/**
 * jsdom has no layout, so it has no ResizeObserver. `GoogleButton` measures its
 * container with one; without this the component throws before it renders.
 */
class NoopResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', NoopResizeObserver);

/**
 * `requestSubmit` is what the code field uses to send the form once the sixth
 * digit lands. jsdom implements it but does not run the submit handler, so
 * tests assert the call rather than the navigation.
 */
if (!HTMLFormElement.prototype.requestSubmit) {
  HTMLFormElement.prototype.requestSubmit = function requestSubmit() {
    this.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  };
}
