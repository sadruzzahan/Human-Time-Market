# Human Time Market

Clerk-authenticated **marketplace for professional time**: listings (fixed rate, auction, emergency), RFPs, an **order book** with price–time matching, **SSE** streams for live prices and depth, secondary resale, time **options**, **swaps**, **bundles**, and a derivatives portfolio view. Implemented as a pnpm monorepo (`artifacts/human-time-market` + `artifacts/api-server`) with PostgreSQL and Drizzle.

## Tech stack

- **Frontend:** React 19, Vite, Wouter, TanStack Query, Tailwind 4, Radix/shadcn-style UI, `@clerk/react`.
- **API:** Express 5, `@clerk/express`, Pino, Drizzle ORM, Zod (see workspace `replit.md`).
- **Data:** PostgreSQL (`DATABASE_URL`); schema covers users, profiles, skills, listings, bids, RFPs, orders, trades, price snapshots, escrow placeholder, derivatives tables (see `replit.md`).

## Project structure

| Path | Role |
|------|------|
| `artifacts/human-time-market/` | SPA (`$PORT`, base `/` in dev per `replit.md`). |
| `artifacts/api-server/` | REST + SSE under `/api` (API port 8080 in `replit.md` notes). |
| `lib/db/` | Drizzle schema + seed (`pnpm --filter @workspace/db run push`). |
| `lib/api-spec/` | OpenAPI + Orval (`pnpm --filter @workspace/api-spec run codegen`). |
| `lib/api-client-react/`, `lib/api-zod/` | Generated client and validators. |
| `replit.md` | Authoritative architecture: DB tables, API list, frontend routes, matching engine. |

## Setup

```bash
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-spec run codegen
```

Configure Clerk and Postgres before exercising auth routes.

## Environment variables

From `artifacts/api-server` code paths:

| Variable | Description |
|----------|-------------|
| `PORT` | API listen port (`src/index.ts`). |
| `DATABASE_URL` | PostgreSQL connection (`lib/db`). |
| `NODE_ENV` | `development` / `production`, etc. |
| `LOG_LEVEL` | Pino level (default `info`). |
| `CLERK_SECRET_KEY` | Server-side Clerk secret (proxy middleware in production). |
| `CLERK_PUBLISHABLE_KEY` | Publishable key for `clerkMiddleware` host resolution. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins; entries trimmed. |
| `REPLIT_DEV_DOMAIN` | When set, `https://<domain>` is appended to CORS allowlist. |
| `RESEND_API_KEY` | Optional transactional email (`lib/email.ts`). |
| `EMAIL_FROM` | From header override (default `Human Time Market <noreply@htm.local>`). |
| `APP_URL` | Base URL for links; falls back with `REPLIT_DEV_DOMAIN` in `email.ts`. |

**Frontend:** set `VITE_CLERK_PUBLISHABLE_KEY` and any Vite `PORT` / `BASE_PATH` required by `vite.config.ts`.

## How to run

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/human-time-market run dev
```

Align SPA API base URL with your deployment (same-origin `/api` or proxy).

## API (summary)

All prefixes below are under **`/api`** (see `replit.md` for the canonical list):

- **Users:** `GET /users/me`, `PUT /users/me`, skills on `/users/me/skills`.
- **Listings:** CRUD, book, bids, accept bid.
- **RFPs:** list/create, detail, responses.
- **Market data:** `GET /skill-categories`, `GET /price-index`, `GET /price-history/:skillCategoryId`, `GET /order-book/:skillCategoryId`, SSE `.../events` and `/price-index/events`.
- **Orders:** `POST /orders`, `DELETE /orders/:orderId`.
- **Secondary / options / swaps / bundles:** routes under `/secondary-market`, `/options`, `/swaps`, `/bundles` with purchase/exercise/accept/decline where applicable.
- **Portfolio:** `GET /derivatives/portfolio` (auth).

## Frontend routes (from `replit.md`)

`/`, `/marketplace`, `/listings/:listingId`, `/onboarding`, `/price-index`, `/secondary-market`, `/derivatives`, `/dashboard`, `/profile/me`, `/profile/:userId`, `/sign-in`, `/sign-up`.

## Features (behavioral)

- Onboarding gate on marketplace for signed-in users without completed profile.
- Order book matching: bids vs asks when `bid.rateCents >= ask.rateCents`; trades and VWAP snapshots updated; SSE broadcasts via `sseManager.ts`.
- Clerk session integration with documented cache-invalidator rules (`replit.md`).

## License

See root `package.json`.
