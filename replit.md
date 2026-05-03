# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (via `@clerk/react` + `@clerk/express`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Architecture

### Artifacts
- `artifacts/human-time-market` — React + Vite frontend (port from `$PORT`, preview `/`)
- `artifacts/api-server` — Express API server (port 8080, all routes under `/api`)

### Shared Libraries
- `lib/db` — Drizzle ORM schema + seed; PostgreSQL via `DATABASE_URL`
- `lib/api-spec` — OpenAPI 3.1 spec (`openapi.yaml`) + Orval codegen config
- `lib/api-client-react` — Generated React Query hooks (via Orval); `customFetch` handles auth
- `lib/api-zod` — Generated Zod schemas from OpenAPI spec (orval `mode: "single"`)

### Codegen Notes
- Orval config: `mode: "single"`, `target: "generated/api.ts"`, `clean: false`, no `schemas` option
- `lib/api-zod/src/index.ts` must stay as single-line `export * from "./generated/api"` — Orval does not regenerate it in mode:single
- After editing `openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`

## Database Schema (key tables)
- `users` — Clerk ID → display name; auto-created on first `GET /api/users/me`
- `professional_profiles` — bio, timezone, experience level, hourly rate, `isOnboarded` flag
- `skill_categories` — two-level taxonomy (parent → children); seeded via `lib/db/src/seed.ts`
- `professional_skills` — user ↔ skill category junction
- `time_listings` — marketplace listings with type (fixed_rate/auction/emergency), status, rate, schedule
- `bids` — bids on auction/emergency listings
- `rfps` — request-for-professionals posts
- `rfp_responses` — professional responses to RFPs
- `escrow_records` — placeholder escrow tracking
- `orders` — order book orders (bid/ask) per skill category, with rateCents, quantityHours, status (open/filled/cancelled/expired)
- `trades` — executed trades from matched orders (price, quantity, buyer/seller references)
- `price_snapshots` — daily VWAP snapshots per skill category for historical charting

## API Routes
- `GET /api/users/me` — get or auto-create authenticated user profile
- `PUT /api/users/me` — upsert profile (used by onboarding)
- `GET /api/users/me/skills`, `PUT /api/users/me/skills` — manage skills
- `GET/POST /api/listings` — list/create time listings
- `GET /api/listings/me` — own listings
- `GET/PATCH/DELETE /api/listings/:id` — single listing CRUD
- `POST /api/listings/:id/book` — book a fixed-rate listing
- `GET/POST /api/listings/:id/bids` — list/place bids
- `POST /api/listings/:id/bids/:bidId/accept` — accept a bid
- `GET/POST /api/rfps` — list/create RFPs
- `GET /api/rfps/:id` — single RFP
- `POST /api/rfps/:id/responses` — respond to RFP
- `GET /api/skill-categories` — nested skill taxonomy
- `GET /api/price-index` — VWAP, volume, 24h change per skill category (live market data)
- `GET /api/order-book/:skillCategoryId` — order book depth (bids/asks) for a skill category
- `GET /api/order-book/:skillCategoryId/events` — SSE stream for real-time order book updates
- `GET /api/price-history/:skillCategoryId` — daily VWAP history for charting
- `GET /api/price-index/events` — SSE stream for real-time price index updates
- `POST /api/orders` — place a bid or ask order (requires auth)
- `DELETE /api/orders/:orderId` — cancel an open order (requires auth)

## Frontend Routes
- `/` — home (redirects to marketplace or onboarding based on auth state)
- `/marketplace` — listings grid + RFP board tabs; redirects un-onboarded signed-in users to /onboarding
- `/listings/:listingId` — listing detail with bid/book/cancel actions
- `/onboarding` — 2-step profile setup (profile form → skill selection)
- `/price-index` — live time price index; terminal-style grid grouped by skill category; expandable rows show order book depth + price history chart + place order dialog
- `/dashboard`, `/profile/me`, `/profile/:userId` — other pages
- `/sign-in`, `/sign-up` — Clerk auth pages

## Order Book / Matching Engine
- Price-time priority matching engine in `artifacts/api-server/src/routes/orderBook.ts`
- Bids matched against asks when `bid.rateCents >= ask.rateCents`; trade executes at ask price
- Trades recorded in `trades` table; daily VWAP snapshots updated in `price_snapshots`
- SSE manager (`artifacts/api-server/src/lib/sseManager.ts`) broadcasts order book and price-index events to subscribed clients
- `marketRateCents` field added to listing summaries via batch VWAP lookup in `GET /api/listings`

## Key Behaviours
- `GET /api/users/me` auto-creates a minimal user row for new Clerk users (returns 200 with `isOnboarded:false`)
- `MarketplaceRoute` wrapper checks onboarding status; redirects signed-in un-onboarded users to `/onboarding`
- Clerk cache invalidator (`ClerkQueryClientCacheInvalidator`) only clears React Query cache on sign-out or user switch — NOT on initial sign-in (prevents render loops)
- Skill categories API returns nested data (`children[]` inside each parent); UI components must use `parent.children`, not a flat filter
- `Select` components use `SelectGroup`/`SelectLabel` for parent headers and `SelectItem` for child categories
