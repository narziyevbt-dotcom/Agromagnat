# Database schema

Postgres 16. Migrations live in `apps/backend/src/database/migrations/` and are the only
way schema changes reach an environment — `synchronize` is off everywhere, including dev.

```bash
npm run migration:run      # apply
npm run migration:revert   # roll back one
npm run seed               # reference data, idempotent
```

## Tables

| Table | Purpose |
|---|---|
| `users` | Phone-identified accounts, role, verified flag, denormalised rating |
| `regions` / `districts` | The 14 regions of Uzbekistan and their districts |
| `categories` | The 12 agro categories, one level of nesting, default unit, `kind` |
| `listings` | The core entity — see below |
| `listing_photos` | Up to 5 per listing, `sort_order` 0 is the cover |
| `favorites` | Unique per (user, listing) |
| `chats` / `messages` | One chat per (listing, buyer); unread counts on the chat |
| `reviews` | One per (listing, author), rating 1–5 enforced by a check constraint |
| `price_index` | Daily median/quartile prices per category+region+unit — see docs/PRICING.md |
| `reports` | User complaints feeding the admin moderation queue |
| `device_tokens` | One row per installation, for FCM push — see docs/PUSH.md |

## Listings

The mandatory set is category, `quantity` + `quantity_unit`, `price` + `price_unit`,
`region_id` and `district_id`. Optional: `min_order`, `wholesale_price`, `harvest_date`,
`delivery`, `season_months`.

Which of the optional ones a listing may actually carry depends on its category's `kind` —
machinery has no harvest date and is counted in `dona`. `attributes` (`jsonb`) holds the
category-specific answers on top of that: a tractor's year and condition, a plot's tenure.
It is validated on write against the same field spec the client rendered the form from, so
it only ever holds keys that spec declares. See docs/CATEGORY-FORMS.md.

Statuses are `draft`, `pending`, `active`, `sold`, `expired`, `blocked`. A listing
auto-expires 14 days after publication via `expires_at`, swept by a cron job. `pending`
exists for the AI moderator's *review* verdict — it holds a listing out of the feed
without rejecting it.

Money and volume are `numeric`, never floats, and cross the API as strings. Rounding
errors on a farmer's price are not acceptable, and JavaScript numbers cannot represent
these values exactly.

### Indexes

- `idx_listings_status_region_category` — the feed and filter path
- `idx_listings_created_at` — newest-first ordering
- `idx_listings_expires_at` — the expiry sweep
- `idx_listings_promoted` — TOP placement lookup
- `idx_listings_search_vector` — GIN over a stored generated `tsvector`
- `idx_listings_title_trgm` — GIN trigram index for fuzzy single-word queries
- `idx_listings_attributes` — GIN over the `attributes` jsonb, for containment lookups
  (machinery buyers filter on condition, land buyers on tenure)

### Full-text search

`search_vector` is a **stored generated column**, so Postgres maintains it on write and
there is no trigger to keep in sync. Title is weighted `A`, description `B`, and the
Russian translations are folded into the same vector so one query covers both languages.

The configuration is `'simple'`, not a language dictionary: Postgres ships no Uzbek
stemmer, and `simple` (lowercase and de-accent, no stemming) is the right behaviour for
Uzbek and Russian product names. `pg_trgm` sits alongside it to catch misspellings like
`pomidr`, which full-text alone handles poorly on short queries.

## Seed data

`npm run seed` is idempotent — it matches on `slug` and updates in place, so it is safe
to re-run after adding a district or renaming a category. It currently loads:

- 14 regions (12 viloyat + Qoraqalpog'iston + Toshkent city)
- 198 districts
- 12 categories, the first 8 flagged `is_featured` for the Home icon grid, each with the
  `kind` that decides its posting form
