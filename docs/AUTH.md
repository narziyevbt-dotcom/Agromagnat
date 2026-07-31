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
- `token.service.spec.ts` — rotation, replay detection, blacklist
- `auth.e2e-spec.ts` — 13 cases over the real stack, from request-otp to logout

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
screen owes anybody who has lost a phone.

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
