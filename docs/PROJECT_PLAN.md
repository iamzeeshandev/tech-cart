# TechCart — Stripe Integration Learning Plan

## Context

**Why this project exists.** You want to become confident at designing, building, debugging and explaining real Stripe integrations across Next.js, NestJS, PostgreSQL and Stripe. TechCart, a small electronics store, is the vehicle for that. The store only needs enough features to make the payment flows realistic.

**Current repository state (inspected 2026-11-11).**
- `d:\ZeeShan\MyWork\Projects\tech-cart` is **empty** and **not a git repo**. We start from zero, with no existing code to reuse.
- Installed: Node 24.18, npm 11.16, pnpm 12.8, git 2.55, Docker 29.6.
- Not installed: Stripe CLI and PostgreSQL. Postgres will run in Docker; the Stripe CLI gets installed in Phase 0.

**Decisions you've confirmed.**
| Topic | Decision |
|---|---|
| Customer identity | 2–3 seeded demo users, picked in a header dropdown. No passwords. Each maps to a Stripe Customer. |
| Webhook format | Snapshot events first (`constructEvent`). A later phase migrates to thin events. |
| Repo layout | pnpm workspace monorepo: `apps/web` + `apps/api` |
| Database | PostgreSQL via Docker Compose |

**Verified against current Stripe docs (Nov 2026):**
- The current API version is `2026-10-28.endive`. The `stripe` npm package is at 23.1.0, and the SDK pins the API version that was current when it was released.
- Checkout Session `ui_mode` values are `hosted_page` (the default), `embedded_page`, `elements` and `form`. Stripe recommends Checkout Sessions over PaymentIntents for most integrations.
- Stripe's fulfillment guide asks for two things: (1) webhooks, which are required, and (2) also triggering the *same idempotent* fulfill function from the success page. That function retrieves the session server-side. The redirect itself is never trusted.
- Webhook retries: up to 3 days in live mode, but only **3 retries over a few hours in sandboxes**. Stripe doesn't guarantee event order and can deliver duplicates.
- Idempotency keys (API v1): results are saved once execution starts, including 500s. Keys can be pruned after 24h, and reusing a key with different parameters errors. stripe-node retries once by default and adds idempotency keys automatically.
- Checkout `expires_at` can be 30 min to 24 h (default 24 h).
- Card authorizations for online customer-initiated payments last about 7 days (Visa about 5 days for merchant-initiated).
- Refund events: `refund.created`, `refund.updated`, `refund.failed` and `charge.refunded`. `charge.refund.updated` is deprecated.
- The Stripe CLI is now installable with `npm i -g @stripe/cli` (v1.55.x).

---

## 1. Project Overview & Scope

**In scope (needed to learn payments):** product list and detail, cart, order creation, hosted Checkout, webhooks, payment status tracking, order history, refunds and cancellation, a PaymentIntents comparison flow, authorize and capture, delayed payment methods, disputes and basic fraud, reliability and reconciliation, testing and production readiness.

**Out of scope:** real authentication and RBAC, admin CRUD, UI polish, search and filters, shipping and tax calculation, subscriptions, Connect and marketplaces, microservices, queues (Redis/BullMQ), deployment infrastructure.

**UI principle:** a functional, plain shadcn/ui interface, built only when a feature needs it.

---

## 2. Application Architecture

```
                    (1) pages, cart, "Pay" click
 ┌──────────────┐  ───────────────────────────▶  ┌────────────────────┐   SQL (Prisma)  ┌────────────┐
 │  Next.js 16  │      /api/* (rewrite proxy)     │     NestJS 12      │ ◀─────────────▶ │ PostgreSQL │
 │  apps/web    │  ◀───────────────────────────  │     apps/api       │                 │  (Docker)  │
 └──────┬───────┘   JSON: products, checkoutUrl,  └───┬───────────▲────┘                 └────────────┘
        │           order status                    │ (2) secret  │ (4) signed webhook events
        │ (3) browser redirect to session.url       │  key, HTTPS │     POST /api/webhooks/stripe
        ▼                                           ▼             │
 ┌───────────────────────────────┐            ┌──────────────────┴─────┐
 │ Stripe-hosted Checkout page   │──────────▶ │      Stripe API        │
 │ checkout.stripe.com           │  card data │ (Customers, Sessions,  │
 └───────────────────────────────┘  never     │  PaymentIntents, ...)  │
          │ (5) redirect to success_url        └────────────────────────┘
          ▼     ?session_id=cs_...  → Next.js success page → asks NestJS for the verified status
```

**Repo layout (pnpm workspace):**
```
tech-cart/
├─ apps/
│  ├─ web/                 Next.js 16 (App Router) + Tailwind + shadcn/ui
│  └─ api/                 NestJS 12 + Prisma 7 + stripe-node 23
│     ├─ prisma/           schema.prisma, migrations/, seed.ts
│     └─ src/
│        ├─ common/        demo-user decorator/guard, money helpers
│        ├─ prisma/        PrismaService (global)
│        ├─ catalog/       products & categories (read-only)
│        ├─ cart/          cart + items
│        ├─ orders/        order creation, state transitions, inventory reservation
│        └─ payments/      THE ONLY MODULE THAT IMPORTS `stripe`
│           ├─ stripe.provider.ts         single configured Stripe client
│           ├─ checkout.service.ts        Checkout Sessions
│           ├─ webhooks.controller.ts     raw-body endpoint + signature check
│           ├─ stripe-events.service.ts   dedup log + dispatch by event type
│           ├─ refunds.service.ts         (Phase 7)
│           ├─ payment-intents.service.ts (Phase 8)
│           └─ reconciliation.service.ts  (Phase 6)
├─ docker-compose.yml      postgres:17 (or current major) on 5432
├─ pnpm-workspace.yaml
├─ DEVELOPMENT_PROGRESS.md
└─ .env.example files      (real .env files are git-ignored)
```

**Boundary rules:**
- `OrdersService` owns order and inventory state transitions (`markPaid`, `markProcessing`, `releaseReservation`, ...). It never calls Stripe.
- `PaymentsModule` talks to Stripe and calls `OrdersService` to change order state.
- Stripe SDK calls appear nowhere outside `payments/`.

**Ports:** web `3000`, api `4000` (global prefix `/api`), Postgres `5432`.

---

## 3. Frontend ↔ Backend ↔ Stripe Communication

- **Next.js → NestJS:** Next.js `rewrites` proxy `/api/*` to `http://localhost:4000/api/*`, so the browser stays same-origin and we avoid CORS work. Server Components fetch the API directly. A tiny `apiFetch` helper adds the `x-demo-user-id` header from the dropdown's cookie.
- **NestJS → Stripe:** server-to-server HTTPS through stripe-node, authenticated with the **secret key** (`sk_test_…`). The API version is pinned and idempotency keys go on every POST.
- **Browser → Stripe (hosted Checkout):** a plain redirect to `session.url`. **No publishable key and no Stripe.js are needed** for hosted Checkout, which is itself a lesson. The publishable key (`pk_test_…`) first appears in Phase 8 for the Payment Element.
- **Stripe → NestJS:** webhook POSTs signed with `Stripe-Signature` and verified against `STRIPE_WEBHOOK_SECRET` (`whsec_…`) using the raw body. Locally they arrive through `stripe listen --forward-to localhost:4000/api/webhooks/stripe`.

**API surface, added phase by phase:**
| Phase | Endpoint | Purpose |
|---|---|---|
| 1 | `GET /api/payments/health` | Proves the Stripe key and config work (`balance.retrieve`) |
| 2 | `GET /api/products`, `GET /api/products/:slug` | Catalog |
| 3 | `GET /api/demo-users`, `GET/POST/PATCH/DELETE /api/cart[/items/:id]` | Cart |
| 4 | `POST /api/checkout` → `{ checkoutUrl, orderId }` | Create order + Checkout Session |
| 5 | `POST /api/webhooks/stripe` | Stripe events |
| 5 | `GET /api/checkout/sessions/:id` | Success page: verify server-side + return order status |
| 5 | `GET /api/orders`, `GET /api/orders/:id` | Order history and status |
| 7 | `POST /api/orders/:id/refunds`, `POST /api/orders/:id/cancel` | Refunds and cancellation (dev-only admin panel) |
| 8 | `POST /api/payment-intents` → `{ clientSecret }` | PaymentIntents comparison flow |
| 9 | `POST /api/orders/:id/capture`, `POST /api/orders/:id/void` | Authorize and capture |

---

## 4. Database Entities & Relationships

Money is always stored as an **integer in minor units** (cents) plus a lowercase ISO currency (`usd`), never floats. Prices on orders are **snapshotted** at order time.

```
User 1─1 Cart 1─n CartItem n─1 Product n─1 Category
User 1─n Order 1─n OrderItem n─1 Product        Product 1─1 Inventory
Order 1─n Payment (one per attempt/flow) 1─n Refund
StripeEvent (standalone log)            Dispute n─1 Payment (Phase 9)
```

| Model | Key fields | Introduced |
|---|---|---|
| Category | id, name, slug | P2 |
| Product | id, categoryId, name, slug, description, imageUrl, `priceAmount Int`, currency, isActive | P2 |
| Inventory | productId (unique), `quantityAvailable`, `quantityReserved` | P2 |
| User | id, email, name, `stripeCustomerId?` (unique) | P3 (stripeCustomerId used P4) |
| Cart / CartItem | cart.userId (unique); item (cartId, productId) unique, quantity | P3 |
| Order | id, userId, `status`, currency, subtotalAmount, totalAmount, amountRefunded, reservationExpiresAt, paidAt, createdAt | P4 |
| OrderItem | orderId, productId, productNameSnapshot, unitAmountSnapshot, quantity, lineTotal | P4 |
| Payment | id, orderId, flow (`CHECKOUT_SESSION`/`PAYMENT_INTENT`), `status`, amount, currency, `stripeCheckoutSessionId?` (unique), `stripePaymentIntentId?` (unique), stripeChargeId?, checkoutUrl?, expiresAt?, lastFailureCode/message, `idempotencyKey` (unique) | P4 |
| StripeEvent | `id` (= Stripe `evt_…`, PK), type, apiVersion, livemode, status (`PROCESSING`/`PROCESSED`/`FAILED`/`IGNORED`), attempts, lastError, payload Json, receivedAt, processedAt | P5 |
| Refund | id, orderId, paymentId, `stripeRefundId?` (unique), amount, currency, `status`, reason, failureReason, restock Bool, `idempotencyKey` (unique) | P7 |
| Dispute | id, paymentId, stripeDisputeId (unique), amount, reason, status | P9 |

**Enums (values added only when a phase needs them):**
- `OrderStatus`: `PENDING_PAYMENT`, `PAYMENT_PROCESSING`, `PAID`, `PAYMENT_FAILED`, `EXPIRED`, `CANCELLED`, `PARTIALLY_REFUNDED`, `REFUNDED`, `AUTHORIZED` (P9)
- `PaymentStatus`: `PENDING`, `PROCESSING`, `REQUIRES_CAPTURE` (P9), `SUCCEEDED`, `FAILED`, `CANCELED`, `EXPIRED`
- `RefundStatus`: `PENDING`, `REQUIRES_ACTION`, `SUCCEEDED`, `FAILED`, `CANCELED`

**Inventory reservation, which is simple and visible:**
- On order creation: `available -= q; reserved += q`, using a conditional update that fails if stock is short.
- On paid: `reserved -= q` (sold).
- On expired, cancelled or async failure: `reserved -= q; available += q`.
- On refund with restock: `available += q`.

---

## 5. Stripe Integration Architecture

**Single Stripe client.** A Nest provider creates `new Stripe(STRIPE_SECRET_KEY, { apiVersion: <pinned>, maxNetworkRetries: 2, timeout, appInfo })`. We pin the SDK's version (expected `2026-10-28.endive`, confirmed at install) and create the webhook endpoint with the **same** version.

**Stripe objects created in one hosted-Checkout payment:**
```
Customer (cus_)  ← created once per demo user, reused
   └─ Checkout Session (cs_)        created by our API; payment_intent = null until the customer submits
        └─ PaymentIntent (pi_)      created by Stripe at submit; carries our metadata via payment_intent_data
             ├─ PaymentMethod (pm_)
             └─ Charge (ch_) → BalanceTransaction (txn_)   (fees, net)
                  └─ later: Refund (re_), Dispute (dp_)
Every state change → Event (evt_) → webhook delivery
```

**Linking Stripe to our DB (metadata strategy):**
- `session.client_reference_id = orderId` and `session.metadata = { orderId, paymentId }`.
- `payment_intent_data.metadata = { orderId, paymentId }`, so `payment_intent.*` and `charge.*` events can be mapped back to our order.
- `refund.metadata = { orderId, refundId }`.

**Two layers of idempotency:**
1. **Client → our API.** The checkout button sends an `Idempotency-Key` header. Our API reuses the existing pending order and open session instead of creating duplicates on double-clicks or retries.
2. **Our API → Stripe.** Every POST passes `{ idempotencyKey }` derived from our own row ID (for example `checkout-session:<paymentId>`, `refund:<refundId>`). A timeout followed by a retry can then never create a second session or refund.

**Webhook pipeline:**
```
raw body + Stripe-Signature ──▶ constructEvent() ──✗──▶ 400 (forged or tampered)
            │ ✓
            ▼
insert StripeEvent(id) ── already PROCESSED? ──▶ 200 (duplicate, skip)
            │ new / failed earlier
            ▼
dispatch by type ──▶ retrieve the latest object from Stripe when needed
                 ──▶ DB transaction: guarded state transition + mark event PROCESSED
            │ throws (DB down, etc.)
            ▼
mark FAILED, return 500 ──▶ Stripe retries later
Unknown or irrelevant event types ──▶ mark IGNORED, return 200 (no retry storms)
```

**Source-of-truth rules:**
- Stripe owns payment state; our DB owns catalog, prices, orders and inventory.
- An order becomes `PAID` **only** through a verified webhook or a server-side `checkout.sessions.retrieve`, never through a browser claim.
- Status transitions are guarded. For example, `PAID` never goes back to `PENDING_PAYMENT` or `FAILED`, so out-of-order events are harmless.

---

## 6. Complete Payment Lifecycle (hosted Checkout)

```
Next.js                  NestJS                        PostgreSQL               Stripe
  │ POST /api/checkout     │                               │                       │
  │ (Idempotency-Key)      │ load cart, DB prices, stock   │                       │
  │──────────────────────▶ │──── tx: Order PENDING_PAYMENT, OrderItems snapshot,   │
  │                        │         reserve stock, Payment PENDING ─────────────▶ │
  │                        │ ensure Customer (cus_) ───────────────────────────────▶│
  │                        │ sessions.create(price_data, metadata, expires_at=+30m,│
  │                        │   success_url ?session_id={CHECKOUT_SESSION_ID})  ───▶│
  │                        │ save cs_ id, url, expires_at ─▶│                       │
  │ ◀── { checkoutUrl } ───│                               │                       │
  │ window.location = checkoutUrl ──────────────────────────────────────────────────▶ hosted page
  │                                       customer pays → PI created/confirmed (3DS if needed)
  │                                       decline → error on Stripe page, session stays open,
  │                                                  payment_intent.payment_failed event
  │                        │ ◀──── checkout.session.completed (payment_status=paid) ──│
  │                        │ verify sig, dedup, retrieve session (expand line_items,  │
  │                        │ payment_intent), check amount/currency == order          │
  │                        │──── tx: Payment SUCCEEDED, Order PAID, commit stock,     │
  │                        │         clear cart, StripeEvent PROCESSED ─▶│            │
  │ ◀──── redirect success_url?session_id=cs_… ─────────────────────────────────────── │
  │ GET /api/checkout/sessions/cs_…  → same idempotent fulfill() → { status: PAID }    │
```

**Alternative endings:**
| Situation | Event(s) | Our result |
|---|---|---|
| Customer clicks back / cancel | (none yet) | Order stays `PENDING_PAYMENT`; can resume via stored `checkoutUrl` while open |
| 30 min pass | `checkout.session.expired` | Order `EXPIRED`, reservation released |
| Delayed method (ACH) | `completed` (payment_status `unpaid`) → `async_payment_succeeded` / `async_payment_failed` | `PAYMENT_PROCESSING` → `PAID` or `PAYMENT_FAILED` (+ stock released) |
| User cancels pending order | our API calls `checkout.sessions.expire` | `CANCELLED`, stock released |
| Refund (P7) | `refund.created/updated/failed`, `charge.refunded` | `PARTIALLY_REFUNDED` / `REFUNDED` |
| Manual capture (P9) | `completed` + PI `requires_capture` | `AUTHORIZED` → capture → `PAID` / void → `CANCELLED` |
| Dispute (P9) | `charge.dispute.created/closed` | Dispute row + flag on order |

**Order state machine:**
```
PENDING_PAYMENT ──paid──────────────▶ PAID ──partial refund──▶ PARTIALLY_REFUNDED ──rest──▶ REFUNDED
   │ ├─async pending─▶ PAYMENT_PROCESSING ─succeeded─▶ PAID        PAID ──full refund──▶ REFUNDED
   │ │                        └─failed─▶ PAYMENT_FAILED
   │ ├─session expired─▶ EXPIRED
   │ ├─user cancel─────▶ CANCELLED
   │ └─(P9) requires_capture─▶ AUTHORIZED ─capture─▶ PAID / ─void─▶ CANCELLED
```

---

## 7. Incremental Development Phases

Every Stripe phase follows your 10-step loop: concept → real-world scenario → lifecycle diagram → approach → decisions → **small task** → code walkthrough → test → edge cases → interview questions. **I stop for your approval at the end of each phase**, and before any large task inside one.

Branch naming is `feature/<phase>-<task>`, created from `dev`.

### Phase 0: Foundation & Stripe Account Setup (no Stripe code yet)
- **Learn:** test mode vs sandboxes vs live mode. The key types: publishable `pk_`, secret `sk_`, restricted `rk_`, webhook secret `whsec_`. Why `sk_` never leaves the server. Workbench request logs.
- **Tasks:**
  1. `git init`, `main` and `dev` branches, `.gitignore`, `DEVELOPMENT_PROGRESS.md`. I explain each command first.
  2. pnpm workspace with Next.js and NestJS skeletons, both booting.
  3. `docker-compose.yml` for Postgres; Prisma 7 initialized in `apps/api` (`prisma.config.ts`, `@prisma/adapter-pg`); first empty migration.
  4. `.env.example` files and env validation at API startup.
  5. You create or open a Stripe account sandbox and copy the test keys into `.env`. Install the Stripe CLI (`npm i -g @stripe/cli`) and run `stripe login`.
- **Deliverables:** both apps run, the DB is reachable, the Stripe CLI is authenticated, and the first commits are on `dev`.
- **Branches:** `feature/p0-repo-setup`, `feature/p0-db-setup`.

### Phase 1: Stripe Fundamentals Lab
- **Concept first:** Stripe is a REST API with form-encoded requests, JSON responses, versioned behavior and object IDs with type prefixes. The SDK is a typed wrapper, and every SDK call is an HTTPS request you can see in Workbench logs.
- **Problem it solves:** you understand the object graph *before* writing integration code.
- **Implement:**
  1. A **CLI-only lab** with no code. Create a Customer, a Product and Price, and a PaymentIntent confirmed with `pm_card_visa`. Inspect the Charge and BalanceTransaction (fees, net) and refund it. Find every object and event in the Dashboard. Repeat a request with the same idempotency key and with a different body.
  2. `PaymentsModule` with the Stripe client provider (pinned version, retries, timeout) and `GET /api/payments/health`.
  3. Decide and document `price_data` versus Stripe Products/Prices.
- **Communication:** CLI/SDK → `api.stripe.com` with Bearer `sk_test`. Look at the response object, the `request-id` and the `Stripe-Version` header.
- **Failure scenarios:** wrong key (401 `authentication_error`), malformed params (`invalid_request_error`), idempotency-key reuse with different params, confirming a PI with the decline card `pm_card_visa_chargeDeclined`.
- **Interview checkpoint:** "Walk me through the objects created when a card payment succeeds." "What are minor units and zero-decimal currencies?" "Why pin an API version?" "Publishable vs secret vs restricted keys?"
- **Branch:** `feature/p1-stripe-client`.

### Phase 2: Feature — Product Catalog (fast track, minimal teaching)
- **Tasks:** Prisma `Category`, `Product`, `Inventory` + migration, then a seed of about 10 electronics in USD minor units. `CatalogModule` with list and detail endpoints. Next.js product grid and detail page.
- **Stripe tie-in:** why prices live in **our** DB and are re-read at checkout. Formatting cents for display only.
- **Deliverables:** browse products from the DB end to end.
- **Branches:** `feature/p2-catalog-api`, `feature/p2-catalog-ui`.

### Phase 3: Feature — Demo Users + Cart (fast track)
- **Tasks:** `User` (seeded 2–3), the `x-demo-user-id` decorator and guard, the header dropdown. `Cart`/`CartItem` with add, update and remove. A cart page with a subtotal computed **for display only**.
- **Stripe tie-in:** the cart is untrusted input. Quantities get re-validated and prices re-read at checkout.
- **Deliverables:** switch users, keep separate carts.
- **Branches:** `feature/p3-demo-users`, `feature/p3-cart`.

### Phase 4: Feature — Checkout with Stripe Hosted Checkout ★
- **Concept first:** a Checkout Session is a server-created, short-lived, Stripe-hosted payment page for a fixed set of line items. Stripe owns card collection, 3DS, payment-method display and receipts, so we stay in the lowest PCI scope (SAQ A). Also covered: session lifecycle (`open` → `complete` | `expired`) and `payment_status` (`unpaid` / `paid` / `no_payment_required`).
- **Problem it solves:** taking money without ever touching card data, and without trusting the browser about amounts.
- **Implement (small steps):**
  1. `Order`/`OrderItem`/`Payment` models with an order-creation transaction (snapshot prices, reserve stock).
  2. `ensureStripeCustomer(user)`, which creates a Customer once and saves `stripeCustomerId`.
  3. `CheckoutService.createSession`: `mode: 'payment'`, `price_data` line items from DB snapshots, `customer`, `client_reference_id`, `metadata`, `payment_intent_data.metadata`, `success_url` containing `{CHECKOUT_SESSION_ID}`, `cancel_url`, `expires_at = now + 30 min`, and an idempotency key from `paymentId`.
  4. `POST /api/checkout` with the client `Idempotency-Key` header and a double-click guard.
  5. Next.js: a Pay button that redirects to `checkoutUrl`, plus a minimal success page and cancel page.
- **Behind the scenes:** the session starts with `payment_intent: null`, and the PI is created when the customer submits. On a decline, the customer stays on Stripe's page and the session stays open.
- **Deliberate gap at the end of this phase:** pay with `4242…`, and Stripe says paid while **our DB still says `PENDING_PAYMENT`**. That gap is exactly why Phase 5 exists.
- **Failure scenarios:** tampered client price (ignored by design), out-of-stock at checkout (409), double-click (one order), decline `4000 0000 0000 0002` and insufficient funds `4000 0000 0000 9995` (session stays open), cancel and resume, Stripe API error or timeout during session creation (order is not left dangling, and the retry reuses the idempotency key).
- **Interview checkpoint:** "Why compute the amount on the server?" "What is `client_reference_id` vs `metadata`?" "Why can't the success redirect confirm payment?" "What happens to stock if the user never comes back?"
- **Branches:** `feature/p4-orders`, `feature/p4-checkout-session`, `feature/p4-checkout-ui`.

### Phase 5: Feature — Webhooks & Payment Confirmation ★
- **Concept first:** webhooks are Stripe's server-to-server push notifications. They're needed because the browser is unreliable (closed tab, lost connection) and some payments finish later (async methods, refunds, disputes). We also cover the HMAC-SHA256 signature over `timestamp.rawBody`, the 5-minute tolerance against replays, at-least-once delivery, no ordering guarantee, and retries (live: 3 days; sandbox: 3 retries over a few hours).
- **Implement:**
  1. NestJS `rawBody: true` and `POST /api/webhooks/stripe` using `req.rawBody` with `stripe.webhooks.constructEvent`.
  2. A `StripeEvent` table plus the dedup and status pipeline from §5.
  3. Handlers:
     - `checkout.session.completed`: paid → `PAID`; unpaid → `PAYMENT_PROCESSING`.
     - `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`.
     - `checkout.session.expired`: release stock.
     - `payment_intent.payment_failed`: record the last failure; the order stays pending because the session is still open.
     - `payment_intent.succeeded`: cross-check and backfill the PI and charge IDs.
  4. A single idempotent `fulfillCheckoutSession(sessionId)` that retrieves the session with `expand: ['line_items','payment_intent']` and verifies amount and currency. It's used by **both** the webhook and `GET /api/checkout/sessions/:id` on the success page, as Stripe's fulfillment guide recommends.
  5. UI: the success page polls the order status; plus an order history list and an order detail page with a payment timeline.
- **Communication:** Stripe → `stripe listen` → `localhost:4000`. Locally, Checkout redirects at once. With a real endpoint, Checkout waits up to 10 s for the `checkout.session.completed` response before redirecting.
- **Failure scenarios:**
  - Forged or modified body (400).
  - Wrong `whsec` (400; we'll diagnose it).
  - Duplicates via `stripe events resend`, which must not double-process.
  - Out-of-order events.
  - API down while an event fires (Stripe retries; we recover).
  - Handler throws midway (transaction rollback, then a 500 and a retry).
  - `stripe trigger checkout.session.completed` with no `orderId` metadata (must be ignored safely).
  - Amount mismatch (flagged, never marked paid).
- **Interview checkpoint:** "Why must the body be raw?" "How do you make webhook handling idempotent?" "What if events arrive out of order?" "Webhook vs success page: which is the source of truth, and why use both?"
- **Branches:** `feature/p5-webhook-endpoint`, `feature/p5-event-handlers`, `feature/p5-order-status-ui`.
- **🏁 Milestone 1:** `dev → main`, tag `v0.1.0` (end-to-end paid order).

### Phase 6: Payment Reliability & Reconciliation ★
- **Concept first:** distributed-systems failure modes between three parties: timeouts with unknown outcomes, retries, at-least-once delivery, partial failures, and drift between our DB and Stripe.
- **Implement:**
  1. Review and harden both idempotency layers, then test them with injected timeouts.
  2. A concurrency guard so the webhook and the success page running fulfill **at the same time** can't double-apply. We use a row lock or a conditional `UPDATE … WHERE status = …` inside the transaction.
  3. A reconciliation command (`pnpm --filter api reconcile`). It finds `PENDING` payments older than N minutes, retrieves their sessions and PIs from Stripe and repairs our state. It also lists undelivered events (`events.list` with `delivery_success: false`) and replays them through the same pipeline.
  4. Classify Stripe errors: card errors vs rate limit vs API vs connection vs idempotency errors, and what to do with each.
- **Failure scenarios:** kill the API mid-checkout; webhook down for 10 minutes and then recovery; the same event processed concurrently; a refund issued in the Dashboard (out-of-band changes must sync); a forced Stripe 429 or timeout via a stubbed client.
- **Interview checkpoint:** "Design exactly-once fulfillment on top of at-least-once delivery." "What do you do when a Stripe call times out?" "How does reconciliation work and when do you need it?"
- **Branches:** `feature/p6-idempotency-hardening`, `feature/p6-reconciliation`.

### Phase 7: Refunds & Order Management ★
- **Concept first:** the Refund object and its statuses (`pending`, `requires_action`, `succeeded`, `failed`, `canceled`). Refunds come from the available balance. Cards can get a reversal if refunded soon after payment. Refunds can fail days later. Cancel before capture versus refund after capture.
- **Implement:**
  1. A `Refund` model.
  2. `POST /api/orders/:id/refunds` (full or partial by amount, `restock` flag). It validates `refundable = paid − (pending + succeeded refunds)`, creates our row first, then `refunds.create({ payment_intent, amount, metadata }, { idempotencyKey })`.
  3. Webhooks `refund.created`, `refund.updated`, `refund.failed` and `charge.refunded` update the Refund and Order statuses and handle restocking.
  4. `POST /api/orders/:id/cancel`. A pending order expires its session through the API and releases stock. A paid order becomes a full refund.
  5. A dev-only admin panel on the order detail page.
- **Failure scenarios:** over-refund (rejected locally and by Stripe), async refund failure with card `4000 0000 0000 5126` (goes `succeeded`, then `failed`), pending refund with card `4000 0000 0000 7726`, a refund made in the Dashboard (must still sync), a duplicate refund click (idempotent), cancelling an already-completed session.
- **Interview checkpoint:** "Partial refund flow and how you track refundable amount?" "Can a refund fail after it succeeded?" "When do you restore inventory?"
- **Branches:** `feature/p7-refunds-api`, `feature/p7-refund-webhooks`, `feature/p7-cancellation`.
- **🏁 Milestone 2:** tag `v0.2.0`.

### Phase 8: PaymentIntents + Payment Element — Practical Comparison ★
- **Concept first:**
  - A PaymentIntent is a state machine for one payment attempt: `requires_payment_method` → (`requires_confirmation`) → `requires_action` (3DS) → `processing` → `succeeded` / `requires_capture` / `canceled`.
  - A Checkout Session *wraps* a PaymentIntent.
  - With raw PIs, **you** own line items, expiry, totals and cart integrity.
  - The client secret's role and why it's safe to expose.
  - Strong Customer Authentication (SCA) and 3DS.
- **Implement:**
  1. `POST /api/payment-intents`: an order created with the same order service, `paymentIntents.create({ amount from DB, currency, customer, automatic_payment_methods: { enabled: true }, metadata }, { idempotencyKey })`, returning `clientSecret`.
  2. `/checkout/custom` page with `@stripe/react-stripe-js` `<Elements>` + `<PaymentElement>` and `stripe.confirmPayment({ return_url })`. The publishable key appears for the first time.
  3. Webhooks `payment_intent.succeeded`, `payment_intent.payment_failed` and `payment_intent.processing` reuse the guarded order transitions.
  4. Our own expiry: cancel stale PIs and release stock in the reconciliation command.
  5. A comparison table written into `DEVELOPMENT_PROGRESS.md` from what we observed.
  6. *Explain only:* Checkout Sessions with `ui_mode: 'elements'`, Stripe's recommended way to get a custom UI without raw PIs.
- **3DS tests:** `4000 0027 6000 3184` (always authenticate), `4000 0025 0000 3155` (authenticate unless set up), and a failed 3DS challenge.
- **Interview checkpoint:** "Checkout Session vs PaymentIntent: when would you pick each?" "Is the client secret a secret?" "What happens during `requires_action`?"
- **Branches:** `feature/p8-payment-intents-api`, `feature/p8-payment-element-ui`.

### Phase 9: Advanced Payment Concepts (one small sub-feature each)
- **9a Authorize & capture.**
  - Checkout with `payment_intent_data.capture_method: 'manual'` gives `AUTHORIZED`.
  - Capture, including partial capture with `amount_to_capture`; void with `paymentIntents.cancel`.
  - Events `payment_intent.amount_capturable_updated` and `payment_intent.canceled`; the authorization expires after about 7 days.
  - We branch on PI status (`requires_capture`), and we'll verify in the sandbox what `payment_status` the session reports.
- **9b Delayed payment methods.**
  - Enable ACH Direct Debit (needs USD and a **US** Stripe account; otherwise we pick the delayed method your account supports).
  - Test bank accounts: `000123456789` (succeeds) and `000222222227` (insufficient funds), routing `110000000`.
  - Exercises the `PAYMENT_PROCESSING` path end to end.
- **9c Disputes & chargebacks.**
  - Card `4000 0000 0000 0259` and the "product not received" card `4000 0000 0000 2685`.
  - A `Dispute` model; events `charge.dispute.created`, `charge.dispute.updated` and `charge.dispute.closed`; funds withdrawn and reinstated.
  - Submitting test evidence; why you can't refund a disputed charge.
- **9d Basic fraud prevention.** Radar in the Dashboard, Radar test cards, rules on metadata, why 3DS shifts liability.
- **9e Abandoned checkouts.** Measure expired sessions; optionally Checkout's `after_expiration.recovery`. Review reservation timing trade-offs.
- **Interview checkpoint:** "When would you separate auth and capture?" "How do async payment methods change fulfillment?" "Walk through a chargeback."
- **Branches:** `feature/p9-manual-capture`, `feature/p9-async-methods`, `feature/p9-disputes`.

### Phase 10: Testing Consolidation & Production Readiness
- Fill gaps in the automated tests (§8).
- Run the full manual test matrix.
- Secret hygiene:
  - Use a restricted key `rk_` with only the permissions we need.
  - Rotate the secret key (rolling with an expiry window).
  - Roll the webhook secret; both secrets stay valid for up to 7 days.
- Production webhook endpoint: Workbench event destination, HTTPS, only the needed events, API version matching the SDK.
- Logging with Stripe `request-id`s; never logging secrets or full payloads in production.
- PCI responsibilities (SAQ A for Checkout and Elements, HTTPS, no card data in logs).
- A go-live checklist.
- **🏁 Milestone 3:** tag `v1.0.0`.

### Phase 11 (later, only if useful): Extensions
1. **Migrate to thin events** (Stripe's recommendation for new integrations): `parseEventNotification` / the notification handler, `fetchRelatedObject()`, unversioned payloads, `stripe listen --forward-thin-to`. Run it side by side with the snapshot endpoint.
2. **Checkout Sessions `ui_mode: 'elements'`.**
3. Possibly Stripe Tax, saved payment methods (`setup_future_usage`), or Accounts v2 customers, each only with a clear learning goal.

---

## 8. Testing Strategy

| Layer | Tool | What |
|---|---|---|
| Unit | Jest (Nest default) | Totals and minor-unit math, order state-transition guards, refundable-amount calculation, idempotency-key derivation |
| Integration / e2e | Jest + Supertest + real Postgres (separate test DB in the same Docker container) | Checkout endpoint (Stripe client replaced by a stub at the provider boundary); **webhook controller with genuinely signed payloads** using `stripe.webhooks.generateTestHeaderString` (no network); duplicate and out-of-order delivery; bad signatures |
| Live sandbox (manual) | Stripe CLI + test cards + Dashboard | Real end-to-end flows, `stripe listen`, `stripe trigger`, `stripe events resend`, Workbench logs |
| Frontend | Manual | Kept deliberately light |

**Manual test matrix (grows each phase):**
| Scenario | Trigger | Expected |
|---|---|---|
| Success | `4242 4242 4242 4242` | `PAID`, stock committed, cart cleared |
| Decline, then retry in the same session | `4000 0000 0000 0002` then `4242…` | Failure recorded, then `PAID` |
| Insufficient funds | `4000 0000 0000 9995` | Session open, order pending |
| 3DS required | `4000 0027 6000 3184` | Challenge, then `PAID` (or failed if rejected) |
| Expired session | Short `expires_at` (30 min min) or `checkout.sessions.expire` | `EXPIRED`, stock released |
| Duplicate event | `stripe events resend evt_…` | Single state change |
| Webhook outage | Stop the API, pay, restart | Retry or reconciliation fixes the state |
| Refund fails later | `4000 0000 0000 5126` | Refund `FAILED`, order stays paid |
| Dashboard refund | Refund in Dashboard | DB syncs via webhook |
| Dispute | `4000 0000 0000 0259` | Dispute recorded |
| Async success / failure | ACH test accounts | `PAYMENT_PROCESSING` → `PAID` / `PAYMENT_FAILED` |

---

## 9. Git Branching & Commit Strategy

- **Branches:** `main` holds stable milestones. `dev` is for integration. Each task gets `feature/p<N>-<task>` from `dev`. Nobody works on `main` directly.
- **Flow (I explain each command before it runs):**
  1. `git switch dev && git switch -c feature/p4-checkout-session`
  2. Commit small steps.
  3. `git switch dev && git merge --no-ff feature/p4-checkout-session`. `--no-ff` keeps a visible merge commit per feature.
  4. At a milestone: `git switch main && git merge --no-ff dev && git tag -a v0.1.0 -m "..."`.
  5. Optional cleanup with the safe `git branch -d`.
- **Never:** force-push, rebase shared branches, amend pushed commits, or commit `.env`.
- **Conventional Commits** with scopes `repo`, `api`, `web`, `db`, `payments`, `webhooks`, `orders`, `progress`. Examples:
  - `feat(payments): create Checkout Session for pending orders`
  - `fix(webhooks): ignore events without orderId metadata`
  - `test(webhooks): cover duplicate event delivery`
  - `docs(progress): complete phase 4`
- **Remote:** local only for now. A GitHub remote can be added any time without changing the flow.
- **`DEVELOPMENT_PROGRESS.md`** sections: Completed phases · Pending phases · Current branch · Important commits · Technical decisions (ADR-style one-liners) · Issues & blockers · Learning progress (concepts mastered + interview Qs answered) · Next task. Updated at every phase end and at notable task ends.

---

## 10. Key Technical Decisions & Reasoning

| # | Decision | Reasoning |
|---|---|---|
| 1 | Hosted Checkout (`ui_mode: hosted_page`) as the primary flow | Stripe's recommended approach; least code; Stripe handles 3DS, payment methods and receipts; lowest PCI burden (SAQ A) |
| 2 | PaymentIntents + Payment Element as a *comparison* flow (P8) | You explicitly asked for it. Stripe advises Checkout Sessions otherwise, and that trade-off is itself interview material |
| 3 | Inline `price_data`, not synced Stripe Products/Prices | Our DB is the source of truth for prices; no sync jobs and no immutable-Price versioning. Products/Prices are still explored in the P1 lab |
| 4 | Integer minor units, USD only | Matches how Stripe represents money; ACH (a delayed method) needs USD |
| 5 | Customers v1 API | GA and ubiquitous. Accounts v2 as customers is public preview outside Connect |
| 6 | API version pinned in code and on the webhook endpoint | Makes object shapes predictable; upgrades become deliberate |
| 7 | Snapshot events first, thin later | Your choice: most common in existing code and interviews; thin events taught in P11 |
| 8 | Webhook = truth; success page re-verifies server-side through the same idempotent function | Stripe's fulfillment guide; fast UX without trusting the browser |
| 9 | Reserve stock at order creation, with a 30-min session expiry | Prevents overselling during checkout; the shortest allowed expiry limits stock held by abandoned carts |
| 10 | Order 1-n Payment (attempts) | Supports retries, re-created sessions, and both flows on one model |
| 11 | `StripeEvent` log + guarded transitions inside DB transactions | Dedup, auditability, safe against out-of-order and concurrent delivery |
| 12 | Synchronous, fast webhook processing (no queue) | Avoids Redis/BullMQ infrastructure; the production queue pattern is explained in P6 and P10 |
| 13 | Only `payments/` imports `stripe` | One place to audit, mock and upgrade Stripe usage |
| 14 | Demo-user header, no auth; dev-only admin panel | Your choice; keeps focus on payments |
| 15 | Prisma 7.x stable (Prisma 8 is still RC) with `@prisma/adapter-pg` | Avoids pre-release churn |
| 16 | Versions pinned at install: Next.js 16.x, NestJS 12.x, stripe 23.x, @stripe/stripe-js 10.x, Prisma 7.10.x | Reproducible builds; exact versions recorded in the progress file |
| 17 | Webhook returns 200 for unknown or irrelevant events and 500 only for transient failures | Retries are for things a retry can fix |

---

## 11. Official Documentation References

- **Fundamentals:** [API keys](https://docs.stripe.com/keys) · [Keys best practices](https://docs.stripe.com/keys-best-practices) · [Versioning](https://docs.stripe.com/api/versioning) · [Set SDK version](https://docs.stripe.com/sdks/set-version) · [Currencies & minor units](https://docs.stripe.com/currencies) · [Sandboxes](https://docs.stripe.com/sandboxes) · [Stripe CLI](https://docs.stripe.com/cli) · [stripe-node](https://github.com/stripe/stripe-node)
- **Checkout:** [Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions) · [Create session](https://docs.stripe.com/api/checkout/sessions/create) · [Fulfill orders](https://docs.stripe.com/checkout/fulfillment) · [Checkout Sessions vs PaymentIntents](https://docs.stripe.com/payments/checkout-sessions-and-payment-intents-comparison) · [Expire a session](https://docs.stripe.com/api/checkout/sessions/expire)
- **PaymentIntents:** [Lifecycle](https://docs.stripe.com/payments/paymentintents/lifecycle) · [Payment Element quickstart](https://docs.stripe.com/payments/quickstart) · [3D Secure](https://docs.stripe.com/payments/3d-secure)
- **Webhooks & events:** [Webhooks](https://docs.stripe.com/webhooks) · [How events work (thin vs snapshot)](https://docs.stripe.com/events/how-events-work) · [Manage endpoints / undelivered events](https://docs.stripe.com/events/manage-webhook-endpoints) · [Snapshot event types](https://docs.stripe.com/api/events/types) · [Thin event types](https://docs.stripe.com/api/v2/core/events/event-types) · [Migrate to thin events](https://docs.stripe.com/webhooks/migrate-snapshot-to-thin-events)
- **Reliability:** [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · [Error handling](https://docs.stripe.com/error-handling) · [Low-level errors & retries](https://docs.stripe.com/error-low-level)
- **Refunds:** [Refund and cancel payments](https://docs.stripe.com/refunds) · [Refunds API](https://docs.stripe.com/api/refunds)
- **Advanced:** [Place a hold (auth & capture)](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method) · [ACH with Checkout](https://docs.stripe.com/payments/ach-direct-debit/accept-a-payment?payment-ui=checkout) · [Payment method notification timing](https://docs.stripe.com/payments/payment-methods#payment-notification) · [How disputes work](https://docs.stripe.com/disputes/how-disputes-work) · [Radar](https://docs.stripe.com/radar)
- **Testing & prod:** [Testing / test cards](https://docs.stripe.com/testing) · [Go-live checklist](https://docs.stripe.com/get-started/checklist/go-live) · [Integration security guide (PCI)](https://docs.stripe.com/security/guide)
- **Stack:** [NestJS raw body](https://docs.nestjs.com/faq/raw-body) · [Prisma ORM v7 docs](https://www.prisma.io/docs/orm/v7)

---

## 12. Collaboration Rules (how each session runs)

1. I explain the concept and draw the request lifecycle for that task. I don't re-explain React, Nest or REST basics.
2. You approve the approach, then I implement **one small task**, never a large code dump.
3. I walk through the code, we run it, and we try to break it with the failure scenarios.
4. I ask 3–5 interview-style questions; you answer, and I give feedback.
5. I update `DEVELOPMENT_PROGRESS.md`, explain the git commands, and we commit and merge.
6. **We go to the next phase only after your explicit approval.**

Any uncertain Stripe behavior gets checked against docs.stripe.com before we code it, for example the session `payment_status` under manual capture.

---

## 13. Verification (how we know each milestone works)

- **Milestone 1 (after P5):**
  - Start everything: `docker compose up -d`, `pnpm dev` (web + api), `stripe listen --forward-to localhost:4000/api/webhooks/stripe`.
  - As demo user A, add 2 products, then pay with `4242…`. The success page shows **Paid**.
  - Check the DB: the order is `PAID`, the payment is `SUCCEEDED` with `pi_`/`ch_` IDs, stock is committed, the cart is empty, and the `StripeEvent` rows are `PROCESSED`.
  - Run `stripe events resend <evt>` and confirm nothing changes.
  - Check the Dashboard: the PI metadata contains our `orderId`.
- **Milestone 2 (after P7):** a partial and then a full refund show correct statuses and amounts in our DB and in the Dashboard. A Dashboard-initiated refund syncs. The failing-refund card ends `FAILED`.
- **Each phase:** `pnpm --filter api test` and `test:e2e` pass, the manual matrix rows for that phase pass, and the progress file is updated.

---

## 14. Prerequisites & Risks

- **Stripe account:** you'll need a Stripe account with a sandbox, or test mode. The account's **country** determines which delayed payment methods (P9b) you can enable; ACH needs a US account. We'll check in Phase 0 and adapt.
- **Windows:** the Stripe CLI installs through npm. All commands are given for PowerShell and Git Bash.
- **Version drift:** library APIs (Next 16, Nest 12, Prisma 7) are checked against their docs when installed; anything surprising gets logged in the progress file.

**Next step after you approve this plan:** Phase 0, task 1 (git init + repo skeleton). I'll explain each git command before it runs.
