# Agromagnat

> Yerdan dasturxongacha — vositachisiz.

An agricultural marketplace for Uzbekistan that connects farmers directly with buyers.
The model is a classifieds board, specialised for one thing: produce sold by volume.
Every listing carries a mandatory quantity and unit, prices are indexed daily, and
seasonality is shown on the listing itself — the gaps a general classifieds site leaves open.

Built from the *Agromagnat — To'liq qo'llanma* playbook, prompt by prompt.

## Repository layout

```
apps/backend     NestJS API — Postgres, Redis, S3, Swagger
apps/web         Next.js public marketplace — SSR, so listings are indexable
apps/mobile      Flutter app — Riverpod, Clean Architecture, feature-first
docs/            Per-feature notes
docker-compose.yml   Postgres 16 + Redis 7 + MinIO (bucket auto-created)
CLAUDE.md        Project context: stack, design system, product rules
```

Web is being built before mobile. Both consume the same API, so a feature is built
once on the backend and rendered twice.

## Prerequisites

- Docker and Docker Compose
- Node.js 20+
- Flutter 3.44+ (Android first — that is where 90%+ of the audience is)

## Running it

```bash
# 1. Environment
cp .env.example .env

# 2. Infrastructure — Postgres, Redis, MinIO
docker compose up -d

# 3. Backend
cd apps/backend
npm install
cp ../../.env .env
npm run migration:run     # creates all 13 tables
npm run seed              # 14 regions, 198 districts, 12 categories
npm run seed:demo         # optional: 6 months of listings and sales
npm run price:snapshot 2026-06-01 2026-07-31   # optional: fill the price index
npm run start:dev
```

- API: <http://localhost:3000/api>
- Health: <http://localhost:3000/health>
- Swagger: <http://localhost:3000/docs>
- MinIO console: <http://localhost:9001>

```bash
# 4. Web (public marketplace)
cd apps/web
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3001
```

```bash
# 5. Mobile
cd apps/mobile
flutter pub get
flutter run
```

## Verifying a fresh setup

```bash
curl http://localhost:3000/health                 # postgres + redis both "up"
curl http://localhost:3000/api/categories         # 12
curl http://localhost:3000/api/regions            # 14
```

```bash
cd apps/backend && npm test && npm run test:e2e   # 153 unit, 171 e2e
cd apps/web && npx tsc --noEmit && npm run build
cd apps/mobile && flutter analyze && flutter test
```

The e2e suite runs against the real Postgres, Redis and MinIO from docker-compose,
so bring the stack up first.

## Design system

Green-dominant, forest for chrome. The cards stay white and the produce photo is still
the loudest thing on a listing — what changed is everything around it: the sidebar,
header and dark panels are deep forest rather than cobalt, which reads as agriculture
on sight instead of as a fintech app that happens to sell vegetables.

| Token | Hex | Used for |
|---|---|---|
| Forest | `#0B1D14` | All dark chrome — sidebar, site header, dark cards |
| Lime | `#D4E96A` | **CTAs and one filled card per screen, nothing else** |
| Harvest green | `#1F7A4D` | **Money, volume and positive deltas, nothing else** |
| Turquoise | `#1D7F8C` | Trust marks — verified badge, ratings |
| Error | `#C4452F` | Errors, falling prices |
| Canvas | `#ECEEEA` | The page the app window floats on |
| Surface | `#FFFFFF` | Cards, on `#E4E9E4` hairlines |

One font: **Plus Jakarta Sans**, headings and body and numbers alike. There is no
monospace. Alignment in a price column is bought with tabular figures instead — the
`.numeric` utility — so a farmer can still compare a list at a glance without every
figure reading as a code listing. Oversized dashboard numbers use `.figure-xl`.

Cards are `rounded-3xl` with `shadow-sm ring-1 ring-hairline`; buttons and pills are
fully round. The dashboard sits in a floating window (`.app-window`) inset from the
canvas. The primary CTA is a lime pill with its arrow in a forest circle.

Tap targets are never below 44px, and location always reads `Viloyat · Tuman`.

Web tokens live in `apps/web/app/globals.css`, mobile tokens in
`apps/mobile/lib/core/theme/`. Take colours and type from there rather than writing
them inline — that is what keeps lime confined to CTAs.

## Build progress

| Step | Status |
|---|---|
| CLAUDE.md project context | ✅ |
| Monorepo skeleton | ✅ |
| Schema + seed | ✅ |
| Auth — SMS OTP + JWT | ✅ |
| Listings, search, favorites | ✅ |
| **Public web marketplace** | ✅ |
| Landing page + seller dashboard | ✅ |
| Production deploy artifacts (Docker, nginx, CI/CD, backups) | ✅ |
| Admin panel (moderation, users, reports) | ✅ |
| **Chat, reviews, push** | ✅ |
| **AI: category suggestion, voice listing, help assistant** | ✅ |
| **Price recommendation + market index** | ✅ |
| **Offers, negotiation and deal completion** | ✅ |
| **AI smart search (natural language → filters)** | ✅ |
| **Google sign-in, phone gate, Telegram OTP** | ✅ |
| AI: moderation, image validation | ⬜ |
| Mobile screens + wiring | ⬜ |
| Hardening, deploy, release, launch | ⬜ |

Order changed from the playbook: web ships before mobile, so the admin panel and the
AI features land on top of a working public site rather than waiting on the app.

## AI

Two providers behind one `AiService` interface, chosen at boot from
`AI_PROVIDER`:

- `local` (the default) is an Uzbek keyword lexicon and a sentence parser. No
  key, no network, no cost — "12 tonna pomidor, kilosi 14 ming so'm" resolves to
  a category, a volume and a price without leaving the process.
- `anthropic` puts Claude on top of it and keeps `local` underneath as the
  fallback, so an API outage degrades the feature instead of breaking posting.

It powers three things: the category that gets selected as a seller types, the
"AI writes the listing" panel (with browser dictation, in Uzbek), and the help
assistant in the corner of every signed-in page. Details, cost and the
structured-output gotchas are in [docs/AI.md](docs/AI.md).

## Price recommendation

The one number a horizontal classifieds site cannot produce: what this crop
actually sold for, in this region, over the last two months. It sits under the
price field on the posting form, with its range, its sample size and where the
figure came from.

It is percentiles over real listings, not a model — a language model asked what
tomatoes should cost returns a confident number with nothing behind it, and a
farmer would act on it. A nightly job snapshots the index into `price_index` so
today cannot retroactively change what last month looked like. See
[docs/PRICING.md](docs/PRICING.md).

## Offers and deals

Buyers and sellers negotiate inside the conversation instead of on the phone.
Accepting an offer closes the sale at the agreed price in one transaction —
which is what finally makes reviews reachable without asking a seller to
delist their own advert, and what gives the price index real clearing prices
rather than asking prices. See [docs/OFFERS.md](docs/OFFERS.md).

## Category-aware forms

Every category has a `kind`, and each kind decides which questions the posting
form asks. Machinery is counted in `dona` and asked for a year and a condition;
land is measured in hectares and asked about irrigation; only produce gets a
harvest date. The spec is served by the API and rendered by the clients, so
adding a field is a backend change — see
[docs/CATEGORY-FORMS.md](docs/CATEGORY-FORMS.md).

## Deploying

Production runs as Docker containers behind nginx with Let's Encrypt TLS —
`docker-compose.prod.yml` plus `deploy/`. The full step-by-step for a fresh
Ubuntu 24 server is in [docs/DEPLOY.md](docs/DEPLOY.md). User data must be
hosted inside Uzbekistan, which constrains the choice of provider — see the
note at the top of that document.

For a throwaway review environment on real URLs — web on Vercel, API on Render —
see [docs/DEPLOY-TEST.md](docs/DEPLOY-TEST.md). It is not production and cannot
be: the OTP is mocked there, so anyone can sign in as anyone.

## Conventions

Each feature ships with a migration, API, DTO validation, tests and a short note in
`docs/`. Screens are built against mock repositories first and wired to the real API
behind the same interfaces later, so UI work never blocks on the backend.
