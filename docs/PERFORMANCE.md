# Performance

Numbers, not impressions. Everything here was measured — nothing is estimated.

## How to reproduce

The polling numbers below come from Playwright counting requests against a real
open conversation (`measure-chat.mjs` in the session scratchpad, reproduced in
this document's history) — Lighthouse only sees the first few seconds of a page,
which is exactly why the chat's real cost went unnoticed for so long.

```bash
# backend + web on real Postgres and Redis
cd apps/backend && npm run start:prod
cd apps/web && npm run build && npm run start -- -p 3100

export CHROME_PATH=/path/to/chrome
npx lighthouse http://localhost:3100/ --preset=perf \
  --chrome-flags="--headless=new" --output=json --output-path=lh.json

# authenticated pages need the session cookies
echo '{"Cookie":"agm_at=…; agm_rt=…"}' > hdr.json
npx lighthouse http://localhost:3100/dashboard --extra-headers=./hdr.json …
```

For what is inside a bundle, `npx next experimental-analyze`. Not
`@next/bundle-analyzer`: it only understands webpack, and this project builds
with Turbopack, so it prints a warning and produces no report.

Lighthouse's `perf` preset is mobile: 412×823, 4× CPU throttling, simulated
slow 4G. That is roughly the machine this market actually holds, which is why
the desktop numbers are not recorded here.

## Baseline — 31 July 2026

| Page | Score | FCP | LCP | TBT | CLS | JS |
|---|---|---|---|---|---|---|
| `/` (landing) | 98 | 1.8 s | 1.8 s | 110 ms | 0.004 | 166 KB |
| `/qidiruv` | 96 | 1.7 s | 1.7 s | 170 ms | 0.003 | 169 KB |
| `/e/[id]` | 98 | 1.8 s | 1.8 s | 130 ms | 0 | 168 KB |
| `/kirish` | 98 | 1.7 s | 1.7 s | 110 ms | 0.006 | 164 KB |
| `/joylash` | 98 | 1.7 s | 1.7 s | 130 ms | 0.001 | 170 KB |
| `/dashboard/analitika` | 98 | 1.6 s | 1.6 s | 140 ms | 0.017 | 156 KB |
| `/xabarlar/[id]` | 98 | 1.6 s | 1.6 s | 120 ms | 0.002 | 163 KB |
| **`/dashboard`** | **83** | 1.6 s | 1.6 s | **620 ms** | 0.005 | **273 KB** |
| **`/dashboard/narxlar`** | **82** | 1.7 s | 1.7 s | **700 ms** | 0 | **271 KB** |

JS is transfer size, compressed, whole page load. Google's thresholds: LCP
under 2.5 s is good, TBT under 200 ms is good, CLS under 0.1 is good.

**Seven of nine pages are healthy.** The two dashboard pages that draw a chart
are not, and the gap is entirely the chart.

## Run-to-run variance is real

The first landing-page run scored **93** with CLS 0.084 and TBT 216 ms. The
second, against an unchanged build, scored **98** with CLS 0.004 and TBT
110 ms. Nothing changed between them; the font happened to land on a different
side of the first paint.

So: **one Lighthouse run is not a measurement.** Take three, report the median,
and treat a swing under about 5 points as noise. Anyone who quotes a single
score as an improvement has not measured anything. This document was nearly
written with a fictitious CLS problem on its front page.

## What the chart costs, and what was done

Recharts and its d3 dependencies are 384 KB unminified, ~109 KB over the wire —
by a wide margin the largest thing this application ships, larger than the whole
rest of the dashboard put together.

It is now split into its own chunk (`next/dynamic`, `ssr: false`) behind
`WhenVisible`, an IntersectionObserver gate, with a skeleton in the space it
will occupy.

**Honest result: this did not move TBT on `/dashboard`.** 620–700 ms before,
620–700 ms after, inside the noise. What it did change:

- The chunk is no longer referenced by the page's HTML, and is fetched at
  ~2.9 s instead of ~1.3 s — off the critical path.
- A viewport or page where the chart sits further down never fetches it at all.
- The empty state is drawn by the wrapper, so a seller whose categories have no
  price history never downloads the chart at all.

An intermediate attempt is worth recording because it is a trap: `next/dynamic`
**on its own made things worse** — 271 KB / 660 ms became 273 KB / 760 ms.
A dynamic import fires on mount, so splitting a component out moves its download
later without removing it, and adds a round trip. The visibility gate is the
part that does the work.

## The chat's cost is not its page load

`/xabarlar/[id]` scores 98. It was still the most expensive page on the site,
because the number that matters there is not how fast it loads but what it does
for the next hour.

Measured in a real browser against the real API, with a real conversation open:

| | Messages | Offers | Total |
|---|---|---|---|
| Before | 600/h (fixed 6 s) | 160/h (fixed 20 s) | **760/h** |
| After | 120/h | 60/h | **~180/h** steady state |

At a thousand people with a thread open, that is the difference between 760,000
and 180,000 requests an hour — and on the other side of it, mobile data this
audience buys by the megabyte.

Nearly all of the old traffic was wasted: on a conversation where nobody is
typing, every one of those 600 polls came back empty.

`lib/usePoll.ts` grows the delay across empty answers and snaps it back to the
floor the moment anything happens — a message arrives, the person sends one, or
they return to the tab. An active conversation never slows down, because an
active conversation keeps resetting it.

**The cost, measured rather than assumed:** after a full back-off to the 30 s
ceiling, a reply appeared **16.0 s** after it was sent. That is the price of the
saving, it is bounded by the ceiling, and any activity at all removes it.

A detail worth keeping: `reset()` originally only lowered the delay *number*,
leaving the thirty-second timeout already in flight to run to completion — so
sending a message did nothing until that timer fired. It now reschedules. The
test caught it; nothing else would have.

## Where the dashboard's blocking time actually comes from

Not the chart. The framework chunk:

```
1117 ms  31iarpvmym1z2.js   (React + Next, 70 KB)
 280 ms  dashboard          (inline/page)
 202 ms  0yc-89ixvqod3.js   (the chart, now deferred)
```

That is React hydrating a large client tree under 4× CPU throttling. Reducing
it means fewer client components on that page, not smaller ones.

## Open

- **The chart on `/dashboard` is a product question, not a technical one.**
  `/dashboard/narxlar` exists specifically for prices. If the overview linked to
  it instead of embedding the chart, the overview would drop ~109 KB and its
  score would join the other pages at ~98. That is a decision about what the
  dashboard is for, so it has not been made unilaterally.
- **No Lighthouse in CI.** Nothing stops a regression. Given the variance above,
  a useful check needs three runs and a median, which is not free.
- **Not measured at all:** `/sotuvchi/[id]`, the admin panel, and any page with
  a real photograph in the hero — `hero.jpg`
  has never been supplied, so the landing page has so far only ever been
  measured with the SVG fallback. A real photograph will change its LCP, and
  probably not for the better.
