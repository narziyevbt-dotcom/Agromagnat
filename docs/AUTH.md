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
