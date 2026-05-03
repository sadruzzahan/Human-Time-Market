# Human Time Market

A **time-as-a-commodity** marketplace prototype: professionals list time (fixed rate, auction, emergency), buyers bid and book, and the stack adds an **order book**, **price index** (VWAP, SSE), **secondary market**, **time options**, **swaps**, and **bundles**. Auth and identity are handled by **Clerk**; profiles, listings, and market data live in **PostgreSQL** (Drizzle ORM).

## Stack

| Layer | Technology |
|--------|------------|
| Monorepo | pnpm workspaces, Node.js 24, TypeScript 5.9 |
| API | Express 5, `@clerk/express`, pino, `http-proxy-middleware` (Clerk Frontend API proxy in production) |
| Database | PostgreSQL, Drizzle ORM, `drizzle-kit push`, optional `tsx` seed (`pnpm --filter @workspace/db run seed`) |
| Contract | OpenAPI 3.1 (`lib/api-spec/openapi.yaml`), Orval → `@workspace/api-client-react`, `@workspace/api-zod` |
| Frontend | React 19, Vite 7, wouter, Tailwind CSS 4, TanStack Query, Radix UI, Recharts, `@clerk/react` |
| Email | Resend (optional; stubs to logs if `RESEND_API_KEY` unset) |

## Repository structure

```
├── artifacts/
│   ├── human-time-market/   # Main SPA
│   ├── api-server/          # Express app, routes under `/api`
│   └── mockup-sandbox/      # UI sandbox
├── lib/
│   ├── db/                  # Schema, seed, migrations push
│   ├── api-spec/, api-zod/, api-client-react/
├── replit.md                # Full route list, schema, matching engine notes
└── package.json             # Root workspace (pnpm only)
```

## Prerequisites

- Node.js **24** and **pnpm**
- **PostgreSQL** and a `DATABASE_URL`
- **Clerk** application (publishable + secret keys for production proxy behavior)

## Environment variables

### API (`artifacts/api-server`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | yes | HTTP listen port (e.g. `8080`) |
| `DATABASE_URL` | yes* | Postgres URL — required whenever route handlers use the DB (normal operation) |
| `CLERK_PUBLISHABLE_KEY` | yes | Passed to `clerkMiddleware` / `publishableKeyFromHost` |
| `CLERK_SECRET_KEY` | prod recommended | Enables `/api/__clerk` → Clerk Frontend API proxy when `NODE_ENV=production` |
| `CORS_ALLOWED_ORIGINS` | yes for browser SPA | Comma-separated allowed origins (credentials enabled). If `REPLIT_DEV_DOMAIN` is set, `https://<that>` is appended automatically |
| `NODE_ENV` | no | `production` enables Clerk proxy middleware branch |
| `LOG_LEVEL` | no | pino level (default `info`) |
| `REPLIT_DEV_DOMAIN` | no | Appended to CORS allow-list as `https://...` |
| `EMAIL_FROM` | no | Default `Human Time Market <noreply@htm.local>` |
| `RESEND_API_KEY` | no | If unset, outbound email is logged only (`src/lib/email.ts`) |
| `APP_URL` | no | Base URL for links inside email HTML (see `email.ts` for fallbacks with `REPLIT_DEV_DOMAIN`) |

\* `DATABASE_URL` is read from `lib/db` / pool; the API will fail on DB access without it.

### Frontend (`artifacts/human-time-market`)

Vite requires **`PORT`** and **`BASE_PATH`** (same pattern as other Replit Vite artifacts).

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | yes | Thrown at startup if missing (`App.tsx`) |
| `VITE_CLERK_PROXY_URL` | no | Passed to `<ClerkProvider proxyUrl={...}>` (use when proxying Clerk through the API) |
| `NODE_ENV`, `REPL_ID` | no | Replit-only Vite plugins when non-production + `REPL_ID` set |

The SPA calls **`/api`** on the **same origin** as the loaded page (cookies / Clerk). Coordinate `BASE_PATH`, hosting, and `CORS_ALLOWED_ORIGINS` so the browser origin matches an allowed entry.

### Database CLI (`lib/db`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Required for `pnpm --filter @workspace/db run push` (and `seed`) |

## Setup

```bash
pnpm install
pnpm run typecheck
pnpm --filter @workspace/db run push
pnpm --filter @workspace/db run seed   # optional: skill taxonomy + seeds
```

After editing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Run commands

**API:**

```bash
set PORT=8080
set DATABASE_URL=postgres://...
set CLERK_PUBLISHABLE_KEY=pk_...
set CORS_ALLOWED_ORIGINS=http://localhost:5173
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

(The `dev` script uses Unix `export`; on Windows set env vars explicitly or use Git Bash.)

**Frontend:**

```bash
set PORT=5173
set BASE_PATH=/
set VITE_CLERK_PUBLISHABLE_KEY=pk_...
pnpm --filter @workspace/human-time-market run dev
```

**Workspace:**

- `pnpm run typecheck` — all workspace packages that define `typecheck`
- `pnpm run build` — typecheck then recursive `build`

## Features

- **Profiles & onboarding** — Clerk user synced to `users` / `professional_profiles` / skills (`GET/PUT /api/users/me`, skill endpoints)
- **Listings & bids** — create listings, book fixed-rate, auction bids, accept bid (`/api/listings`, `/api/listings/:id/bids`, …)
- **RFPs** — post and respond (`/api/rfps`, …)
- **Skill taxonomy** — nested categories (`GET /api/skill-categories`)
- **Order book & matching** — price-time matching, trades, VWAP snapshots (`/api/orders`, `/api/order-book/...`, SSE events)
- **Price index** — live grid + history (`/api/price-index`, `/api/price-history/...`, SSE)
- **Derivatives-style products** — secondary listings, options, swaps, bundles (`/api/secondary-market`, `/api/options`, `/api/swaps`, `/api/bundles`, `/api/derivatives/portfolio`)

See **`replit.md`** for the authoritative bullet list of endpoints, tables, frontend routes, and matching rules.

## HTTP API

- **OpenAPI:** `lib/api-spec/openapi.yaml` — base path `/api`, version 0.2.0, tags include health, users, skill-categories, listings, bids, rfps, order-book, and additional domains per spec.
- **Health:** `GET /api/healthz`
- **Clerk proxy (production):** `POST/GET …` under `/api/__clerk` when proxy middleware is active (`CLERK_SECRET_KEY` + `NODE_ENV=production`)

## Frontend routes (summary)

| Area | Paths |
|------|--------|
| Auth | `/sign-in`, `/sign-up` |
| Core | `/`, `/marketplace`, `/onboarding`, `/listings/:listingId`, `/dashboard`, `/profile/me`, `/profile/:userId` |
| Markets | `/price-index`, `/secondary-market`, `/derivatives` |

Details and guards (e.g. onboarding redirects) are in **`replit.md`**.
