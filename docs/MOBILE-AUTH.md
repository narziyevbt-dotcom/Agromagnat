# Mobile auth — phone + SMS OTP

No passwords and no email. A farmer signs in with the number buyers already
call, and a 6-digit code proves it is theirs.

## The API this is written against

Mirrors `apps/backend/src/modules/auth` exactly:

| Endpoint | Purpose |
|---|---|
| `POST /auth/request-otp` | `{phone}` → `{sent, expiresIn}` |
| `POST /auth/verify-otp` | `{phone, code, name?}` → `{accessToken, refreshToken, isNewUser}` |
| `POST /auth/refresh` | single-use refresh token → new pair |
| `POST /auth/logout` | revokes the refresh token, blacklists the access token |
| `GET /auth/me` | the authenticated user |
| `PATCH /auth/me` | name and default location |

Rules the client depends on, copied rather than approximated:

- Phone is `+998` followed by 9 digits
- Code is 6 digits, valid **300 s**
- **3** requests per phone per 10 minutes
- **5** wrong guesses burn the code
- A successful login clears the throttle

`MockAuthRepository` implements all of them. That matters: the resend
countdown, the "still on the code step" behaviour after a wrong digit, and the
rate-limit message are each written against one of these rules. A mock that
accepted any code would leave every one of those paths untested until the API
arrived.

In dev the backend prints the code instead of sending an SMS; the mock accepts
a fixed `000000` and the code screen says so in debug builds.

## Where the session lives

`SecureTokenStore` → Android Keystore, iOS Keychain.

Not SharedPreferences. A refresh token is good for 30 days, which makes it the
most valuable thing on the device; SharedPreferences is a plain XML file that
adb backup or any process on a rooted handset can read. iOS accessibility is
`first_unlock` so the session survives a reboot — the app opens to a feed, not
a vault.

`InMemoryTokenStore` stands in under `flutter test`, where neither platform
store exists.

## States

```
AuthRestoring → AuthSignedOut
              → AuthSignedIn(user, session)
```

`AuthRestoring` is a real state, not "signed out until proven otherwise".
Reading the keystore takes a moment on a cold start, and treating that moment
as signed-out bounces a returning user to the login screen for a frame.

**Anything that reads rather than watches auth must `await controller.ready`
first.** A screen that never watches auth leaves the controller
uninstantiated, so the first read lands on `AuthRestoring` — and a signed-in
user gets asked to sign in again. `toggleFavoriteOrSignIn` is the case that
found this.

## What is gated

Browsing stays open to everyone. A farmer should be able to see what tomatoes
are fetching before deciding the app is worth an account. Only the parts that
write something ask for one:

| | Gate |
|---|---|
| Home, search, listing detail | open |
| Saving a listing | prompts, then completes the save |
| Add listing | `SignInGate` |
| Messages | `SignInGate` |
| Profile | `SignInGate` |

`SignInGate` states its reason in the user's terms — "E'lon joylash uchun
telefon raqamingizni tasdiqlang", not a bare "sign in". `promptSignIn` returns
whether the user came back signed in, so the tap that triggered the login is
not lost.

## The login screen

Two steps in one route: the code step needs the phone step's number, and a
farmer who mistyped a digit should be one tap from fixing it.

- `+998` is a fixed prefix beside the field, not something to type
- Digits group as `90 123 45 67` while typing, in tabular figures so the
  groups do not shift width
- The button stays disabled until all nine digits are in — enabling it earlier
  only buys a round trip that fails validation
- The code submits on the sixth digit; there is nothing else to do on that
  screen and an extra tap is one more thing to get wrong
- A wrong code keeps the user on the code step. An expired or burned one sends
  them back to request a new one, because typing again cannot fix those
- The resend countdown uses the server's `expiresIn`, so the button never
  unlocks early. A rate limit shows its own countdown rather than a dead button

## Tests

33 auth tests inside `flutter test` (92 total). Covering phone normalisation
of the forms people actually type, every OTP rule above, session restore, a
stale token being discarded, the gate, and confirmed sign-out.

Two things worth knowing when adding more:

- `testWidgets` runs its body under fake async, so repository setup awaited
  directly in the body hangs rather than failing — the `Future.delayed` never
  fires. Seed through `tester.runAsync`.
- The resend countdown is a periodic Timer, and flutter_test asserts no timer
  is pending before teardown disposes the container. `loginTest` stops it via
  `editPhone`, the product's own "abandon this code" path.

## Not done yet

- **Access-token refresh.** `POST /auth/refresh` is in the repository
  interface but nothing calls it — there is no HTTP client yet to 401 against.
  It has to land with the real API, together with a single-flight guard so a
  screen firing three requests does not spend three refresh tokens.
- **Name on first login.** `verify-otp` accepts one and `isNewUser` comes back;
  the screen that asks for it belongs with the posting flow, where the name
  first shows up on a listing.

## The token has to travel with the request

`GET /auth/me` runs **inside** sign-in: a code is accepted, tokens come back,
and the user is fetched before the app has a session. The HTTP client takes
its bearer from the session, which at that moment is still signed out — so the
request went out with no `Authorization` header at all and the server answered
401 *"Avtorizatsiya talab qilinadi"*, which the login screen showed under the
code field. It read as "wrong code". Nobody could sign in.

`ApiClient.get/post/patch` now take an optional `bearer` that overrides the
session token for one request, and `ApiAuthRepository` passes the token it was
handed rather than ignoring it. Three calls need it, all the same shape — the
token is in hand but is not the session:

| | |
|---|---|
| `me()` during sign-in | the session does not exist yet |
| `me()` during restore | the stored session has not been adopted yet |
| `logout()` | the session has already been cleared |

**Why no test caught it.** `MockAuthRepository.me(accessToken)` honours the
argument, as any sane in-memory implementation would; `ApiAuthRepository.me`
took the same argument and dropped it. Every auth test passed against the
mock. The lesson is in the shape of the signature: a parameter that one
implementation ignores is a parameter the interface should not have had —
short of that, it needs a test at the HTTP layer, which `api_client_test.dart`
now has.
