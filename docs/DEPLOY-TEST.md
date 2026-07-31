# Test deploy — Vercel (web) + Render (API)

A throwaway environment for reviewing the product on real URLs. Follow the four
steps in order; the whole thing takes about twenty minutes, most of it waiting
for builds.

> **This is not production.** User data must be hosted inside Uzbekistan by law,
> and neither Vercel nor Render has a region there. Production stays on the
> Ubuntu server in [DEPLOY.md](DEPLOY.md). Nothing real belongs in this
> environment — see [Caveats](#caveats), especially the one about OTP.

## Shape of it

```
Vercel (apps/web)  ──server-to-server──▶  Render (apps/backend)
   Next.js SSR                              NestJS
                                            ├── Render Postgres
                                            └── Render Key Value (Redis)
```

The browser never calls the API directly — every request goes through the
Next.js server, which holds the access token in an httpOnly cookie. That is why
there is no CORS to configure for the frontend to work, and why Vercel preview
URLs work without being registered anywhere.

## 1. Backend on Render

1. <https://dashboard.render.com> → **New** → **Blueprint**
2. Connect the GitHub repo and pick the branch
3. Render reads [`render.yaml`](../render.yaml) from the repo root and proposes
   three resources: `agromagnat-api`, `agromagnat-db`, `agromagnat-redis`
4. It will prompt for the `sync: false` values. Leave every one of them blank
   for now — `CORS_ORIGINS` is filled in at step 4, and the `S3_*` group only
   matters if you want photo upload (see below)
5. **Apply**, then wait. First build is 5–10 minutes: Docker image, then
   migrations, then the reference-data seed, all on boot

Check it came up:

```bash
curl https://agromagnat-api.onrender.com/health          # postgres + redis "up"
curl https://agromagnat-api.onrender.com/api/regions     # 14
curl https://agromagnat-api.onrender.com/api/categories  # 12
```

If `/api/regions` returns `[]`, the seed did not run — check the service logs
for "Seeding reference data" and that `SEED_ON_START=true` survived.

Note the service URL; step 3 needs it.

> If Render rejects `type: keyvalue`, the account is on the older naming —
> change it to `type: redis` in `render.yaml` and re-apply.

### Photo upload (optional)

Render has no object storage, so uploads fail until `S3_*` points at a real
S3-compatible bucket. [Cloudflare R2](https://developers.cloudflare.com/r2/) has
a free tier and works with the existing client, which already uses path-style
addressing:

| Variable | Value |
|---|---|
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | your bucket name |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | R2 API token pair |
| `S3_PUBLIC_URL` | the bucket's public r2.dev URL, including the bucket path |

Everything except photos works without this.

## 2. Frontend on Vercel

1. <https://vercel.com/new> → import the same GitHub repo
2. **Root Directory: `apps/web`** — this is the one setting that matters, and
   the build fails without it. Click *Edit* next to Root Directory and pick it
3. Framework preset should read **Next.js** on its own
4. Add the environment variables from step 3 *before* the first deploy, so the
   `NEXT_PUBLIC_*` values are baked into the bundle
5. **Deploy**

Every push to the branch redeploys from here on, no token or CLI involved.

## 3. Environment variables on Vercel

Settings → Environment Variables. `NEXT_PUBLIC_*` are compiled into the client
bundle, so changing one needs a redeploy, not just a restart.

| Variable | Value |
|---|---|
| `API_URL` | `https://agromagnat-api.onrender.com/api` |
| `NEXT_PUBLIC_API_URL` | `https://agromagnat-api.onrender.com/api` |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-project>.vercel.app` |
| `NEXT_PUBLIC_S3_URL` | your R2 public URL, or skip if photos are off |

`NEXT_PUBLIC_S3_URL` is what `next.config.ts` allow-lists for `next/image`. Left
unset it falls back to `localhost:9000`, and any remote photo fails to render —
harmless while there are no photos.

## 4. CORS_ORIGINS on Render

Not needed for the web app, which talks to the API server-to-server. Set it
anyway if you plan to call the API from a browser directly — a fetch from the
devtools console, or the mobile web build later:

```
CORS_ORIGINS=https://<your-project>.vercel.app
```

Render service → Environment → add it → save (this restarts the service). The
backend logs `CORS enabled for: …` on boot when it takes effect. Comma-separate
multiple origins; trailing slashes are trimmed for you.

## 5. Verify

- [ ] `https://<project>.vercel.app` opens, landing page renders
- [ ] `/qidiruv` shows the region and category filters populated — proves the
      frontend is reaching Render
- [ ] `/kirish` → any `+998…` number → code **000000** → signed in
- [ ] Post a listing (without photos) → it appears in the feed
- [ ] Open it from a second account → **Yozish** → send a message → the first
      account sees it in `/xabarlar`
- [ ] Mark the listing sold from the seller account → the buyer gets the rating
      form on the listing page → leave a rating → it shows on `/sotuvchi/<id>`
- [ ] `https://agromagnat-api.onrender.com/docs` — Swagger, deliberately on here

## Caveats

**The OTP is always `000000`.** `SMS_PROVIDER=mock` means anyone who finds the
URL can sign in as any phone number, including an admin's. This is intentional
on a test box — it costs no Eskiz credit and makes the flow testable — and it
is the reason nothing real may be entered here. If the URL is shared beyond the
team, turn on Vercel password protection.

**The API sleeps.** Render's free plan spins a service down after 15 minutes
idle; the next request takes ~50 seconds while it wakes. The first page load
after a break will look broken. It is not.

**Free Postgres expires.** Render drops free databases after their trial window.
When that happens the blueprint can simply be re-applied — the schema comes from
migrations and the reference data from the boot seed, so nothing is lost that
was not disposable anyway.

**No cron.** `listings.cron.ts` expires listings after 14 days and runs inside
the API process, so it only fires while the service happens to be awake.

**Preview deploys get their own URL,** and cookies are per-domain — a session
does not carry from one preview to the next. `NEXT_PUBLIC_SITE_URL` also stays
pointed at the production alias, so metadata on a preview is slightly wrong.
Neither matters for review.

**Indexing.** Vercel preview URLs are `noindex` automatically. The production
alias on `*.vercel.app` is not, and `robots.ts` allows crawling — so a shared
test deploy can end up in Google competing with the real domain. Password
protection or a `NEXT_PUBLIC_SITE_URL`-gated robots rule solves it if the deploy
lives longer than a few days.
