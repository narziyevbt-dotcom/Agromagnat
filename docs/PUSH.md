# Push notifications

Firebase Cloud Messaging behind a `PushService` interface, mocked in
development the same way SMS is.

## API

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/me/devices` | Register this installation (idempotent per token) |
| `DELETE` | `/api/me/devices` | Unregister — called on logout |

Two events push today: a new chat message (to the other participant) and a new
review (to the seller).

## Configuration

```bash
PUSH_PROVIDER=mock          # mock | fcm
FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_PRIVATE_KEY=            # keep the literal \n escapes from the JSON key
```

The three `FCM_*` values come from a Firebase service-account JSON key. With
`PUSH_PROVIDER=mock` nothing leaves the process — notifications are logged, so
the whole chat flow is exercisable without a Firebase project.

## Decisions worth knowing

**One row per installation, not per user.** `device_tokens` replaces the single
`users.push_token` column from the initial schema. A farmer who reinstalls gets
a fresh registration token while the old one keeps resolving for days; one
column either loses the new device or keeps pushing into the dead one.

**`users.push_token` is left in place rather than dropped.** Dropping a column
is destructive and the mobile client that writes it has not shipped. It is
unused; the table is the source of truth.

**The token is the identity, not the (user, token) pair.** Two accounts on one
handset share an FCM token, and the second login moves it rather than
duplicating it — otherwise the first account keeps receiving the second's
messages on a device it no longer owns.

**Dead tokens are deleted, not retried.** FCM answers `UNREGISTERED` (404) when
the app was uninstalled or the token rotated, and `INVALID_ARGUMENT` when the
string is malformed. Both are permanent, so the row goes; a retired token never
revives and keeping it costs a wasted request on every future notification.

**Delivery never fails the action behind it.** `sendToUser` swallows everything.
A message is already stored by the time the push is attempted, and a provider
being slow or down must not roll that back or surface as an error to the user.
The call site treats it as fire-and-forget.

**FCM HTTP v1, authenticated with a hand-signed service-account JWT.** The
legacy server-key endpoint is gone and v1 wants a short-lived OAuth token. That
is forty lines of `node:crypto`; `firebase-admin` exists to do those forty lines
and drags the whole Firebase SDK, gRPC included, into an image that only ever
sends a POST. The access token is cached until a minute before it expires.

**v1 has no multicast, so tokens are sent one request each.** Acceptable because
a user has one or two devices, not thousands; the requests go out concurrently
and one failure never sinks the batch.

**Android messages are sent at `HIGH` priority.** The audience is on Android
with intermittent connectivity — a chat message has to wake the device rather
than wait for the next maintenance window.

## Deferred

- Web push. The registration endpoint already accepts `platform: 'web'`; the
  service worker and the permission prompt are not built.
- Per-user notification preferences (mute a thread, quiet hours).
- Batching. A seller who gets twenty messages in a minute gets twenty
  notifications; collapsing them needs a digest window and a cancel token.
