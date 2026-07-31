# Wiring the real API — mobile

Every repository was written against an interface, so this slice added
implementations and flipped four provider lines. **No screen changed.**

```dart
final listingRepositoryProvider = Provider<ListingRepository>((ref) {
  if (!ApiConfig.isConfigured) return MockListingRepository();
  return ApiListingRepository(ref.watch(apiClientProvider));
});
```

## Pointing it somewhere

```bash
flutter run --dart-define=API_URL=https://agromagnat-api.onrender.com/api
```

No `API_URL` means every repository stays on its mock. That is a supported way
to run, not a debug affordance: it is how the screens were built, and it keeps
the app openable with nothing behind it.

## Token refresh

The client holds the bearer and renews it on a 401, **single-flight**. A screen
that fires three requests at once on a stale token would otherwise spend three
refresh tokens, and the API invalidates each on use — the second and third
would fail and log the user out mid-session. There is a test for exactly that.

Three cases that are easy to get wrong and are each covered:

- **A rejected refresh token ends the session.** 30 days elapsed or revoked;
  keeping it means every request from here on 401s in silence.
- **Being offline during a refresh does not.** The session may be perfectly
  good and the phone simply has no signal.
- **A request that never carried a token is never refreshed.** A wrong OTP is
  also a 401, and refreshing over it would bury the real message.

## What the API actually returns

Read off the running deploy, not from the DTOs:

- **Money and volume are strings** — `"40.000"`, `"8000.00"`, `ratingAvg:
  "0.00"`. Postgres numerics lose precision through a JSON double, so they come
  as text and are parsed once in `ListingMapper`.
- **The category nested in a listing has no `form`.** Only `GET /categories`
  expands the spec. `ListingCategory.form` is nullable because of this; the
  posting form only ever uses categories from `/categories`.
- **Favourites are two endpoints, not a toggle** — `POST` to save, `DELETE` to
  unsave, both 204. The repository interface changed to `setFavorite(id, saved:)`
  to match, which also drops a round trip: the UI already knows the state.
- **A malformed row is dropped, not thrown on.** One bad row in a page of
  twenty should cost the buyer that row, not the feed. A row with no price is
  treated as malformed — a card with no price is worse than no card.

## The sort that had to go

The app offered "Katta hajmlar" — biggest volumes first. `GET /listings` has no
such sort; it has `newest | cheapest | expensive`.

Mapping it to `newest` would have sorted one page of the newest listings and
labelled the result "the biggest volumes" — a wrong answer presented
confidently. **It was removed** rather than faked. The wholesale need it served
is still met by the minimum-volume filter (`quantityMin`), which the API does
support. A real volume sort is a backend change.

## Tests

| | |
|---|---|
| `listing_mapper_test.dart` | 13, against responses **captured from the live API** |
| `api_client_test.dart` | 12, refresh and error mapping against a scripted adapter |
| `live_api_test.dart` | 8, the repositories against the deployed backend |

The fixtures under `test/fixtures/` were pulled off
`agromagnat-api.onrender.com`. Hand-written JSON agrees with whatever the
mapper already does; these carry the server's real quirks.

The live suite is tagged and skips without a URL:

```bash
flutter test test/live_api_test.dart --tags live \
  --dart-define=LIVE_API_URL=https://agromagnat-api.onrender.com/api
```

It is **read-only on purpose**. Nothing posts a listing, requests an OTP or
touches a favourite: the target is a shared environment, and a suite that spams
SMS or leaves rows behind is one people turn off.

## Not done yet

- **Photo upload is untested against the API.** The code is there — one
  request per photo, so a body that dies at 90% on EDGE does not take all five
  — but posting to a shared backend from a test is the line this suite does not
  cross. It needs a throwaway environment.
- **The AI draft endpoint** is wired with the on-device lexicon underneath as a
  fallback, which is the same shape the backend uses. Unverified against the
  live route for the same reason: it is authenticated and rate-limited per user.

See also: [MOBILE-OFFLINE.md](MOBILE-OFFLINE.md), which is what the repositories
here fall back to when the network is dead.
