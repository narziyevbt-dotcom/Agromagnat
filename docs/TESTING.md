# Testing

```bash
cd apps/backend && npm test        # 184 unit
cd apps/backend && npm run test:e2e # 190 against real Postgres + Redis
cd apps/web     && npm test         # 74 unit + component
```

CI runs all three on every push and pull request to `main`, and the deploy job
will not start until they pass.

## Why the web got a runner

For most of this project the web had no tests at all, and it cost us. Two bugs
shipped that nothing could have caught:

- **Nothing renewed the access token.** `refreshTokens()` was written and never
  called, so every signed-in visitor was thrown back to the SMS screen fifteen
  minutes after logging in while holding a thirty-day refresh token. It failed
  silently, logged nothing, and was only found by hand with `curl`.
- **The code field submitted on the first keystroke.** `setDigits` was given an
  updater function and the result read straight back out of it — but React runs
  an updater during the next render, not at the call, so the array read back was
  empty, and `[].every(Boolean)` is `true`. Typing one digit sent a one-digit
  code and showed "the code must be 6 digits". This one was caught by the third
  test written against the component, before anybody saw it.

Both are the same class of failure: the code looks right, the build passes, the
typechecker is happy, and the behaviour is wrong. That is the class a test
suite exists for, and it is why the web runner came before animations and
performance work.

## Layout

| Where | What |
|---|---|
| `apps/backend/src/**/*.spec.ts` | Unit — services in isolation, Redis and the database faked |
| `apps/backend/test/*.e2e-spec.ts` | The real stack. Postgres and Redis are running; `SMS_PROVIDER=mock`, so the code is always `000000` |
| `apps/web/test/*.test.ts(x)` | Vitest + jsdom. Server actions, the proxy, hooks, and components |

## Conventions

**Test the decision, not the implementation.** `phoneGatePath` is tested for
refusing `//evil.example`, not for the shape of its output string. A refactor
that changes how it builds the URL should not turn a suite red.

**jsdom everywhere on the web side**, not a node/jsdom split. The proxy and the
server actions run just as well under it, and one environment means nobody has
to remember a per-file docblock to make a test work. Node's own `Request` and
`Response` survive jsdom, which is what the Next server primitives need.

**e2e tests own their data.** Two suites have been broken in the past by
assuming an empty database or a global ordering that only held because the seed
happened not to contradict it. Create the rows the test needs, delete them in
`afterAll`, and assert within the group you created.

**The comment says why, not what.** A test whose only note is "tests the login"
tells the next person nothing when it fails at 2am. `favorite-button.test.tsx`
says *why* a background fetch cannot redirect itself; that is the part that is
hard to rediscover.

## Measuring, as opposed to testing

Some things a unit test cannot see. The chat's real cost was 760 requests an
hour from one open conversation, and every page-load metric said it was fine —
Lighthouse only watches the first few seconds. That was found by driving a real
browser with Playwright and counting requests over three minutes.

When a change is about behaviour *over time* — polling, retries, background
work — measure it against the running stack and write the number down in
`docs/PERFORMANCE.md`. A test then locks in the logic; the measurement is what
tells you the logic was worth having.

## Known gaps

- **No end-to-end browser test.** Nothing exercises a real browser against a
  real backend. The pieces are each covered; the seams between them are covered
  by hand.
- **The dashboard and admin panel have no web tests.** Only the auth path does
  so far.
- **`apps/mobile` has no tests.** It also has no finished screens.
