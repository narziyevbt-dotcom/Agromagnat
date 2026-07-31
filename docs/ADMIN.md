# Admin panel

Lives inside the Next.js app at `/admin`, not as a separate Vite app. A third
frontend would duplicate the API client, session handling and design tokens for
no gain; the book's original suggestion predates the web app existing.

## Access

There is no admin login form. Admins sign in through the same phone + OTP flow
as everyone else; what differs is the role on the account:

```bash
# The account must already exist (log in once through the app first):
cd apps/backend && npm run seed:admin -- +998XXXXXXXXX
```

Promotion-only by design: the owner has proven control of the phone through
OTP, so no separate credential is invented. In production:
`docker compose -f docker-compose.prod.yml exec backend node dist/database/seeds/make-admin.js +998XXXXXXXXX`.

The layout check in `app/admin/layout.tsx` is UI convenience; the enforcement
is the backend's `RolesGuard` — every `/api/admin/*` route 403s a non-admin
token regardless of what a browser renders.

## Surfaces

| Page | What it does |
|---|---|
| `/admin` | Counters, with the two human queues (moderation, reports) surfaced as calls to action |
| `/admin/moderatsiya` | Pending listings → approve (fresh 14-day clock) or reject with a written reason |
| `/admin/elonlar` | Everything, searchable by title or seller phone, filter by status; TOP placement, block/unblock |
| `/admin/foydalanuvchilar` | Search by phone/name; grant the verified badge; block/unblock |
| `/admin/shikoyatlar` | User complaints; close as resolved or unfounded |

## Decisions worth knowing

**A block always carries a reason, and the seller reads it.** The field is
mandatory at the API level. "Bloklangan" with no explanation teaches sellers
that moderation is arbitrary, and one bad experience travels through a whole
village. The blocked listing stays visible to its owner — with the reason —
while returning 404 to everyone else.

**Blocking a user pulls their active listings in the same operation.** A blocked
scammer whose listings stay in the feed defeats the point. Their login and
token refresh stop immediately; an already-issued access token lives out its
15 minutes. The admin UI warns about the blast radius before confirming.

**Complaints are one per (user, listing)**, enforced by a unique index; a repeat
press answers 409, which the public UI treats as success — from the user's
side, the mission was accomplished the first time.

**The complaint button is two taps** (open → pick a reason) on every listing
page. It has to be effortless enough that people actually use it, because in
the early months the reports queue *is* the fraud-detection system.

**Admin lists use offset pagination.** Moderation is low-volume, human-paced
work; the keyset machinery the public feed needs would only make these queries
harder to read.

## Deferred

- **Push composer** — needs the FCM wiring that comes with the notifications
  work; a composer without a delivery channel would be an empty form.
- **Banners CRUD** — needs a banners table and a display surface; scheduled
  alongside the mobile home screen that shows them.
- Browser `prompt()`/`confirm()` dialogs for block reasons and TOP duration are
  deliberate v1 — ugly, but they work everywhere and cost zero code. Replace
  with proper modals when the panel grows real usage.

## Tests

`test/admin.e2e-spec.ts` — 12 cases over the real stack: the role guard
(anonymous 401, ordinary user 403, admin 200), approve with a fresh expiry,
reject requiring a reason, blocked listings hidden from visitors but visible to
their owner, TOP promote/demote, search by phone fragment, verify badge,
user-block pulling listings and stopping login, and the complaint lifecycle
including the 409 repeat.
