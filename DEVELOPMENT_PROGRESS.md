# TechCart — Development Progress

Learning project: Stripe integration across Next.js, NestJS and PostgreSQL.
Full plan: [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md)

_Last updated: 2026-11-12_

## Current status

- **Current phase:** Phase 3 complete (PR into `dev` pending). Waiting for approval to start Phase 4
- **Current branch:** `feature/p3-cart` (one branch and one PR for the phase, one commit per task)
- **Next task:** Phase 4 ★ hosted Stripe Checkout: orders + stock reservation, Stripe Customer, Checkout Session, Pay button
- **Revision notes:** [docs/STRIPE_NOTES.md](docs/STRIPE_NOTES.md), updated at every phase end per [docs/STRIPE_NOTES_PROMPT.md](docs/STRIPE_NOTES_PROMPT.md)

## How to run

```bash
pnpm install                      # once, from the repo root
cp apps/api/.env.example apps/api/.env   # once
pnpm db:up                        # Postgres 18 in Docker on 127.0.0.1:5435
pnpm --filter api db:migrate      # apply migrations (and create one after a schema edit)
pnpm --filter api db:generate     # Prisma 7: migrate no longer generates the client
pnpm --filter api db:seed         # Prisma 7: never runs automatically; safe to re-run
pnpm dev                          # web http://localhost:3000, api http://localhost:4000/api
```

- `http://localhost:3000/api/*` is proxied to the API, so the browser only ever talks to the web app.
- Health check: `curl http://localhost:3000/api/health` should return `{"status":"ok","database":"up"}` (503 if Postgres is down).
- Stripe check: `curl http://localhost:3000/api/payments/health` should return `livemode: false`, `apiVersion`, `requestId` (503 if the key is wrong).
- Catalog: `curl http://localhost:3000/api/products` (9 active products) and `curl http://localhost:3000/api/products/orbit-mini`.
- Store pages: http://localhost:3000 (product grid) and http://localhost:3000/products/orbit-mini (detail).
- Cart (needs a demo user): `curl -H "x-demo-user-id: demo-sarah" http://localhost:3000/api/cart`. In Swagger, click **Authorize** and enter `demo-sarah`. Users: `GET /api/demo-users`.
- Swagger UI: http://localhost:4000/api/docs (OpenAPI JSON at `/api/docs-json`). Use **Try it out → Execute** on any endpoint.
- Inspect data: `pnpm --filter api db:studio --port 5555`, then open http://localhost:5555.
- Store as a user: pick a demo user in the header dropdown (saved in the `demoUserId` cookie), add products, open http://localhost:3000/cart.
- Run `pnpm dev` from the **repo root** to start both apps. Inside `apps/api` it starts only the API.

## Phases

| # | Phase | Status |
|---|---|---|
| 0 | Foundation & Stripe account setup | ✅ Done (2026-11-11) |
| 1 | Stripe fundamentals lab | ✅ Done (2026-11-11) |
| 2 | Feature: product catalog | ✅ Done (2026-11-12) |
| 3 | Feature: demo users + cart | ✅ Done (2026-11-12) |
| 4 | Feature: hosted Stripe Checkout | ⬜ Pending |
| 5 | Feature: webhooks & payment confirmation | ⬜ Pending — 🏁 Milestone 1 (`v0.1.0`) |
| 6 | Payment reliability & reconciliation | ⬜ Pending |
| 7 | Refunds & order management | ⬜ Pending — 🏁 Milestone 2 (`v0.2.0`) |
| 8 | PaymentIntents + Payment Element comparison | ⬜ Pending |
| 9 | Advanced: capture, async methods, disputes, fraud, abandoned checkouts | ⬜ Pending |
| 10 | Testing & production readiness | ⬜ Pending — 🏁 Milestone 3 (`v1.0.0`) |
| 11 | Extensions: thin events, `ui_mode: 'elements'` | ⬜ Optional |

### Phase 0 tasks

- [x] 1. Git repo (`main`, `dev`, feature branch), `.gitignore`, `.gitattributes`, README, progress file
- [x] 2. pnpm workspace + Next.js (`apps/web`) and NestJS (`apps/api`) skeletons. API on :4000 under `/api`; web proxies `/api/*` to it; tests and lint pass
- [x] 3. Docker Compose Postgres + Prisma 7 in `apps/api`, `GET /api/health` (checks DB, 503 when down)
- [x] 4. `.env.example` files + zod env validation at API startup (folded into task 3)
- [x] 5. Stripe sandbox (US) test key in `apps/api/.env` (validated: `sk_test_`/`rk_test_` only); Stripe CLI installed and logged in; `GET /v1/balance` verified via CLI, raw curl and API boot

### Phase 2 tasks

- [x] 1. `Category`/`Product`/`Inventory` models + first migration (`catalog`); re-runnable seed (4 categories, 10 products incl. edge cases); `GET /api/products`, `GET /api/products/:slug` (404 for unknown or inactive), in Swagger. API restructured into `src/modules/{health,product,payment}` (controller/service/module each)
- [x] 2. Product grid (`/`) and detail page (`/products/[slug]`, 404 for unknown or inactive) in `apps/web`; prices formatted from cents for display only; stock labels; `next build` passes with Cache Components

### Phase 3 tasks

- [x] 1. `User` (+ `stripeCustomerId`, unused until Phase 4) and `CartItem` models + migration `demo_users_cart`; 3 seeded demo users; `DemoUserGuard` + `@CurrentUser()`; `GET /api/demo-users`; `GET /api/cart`, `POST /api/cart/items`, `PATCH`/`DELETE /api/cart/items/:itemId`; zod body validation; Swagger Authorize
- [x] 2. Web: demo-user dropdown in the header (cookie), add-to-cart button on the product page, `/cart` page with −/+/remove and a display-only subtotal; `next build` passes

## Important commits

Recorded at each milestone (hashes from `git log --oneline`).

| Commit | Description |
|---|---|
| — | — |

## Technical decisions

Full reasoning lives in plan §10. One line each:

| # | Date | Decision |
|---|---|---|
| D1 | 2026-11-11 | Hosted Checkout (`ui_mode: hosted_page`) is the primary payment flow |
| D2 | 2026-11-11 | PaymentIntents + Payment Element built only as a comparison flow (Phase 8) |
| D3 | 2026-11-11 | Inline `price_data`; our DB is the source of truth for prices |
| D4 | 2026-11-11 | Money as integer minor units; USD only |
| D5 | 2026-11-11 | Customers v1 API (Accounts v2 customers are still preview outside Connect) |
| D6 | 2026-11-11 | Stripe API version pinned in code and on the webhook endpoint |
| D7 | 2026-11-11 | Snapshot webhook events first; thin events later (Phase 11) |
| D8 | 2026-11-11 | Webhook is the source of truth; success page re-verifies server-side with the same idempotent function |
| D9 | 2026-11-11 | Stock reserved at order creation; Checkout session expires after 30 min |
| D10 | 2026-11-11 | Order has many Payments (one per attempt) |
| D11 | 2026-11-11 | `StripeEvent` table for dedup + guarded status transitions in DB transactions |
| D12 | 2026-11-11 | Webhooks processed synchronously (no queue infrastructure) |
| D13 | 2026-11-11 | Only the payment module (`modules/payment/`) imports the Stripe SDK |
| D14 | 2026-11-11 | Seeded demo users via `x-demo-user-id` header; no real auth |
| D15 | 2026-11-11 | pnpm workspace monorepo: `apps/web` + `apps/api` |
| D16 | 2026-11-11 | PostgreSQL in Docker Compose; Prisma 7 (Prisma 8 is still RC) |
| D17 | 2026-11-11 | Keep Nest 12 defaults: ESM-only, Vitest for tests, oxlint for lint |
| D18 | 2026-11-11 | Next.js `rewrites` proxies `/api/*` to NestJS (`API_URL`, default `http://localhost:4000`) |
| D19 | 2026-11-11 | Keep Next 16 generator defaults (`cacheComponents`, `partialPrefetching`); revisit only if they get in the way |
| D20 | 2026-11-11 | Build webhook verification and idempotency by hand first; compare with Nest's `@nestjs/webhooks` / `@nestjs/idempotency` afterwards |
| D21 | 2026-11-11 | Practical testing only: no `*.spec.ts` files; each task ends with a manual test recipe (curl, Stripe CLI, Dashboard, DB rows) |
| D22 | 2026-11-11 | Postgres on host port 5435, bound to 127.0.0.1; `DATABASE_URL` uses `127.0.0.1`, not `localhost` |
| D23 | 2026-11-11 | Prisma 7.10 config file is `prisma7.config.ts` (7.10 treats `prisma.config.ts` as legacy); generated client in `src/generated/prisma` (git-ignored) |
| D24 | 2026-11-11 | Env validated with zod via `ConfigModule.forRoot({ validate })`; the API won't start with missing or bad settings |
| D25 | 2026-11-11 | `STRIPE_SECRET_KEY` must be a sandbox key (`sk_test_`/`rk_test_`); live keys are rejected at startup |
| D26 | 2026-11-11 | Use the sandbox secret key while learning; switch to a restricted key (`rk_test_`) in Phase 10 (Stripe recommends RAKs for production) |
| D27 | 2026-11-11 | One Stripe client via Nest provider token `STRIPE_CLIENT` in `modules/payment/` (pinned `2026-10-28.endive`, `maxNetworkRetries: 2`, `timeout: 20s`) |
| D28 | 2026-11-11 | Inline `price_data` confirmed: PaymentIntents don't use Prices, and our DB stays the price source of truth |
| D29 | 2026-11-11 | `docs/STRIPE_NOTES.md` is the revision sheet (cheat sheet + per-phase sequence/why/gotchas/Q&A), updated each phase |
| D30 | 2026-11-11 | Swagger (`@nestjs/swagger` 12.1.1) at `/api/docs` for manual testing next to curl; `@scarf/scarf` install-analytics script denied in `allowBuilds` |
| D31 | 2026-11-11 | One GitHub PR per feature branch into `dev` (merge commit, no squash/rebase); `.github/pull_request_template.md`; milestone PRs `dev` → `main` |
| D32 | 2026-11-12 | Small phases use one branch + one PR per phase, one commit per task (Phase 2: `feature/p2-catalog`) |
| D33 | 2026-11-12 | IDs are `cuid()` strings; stock lives in a separate `Inventory` row (1–1 with `Product`) so reservation updates touch only stock |
| D34 | 2026-11-12 | Products are soft-hidden with `isActive`, never deleted, so future orders keep valid references |
| D35 | 2026-11-12 | Product API returns an explicit Prisma `select` (public fields only); lookup by slug uses `findUnique` (slug is `@unique`) |
| D36 | 2026-11-12 | Seed upserts by slug and never resets stock; includes edge-case products: 1 in stock (`orbit-mini`), 0 in stock (`echo-buds`), $0.35 below Stripe's $0.50 minimum (`cable-ties`), inactive (`retro-dock`) |
| D37 | 2026-11-12 | Seed runs with `tsx` (Prisma's documented runner); esbuild's install script denied in `allowBuilds` (pnpm already installs its platform binary) |
| D38 | 2026-11-12 | Product images are placeholder PNG URLs (placehold.co) so Stripe Checkout can display them later via `product_data.images` |
| D39 | 2026-11-12 | Feature modules live in `src/modules/<name>/` (singular) as `<name>.controller.ts` / `.service.ts` / `.module.ts`. Controllers handle HTTP only; services are the only place that calls Prisma or Stripe. Infrastructure (`prisma/`, `config/`, `generated/`) stays outside `modules/`. URLs stay plural (`/api/products`) |
| D40 | 2026-11-12 | Server Components call NestJS directly at `API_URL`; only the browser uses the `/api` proxy. Catalog fetches are uncached (no `"use cache"`) so stock and prices are fresh |
| D41 | 2026-11-12 | One root `app/loading.tsx` provides the Suspense boundary Cache Components requires for request-time data (pages become Partial Prerender: static shell + streamed data) |
| D42 | 2026-11-12 | `formatMoney` (Intl, the currency's own decimals) is display-only; amounts stay integer minor units everywhere else |
| D43 | 2026-11-12 | `next/image` with `remotePatterns` limited to `https://placehold.co/600x400/png` (query left open because the label is in `?text=`); plain Tailwind, no shadcn yet |
| D44 | 2026-11-12 | The cart is the user's `CartItem` rows (no `Cart` table); `@@unique([userId, productId])`; no prices stored in the cart |
| D45 | 2026-11-12 | `DemoUserGuard` reads `x-demo-user-id`, loads the user (401 if missing or unknown) and `@CurrentUser()` exposes it, the same shape a real auth guard would have. Seeded ids are fixed (`demo-sarah`, `demo-james`, `demo-emily`); emails use public `@yopmail.com` inboxes |
| D49 | 2026-11-12 | The user runs every migration and seed command (`migrate dev/reset/deploy`, `db:seed`) themselves; Claude provides each command with its purpose |
| D50 | 2026-11-12 | Web identity: the header dropdown stores the demo user in a readable `demoUserId` cookie. Server Components read it with `cookies()` and send `x-demo-user-id`; browser cart calls send the same header through the `/api` proxy. (Real apps: an httpOnly session cookie that only the server reads.) |
| D51 | 2026-11-12 | Cart changes are browser `fetch` calls to `/api/cart/...` followed by `router.refresh()` (visible in DevTools, the same shape as Phase 4's checkout POST); no Server Actions |
| D52 | 2026-11-12 | A cookie for a user that no longer exists (API 401) makes the cart page ask the user to pick a demo user, instead of erroring |
| D46 | 2026-11-12 | Request bodies are validated with zod via Nest's global `StandardSchemaValidationPipe`; the same schema documents the Swagger body. Unknown keys (e.g. a tampered `priceAmount`) are stripped |
| D47 | 2026-11-12 | Cart stock and limit checks (max 10 per product) are early feedback only (409); checkout re-checks and reserves stock |
| D48 | 2026-11-12 | Ownership is enforced inside the query (`where: { id, userId }`), so another user's cart item returns 404 (prevents IDOR) |

## Tool & library versions

| Item | Version | Notes |
|---|---|---|
| Node.js | 24.18.0 | |
| pnpm | 12.8.1 | |
| git | 2.55.0 | |
| Docker | 29.6.1 | |
| Stripe CLI | 1.55.10 | `npm i -g @stripe/cli`; logged in to the US sandbox |
| Stripe API version | `2026-10-28.endive` | Account default (seen in the `Stripe-Version` response header); confirm the SDK pins the same in Phase 1 |
| Next.js / React | 16.4.6 / 19.3.0 | `apps/web`, Tailwind 4.3.3, ESLint 9, TypeScript 5.9 |
| NestJS | 12.4.2 (CLI 12.0.12) | `apps/api`, ESM, TypeScript 6.0, Vitest 4.1, oxlint 1.93 |
| PostgreSQL | 18.6 (`postgres:18-alpine`) | Docker container `techcart-postgres`, volume `techcart-pgdata` |
| Prisma | 7.10.1 (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) | `pg` 8.23; pnpm `allowBuilds` approves `prisma` + `@prisma/engines` |
| Config | `@nestjs/config` 12.1.1, zod 4.6.7, dotenv 18 (Prisma CLI only) | |
| stripe (Node SDK) | 23.1.0 | Pins API `2026-10-28.endive`; ESM default import `import Stripe from 'stripe'` |
| Not installed yet | — | @stripe/stripe-js / @stripe/react-stripe-js (Phase 8 only) |

## Issues & blockers

- Resolved: Prisma couldn't reach `localhost:5435` because Windows resolves `localhost` to IPv6 `::1` first, while the container listens on IPv4 only. Fixed by using `127.0.0.1` in `DATABASE_URL`.
- Note: `prisma init` (7.10) also writes AI-agent skill folders (`.claude/`, `.windsurf/`, `.agents/`, `skills-lock.json`). They were deleted as noise.
- Resolved: the Stripe account is a US sandbox, so ACH Direct Debit can be tested in Phase 9b. Live mode will never be activated.
- Note: with Cache Components, a product page that calls `notFound()` returns HTTP **200** with `<meta name="robots" content="noindex">`, because the static shell has already been streamed. The page content is the 404 page. Acceptable here.
- Note: if `nest start --watch` ever leaves `apps/api/dist` deleted with nothing on :4000, restart `pnpm dev`.

## Learning progress

Details, gotchas and interview Q&A live in [docs/STRIPE_NOTES.md](docs/STRIPE_NOTES.md). Covered so far:

- **Phase 0:** sandbox vs live, the four key types, how a request authenticates, `Request-Id` / `Stripe-Version`, fail-fast config, Workbench logs.
- **Phase 1:** the object chain of one payment (Customer → PaymentIntent → PaymentMethod → Charge → BalanceTransaction → Refund, with Events), fees and net, decline behavior, idempotency keys (replay and mismatch error), SDK pinning, retries and timeouts.
- **Phase 2:** prices as integer minor units in our DB (the server's trusted source for `price_data`), zero-decimal currencies, Stripe's $0.50 USD minimum and amount limits, display-only formatting, soft-hiding products.
- **Phase 3:** the cart as untrusted input (no stored prices, zod validation, stripped fields), soft stock checks vs reservation, ownership-scoped queries (IDOR), one user → one future Stripe Customer (`stripeCustomerId @unique`).

## Git workflow (quick reference): one PR per feature branch

```bash
git switch dev && git pull                       # start from the latest dev
git switch -c feature/p<N>-<task>                # one branch per task
git add -A && git commit -m "feat(scope): ..."   # Conventional Commits
git push -u origin feature/p<N>-<task>
# GitHub: open PR (base: dev) → fill template → "Create a merge commit" → delete branch
git switch dev && git pull && git branch -d feature/p<N>-<task>
# Milestones: PR dev → main, then tag vX.Y.Z on main
```

Never: commit on `main` directly, force-push, rebase shared branches, squash/rebase-merge PRs, or commit `.env` files.

## Pull requests

| PR | Branch | Phase | Status |
|---|---|---|---|
| — | `feature/p0-*` | 0 | Merged locally before PRs were adopted |
| [#1](https://github.com/iamzeeshandev/tech-cart/pull/1) | `feature/p1-stripe-client` | 1 | Merged |
| [#2](https://github.com/iamzeeshandev/tech-cart/pull/2) | `feature/p2-catalog` | 2 | Merged |
| (link) | `feature/p3-cart` | 3 | Open |
