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
- AI: an AiService abstraction with two providers — `local` (Uzbek keyword lexicon, no key,
  no cost, the default) and `anthropic` (Claude, with `local` underneath as the fallback).
  Voice transcription stays on an OpenAI-compatible endpoint. See docs/AI.md
- Web: Next.js (App Router, SSR) for the public marketplace - listings must be
  indexable by Google; admin panel lives in the same Next.js app under /admin
  behind a role guard (a separate Vite app would duplicate the API client,
  session handling and design tokens for no gain)
- Monorepo: apps/web, apps/mobile, apps/backend, docker-compose (Postgres + Redis + MinIO)

## Design system (follow exactly)
Green-dominant. Tokens live in apps/web/app/globals.css - take colours and type from
there, never inline a hex.
- Colors: forest #0B1D14 all dark chrome (sidebar, site header, dark cards), lime #D4E96A
  CTAs and ONE filled card per screen, harvest #1F7A4D money/volume/positive deltas,
  turquoise #1D7F8C trust marks (verified, ratings), error #C4452F, page canvas #ECEEEA,
  cards #FFFFFF on hairline #E4E9E4
- Font: Plus Jakarta Sans for everything - headings, body and numbers alike. There is no
  monospace. Numbers use the `.numeric` utility (tabular figures + tight tracking) so
  price columns still align; oversized dashboard figures use `.figure-xl`
- Shape: rounded-3xl cards, rounded-full buttons and pills, generous padding (p-5/p-6),
  shadow-sm with ring-1 ring-hairline rather than borders
- The dashboard sits in a floating window (`.app-window`) inset from the page canvas
- Primary CTA is a lime pill with the arrow in its own forest circle
- Every listing card shows volume ("12 t") as a green chip - as prominent as price
- Location format "Region - District", tap targets >=44px
- Bottom nav: Home, Search, big lime "+", Messages, Profile. TOP badge in saffron

## Product rules
- Listing required: category, volume+unit, price+unit, region, district. Optional: min_order,
  harvest_date, delivery
- Statuses: draft/active/sold/expired/blocked; auto-expire after 14 days
- Voice-first posting: mic on Add Listing -> AI transcribes -> fills the whole form
- Mock-first: screens ship on mock repositories, real API wired later behind same interfaces
- The posting form is category-aware. Every category has a `kind` (produce | supply |
  machinery | service | land) and each kind decides which questions get asked — machinery is
  counted in `dona` and never asked for kilos or a harvest date. The spec comes from the API,
  the clients only render it. Never hardcode a per-category form. See docs/CATEGORY-FORMS.md
- AI drafts, it never publishes. `POST /ai/draft` returns form values plus `missingUz`; the
  seller reviews and submits through the ordinary listing endpoint with the same validation
- Home is two pages behind one URL: the marketing landing signed out, the app
  (search -> categories -> feed) signed in

## Build order
Web first, then mobile. Both consume the same backend API, so a feature is built once on the
backend and rendered twice. Design tokens are defined once per platform and never inlined.

## Workflow
For every feature deliver: DB migration + API + DTO validation + tests + short note in docs/. Ask before
destructive changes.
