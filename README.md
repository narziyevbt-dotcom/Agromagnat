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
apps/mobile      Flutter app — Riverpod, Clean Architecture, feature-first
docs/            Per-feature notes
docker-compose.yml   Postgres 16 + Redis 7 + MinIO (bucket auto-created)
CLAUDE.md        Project context: stack, design system, product rules
```

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
# 4. Mobile
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
cd apps/backend && npm test          # unit tests
cd apps/mobile && flutter analyze && flutter test
```

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

| Phase | Prompt | Status |
|---|---|---|
| 0 | CLAUDE.md project context | ✅ |
| 1 | Monorepo skeleton | ✅ |
| 2 | Schema + seed | ✅ |
| 3 | Auth — SMS OTP + JWT | ⬜ |
| 4 | Listings, search, favorites | ⬜ |
| 5–10 | Mobile screens (mock-first) | ⬜ |
| 11 | Wire mobile to backend | ⬜ |
| 12–13 | Chat, reviews, push | ⬜ |
| 14–17 | AI: voice listing, pricing, moderation, search | ⬜ |
| 18 | Admin panel | ⬜ |
| 19–22 | Hardening, deploy, release, launch | ⬜ |

## Conventions

Each feature ships with a migration, API, DTO validation, tests and a short note in
`docs/`. Screens are built against mock repositories first and wired to the real API
behind the same interfaces later, so UI work never blocks on the backend.
