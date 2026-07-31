# Authentication

Phone plus SMS one-time code. There is no password anywhere in the system — the
audience does not want one, and a password reset flow would need email nobody has.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/request-otp` | public | Send a 6-digit code |
| POST | `/api/auth/verify-otp` | public | Verify; creates the account on first login |
| POST | `/api/auth/refresh` | public | Exchange a refresh token for a new pair |
| POST | `/api/auth/logout` | public | Revoke the refresh token, blacklist the access token |
| GET | `/api/auth/me` | bearer | The authenticated user |

Phone numbers are normalised before validation, so `+998 90 123-45-67` and
`+998901234567` are the same input. Anything not matching `+998` followed by nine
digits is rejected with an Uzbek message.

## SMS provider

`SmsService` is an interface with two implementations, chosen by `SMS_PROVIDER`:

- `mock` (dev) — nothing leaves the process, the code is always `000000` and is
  logged to the console. The whole flow can be walked without spending credit.
- `eskiz` — Eskiz.uz. The bearer token is cached and re-fetched once on a 401
  rather than refreshed on a timer, which is what a process idle for days needs.

A provider-side rejection returns `false` rather than throwing, so a bad number
answers 503 with an Uzbek message instead of a stack trace.

## Codes

Codes live in Redis, not Postgres — they are short-lived, written on every login
attempt, and must disappear on their own. A TTL does that for free.

- Lifetime: 5 minutes
- Rate limit: 3 requests per phone per 10 minutes → 429
- Wrong-code attempts: 5, after which the code is burned and a new one is needed
- Single use: a verified code is deleted immediately

A wrong guess rewrites the record with the *remaining* TTL, so guessing cannot
extend the window. A successful login clears the rate counter, so logging in does
not leave the phone throttled.

## Tokens

Access tokens last 15 minutes, refresh tokens 30 days.

**Refresh tokens are single use.** Rotating one revokes it. If a revoked token is
presented again, every session for that user is dropped — that is what turns a
stolen refresh token into a detectable event rather than silent long-term access.

**Logout blacklists the access token.** A stateless JWT cannot otherwise be
invalidated before it expires. Redis stores a SHA-256 hash of the token until its
own `exp`, so the entry is self-limiting and no raw credential is stored.

## Guards

`JwtAuthGuard` is registered globally: authentication is the default and every
exception is written down with `@Public()`. For a marketplace, an unguarded write
endpoint means anyone can post as anyone, so the safe direction is opt-out.

`@Public()` routes still decode a token when one is present. That is what lets the
public feed mark listings the caller has already favorited without demanding a login.

`RolesGuard` enforces `@Roles(UserRole.ADMIN)` on top, for the admin panel.

## Tests

- `otp.service.spec.ts` — issue, expiry, rate limit, attempt burn, single use
- `token.service.spec.ts` — rotation, the grace window, replay detection,
  blacklist, and that logout closes the window
- `auth.e2e-spec.ts` — the real stack, from request-otp to logout, including a
  concurrent refresh that must not sign the account out
- `phone-gate.e2e-spec.ts` — browsing allowed without a phone, every
  participating action refused, verification attaching the identity and
  reissuing the pair

Web (`npm test` in `apps/web`, Vitest + Testing Library):

- `proxy.test.ts` — renewal ahead of expiry, no call when there is nothing to
  renew, cookies cleared on a dead session, session left alone when the API is
  unreachable, the new token forwarded to the page being rendered
- `gate.test.ts` — the 403 code read off the envelope, an ordinary 403 *not*
  mistaken for it, and `next` refusing absolute and protocol-relative URLs
- `auth-actions.test.ts` — no session is ever stored on a failed proof, no
  redirect ever leaves the site, the phone-attach path uses the account token
  rather than the anonymous endpoint
- `auth-fields.test.tsx` — auto-advance, paste, auto-submit on the sixth digit,
  correction after a failed attempt, the resend countdown
- `favorite-button.test.tsx` — optimistic fill, rollback on failure, and the
  gate's hardest path: a background fetch that cannot redirect itself

See `docs/TESTING.md`.

## Identity vs proof

`users` is who somebody is. `auth_identities` is how they proved it — one row
per provider, unique on `(provider, provider_user_id)`. Adding Apple or
Telegram login later is a row, not a migration, and one person holding several
proofs resolves to one account rather than to several.

The phone stopped being a login credential and became **accountability**: the
thing that makes a seller reachable and a scammer traceable. It is nullable,
and `phone_verified_at` records when an OTP for it succeeded.

## Two doors, one gate

| Route | What it gives |
|---|---|
| `POST /auth/google` | An account from a Google ID token. No phone, no SMS, no cost. |
| `POST /auth/request-otp` + `verify-otp` | An account from a phone, verified on arrival. |
| `POST /auth/phone/request` + `phone/verify` | Attaches a phone to an account that already exists — the Google path. |

Browsing needs neither. A buyer evaluating the market costs us nothing and an
SMS costs money, so the old sign-up wall was charging us to turn visitors away.

`@RequiresPhone()` marks the actions that reach another person — post a
listing, open a chat, make or accept an offer, save a favourite, edit a
profile. `PhoneVerifiedGuard` reads the claim off the access token rather than
the database: the token is short-lived, so a freshly verified phone is live
within one refresh, and the alternative would put a query in front of every
message send for a check that is almost always true.

It answers 403 with `error: "PHONE_VERIFICATION_REQUIRED"`. A machine-readable
code, not just a message, because the client must tell "verify your phone"
apart from "this is not yours" and open the verification sheet for one only.

### What the web does with that 403

`/telefon` — a route, not a modal. The refusal can arrive from a server action,
a route handler or a full page load, and a URL is the only target all three can
reach; it also survives a reload mid-flow, which a sheet held in React state
does not. Every entry point carries `?next=` so verifying returns the person to
the listing they were about to save.

| Where | What happens |
|---|---|
| `/joylash` | Checked **before** the form renders. Photographing a crop, filling six fields and *then* being asked for a phone is how a seller gives up. Asked first, it is one step; asked after, it is a lost listing. |
| Chat, profile edit | The action catches the code and redirects. |
| Save (favourite) | A background fetch cannot redirect itself, so the proxy route hands back the code plus `verifyUrl`; the button rolls the heart back and navigates. |
| `/profil` | A standing banner while the account has no verified phone — it sits above the actions because every one of them is refused until it is done. |

`/telefon` also checks the account rather than the token: somebody who verified
on their phone and then opened the link on a laptop still holds an access token
that says otherwise, and sending them round the SMS loop again would cost money
to tell them something we already know.

### One screen for signing in and signing up

There is no separate register page and there never was a reason for one: the
site cannot know whether a number is new until the code is confirmed, so asking
the visitor to declare it up front makes them guess at something we are about to
find out anyway. `/kirish` offers Google first — one tap for anyone signed in on
an Android phone, which is most of this market, and it costs us no SMS — then a
divider, then the phone field.

Google's own button is rendered rather than a lime pill in our design language.
The branding *is* the trust signal: a home-made button next to the word Google
is what a phishing page looks like, and Google's terms require their asset. It
is the one place on the site where matching the design system would cost more
than it buys. With `NEXT_PUBLIC_GOOGLE_CLIENT_ID` unset the button is absent
entirely — a dead button that fails on tap is worse than one door.

One Tap is deliberately **not** enabled. Signing in is a deliberate act on this
site, not something to interrupt a browsing farmer with on a listing page.

### Two joins we deliberately refuse

**Google email to an existing account.** Automatic linking on an email is a
known takeover route — whoever inherits an address inherits the account. The
safe join is proving both, which is the phone verification this account will be
asked for anyway.

**A phone already held by another account.** Merging would move listings
between accounts. It is refused, and the person is told to sign in the other
way.

## Google verification

Verified against Google's JWKS with `node:crypto` rather than
`google-auth-library`, which brings the whole Google API client stack for one
signature check. Keys are cached for an hour, refetched on an unknown `kid`
(that is what a rotation looks like), and refreshed under a single-flight lock
so a burst of sign-ins after a rotation does not hammer Google.

The **claim checks are the security boundary, not the signature.** A valid
Google signature only proves Google issued the token; it says nothing about who
it was issued *to*. Without the `aud` check, a token minted for any other
Google application would authenticate here. That is the classic way this
integration is got wrong, so `audience` and `issuer` are passed to the verifier
rather than checked by hand afterwards — a mistake becomes a rejected token
instead of a skipped check.

An unverified Google email is withheld: the subject is still trustworthy, the
email is not.

## OTP delivery

Telegram first, SMS second, chosen per person rather than per deployment.

That order is a cost decision as much as a delivery one. Telegram is free and
instant, an SMS is neither, and at any real volume the difference between them
is most of the OTP bill. `OtpDispatcher` asks each channel whether it can reach
this recipient and falls through when one throws — a channel that failed is a
code that did not arrive, and the next channel exists for exactly that.

The response says which channel delivered, because telling somebody to check
the wrong place is the fastest way to make a working code look broken.

Telegram becomes available for a person once they start the bot: `/start <userId>`
binds the chat id. The webhook is authenticated by the secret Telegram echoes
back — without it, anyone who guessed the URL could bind their own chat to
somebody else's account and receive their login codes.

The bot is two HTTPS calls, not a library. Webhooks also scale where polling
does not: a polling bot pins one process, so the API could never run more than
one replica.

## Sessions

Refresh tokens rotate on every use and the old one is revoked, so a stolen
refresh token is single-use and its replay is detectable. `POST /auth/logout-all`
revokes every one the account holds — the "sign out everywhere" a settings
screen owes anybody who has lost a phone. It is on `/profil`, behind one
confirmation, not buried in settings: the moment somebody needs it is the moment
they have just lost a phone.

### The rotation grace window

Single-use rotation and multiple tabs are in direct conflict. Two tabs whose
access tokens expire in the same second both present the same refresh token;
one wins, and the loser looks exactly like a thief replaying a stolen token.
Taken literally, that signs the person out of every device for opening a second
tab.

So a rotated token is remembered for **60 seconds** under `auth:rotated:<user>:<jti>`.
A second use inside that window is served with a fresh pair and nothing is
revoked. A use after it is still treated as a compromise and still drops every
session the account holds. Both `logout` and `logout-all` clear the grace keys,
or the window would be a minute-long hole in the one operation whose purpose is
closing the session.

### Staying signed in (web)

The access token lives 15 minutes, the refresh token 30 days. Nothing was
spending the second to renew the first: once the short token expired every
authenticated page saw a 401 and bounced to the login screen while a perfectly
good refresh token sat in the next cookie along. In practice that meant signing
in again a few times an hour, and each of those is another SMS.

`apps/web/proxy.ts` renews it. It runs before the page and is the only place in
the App Router where a cookie can still be written for a server-rendered
request — a server component cannot set one, and by the time an action notices
the 401 the page has already decided to redirect. It renews 120 seconds ahead of
expiry so a slow render never straddles the boundary, clears both cookies on a
401 so the next page is the signed-out one rather than a broken authenticated
one, and does nothing at all when the API is unreachable: signing somebody out
because a network blipped is worse than a page that briefly shows less.

The `exp` claim is read without verifying the signature, deliberately. This
decides whether to *ask the backend* for a new token, and the backend verifies
for real; a forged `exp` buys an attacker one pointless refresh call with their
own cookie.

## Production guards

The app refuses to boot when `NODE_ENV=production` and any of the following is
true. These are enforced in `env.validation.ts` and covered by tests:

| Condition | Why it is fatal |
|---|---|
| `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` is the development placeholder | This repository is public, so those strings are public. `role` travels inside the access token and `RolesGuard` trusts it, so anyone holding the secret can mint an administrator — no exploit, no unusual traffic, nothing in the logs. |
| Either secret is shorter than 32 characters | Brute-forceable offline. |
| Either secret is missing | Silently defaulting is what made the placeholder dangerous: the app booted happily. |
| `SMS_PROVIDER=mock` | mock accepts `000000` for every phone number, so anyone can sign in as anyone, including an admin. |
| `SMS_PROVIDER=eskiz` without credentials | The provider is real, the credentials are blank, and every OTP fails silently — indistinguishable from "nobody can register". |
| `DB_SYNCHRONIZE=true` | TypeORM's schema sync drops columns it cannot reconcile, on live listings. |

`SWAGGER_ENABLED` also flips to `false` by default in production: it is an
annotated map of every endpoint and DTO, and should be opted into rather than
out of.

Failing at boot is deliberate. Warning and continuing is exactly how a
placeholder survives to production — nobody reads a startup log until something
is already wrong.

Development is untouched: a fresh clone still runs with an empty environment.
