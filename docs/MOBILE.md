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
| Add listing | gated placeholder |
| Messages | gated placeholder |

Everything runs on mock repositories. No backend is needed to open the app.

Browsing is open to everyone; only the parts that write something ask for an
account. See [MOBILE-AUTH.md](MOBILE-AUTH.md).

## Layers

```
lib/
  core/            theme · localization · format · pagination
  features/
    listings/      domain → data → presentation      ← owns the listing model
    auth/          domain → data → presentation      ← owns the session
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
  return MockListingRepository();
});
```

Wiring the real API is this line plus a Dio-backed class implementing the same
interface. No screen changes, because no screen names an implementation. Tests
override the same provider.

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
flutter test          # 92 tests
flutter analyze       # clean
```

Covered: Uzbek formatting (grouping, units, relative dates, phone numbers),
the mock repository's filter/sort/page/favourite behaviour, the card, the
detail screen, the search flow including the filter sheet, and shell
navigation.

`test/support/test_harness.dart` pins `now` to a fixed instant and strips the
mock latency. Without the fixed clock a fixture posted "2 soat oldin" drifts
across midnight and a date assertion fails once a day, in CI, for no reason.

Four real defects came out of writing these:

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

There is no platform-channel code of our own. The one native dependency is
`flutter_secure_storage`, whose iOS side is a Keychain wrapper the package
maintains — so the iOS build is expected to be a formality. **That expectation
is unverified**: nobody has run it on a Mac, and a native plugin is exactly the
kind of thing that surfaces a CocoaPods or deployment-target problem the first
time it is compiled.

## Next

1. Add Listing — category-aware form, then voice-first posting
2. Real API behind the existing repository interfaces, including token refresh
3. Messages
