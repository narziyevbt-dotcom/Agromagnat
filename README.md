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
cd apps/backend && npm test && npm run test:e2e   # 61 unit, 92 e2e
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
| AI: voice listing, pricing, moderation, search | ⬜ |
| Mobile screens + wiring | ⬜ |
| Hardening, deploy, release, launch | ⬜ |

Order changed from the playbook: web ships before mobile, so the admin panel and the
AI features land on top of a working public site rather than waiting on the app.

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
