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
npm run migration:run     # creates all 12 tables
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
cd apps/backend && npm test && npm run test:e2e   # 22 unit + 44 e2e
cd apps/web && npx tsc --noEmit && npm run build
cd apps/mobile && flutter analyze && flutter test
```

The e2e suite runs against the real Postgres, Redis and MinIO from docker-compose,
so bring the stack up first.

## Design system

Cobalt and turquoise, not green. The screen is already full of green, red and yellow
produce photography; a green interface swallows the product, while cobalt makes the
photos stand out and separates Agromagnat from every other agro app on the market.

| Token | Hex | Used for |
|---|---|---|
| Cobalt | `#0A3A55` | Primary — headers, nav, price card |
| Turquoise | `#1D7F8C` | Secondary, verified badge |
| Saffron | `#E0932A` | **CTA and TOP badge only** |
| Harvest green | `#1F7A4D` | **Prices and volumes only** |
| Error | `#C4452F` | Errors, falling prices |
| Background | `#EEF1F2` | App background |

Three font roles: Bricolage Grotesque for headings, IBM Plex Sans for body,
**IBM Plex Mono for every number without exception** — monospace digits align
column-wise, so a farmer can compare a list of prices at a glance.

Tap targets are never below 44px, and location always reads `Viloyat · Tuman`.

Tokens live in `apps/mobile/lib/core/theme/`. Take colours and type from there rather
than writing them inline — that is what keeps saffron confined to CTAs.

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
| Chat, reviews, push | ⬜ |
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

## Conventions

Each feature ships with a migration, API, DTO validation, tests and a short note in
`docs/`. Screens are built against mock repositories first and wired to the real API
behind the same interfaces later, so UI work never blocks on the backend.
