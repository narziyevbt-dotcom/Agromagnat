# Reviews

A buyer rates a seller once per completed deal. One review per (listing,
author), enforced by a unique index.

## API

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | `/api/listings/:id/review` | user | Rate the seller of a sold listing |
| `GET` | `/api/listings/:id/review` | user | The caller's own review, or `null` |
| `GET` | `/api/sellers/:id/reviews` | public | Visible reviews + star histogram |
| `GET` | `/api/admin/reviews` | admin | The moderation queue, hidden included |
| `POST` | `/api/admin/reviews/:id/hide` | admin | Hide or restore |

## Web

The rating form appears on a listing the seller has marked sold, to any signed-in
user who is not that seller — that is the moment a deal ends and the only moment
a rating means anything. The seller's profile at `/sotuvchi/:id` shows the
average, the histogram and the comments. Moderation lives at `/admin/baholar`.

## Decisions worth knowing

**"Completed" means the seller marked the listing sold.** Money changes hands
off-platform, so that flag is the only completion signal the platform has. It is
also why a review cannot be left on an active listing: otherwise a competitor
rates a rival on a lot nobody ever bought.

**The seller's `rating_avg` is recomputed, never incremented.** An increment is
only correct while every write is an insert — hiding, restoring and cascade
deletes all move the average too. One aggregate over the indexed `seller_id` is
cheap enough that being right is the easy option, and it runs in the same
transaction as the write that triggered it.

**The public average is computed over the visible reviews, not read off
`users.rating_avg`.** A moderator hiding a review has to change the number a
buyer sees, or hiding it accomplishes nothing. The two agree because hiding
recomputes the denormalised column as well; the list endpoint simply does not
depend on that being true.

**The histogram ships with the average.** A 4.5 built from twenty ratings and a
4.5 built from two are different claims, and the difference is exactly what a
buyer is trying to learn.

**Stars render turquoise, not gold.** Saffron is reserved for CTAs and the TOP
badge; a row of saffron stars on every profile would drain the colour of the
meaning the palette rests on. Turquoise already carries the verified badge, so
trust signals stay one colour.

**Half-stars are clipped, not rounded.** A 4.4 shown as four and a half is
honest; a 4.4 rounded up to five is the small lie that makes a rating system
worth ignoring.

**A second review answers 409, not 500.** The unique violation is translated
into an Uzbek message the buyer can act on.

## Deferred

- **Proof of contact.** Today any signed-in user can rate the seller of a sold
  listing. Requiring a prior chat or a registered call on that listing would
  raise the bar, but calls are placed through a `tel:` link with no per-user
  record, and most real deals still happen that way — the gate would block more
  honest reviews than fake ones. Revisit when chat carries a meaningful share of
  deals; until then the moderation queue is the answer.
- Seller replies to a review.
- Buyer ratings. Sellers get rated; buyers do not, because a buyer has no
  standing profile to attach it to yet.
