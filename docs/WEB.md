# Public web marketplace

`apps/web` — Next.js 16, App Router, Tailwind 4. Uzbek UI throughout.

## Why SSR

A classifieds site lives on search traffic. A buyer looking for "urgut pomidor optom"
must land on the listing page itself, and a client-rendered feed is invisible to a
crawler. Every page a visitor can reach without logging in renders on the server with
its content in the HTML.

Each listing page ships:

- a title and description built from the listing's own volume, price and location
- `Product` JSON-LD with price, currency and availability, so a result can show the
  price directly rather than as a plain blue link
- `robots: index` only while the listing is active — sold and expired listings stay
  reachable by link but leave the index

`sitemap.xml` lists static pages, one entry per category, and the 50 newest listings.
That cap is deliberate for the pilot-region phase; a sitemap index is only worth the
machinery once the catalogue outgrows one file.

## Routes

| Path | Rendering | Purpose |
|---|---|---|
| `/` | SSR, 60s ISR | Hero, category grid, newest listings |
| `/qidiruv` | SSR | Search with filters, cursor pagination |
| `/e/[id]` | SSR | Listing detail — the page that has to rank |
| `/sotuvchi/[id]` | SSR | A seller's listings |
| `/kirish` | SSR | Phone + OTP login |
| `/joylash` | SSR, auth | Post a listing |
| `/profil` | SSR, auth | Stats, own listings, sold/delete |
| `/sevimlilar` | SSR, auth | Saved listings |

Uzbek URLs, not English. The audience reads them, and `/e/…` keeps listing links
short enough to paste into Telegram.

## Sessions

Tokens live in **httpOnly cookies**, not localStorage. Two reasons, in order: server
components need the token to render a personalised page at all, and script on the page
cannot read an httpOnly cookie, so an XSS bug cannot walk off with a 30-day refresh
token. `SameSite=Lax` rather than `Strict` — a listing shared into Telegram has to open
already signed in.

Favorites go through `/api/favorites/[id]`, a thin route handler, so the browser never
holds the access token.

## Caching

The feed is revalidated every 60 seconds, matching the backend's own cache window.
A request carrying a token is never cached — otherwise one visitor's saved-listing
flags would be served to the next. Reference data (regions, categories) is cached for
an hour; it changes about twice a year.

## Filters

Every filter lives in the URL rather than in component state. That is what makes a
filtered search shareable, linkable from Telegram and indexable, and it survives the
back button for free. Changing any filter clears the cursor, since page 2 of the old
query is meaningless against the new one.

"Next page" is a link, not a button, so results stay crawlable and need no client state.

## Design system

Tokens are defined once in `app/globals.css` under Tailwind's `@theme`, never inlined
in a component. That is what keeps the two rules that matter enforceable:

- **lime** is CTAs and one filled card per screen, nothing else
- **harvest green** is prices and volumes, nothing else

Used anywhere else, both stop meaning anything.

The `.numeric` utility carries `tabular-nums` plus tight tracking and is applied to
every price, volume, tonnage and percentage. This is not decoration: a farmer scans a
column of prices top to bottom, and tabular digits share one width so the numbers line
up. `.tap-target` enforces the 44px floor — the audience skews older and often taps
with a work-worn thumb.

The listing card gives the volume chip the same weight as the price. That pairing is
the reason the product exists rather than being a generic classifieds board.

## Weak-connection behaviour

The add-listing form mirrors its draft to localStorage on every change. Connections in
the target market drop mid-form regularly, and losing a half-typed listing is the
fastest way to lose the seller.

The call button fires its counter via `sendBeacon` and never blocks the `tel:` link.
A farmer losing a call to a failed analytics POST is the exact failure this product
cannot have.

## Configuration

```
API_URL=http://localhost:3000/api          # server-side calls
NEXT_PUBLIC_API_URL=http://localhost:3000/api  # browser calls
NEXT_PUBLIC_S3_URL=http://localhost:9000   # allow-listed for next/image
NEXT_PUBLIC_SITE_URL=https://agromagnat.uz # sitemap and robots
```

## Verified

Against the running stack with a real listing: the listing's title, price, volume chip
and location appear in the server-rendered HTML of both the home page and the detail
page; `<title>` and `<meta description>` are built from the listing; JSON-LD carries
`Product` with `UZS`; search matches by root, by suffixed form and case-insensitively;
the wholesale, empty-result and no-match states render; `robots.txt` excludes the
private routes; `sitemap.xml` contains the listing.
