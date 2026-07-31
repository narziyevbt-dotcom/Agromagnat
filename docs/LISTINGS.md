# Listings API

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/listings` | public | Feed and search, cursor-paginated |
| GET | `/api/listings/:id` | public | Detail; increments `view_count` |
| GET | `/api/listings/me` | bearer | The caller's own listings, any status |
| POST | `/api/listings` | bearer | Publish (active, expires in 14 days) |
| PATCH | `/api/listings/:id` | bearer | Edit own |
| DELETE | `/api/listings/:id` | bearer | Soft-delete own |
| POST | `/api/listings/:id/sold` | bearer | Mark sold, increments seller `sales_count` |
| POST | `/api/listings/:id/renew` | bearer | Put an **expired** listing back for 14 more days |
| POST | `/api/listings/:id/call` | public | Record a call tap |
| POST | `/api/listings/:id/photos` | bearer | Upload up to 5 photos |
| DELETE | `/api/listings/:id/photos/:photoId` | bearer | Delete one photo |
| POST/DELETE | `/api/listings/:id/favorite` | bearer | Save / unsave |
| GET | `/api/me/favorites` | bearer | Saved listings, newest save first |

`POST /listings/:id/call` is public and unauthenticated on purpose: it counts taps
on "Qo'ng'iroq qilish", the product's north-star metric, and a login prompt in front
of it would both suppress the number and cost the seller a call.

## Filters

`categoryId`, `regionId`, `districtId`, `sellerId`, `priceMin`, `priceMax`,
`quantityMin`, `verifiedOnly`, `withDelivery`, `delivery`, `q`,
`sort` (`newest` | `cheapest` | `expensive`), `cursor`, `limit` (max 50).

`quantityMin` is the wholesale filter — "ulgurji ≥ 1t" on the search screen.

## Search

`q` runs `websearch_to_tsquery` against the stored `search_vector`, OR'd with a
trigram similarity check on the title. `websearch_to_tsquery` accepts what a person
actually types — bare words, quotes, "or" — instead of throwing on syntax the way
`to_tsquery` does. The trigram arm catches misspellings (`pomidr`) that full-text
alone misses on short queries.

## Pagination

Keyset, not `OFFSET`. The feed is append-heavy: `OFFSET` slows down linearly and
drops rows whenever a new listing lands between two page fetches.

The query runs in two phases. Phase one orders, filters and pages over the
`listings` table alone and returns ids; phase two hydrates those ids with their
relations. A single joined query would multiply rows by the photo count and defeat
the feed index.

The cursor is a base64url `{r, v, id}`:

- `r` — promotion rank, 0 for live paid TOP placement, 1 otherwise
- `v` — `created_at` or `price`, depending on sort
- `id` — tie-breaker, so rows sharing a sort value are never skipped or repeated

**The promotion rank has to be in the cursor.** Paid TOP listings sort ahead of
everything, so rank is part of the sort key. Left out of the cursor, the jump from
the last promoted row to the first ordinary one would carry the promoted row's
timestamp into the next page's filter and silently drop every ordinary listing
newer than it. Because the directions are mixed — rank ascending, recency
descending — a single row-value comparison will not express this, so the branches
are written out.

A malformed cursor restarts the feed rather than failing the request.

## Caching

Only the unfiltered, uncursored, newest-first page is cached, for 60 seconds, keyed
by region. That is the screen everyone opens and the one worth protecting; caching
every filter permutation would fill Redis with entries read once. Any write
invalidates `feed:v1:*`.

Favorite flags are applied after the cache read, so a shared cached page never
leaks one user's saved state to another.

## Photos

Up to 5 per listing, `sort_order` 0 is the cover. Each upload is re-encoded to WebP,
capped at 1280px on the long edge, and a 400px thumbnail is written alongside so the
feed never downloads full-size images — the audience is on 3G.

The image type is taken from the decoded pixels, not the client-supplied header: a
caller can label anything `image/jpeg`, but sharp only decodes what is genuinely an
image. EXIF orientation is honoured, otherwise phone photos arrive sideways.

## Lifecycle

Listings expire 14 days after publication. An hourly cron sweeps them to `expired` —
hourly rather than daily so nothing lingers a full day past its fourteenth, since
feed freshness is what a buyer trusts.

`POST /listings/:id/renew` puts an expired listing back on the market for another
14 days. It updates **the same row** rather than copying it: the listing keeps its
id, so links already shared in Telegram still resolve, and it keeps its view count,
its favourites and the conversations hanging off it. A repost that created a
duplicate would strand all four.

Only an `expired` listing can be renewed. Renewing an active one would be a way to
buy a fresh fourteen days at the top of the feed whenever you liked, without anybody
noticing; a sold one is finished. Both are a 400, and somebody else's listing is a
403.

Deletes are soft: chats, reviews and the price index all reference the row.

## Validation

Money and volume are `numeric` in Postgres and cross the API as strings. Rounding
errors on a farmer's price are not acceptable.

A wholesale price is rejected unless a minimum lot is given and the wholesale price
is genuinely below the retail price.

## Tests

`listings.e2e-spec.ts` — 27 cases against the real stack: validation, ownership,
each filter, sorting, cursor walking, view and call counters, favorites, expiry.
