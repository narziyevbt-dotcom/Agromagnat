# Vercel — test deploy of the web app only

For sharing a preview URL and reviewing layout and copy. **Not** the production
path: user data must be hosted inside Uzbekistan, which a US/EU serverless
platform does not satisfy. Production stays on the Ubuntu server described in
[DEPLOY.md](DEPLOY.md).

## What actually deploys

Only `apps/web`. The backend is NestJS with Postgres, Redis and MinIO — it does
not run on Vercel, so the deployed site is the Next.js frontend pointed at some
backend elsewhere, or at none.

Public pages degrade on purpose when the API is unreachable: the landing page,
header, footer and nav render, the listing strip is simply empty, and search
shows its error state. Anything behind a login (posting, chat, reviews, the
dashboard, admin) needs a reachable backend to do anything at all.

## Prerequisites

- A Vercel account and a token from <https://vercel.com/account/tokens>
- `npx vercel` (no global install needed)

## Deploy

```bash
cd apps/web

# Preview (a throwaway URL, safe to repeat)
npx vercel deploy --token=$VERCEL_TOKEN --yes

# Production alias on the project's vercel.app domain
npx vercel deploy --prod --token=$VERCEL_TOKEN --yes
```

The first run links the directory to a Vercel project and writes `.vercel/`,
which is git-ignored.

## Environment variables

Set these on the Vercel project (Settings → Environment Variables), or pass
`--build-env` / `--env` on the command line. `NEXT_PUBLIC_*` are baked into the
client bundle at build time, so a change to them needs a rebuild.

| Variable | Value | Why |
|---|---|---|
| `API_URL` | `https://<backend>/api` | Server-side fetches from React Server Components |
| `NEXT_PUBLIC_API_URL` | `https://<backend>/api` | Browser-side fetches |
| `NEXT_PUBLIC_S3_URL` | `https://<backend-or-cdn>` | Allow-listed host for `next/image` |
| `NEXT_PUBLIC_SITE_URL` | `https://<project>.vercel.app` | Canonical URL in sitemap and metadata |

With no backend, leave them unset — the app falls back to `localhost:3000`,
which is unreachable from Vercel, and every data fetch fails into the empty
state it is already written to handle.

**The backend must send CORS headers for the Vercel origin**, and its cookies
are irrelevant here — the web app keeps tokens in its own httpOnly cookies on
the Vercel domain and calls the API server-to-server with a bearer token.

## Repo changes this needed

`next.config.ts` sets `output: 'standalone'` for the production Docker image.
That is skipped when `VERCEL=1` is set, which Vercel does automatically —
otherwise Vercel traces the bundle a second time for output it never uses. Both
build paths are exercised by CI.

`apps/web/vercel.json` pins the framework, the install command and the `fra1`
region — Frankfurt is the closest Vercel region to Uzbekistan.

## Caveats

- **`robots.ts` allows indexing.** A preview deploy that gets crawled competes
  with the real domain. Vercel preview URLs carry `X-Robots-Tag: noindex`
  automatically; a `--prod` deploy on a `.vercel.app` domain does not, so keep
  test deploys on preview URLs or set the project to password protection.
- **No cron.** `listings.cron.ts` auto-expires listings after 14 days and runs
  in the backend, not here.
- **Sessions do not carry over** between preview deploys on different URLs —
  cookies are per-domain.
