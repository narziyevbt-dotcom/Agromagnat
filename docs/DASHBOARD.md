# Landing page and dashboard

## Route groups

```
app/(site)/     public marketplace — cobalt header, footer, mobile tab bar
app/dashboard/  seller dashboard — cobalt sidebar, top bar
```

The root layout carries only the document, fonts and metadata. Chrome belongs to the
groups, so the dashboard does not inherit a second navigation.

Auth is enforced in `app/dashboard/layout.tsx` rather than per page, so a new dashboard
route cannot ship unguarded by omission.

## The CTA colour

The brief specified lime `#D4E96A` for calls to action. The brand book in `CLAUDE.md`
specifies saffron `#E0932A` for "CTA and TOP badge".

Rather than run two accent colours in one product, every **button** is now lime and
saffron is reserved for **promotion** — the TOP badge, the "pending review" status chip,
and the current month on the harvest strip. That keeps a single rule a reader can hold:
lime means *do this*, saffron means *this is promoted*.

This changed the existing marketplace pages (header CTA, mobile "+", login and
add-listing submit buttons). Reverting to saffron throughout is a one-line change per
component if that is preferred.

## Landing page (`/`)

Hero, partner ticker, bento grid, a strip of real listings, closing CTA band.

The listing strip is not decoration. The home page is the strongest URL on the domain,
and handing a crawler nothing but marketing copy would waste it — the listing feed is
what earns the search traffic the business runs on.

**Card A (price index) reads live data.** It shows the latest month's median per
category and the change against the previous month with data. Months with no listings
are skipped rather than treated as zero, which would render as a 100% crash. A price
widget that lies is worse than no price widget.

**The hero artwork is an SVG, not a photograph.** Stock imagery would need a licence the
project does not have, and the drawing stays sharp at any size for a few hundred bytes,
which matters on 3G. Replace it with a commissioned photograph of a real Uzbek farm when
one exists — that will carry far more trust than any illustration.

**The partner names are sector labels, not real companies.** Putting a real logo there
before an agreement exists would be a claim the product cannot back.

## Dashboard (`/dashboard`)

- **Sidebar** — six nav items, user widget with a verified-farmer badge
- **Top bar** — search with `⌘K`, lime quick action, notification bell, UZ/RU toggle
- **Metrics** — active listings, total views, calls, median price index
- **Chart** — six-month median per category, bar or line (Recharts)
- **Table** — photo, title, category, green volume badge, price, location, status

Numbers use `.numeric` (IBM Plex Mono, tabular figures) throughout.

### What the numbers actually are

`GET /api/me/stats` aggregates in SQL, not by loading rows, so a seller with hundreds of
listings still costs one round trip. The price figure is a **median**, not a mean — one
mis-typed price should not move the number a farmer reads as "what my produce is worth".

The views trend is a **proxy and is labelled as one in the code**: per-listing view
counts are cumulative totals with no time dimension, so a view cannot be attributed to a
month. It compares views on listings *published* in the last 30 days against the 30
before. When either window is empty it returns `null` and the card renders no trend at
all rather than inventing a comparison. A real time series arrives with the analytics
events work.

`GET /api/stats/price-trend` computes the monthly medians from the listings themselves.
The `price_index` table exists for a nightly job to fill, but nothing writes to it yet —
so this reads the source. It is the same aggregate that job will store, which means the
chart is correct today and the query is the one that moves into the cron later.

Only `price_unit = 'kg'` rows are included. Prices are comparable only within one unit,
and mixing tonnes with kilos would make the line jump by three orders of magnitude.

The line chart uses `connectNulls={false}`: a month with no listings is a gap, not a
zero, and joining across it would draw a crash that never happened.

## Demo data

```bash
npm run seed:demo         # 3 sellers, 54 listings across 6 months
npm run seed:demo:clean   # removes them
```

A fresh database has no history, so the chart would render empty and tell you nothing
about whether it works. Everything the demo seed creates is tagged with a `+99899` phone
prefix so it can be removed without touching real rows. Prices drift month over month so
the series has a real shape.

Sign in as `+998990000001` with code `000000` to see a populated dashboard.

## Known gaps

- The demo listings have no photos, so cards and table rows show a placeholder.
  Photo upload is implemented and tested at the API level but has not been exercised
  through the browser with a real file.
- The UZ/RU toggle changes local state only. Switching content needs the backend
  translation fields, which is separate work.
- `shartlar` and `maxfiylik` are written to match what the system actually stores, but
  need a lawyer's review before launch.

## Sub-pages

Every sidebar item now resolves:

- **E'lonlarim** — the seller's catalogue with status filter chips; sold/delete
  actions reuse the profile row component. `/listings/me` returns all statuses
  in one page (a seller's catalogue is small), so the filter is applied in the
  page rather than with another round trip.
- **Bozor narxlari** — the six-month chart plus this month's medians with
  month-over-month movement, narrowable to one region via a GET form (the
  chosen region lives in the URL, shareable like any filter).
- **Analitika** — per-listing views and calls ranked by calls, with the
  north-star figure (calls per active listing) up top and a plain-language
  reading of whether it is healthy.
- **Sozlamalar** — name and default location edit against the new
  `PATCH /api/auth/me`; the phone is shown read-only because it is the
  account's identity, not a setting. A district must belong to the chosen
  region — enforced server-side.
- **Xabarlar** — an honest placeholder until chat ships; it points at the
  channel that works today (the call button) instead of pretending with a
  dead inbox.
