# Security

What protects this site, and why each piece is there. Written for the person
who has to change one of them later.

## Sessions

Tokens live in **httpOnly** cookies, never in `localStorage`. Two reasons, in
order: server components need the token to render a personalised page, and
script on the page cannot read an httpOnly cookie — so an XSS bug cannot walk
off with a thirty-day refresh token.

`SameSite=Lax`, `Secure` in production, `Path=/`.

Refresh tokens rotate on every use, with a 60-second grace window so two tabs
refreshing at once is not read as an attack. A reuse after that window drops
every session the account holds. See `docs/AUTH.md`.

## The gate

`@RequiresPhone()` marks every action that reaches another person. Browsing
needs nothing. The claim is read off the access token rather than the database,
so the check costs nothing per request and a freshly verified phone is live
within one refresh.

## Cross-site requests

Server actions are covered by Next itself. **Route handlers are not**, and every
mutating one here authenticates from a cookie — which is the textbook shape of
a CSRF hole.

`lib/same-origin.ts` closes it. `Sec-Fetch-Site` is the primary check: the
browser sets it and script cannot, so it cannot be forged. `Origin` is the
fallback. A request with neither is allowed through — that is `curl`, a health
probe, or the app's own server-to-server call, none of which is a browser being
tricked.

Verified against the running site:

| Request | Answer |
|---|---|
| `Sec-Fetch-Site: cross-site` | **403** |
| `Sec-Fetch-Site: same-origin` | passes the check (401 without a session) |
| No headers at all | passes the check |

Guarded: `POST/DELETE /api/favorites/:id`, `POST /api/call`,
`POST /api/telegram/start`.

## Content Security Policy

Set per request in `proxy.ts`, with a **fresh nonce each time**. Before this
there was no policy at all, which is the difference between an XSS bug being a
bad day and being every seller's session.

A nonce rather than `unsafe-inline`, because `unsafe-inline` is the setting that
makes a policy decorative. Next stamps the nonce onto its own bootstrap; nothing
else on the page may run. `strict-dynamic` lets that bootstrap load its chunks
without listing every URL.

```
default-src 'self'
script-src  'self' 'nonce-…' 'strict-dynamic' https://accounts.google.com https://apis.google.com
style-src   'self' 'unsafe-inline'
img-src     'self' data: blob: <S3 origin>
connect-src 'self' <API origin> https://accounts.google.com
frame-src   https://accounts.google.com
frame-ancestors 'none'
base-uri 'self'; object-src 'none'; form-action 'self'
upgrade-insecure-requests
```

`form-action 'self'` is the one that is easy to leave out and worth the most: it
stops an injected form posting a farmer's phone number to somebody else's
server.

`style-src` keeps `unsafe-inline` because Next writes style attributes — for the
image placeholder among other things — that no nonce can cover. Styles cannot
exfiltrate on their own, so this is the cheap half of the trade.

**Changing the policy requires a browser check, not a build.** A CSP mistake
renders a page that looks perfect and does nothing, because hydration was
blocked. `npm run build && npm start`, then walk sign-up end to end and watch
the console.

## Boot guards

Production refuses to start when a setting would be dangerous — see
`env.validation.ts` and the table in `docs/AUTH.md`. Placeholder JWT secrets,
`SMS_PROVIDER=mock`, `DB_SYNCHRONIZE=true`. Failing at boot is deliberate:
warning and continuing is exactly how a placeholder survives to production.

## Rate limits

Writes are capped per account, reads are not — browsing is the product, and a
cap there turns a farmer on a retrying connection into a locked-out one. Twenty
listings an hour shared between posting and editing, thirty conversations,
forty offers, a hundred and twenty saves. OTP requests are capped separately,
per phone.

## Telegram sign-in

The contact must belong to the account that sent it (`contact.user_id` equals
`message.from.id`) — otherwise forwarding a friend's contact card signs you in
as them. The ticket lives two minutes, is burned before the session is written,
and the session is collected once. The webhook requires the shared secret;
without it the URL alone would mint sessions.

## Known gaps

- **No automated dependency scanning.** Next 16.2.12 currently carries
  high-severity advisories in bundled `postcss` and `sharp`; no patched release
  exists yet, and `npm audit fix --force` would downgrade Next to 9.x. Watch for
  a patch release.
- **No penetration test.** Everything here was reasoned about and tested by the
  people who wrote it, which is not the same as being attacked.
- **No audit log.** An admin deleting a listing leaves no record beyond the
  application log.
- **CSP has no reporting endpoint.** A violation in the wild is invisible;
  `report-uri` would make the first sign of an injection something we see.
