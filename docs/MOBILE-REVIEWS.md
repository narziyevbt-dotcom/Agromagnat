# Seller reviews — mobile

The reviews API had been on the backend for a while with nothing on the phone
calling it. A marketplace puts strangers in a car together with cash; who the
other person is was the one thing the app could not tell you.

## The seller page

Tapping the seller panel on a listing opens them: name, verified mark, sales
count, the rating, and everything they currently have on the market.

It leads with the **histogram**, not the average. "4.6" reads the same whether
it is twenty fives or a row of fives cancelling out a row of ones, and that
difference is exactly what a buyer is deciding on. The API computes the
breakdown, so the bars cost nothing extra.

A seller nobody has rated says so rather than drawing five empty stars — an
unrated seller is not a bad one, and zero stars reads as bad.

## Leaving one

`RateSellerPanel` sits above the seller section on a listing and renders
**nothing at all** in three cases:

- **The listing is not sold.** The API refuses a review on an active one and
  is right to: otherwise a competitor could rate a rival on a listing nobody
  ever bought. "Sold" is the only completion signal the platform has, because
  the money changes hands off-platform.
- **It is the viewer's own listing.** Rating yourself is not a thing.
- **Nobody is signed in.** The prompt would invite a login for a deal they may
  have had no part in.

Once rated, the panel shows the stars that were given instead of asking again
— `GET /listings/:id/review` is what decides between the two.

The sheet disables its button until a star is picked (a review with no rating
is the one thing the API cannot store) and keeps the server's refusal **inside
the sheet**: "you already rated this deal" is about what is on screen, and a
snackbar over a dismissed sheet explains nothing.

`ReviewRefusedException` is deliberately distinct from a network failure. A
400 or a 409 is an answer — already in Uzbek, from the server — and retrying
will not change it; a timeout is worth another go.

## Tests

17 tests in `test/features/reviews/reviews_test.dart` — the histogram maths,
the three refusals, the mapper against the API's shapes, and the panel's
silence in each case it must stay quiet.

Two are about numbers that go wrong quietly: a seller with no reviews divides
by zero into a `NaN`-wide bar, and a rating outside 1..5 draws six stars. Both
are clamped now.

Writing them turned up a latent flake in an unrelated test: `ListingCard`
formatted "2 soat oldin" against the **real** clock while its fixture was
pinned to a fixed instant, so the assertion failed whenever the container's
date rolled over — "2 soat oldin" quietly becomes "kecha". The card now takes
an injectable `now`, the same way `MyListingTile` already did.

## Not done yet

- **Paging.** `GET /sellers/:id/reviews` is paged and the screen reads the
  first page only.
- **A buyer's own history.** There is no "deals I bought" screen, so the only
  route to rating is the listing itself — which a buyer has to find again.
- **Seller replies.** The API has no endpoint for one.
