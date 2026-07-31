# My listings — mobile

`Profil → Mening e'lonlarim`. Everything the seller has posted, in **any**
status.

## Why it shows what the feed hides

The feed and search only return `active`. A listing that expired after its 14
days, or was blocked, disappears from every other screen — and a farmer who
cannot find their own listing does not conclude "it expired", they conclude the
app lost it and post it again.

So this screen is `GET /listings/me`, not `search` with a seller filter. Each
row carries a status pill, and the two statuses a person can do something about
carry a sentence explaining what:

| | |
|---|---|
| Faol | green, plus a warning in the last three days before it expires |
| Sotildi | grey — the seller took it off the market |
| Muddati tugagan | *"Qaytadan joylasangiz yana ko'rinadi"* |
| Bloklangan | *"Qoidalarga mos kelmagani uchun to'xtatilgan"* |

The expiry warning appears only inside three days. A countdown from day one is
noise, and noise is what people learn to ignore before day twelve.

## The card is the buyer's card

`MyListingTile` wraps the same `ListingCard` the feed uses, with the heart
removed and a status/action strip added underneath.

Reused rather than redrawn so what the seller checks is literally what a buyer
sees. A second layout here would drift, and the first person to notice would be
a farmer wondering why their listing looks different in the feed.

## Both edits are optimistic, and both can be undone by the server

`markSold` and `remove` change what is on screen before the request finishes,
then put it back if the server disagrees. A row that does nothing for two
seconds on EDGE reads as a dead button and gets tapped again — and on this
screen the second tap is on a delete.

A restored listing goes back **in its original position**, not appended: a
listing that reappears at the bottom of the list looks like a different one.

Both are confirmed first, and the dialog **names the listing in its title**.
"Delete this listing?" over a list of eight is how the wrong one gets deleted.
Neither is reversible — the API has no endpoint that puts a sold listing back
on the market.

The "Sotildi deb belgilash" button only exists on an active row. On a sold or
expired one it could only ever return an error.

## Editing

"Tahrirlash" reopens the **posting form** on the listing — the same
spec-driven form, seeded from the listing rather than empty. There is no
second edit screen: a category's questions are decided by its spec, and a
separate editor would be a second place for that to be got wrong.

Three things it does that are easy to get wrong:

- **The category comes from the catalogue, not from the listing.** The
  category nested in a listing carries no form spec — only `GET /categories`
  expands it. The list row resolves it before pushing, so the form never opens
  with nothing below the category row. If the category has since been retired,
  the seller is told, rather than handed a form they cannot submit.
- **Answers to questions the spec no longer asks are dropped.** Sending one
  back would have the server reject an edit the seller can see nothing wrong
  with.
- **An edit is never queued offline.** The outbox replays *creates*; a queued
  edit would sit behind them with no ordering, and "saqlandi" would be a lie
  until it went out. It fails in front of the seller instead.

The whole draft is sent, not a diff — `PATCH` takes a partial, but the server
re-validates the merged row anyway, and a client-side diff is one more place
for the two to disagree about what changed.

Photos already on the listing show in the strip from their URL, next to any
new ones. They are never re-uploaded, they count against the API's five, and
the X on one deletes it **immediately** rather than on save — it is its own
endpoint, and a photo queued for deletion until the seller happens to press
"Saqlash" is still on the listing every buyer is looking at meanwhile. Asked
first, and put back if the server refuses. They cannot be reordered: the cover
is the first photo, and the API has no endpoint that changes that.

Saving pops back to the list with a snackbar. No modal with a "view it"
button: the seller came from a list they are returning to, and a celebration
over a corrected price is noise.

## Not cached, and disposed on close

Unlike the feed, this screen never reads from disk, and its provider is
`autoDispose` so reopening refetches.

Both for the same reason: it changes because of something the seller *just
did*. A stale copy here does not read as "old data", it reads as "my edit did
not save" — and the next thing that gets tapped is the same button again.

## Tests

29 tests — `my_listings_test.dart` for the list and its two edits,
`edit_listing_test.dart` for the form reopened on a listing.

The ones worth having: a sold listing leaves the feed but stays in this list,
a failed mark-sold reverts the row, a failed delete restores it in position,
cancelling a dialog changes nothing, and the sold row stops offering the sold
button.

On the edit side: the form opens valid on the first frame, a sold listing
stays sold after a correction, an answer to a retired question is dropped, a
dead network does not queue the edit, and a photo the server refused to delete
comes back.

Writing them turned up two real defects. The new profile row was a `ListTile`
inside a coloured `Container`, which silently swallows the ink splash — Flutter
asserts on it, and the sign-in and screenshot tests caught it. And seeding the
form from `initState` is exactly what Riverpod forbids; the listing now arrives
through a `ProviderScope` override, which also removes the frame of empty form
that a post-frame callback would have left.

## Not done yet

- **Reordering photos.** The cover is whichever photo is first, and only new
  ones can be moved. Changing the order of photos already uploaded needs an
  endpoint the API does not have.
- **Reposting an expired listing.** The copy tells the seller to post it again;
  it should be one button.
- **Editing offline.** Deliberate for now — see above.
