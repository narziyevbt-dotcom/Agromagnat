# Messages — mobile

The inbox and the conversation screen, over the chat endpoints that were
already on the backend.

## Every thread is about a listing

The listing sits pinned at the top of the conversation and on every inbox row.
That is not decoration: a seller with four lots on the market gets "qancha
qoldi?" in four threads that are otherwise identical, and answering the wrong
one costs a sale.

`ChatSummary` carries the listing's title, photo and price rather than an id
alone. Fetching a listing per row would be twenty requests on a connection that
can barely afford one.

## The message appears before the server has it

A bubble is drawn the moment it is written, greyed with a clock, and turns
solid when the server confirms. Waiting for an EDGE round trip before showing
anything is what makes people press send twice.

If the send fails the bubble **stays**, marked, with a retry under it. The
words are the user's; a message that vanishes on send is the failure people
stop trusting an app for.

## Client ids, because the response is what gets lost

Every message carries a `clientId` generated on the device, and a retry reuses
it. On EDGE the common failure is not a request that never arrived — it is a
request that arrived and whose *response* timed out. Retrying without an
idempotency key delivers the message twice, and the recipient sees a person
repeating themselves.

The API stores the id uniquely and returns the message already stored, so a
retry is safe by construction rather than by luck. The mock implements the same
rule, so the behaviour is exercised without a backend.

## The list reads like a chat

The message list is **reversed**, which does two things at once: a
conversation opens on the newest message the way every chat app does, and
prepending older history does not jerk the reader's position.

It was not, at first. The thread opened on the oldest message and made you
scroll down to find out what had been said — obvious the moment it is on a
phone, invisible in a widget test that only asks whether the text is present.

Scrolling to the top fetches the page before it. `load()` keeps the older
pages already on screen, so the ten-second poll cannot throw away history the
reader just scrolled up for — with the boundary handled by *not older than*
rather than *older than*, because a burst of messages can share a timestamp to
the second and the ones on the edge would vanish.

The mock pages for real (30 a page, cursor and all). A mock that handed back
the whole history at once would let a broken "load older" ship and only fail
against the API.

## Polling, not sockets

The backend has no gateway, so the open conversation refetches every ten
seconds and the unread badge every time the Messages tab is opened or a
conversation is left.

Two rules keep the poll from doing damage:

- **A failed poll never replaces what is on screen.** The error view is only
  for a conversation that has never loaded.
- **A poll never swallows a message in flight.** Anything not yet confirmed is
  re-appended after the refetched history.

The badge behaves the same way: a failed refresh leaves the last known count
rather than clearing it, because a badge that empties itself when the phone
loses signal reads as "the messages are gone".

## One thread per listing and buyer

"Yozish" on a listing opens the conversation or returns the one that exists —
the API's rule, mirrored in the mock. Tapping it twice does not leave the
seller answering the same question in two places.

Tapping it on **your own** listing raises `CannotChatWithSelfException` rather
than a generic failure. It is not a network problem and retrying will not fix
it: the button should not have been offered, and the message says so.

Browsing stays open to everyone; the sign-in is asked for at "Yozish", and the
conversation opens straight after — the tap that triggered the login is not
lost.

## Tests

24 tests in `test/features/messages/messages_test.dart`.

The ones worth having: a failed send keeps its words and offers a retry, the
retry goes out under the same client id and lands once, a poll during a send
does not swallow the pending bubble, a failed poll does not blank the thread,
opening a chat twice returns one conversation, and a poll fired after
scrolling up does not throw the older pages away.

## Not done yet

- **Push notifications.** A reply while the app is closed is invisible until
  it is opened. FCM is in the stack and not yet wired on the client.
- **Photos in a chat.** The API has a message type for them; the composer only
  sends text.
- **Offline queueing.** A failed message is kept and retried by hand. It is not
  written to disk, so closing the app loses it — unlike a queued listing.
