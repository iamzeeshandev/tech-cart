# TechCart — Development Progress

Learning project: Stripe integration across Next.js, NestJS and PostgreSQL.
Full plan: [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md)

_Last updated: 2026-11-11_

## Current status

- **Current phase:** Phase 0 — Foundation & Stripe account setup
- **Current branch:** `feature/p0-repo-setup`
- **Next task:** Phase 0, task 2 — pnpm workspace with Next.js (`apps/web`) and NestJS (`apps/api`) skeletons

## Phases

| # | Phase | Status |
|---|---|---|
| 0 | Foundation & Stripe account setup | 🟡 In progress (task 1 of 5 done) |
| 1 | Stripe fundamentals lab | ⬜ Pending |
| 2 | Feature: product catalog | ⬜ Pending |
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
- [ ] 2. pnpm workspace + Next.js (`apps/web`) and NestJS (`apps/api`) skeletons
- [ ] 3. Docker Compose Postgres + Prisma 7 in `apps/api`
- [ ] 4. `.env.example` files + env validation at API startup
- [ ] 5. Stripe sandbox test keys + Stripe CLI installed and logged in

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

## Tool & library versions

| Item | Version | Notes |
|---|---|---|
| Node.js | 24.18.0 | |
| pnpm | 12.8.1 | |
| git | 2.55.0 | |
| Docker | 29.6.1 | |
| Stripe CLI | not installed yet | Phase 0, task 5 (`npm i -g @stripe/cli`) |
| Stripe API version | `2026-10-28.endive` (expected) | Confirm against the SDK at install |
| Libraries | pinned at install | Expected: next 16.4.x, @nestjs/core 12.4.x, stripe 23.1.x, prisma 7.10.x, @stripe/stripe-js 10.2.x |

## Issues & blockers

- None yet.
- Open check: Stripe account country. It decides which delayed payment method we can test in Phase 9b (ACH needs a US account).

## Learning progress

### Concepts covered

- None yet. Stripe concepts start with Phase 0, task 5 and Phase 1.

### Interview questions answered

- None yet.

## Git workflow (quick reference)

```bash
git switch dev                                # start from dev
git switch -c feature/p<N>-<task>             # one branch per task
git add <files> && git commit -m "feat(scope): ..."   # small Conventional Commits
git switch dev && git merge --no-ff feature/p<N>-<task>  # merge commit per feature
git switch main && git merge --no-ff dev && git tag -a vX.Y.Z -m "..."  # milestones only
```

Never: commit on `main` directly, force-push, rebase shared branches, or commit `.env` files.
