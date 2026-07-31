# Offers and deals

Price negotiation inside a conversation, and the sale that accepting one
closes.

## The problem this fixes

The trust loop on a marketplace runs:

> sale → review → rating → trust → more sales

Every link was in place except the first. A review required the listing to be
`sold` (`reviews.service.ts`), and the only way to reach `sold` was a button on
the seller's own profile — an action whose immediate effect is to remove their
advert from the feed and which gains them nothing. The one step the entire
trust system depends on was the one step the seller is actively
disincentivised to take. Predictably, sales went unrecorded, reviews never
became possible, ratings stayed empty, and the product degraded into a
bulletin board.

There was a second, quieter consequence. The price recommender ranks
`sold_local` above every other population — but it read `listings.price`, the
*asking* price, even for sold rows. Agricultural sales close below asking
almost every time, so the headline feature was systematically high while
claiming to be "based on real sales".

Accepting an offer fixes both: it closes the sale as a side effect of
something both sides already want to do, and it records what was actually
agreed.

## Model

`offers` is its own table, not columns on `messages`. A message is an
immutable timeline entry; an offer has a lifecycle (`pending → accepted |
declined | expired`) and "every offer on this listing" has to be a real query
rather than a scan of message bodies.

Each offer still appears *in* the thread as a message of type `offer`, whose
body is `<offerId>|<preview text>`. That lets the client draw the card and join
it to its row without one request per message, and keeps the negotiation in
chronological order with the conversation instead of in a separate panel the
seller has to remember to open.

`listings` gains two columns:

- `sold_price` — the agreed price. `price` keeps the asking price untouched.
- `sold_quantity` — the volume the accepted offer covered.

Both are null for a listing closed by hand, which is why every query reads
`COALESCE(sold_price, price)` rather than `sold_price` alone: dropping
hand-closed rows would shrink the sold population below its floor for every
category that predates offers.

## Constraints that matter

**One live offer per side per conversation**, enforced by a partial unique
index on `(chat_id, from_role) WHERE status = 'pending'`. Two open offers would
let the counterpart accept either, which makes the winning price a race rather
than a decision. Hitting it returns an Uzbek message rather than silently
replacing a price the other side may be reading right now.

**You cannot answer your own offer.** Without this a seller could accept their
own asking price, close the sale unilaterally, and inflate both their sales
count and the price index.

**An offer below 5% of asking is rejected** as a missing zero rather than a
negotiating position. Skipped when the offer is quoted in a different unit,
since the two are then not comparable.

## Accepting is one transaction

Four things happen together or not at all:

1. the offer becomes `accepted`
2. the listing becomes `sold`, with `sold_at`, `sold_price`, `sold_quantity`
3. the seller's `sales_count` increments
4. every other pending offer **on that listing** becomes `expired`

A partial apply would leave a listing sold with no price, or two buyers each
told they had won it. Both the offer and the listing are re-read under
`pessimistic_write` inside the transaction, because between loading and
committing the counterpart may have declined it or accepted a rival offer.

Step 4 is what makes concurrent negotiations safe: rival offers are on
*different* chats (one per buyer) but the same listing, so the sweep is by
`listing_id`.

Afterwards the feed cache and every cached price suggestion are dropped — both
change the moment a listing sells.

## API

All authenticated; the caller must be a participant in the conversation.

| Route | Who | Effect |
|---|---|---|
| `GET /api/chats/:id/offers` | either side | Newest first, with `canRespond` and `isMine` for the caller |
| `POST /api/chats/:id/offers` | either side | New offer; 400 if that side already has one open |
| `POST /api/offers/:id/accept` | the counterpart | Closes the sale |
| `POST /api/offers/:id/decline` | the counterpart | Offer only; listing untouched |
| `POST /api/offers/:id/withdraw` | the author | Retract your own pending offer |

Rate-limited to 20 offers per user per hour in Redis — generous for a person,
tight for a script, and the same shape as the message and AI limits.

`canRespond` and `isMine` are computed per viewer rather than left to the
client, so the client cannot show an Accept button to somebody the API would
reject.

## Where it appears

`OfferPanel` sits above the message thread. It shows a single button until
there is something to act on, so an ordinary conversation is not cluttered by
a form nobody is using. A live offer becomes a card with **Roziman** /
**Rad etish** for the counterpart and **Bekor qilish** for its author. Once a
deal is struck the panel collapses to a green "Savdo yakunlandi" bar with the
agreed price.

It polls every 20 seconds — far less often than the thread's 6, because an
offer is a rare event next to a message — so a deal accepted on another device
still appears.

Accept revalidates `/`, `/profil` and `/dashboard`; decline does not, since
nothing outside the conversation changed.

## What this unlocks

- **GMV becomes measurable.** Until now the closest thing to a transaction
  metric was `call_count`, a proxy for intent rather than for a sale.
- **Reviews become reachable** without asking a seller to delist by hand.
- **The price index learns clearing prices** rather than asking prices — see
  [PRICING.md](PRICING.md).
