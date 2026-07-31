# Mobile app — Flutter

`apps/mobile` — Flutter 3.44, Riverpod, Clean Architecture. Android and iOS from
one codebase. Uzbek UI throughout.

## What exists

| Screen | State |
|---|---|
| Home — search entry, category strip, newest listings | built |
| Search — text, filters, sort, cursor paging | built |
| Listing detail — price, volume, seller, call bar | built |
| Sign in — phone + SMS OTP | built · [MOBILE-AUTH.md](MOBILE-AUTH.md) |
| Profile — account, sign out | built |
| Add listing — category-aware form | built · [MOBILE-POSTING.md](MOBILE-POSTING.md) |
| Photos — camera, gallery, gallery view | built · [MOBILE-PHOTOS.md](MOBILE-PHOTOS.md) |
| Voice-first posting — say it, form fills | built · [MOBILE-VOICE.md](MOBILE-VOICE.md) |
| Real API — feed, auth, posting, AI | built · [MOBILE-API.md](MOBILE-API.md) |
| Offline — cached feed, catalogue, details | built · [MOBILE-OFFLINE.md](MOBILE-OFFLINE.md) |
| Queued posting — publish with no signal | built · [MOBILE-OUTBOX.md](MOBILE-OUTBOX.md) |
| My listings — status, edit, mark sold, delete | built · [MOBILE-MY-LISTINGS.md](MOBILE-MY-LISTINGS.md) |
| Messages | gated placeholder |

Runs against the real API when one is configured, and on mock repositories
when not. No backend is needed to open the app.

Browsing is open to everyone; only the parts that write something ask for an
account. See [MOBILE-AUTH.md](MOBILE-AUTH.md).

## Layers

```
lib/
  core/            theme · localization · format · pagination · network · cache
  features/
    listings/      domain → data → presentation      ← owns the listing model
    auth/          domain → data → presentation      ← owns the session
    ai/            domain → data → presentation      ← drafts and dictation
    add_listing/   presentation                      ← renders the API's form spec
    my_listings/   presentation                      ← the seller's own listings
    home/          presentation
    search/        presentation
    profile/       presentation
    shell/         the five-slot bottom bar
  shared/widgets/  cards, skeletons, empty and error views
```

`features/listings` owns the domain because home, search and detail are three
views of one thing. The dependency runs one way: `presentation` knows `domain`,
`data` implements `domain`, and `domain` knows neither.

### The repository seam

```dart
final listingRepositoryProvider = Provider<ListingRepository>((ref) {
  if (!ApiConfig.isConfigured) return MockListingRepository();
  return ApiListingRepository(ref.watch(apiClientProvider));
});
```

Both sides are live. `--dart-define=API_URL=…` picks the real backend; without
it every repository stays on its mock, which is how the screens were built and
what keeps the app openable with nothing behind it. No screen names an
implementation, so wiring the API changed none of them —
[MOBILE-API.md](MOBILE-API.md).

`MockListingRepository` implements filtering, sorting and cursor paging for
real rather than returning a fixed list. A mock that ignored its query would
let a broken filter ship and only fail once the API was connected.

It also carries a deliberate ~350 ms latency. The target user is a farmer on
EDGE, so loading and empty states are the common case — the delay makes them
visible during development instead of something discovered in the field. Tests
override it to zero.

## Design tokens

`core/theme` mirrors `apps/web/app/globals.css` value for value: forest
`#0B1D14`, harvest `#1F7A4D` for money, lime `#D4E96A` for calls to action,
canvas `#ECEEEA`. A buyer who found a listing through Google and then installs
the app has to recognise it as the same product.

Two rules the theme enforces rather than documents:

- **Lime is the only "press me" colour**, and it is light, so `onLime` is
  forest. White on lime fails contrast.
- **Every number goes through `AppTypography.number`**, which turns on tabular
  figures. Prices align down a column without a second typeface.

Plus Jakarta Sans is **bundled** (`assets/fonts`), not fetched by
`google_fonts`. Runtime font fetching means the first session renders in the
wrong face on a slow connection, and every session if the request never
completes. 176 KB of variable font removes the network from that path;
`google_fonts` was dropped from the dependencies.

## The card

`ListingCard` shows the volume chip as prominently as the price. That is the
product rule, not decoration: a wholesale buyer decides on volume first ("does
this fill my truck?") and price second. Both are harvest green, both tabular.

Most listings have no photo — a farmer posting from a field types faster than
they photograph — so the no-photo path renders the category emoji on mint, not
a broken-image icon.

## Tests

```bash
flutter test          # 270 tests
flutter analyze       # clean
```

Covered: Uzbek formatting (grouping, units, relative dates, phone numbers),
the mock repository's filter/sort/page/favourite behaviour, the card, the
detail screen, the search flow including the filter sheet, and shell
navigation.

`test/support/test_harness.dart` pins `now` to a fixed instant and strips the
mock latency. Without the fixed clock a fixture posted "2 soat oldin" drifts
across midnight and a date assertion fails once a day, in CI, for no reason.

Five real defects came out of writing these:

- The filter sheet grew past the screen and put "Qo'llash" below the fold with
  no way to reach it. It is now capped at 85% height with the button pinned.
- Region and category chips were a horizontal scroll row, which hid 10 of 13
  viloyats behind a gesture people do not think to make. They wrap now.
- Tapping the heart on the detail screen did nothing visible: saved state lived
  on the `Listing` entity, and the detail screen held a different instance from
  the one the list had. It moved to `favoritesProvider`, which is optimistic —
  a heart that does nothing for two seconds on EDGE reads as a dead button.
- A signed-in user was asked to sign in again when saving. Auth that is read
  rather than watched lands on `AuthRestoring` on first touch, and that was
  being treated as signed-out; the read now awaits `controller.ready`.
- The profile row added for "Mening e'lonlarim" was a `ListTile` inside a
  coloured `Container`, which silently swallows the ink splash. Flutter asserts
  on it; the sign-in and screenshot tests caught it the same minute.

## Platforms

| | Status |
|---|---|
| Android | `flutter build apk --debug` verified in CI-like container |
| iOS | Project configured; **cannot be built on Linux** — needs macOS + Xcode |

Bundle id `uz.agromagnat.agromagnat` on both. iOS deployment target 13.0.
`CFBundleLocalizations` lists `uz` and `ru`, matching `supportedLocales` in
`main.dart` — without it iOS advertises the app as English-only and system
sheets come back in English on an Uzbek phone.

The iOS build has to be run on a Mac (or a macOS CI runner):

```bash
cd apps/mobile
flutter build ios --debug --no-codesign
```

There is no platform-channel code of our own. Four packages carry native code —
`flutter_secure_storage` (Keychain), `image_picker`, `speech_to_text` and
`shared_preferences` — all maintained upstream, so the iOS build is expected to
be a formality. **That expectation is unverified**: nobody has run it on a Mac,
and native plugins are exactly the kind of thing that surface a CocoaPods or
deployment-target problem the first time they are compiled.

`Info.plist` already carries the four usage descriptions those plugins require
— camera, photo library, microphone, speech recognition — in Uzbek. Missing
one does not fail the build; it crashes the app at the moment that permission
is first asked for, which is the hardest kind of iOS problem to find late.

## Next

1. Photo upload retry — the listing publishes offline now, but photos that
   fail after it goes live are gone, and a photo already on a listing cannot
   be removed
2. Messages
3. Reposting an expired listing in one tap
