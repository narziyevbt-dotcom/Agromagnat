# Queued posting — mobile

A farmer finishes a listing in a field with no bars and taps publish. Before
this slice the request timed out and the draft went with it. They typed it
once, in the sun, on a phone keyboard, and they do not type it twice — they
stop using the app.

Now the listing is written to disk and sent when a signal comes back.

## Only a dead network queues

`ApiException.status == 0` — a timeout or an unreachable host. Everything else
still fails in front of the seller while the form is open and fixable:

- **A 400 is not queued.** The server will never accept that body. Queueing it
  moves the failure to a moment when the form is gone and nobody can explain
  what was wrong with it.
- **Local validation is not queued either.** `submit()` validates first; a
  draft with no price never reaches the network and never reaches the queue.

## What is stored is the request, not the draft

```dart
static Map<String, dynamic> bodyFor(ListingDraft draft) => { … };
Future<Listing> postBody(Map<String, dynamic> body) async { … }
```

`create()` is now those two composed, and the outbox holds the body.

Storing the `ListingDraft` would mean rehydrating it on the way out —
category, region and district looked up again from the catalogue. A category
renamed while the listing sat in the queue would then fail the *rehydration*
rather than the post, and the seller would lose a listing to a rename they
never saw. The body is already the exact JSON `POST /listings` validates.

Photos go with it as on-device paths, uploaded after the listing exists.

## Sending

`flush()` runs on launch, on `AppLifecycleState.resumed`, and on the banner's
"Hozir yuborish". No connectivity listener: resume covers coming back from
airplane mode, and a listener is another native plugin for the same outcome.

Three rules it enforces:

- **It stops at the first dead request.** Working through ten queued listings
  while offline costs ten radio wakeups and tells you nothing the first one
  did not.
- **A refused body is counted, not deleted.** After `maxAttempts` (5) it stops
  being retried and the banner turns and says a person needs to look at it. It
  is still the seller's work; the app does not get to throw it away.
- **A listing whose photos fail is still done.** The listing is live, so it
  comes off the queue either way — posting it twice is the one thing that must
  not happen. The photos move to the photo queue below rather than being
  dropped.

## Photos for a listing that is already live

Publishing and uploading are two requests, and on EDGE the second is the one
that dies: the listing goes live and its photos do not. That used to end with
*"keyinroq qo'shishingiz mumkin"* — an instruction, with nothing in the app
that could carry it out.

`PhotoOutbox` is a second queue, keyed on a listing id that already exists. It
is deliberately not the same queue: an entry that is half-sent is exactly the
state that eventually posts a listing twice.

- **One job per listing.** A seller who retries three times uploads the photo
  once, not three times.
- **Three attempts, not five.** A listing is the seller's typing and worth
  pushing at; a photo is a file the OS may already have cleared out of its
  cache directory, and retrying that forever is battery for nothing.
- **A 404 drops the job.** The listing was deleted here or on another device.
  Uploading at it forever helps nobody.

The message changes with it. "Add them later" when nothing will retry is an
instruction; *"Rasmlar navbatda — internet paydo bo'lishi bilan o'zi
yuklanadi"* when something will is a reassurance, and only one of the two is
ever true.

## It says "queued", not "published"

The success sheet after an offline submit reads *"E'lon navbatda — internet
paydo bo'lishi bilan o'zi joylanadi"*, and `OutboxBanner` sits on **home**,
not in the profile.

That placement is the whole point. Somebody who taps publish, is told
"joylandi", then finds nothing in the feed concludes it failed and posts it
again. The duplicate is the failure mode the banner exists to prevent.

`submit()` returns `true` for a queued listing — the seller's work is safe,
which is what that return value means to the screen — but `state.published`
stays null and `state.queued` is set, so nothing navigates to a listing that
does not exist yet.

## Tests

23 tests — `outbox_test.dart` drives both queues over an adapter that can be
switched offline mid-test, `outbox_banner_test.dart` covers what the seller
sees.

The ones worth having: it survives the app being killed (a second controller
reading the same disk), an invalid listing is still rejected rather than
queued, flushing stops at the first dead request, a refused body is given up
on after five tries, one unreadable row does not cost the seller the listing
beside it, backing out of the delete dialog is not a way to lose a listing,
and a photo job for a deleted listing is dropped rather than retried forever.

## Not done yet

- **No editing from the queue.** A stuck entry can be deleted, not corrected —
  the seller has to type it again. Reopening it in the posting form means
  rebuilding a draft from a stored body, which is the rehydration this design
  deliberately avoids on the sending path.
