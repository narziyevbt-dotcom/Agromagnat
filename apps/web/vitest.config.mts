import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * The web app's test runner.
 *
 * jsdom everywhere rather than a node/jsdom split. The files that do not touch
 * the DOM — the proxy, the server actions — run just as well under it, and one
 * environment means nobody has to remember a per-file docblock to make a test
 * work. Node's own `Request`/`Response` survive jsdom, which is what the Next
 * server primitives need.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // `@/…` comes straight from tsconfig, so the paths cannot drift apart.
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**'],
    restoreMocks: true,
  },
});
