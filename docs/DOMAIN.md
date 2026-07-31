# Custom domain — agromagnat.uz

The domain is registered and attached to the Vercel project. This note records
what is wired where, what the app does about it, and the two things that still
have to be done by hand in a dashboard.

## Current state

| Host                 | DNS                        | Result                    |
| -------------------- | -------------------------- | ------------------------- |
| `agromagnat.uz`      | `A → 216.198.79.1`         | serves the site over TLS  |
| `www.agromagnat.uz`  | **no record**              | does not resolve at all   |

`http://agromagnat.uz` answers `308` to `https://` — that part is Vercel's, and
it is already correct.

## What the app does

`apps/web/lib/site.ts` derives one canonical origin and everything that has to
name the site uses it: `robots.txt`, `sitemap.xml`, `metadataBase`, the
canonical tag and the Open Graph card.

It deliberately does **not** trust `NEXT_PUBLIC_SITE_URL` verbatim. A value
pointing at `*.vercel.app` or `localhost` is treated as a deployment alias and
replaced with `https://agromagnat.uz`. That guard exists because the variable
was set to `https://agromagnat.vercel.app` during the first test deploy and
stayed there — which put the deployment alias into the live `robots.txt` and
into all 50-odd sitemap URLs, pointing Google at the wrong hostname.

`apps/web/middleware.ts` redirects any `www.` host to the apex with a `308`,
preserving path and query. So whichever way the DNS is eventually pointed, only
one hostname is ever indexed.

## Still to do by hand

Neither of these can be fixed from the repository.

### 1. Add the `www` DNS record

At the registrar's DNS panel for `agromagnat.uz`:

```
Type   Name   Value
CNAME  www    cname.vercel-dns.com
```

Use whatever target Vercel shows under **Project → Settings → Domains →
`www.agromagnat.uz`**; it occasionally differs per account. Until this record
exists, `www.agromagnat.uz` fails to resolve — the middleware redirect never
runs, because the browser never reaches Vercel.

Propagation is usually minutes, up to a few hours. Check with:

```bash
dig +short www.agromagnat.uz
curl -sI https://www.agromagnat.uz | head -1     # expect 308
```

### 2. Point the Vercel Production Branch at the branch being worked on

**Project → Settings → Git → Production Branch.**

It is currently set to a branch that no longer receives commits, so pushes do
not update production and the live domain is pinned to a manually promoted
deployment. Any rollback or redeploy from the dashboard would silently serve a
much older build.

Set it to the branch that is actually being merged into, then redeploy once so
the domain is attached to a real production deployment rather than a promoted
preview.

## Verifying after a deploy

```bash
curl -s https://agromagnat.uz/robots.txt | grep Sitemap        # agromagnat.uz
curl -s https://agromagnat.uz | grep -o '<link rel="canonical"[^>]*>'
curl -sI https://www.agromagnat.uz | head -1                   # 308 once DNS lands
```
