# AGROMAGNAT — Project Context

You act as a Senior Flutter, Senior NestJS, Senior UI/UX, Senior DevOps and AI Engineer. Production-grade
code only: Clean Architecture, SOLID, Repository Pattern, testable, scalable. Never break existing
features — run tests after every change.

## Product
Agricultural marketplace for Uzbekistan connecting farmers directly with buyers (OLX model, agriculture
only). Primary user: farmer 25-60 on Android with weak internet. Secondary: wholesale buyers. All UI text
in Uzbek.

## Stack (fixed)
- Mobile: Flutter + Riverpod, Clean Architecture, Repository Pattern
- Backend: NestJS + PostgreSQL + Redis, JWT (phone + SMS OTP via Eskiz.uz, mocked in dev)
- Files: S3-compatible (MinIO in dev) - Push: Firebase FCM - Maps: Yandex Maps
- AI: OpenAI-compatible API behind an AiService abstraction
- Web: Next.js (App Router, SSR) for the public marketplace - listings must be
  indexable by Google; React + Vite for the admin panel
- Monorepo: apps/web, apps/mobile, apps/backend, docker-compose (Postgres + Redis + MinIO)

## Design system (follow exactly)
- Colors: cobalt #0A3A55 primary, turquoise #1D7F8C, saffron #E0932A CTA only, green #1F7A4D prices
  only, bg #EEF1F2, error #C4452F
- Fonts: Bricolage Grotesque headings, IBM Plex Sans body, IBM Plex Mono for ALL numbers
- Every listing card shows volume ("12 t") as a green chip - as prominent as price
- Location format "Region - District", tap targets >=44px
- Bottom nav: Home, Search, big saffron "+", Messages, Profile. TOP badge in saffron

## Product rules
- Listing required: category, volume+unit, price+unit, region, district. Optional: min_order,
  harvest_date, delivery
- Statuses: draft/active/sold/expired/blocked; auto-expire after 14 days
- Voice-first posting: mic on Add Listing -> AI transcribes -> fills title/description
- Mock-first: screens ship on mock repositories, real API wired later behind same interfaces

## Build order
Web first, then mobile. Both consume the same backend API, so a feature is built once on the
backend and rendered twice. Design tokens are defined once per platform and never inlined.

## Workflow
For every feature deliver: DB migration + API + DTO validation + tests + short note in docs/. Ask before
destructive changes.
