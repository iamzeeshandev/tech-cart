# TechCart — Development Progress

Learning project: Stripe integration across Next.js, NestJS and PostgreSQL.
Full plan: [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md)

_Last updated: 2026-11-11_

## Current status

- **Current phase:** Phase 1 complete. Waiting for approval to start Phase 2
- **Current branch:** `feature/p1-stripe-client` (to be merged into `dev`)
- **Next task:** Phase 2 — product catalog (Prisma models + seed, list/detail API, minimal product pages)
- **Revision notes:** [docs/STRIPE_NOTES.md](docs/STRIPE_NOTES.md), updated at every phase end per [docs/STRIPE_NOTES_PROMPT.md](docs/STRIPE_NOTES_PROMPT.md)

## How to run

```bash
pnpm install                      # once, from the repo root
cp apps/api/.env.example apps/api/.env   # once
pnpm db:up                        # Postgres 18 in Docker on 127.0.0.1:5435
pnpm --filter api db:generate     # once, and after every schema change
pnpm dev                          # web http://localhost:3000, api http://localhost:4000/api
```

- `http://localhost:3000/api/*` is proxied to the API, so the browser only ever talks to the web app.
- Health check: `curl http://localhost:3000/api/health` should return `{"status":"ok","database":"up"}` (503 if Postgres is down).
- Stripe check: `curl http://localhost:3000/api/payments/health` should return `livemode: false`, `apiVersion`, `requestId` (503 if the key is wrong).
- Swagger UI: http://localhost:4000/api/docs (OpenAPI JSON at `/api/docs-json`). Use **Try it out → Execute** on any endpoint.
- Inspect data: `pnpm --filter api db:studio`.
- Run `pnpm dev` from the **repo root** to start both apps. Inside `apps/api` it starts only the API.

## Phases

| # | Phase | Status |
|---|---|---|
| 0 | Foundation & Stripe account setup | ✅ Done (2026-11-11) |
| 1 | Stripe fundamentals lab | ✅ Done (2026-11-11) |
| 2 | Feature: product catalog | ⬜ Next (needs approval) |
| 3 | Feature: demo users + cart | ⬜ Pending |
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
| D13 | 2026-11-11 | Only the `payments` module imports the Stripe SDK |
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
| D27 | 2026-11-11 | One Stripe client via Nest provider token `STRIPE_CLIENT` in `payments/` (pinned `2026-10-28.endive`, `maxNetworkRetries: 2`, `timeout: 20s`) |
| D28 | 2026-11-11 | Inline `price_data` confirmed: PaymentIntents don't use Prices, and our DB stays the price source of truth |
| D29 | 2026-11-11 | `docs/STRIPE_NOTES.md` is the revision sheet (cheat sheet + per-phase sequence/why/gotchas/Q&A), updated each phase |
| D30 | 2026-11-11 | Swagger (`@nestjs/swagger` 12.1.1) at `/api/docs` for manual testing next to curl; `@scarf/scarf` install-analytics script denied in `allowBuilds` |
| D31 | 2026-11-11 | One GitHub PR per feature branch into `dev` (merge commit, no squash/rebase); `.github/pull_request_template.md`; milestone PRs `dev` → `main` |

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

## Learning progress

Details, gotchas and interview Q&A live in [docs/STRIPE_NOTES.md](docs/STRIPE_NOTES.md). Covered so far:

- **Phase 0:** sandbox vs live, the four key types, how a request authenticates, `Request-Id` / `Stripe-Version`, fail-fast config, Workbench logs.
- **Phase 1:** the object chain of one payment (Customer → PaymentIntent → PaymentMethod → Charge → BalanceTransaction → Refund, with Events), fees and net, decline behavior, idempotency keys (replay and mismatch error), SDK pinning, retries and timeouts.

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
| (link) | `feature/p1-stripe-client` | 1 | Open |
