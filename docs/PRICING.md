# Price recommendation

The answer to "why not just use OLX".

A general classifieds board can show a farmer what other people are asking. It
cannot show what tomatoes in Urgut actually *sold* for over the last two months,
because it does not know that a listing carries a volume, a unit and a harvest.
Agromagnat does, so this is the one number the platform can produce that a
horizontal marketplace structurally cannot.

## It is arithmetic, not a model

This is the most important decision in the feature, so it is worth stating
plainly: **no language model chooses the price.**

Asked "what should tomatoes cost in Samarqand this week", a model returns a
confident, plausible, unfalsifiable number with nothing behind it. A farmer
would act on it. What we have instead is the real distribution — what listings
in this category, region and unit actually sold for — and percentiles over that
are both more accurate and defensible to a seller who disagrees.

The model's role is downstream and narrow, and today not required at all: the
Uzbek sentence is generated from the numbers by a template (`explainUz`),
because it renders on every keystroke, must be identical for identical inputs,
and must never be able to disagree with the figures beside it.

## The fallback ladder

Four populations, strongest first. The estimator stops at the first with at
least `MIN_SAMPLE` (5) rows:

| Basis | Population | Why it ranks here |
|---|---|---|
| `sold_local` | Sold in this region, last 60 days | An asking price is an opinion; a sale is a fact |
| `sold_national` | Sold anywhere, last 60 days | Still real transactions |
| `active_local` | Active in this region, last 30 days | Asking prices, but local |
| `active_national` | Active anywhere, last 30 days | Weakest useful signal |

Widening beats guessing — but never silently. The `basis` rides on the response
and is rendered in the sentence the seller reads, so a national asking-price
median is labelled as one.

If nothing clears the floor, the answer is `range: null` and *"not enough data —
set the price yourself"*. A fabricated number is worse than no number here,
because it would be used.

## Why percentiles, not averages

`PERCENTILE_CONT`, everywhere. A price typed with three extra zeros is routine
on a form filled in a field, and one such row moves a mean into nonsense while
leaving a median untouched. There is an e2e test that asserts exactly this: a
14 000 000 so'm/kg listing must not move the recommendation by more than 2 000.

The 25th and 75th percentiles double as the range shown to the seller, which is
free — the same window function produces all three.

Two exclusions matter:

- **Blocked listings.** They are usually scams, and scams are priced to look
  like bargains, so leaving them in drags the median down.
- **Mixed units.** A median over `t` and `kg` together sits three orders of
  magnitude from either. Every query is unit-scoped.

## Confidence

A bare median is the dishonest version of this feature: five scattered listings
and four hundred tight ones produce the same number and deserve very different
trust. `confidenceOf` combines three independent penalties:

- **Basis weight** — sold over asking, local over national.
- **Sample size**, with `sqrt` diminishing returns saturating at 40. The 41st
  listing says far less than the 6th.
- **Dispersion** — the IQR as a fraction of the median. Under 0.33 is one
  market; beyond about 1.5 the prices are telling you the population is not.

The web hint uses 0.5 as the line between "Bozor narxi" and "Taxminiy narx", and
the sentence appends *"ma'lumot kam — taxminiy"* below it.

## Lot size

Wholesale is cheaper per unit — that is why a buyer takes ten tonnes instead of
ten kilos — so a seller with a very large lot is not in the median's market.
`lotAdjustment` shades the median down by 4% above 1 000 units and 8% above
10 000, and never more. It is a hint, not a pricing model; overreaching produces
a number the seller can see is wrong, which costs the whole feature its
credibility.

## The nightly index

`price_index` holds one row per `(day, category, region, unit)` plus a national
row per `(day, category, unit)`, with p25/median/p75, sample size and the
percent change against the previous recorded day.

It exists because **today cannot be allowed to change what last month looked
like**. Listings get sold, deleted and expired, so recomputing a historical
median from live rows returns a different answer every day for the same past
date. The trend and the chart read the snapshot; only the current
recommendation reads live listings.

`PricingCron` runs it at 01:00 — not midnight, where the day's listings are
still landing and the sample size would disagree with the next morning's.

Two properties make it safe:

- **Idempotent.** `ON CONFLICT (day, category, region, unit) DO UPDATE` means a
  retry, a manual backfill, or two instances racing all converge. A cron that
  cannot be run twice will eventually corrupt the series.
- **One statement per day.** `GROUPING SETS` via a `CROSS JOIN LATERAL (VALUES
  (region_id), (NULL))` produces the regional and national aggregates in a
  single pass instead of scanning `listings` twice.

`snapshot(day)` takes an optional date, and there is an ops entry point for it:

```bash
npm run price:snapshot                          # today
npm run price:snapshot 2026-07-30               # one missed night
npm run price:snapshot 2026-06-01 2026-07-30    # an inclusive backfill range
```

It boots the Nest context rather than a bare DataSource, so the service shares
the app's Redis client and its cache invalidation clears the keys the API is
actually serving.

## Two bugs worth remembering

Both were found by e2e tests against real Postgres and would have been invisible
to a mocked query builder.

**Enums do not coerce.** `listings.price_unit` and `price_index.unit` are
separate Postgres enum types with identical values, and Postgres refuses to cast
between them. The snapshot needs `price_unit::text::price_index_unit_enum`.
Without it the job typechecks cleanly and fails every night at runtime.

**`NULL` is distinct in a unique index.** The national row has `region_id IS
NULL`, and in a plain unique index every NULL differs from every other NULL — so
`ON CONFLICT` never matched a national row and the snapshot inserted a fresh
duplicate *every night, forever*, while regional rows upserted correctly. The
chart would have started double-plotting the national line within a day of the
cron going live. Fixed with `NULLS NOT DISTINCT` (Postgres 15+, and this project
runs 16), which says what the constraint always meant.

## API

| Route | Auth | Notes |
|---|---|---|
| `POST /api/pricing/suggest` | public | Cached 10 min per (category, region, unit, lot bucket) |
| `GET /api/pricing/history` | public | The index series, 7–365 days |

Public on purpose. These are aggregates over listings that are themselves
public, they cost a cached percentile query rather than a model call, and a
buyer checking whether an asking price is fair is exactly who should see them
without an account. The market index is the argument for the platform — putting
it behind a login would hide the thing that sells it.

## Where it appears

Under the price field on the posting form (`PriceHint`), where the decision is
actually made rather than on a separate analytics page. It never writes the
field: accepting the suggestion is one deliberate tap, and the range is shown
beside it so accepting the median is visibly a choice among several defensible
numbers.
