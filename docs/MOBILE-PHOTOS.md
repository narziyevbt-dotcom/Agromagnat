# Photos — mobile

## Downscaled on the phone, not on the server

The server accepts 12 MB and resizes to 1280 px itself. That is not the
constraint that matters. The **upload** is what a farmer on EDGE pays for: a
stock camera photo is 3–5 MB and takes minutes, while the same frame at 1280 px
is around 200 KB.

`image_picker`'s `maxWidth` / `maxHeight` / `imageQuality` do the resize in
native code before the bytes ever reach Dart, so nothing large is held in
memory either — which matters on the cheap handsets this app targets.

```dart
maxEdge  = 1280   // matches the server's PHOTO_MAX_EDGE
quality  = 85     // artefacts stop being visible on produce; file is a fraction
```

Sending more pixels than the server will keep is paying for bytes it throws
away.

## Two calls, not one

The API keys photos on a listing id (`POST /listings/:id/photos`), so a listing
must exist before its photos can go up. `submit()` does create-then-upload.

They fail differently, and that is the point:

- **Create fails** → nothing was posted, show the error, let them retry.
- **Upload fails** → the listing is live without photos. Reported as
  `photoFailure`, never as `failure`. Telling a seller their post failed when
  it did not is how you get two identical listings.

Up to 5 photos, matching `MAX_PHOTOS` in `listings.service.ts`.

## In the form

The strip sits above the title, because a listing with a photo is the one
buyers call. Optional all the same — one bar of signal in a field is the common
case, and requiring a photo would keep the listings that matter most off the
market.

- **Camera or gallery is an explicit choice**, not one button that guesses.
  Photographing the crop in front of you and posting last week's harvest are
  different intentions.
- **Tap a thumbnail to make it the cover.** Drag-to-reorder is the usual
  gesture and a poor fit: the strip holds at most five items, and
  long-press-drag is not something this audience reaches for.
- **The gallery is asked only for the slots that remain.** Asking for five when
  three are free lets the picker hand back more than the API takes, and the
  extras get dropped after the seller chose them — which reads as the app
  losing their photos.
- **Duplicates are dropped.** A gallery grid makes double-tapping easy, and two
  identical photos on a listing look like a mistake because they are one.
- **The publish button says "Rasmlar yuklanmoqda…"** while the upload leg runs.
  Five photos on EDGE is slow enough that a bare spinner reads as a hang.

## Showing them

`PhotoGallery` on the detail screen, a 4:3 swipeable strip with a counter —
produce is photographed in landscape far more often than not, and 4:3 fits a
crate of tomatoes without cropping the ends off.

**It renders nothing when there are no photos.** An empty grey box would eat
the top of the screen on the majority of listings and push the price below the
fold, which is the one thing that has to be visible on arrival. The card keeps
its category-emoji placeholder for the same reason.

`ListingPhotoView` handles a local path and a remote URL alike. Both occur
within one posting flow: a listing that was just created still holds on-device
paths, and one refetched from the API holds S3 URLs.

## iOS

`NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` are in
`Info.plist`, in Uzbek — they are shown in the system prompt the seller reads.
Without them iOS terminates the app the instant it asks for either.

## Tests

`photos_test.dart` covers the picking rules and both publish paths against a
`FakePhotoPicker`; the real one talks to a platform channel that does not exist
under `flutter test`. `photoPickerProvider` is the seam.

## Not done yet

- **Retrying a failed upload.** The listing is live and photo-less, and there
  is no way back to it to add them. That needs the "my listings" screen, which
  is where editing belongs anyway.
- **Full-screen photo view.** Tapping a photo on the detail screen does
  nothing; pinch-to-zoom on a crate of produce is worth having.
- **Progress per photo.** `uploaded` is on the state and the bar shows a
  generic message. One request per photo is already the shape, so a real
  counter is a small step once the API client exists.
