# Stripe Notes — TechCart

Revision sheet: the cheat sheet first, then each phase in build order. Update rules: [STRIPE_NOTES_PROMPT.md](STRIPE_NOTES_PROMPT.md).

## Cheat sheet

**Keys**
| Key | Prefix | Lives | Can |
|---|---|---|---|
| Publishable | `pk_test_` / `pk_live_` | Browser | Identify account to Stripe.js, tokenize card details. Can't charge or read data |
| Secret | `sk_` | Server only | Everything on the account |
| Restricted | `rk_` | Server only | Only granted permissions. Stripe's recommended default for production |
| Webhook signing secret | `whsec_` | Server only | Not an API key: verifies a webhook really came from Stripe |

**Request anatomy:** HTTPS to `api.stripe.com/v1/...` · key as credential (`Authorization: Bearer sk_...` or Basic) · form-encoded body (`metadata[k]=v`) · JSON response · response headers `Request-Id` (find it in Workbench → Logs), `Stripe-Version`, `Idempotent-Replayed: true` on a replay · send `Idempotency-Key` on POSTs you might retry.

**REST shape (v1):** create `POST /v1/customers` · retrieve `GET /v1/customers/cus_x` · **update `POST /v1/customers/cus_x`** (POST, not PUT/PATCH) · list `GET /v1/customers?limit=3` · delete `DELETE /v1/customers/cus_x`. The CLI (`stripe customers create`), curl and the SDK (`stripe.customers.create()`) all send these same requests.

**Who calls whom:** our server → Stripe (requests, Workbench **Logs**) · customer's browser → Stripe-hosted Checkout (card data never touches us) · Stripe → our server (**Events** delivered as webhooks, Workbench **Webhooks**).

**Money:** integers in minor units. `129900` = $1,299.00. Zero-decimal currencies (e.g. JPY) have no ×100. Lowercase currency codes (`usd`). Minimum charge **$0.50 USD** (depends on settlement currency). Max: 8 digits for most methods (`99999999`), up to 12 for cards.

**Objects (ID prefix)**
| Object | Prefix | One-liner |
|---|---|---|
| Customer | `cus_` | Who pays; reusable; holds email and saved payment methods |
| Product / Price | `prod_` / `price_` | Catalog. A Price is immutable (amount + currency). Used by Checkout/Billing, **not** by PaymentIntents |
| PaymentIntent | `pi_` | State machine for collecting one payment; can have several attempts |
| PaymentMethod | `pm_` | The card/bank used. Test ones: `pm_card_visa`, `pm_card_visa_chargeDeclined` |
| Charge | `ch_` | One attempt to move money (succeeded or failed) |
| BalanceTransaction | `txn_` | Money in your Stripe balance: amount, fee, net, `pending` → `available` |
| Refund | `re_` | Money back to the original payment method |
| Event | `evt_` | A record of every state change; what webhooks deliver |
| Checkout Session | `cs_` | Stripe-hosted page for a fixed list of line items; creates the PaymentIntent when the customer clicks Pay |

**PaymentIntent statuses:** `requires_payment_method` → (`requires_confirmation`) → `requires_action` (3DS) → `processing` → `succeeded` · also `requires_capture`, `canceled`. A decline sends it back to `requires_payment_method` (retryable).

**Checkout Session statuses:** `status` `open` → `complete` | `expired` · `payment_status` `unpaid` | `paid` | `no_payment_required`. A decline keeps it `open`.

**Events seen so far:** `payment_intent.created/succeeded/payment_failed` · `charge.succeeded/failed/updated/refunded` · `refund.created/updated` (`charge.refund.updated` is deprecated) · `checkout.session.completed`. Creating a Checkout Session emits **no** event.

**Stripe error → action:** 4xx except 409/429 = Stripe rejected the request, so sending it again can't help (fix it or give up) · 409 (same idempotency key still in progress), 429, 5xx, network error/timeout = outcome unknown, so retry with the **same** idempotency key.

**Test cards:** `4242 4242 4242 4242` success · `4000 0000 0000 0002` generic decline · `4000 0000 0000 9995` insufficient funds · more as we use them.

**CLI:** `stripe login` · `stripe <resource> create|retrieve|list` (`-d key=val`, `-e` expand, `-i` idempotency key) · `stripe checkout sessions retrieve cs_…` · `stripe charges list --payment-intent pi_…` · `stripe listen --forward-to <url>` · `stripe trigger <event>` · `stripe events resend <evt>` · `stripe logs tail`. In Git Bash, prefix raw paths: `MSYS_NO_PATHCONV=1 stripe get /v1/events`.

---

## Phase 0 — Account, keys, safe config

**Goal:** a sandbox account wired to the API so that no secret can leak and no live key can be used.

**Sequence**
1. Create a Stripe account and use its **sandbox** (isolated test environment; never activate live).
2. Copy the sandbox `sk_test_...` into `apps/api/.env` (git-ignored). `.env.example` documents it without the value.
3. The API validates env at boot with zod: only `sk_test_`/`rk_test_` is accepted, otherwise it refuses to start.
4. Enable CLI access (Settings → Team and security → MCP and CLI access), then `stripe login` (browser pairing code).
5. Verify `GET /v1/balance` three ways: `stripe balance retrieve`, raw `curl ... -u sk_test_...:`, and the API booting.
6. Debug view: **Workbench → Logs** shows each request's ID, API version, user agent and the key used.

**Why:** fail-fast config turns "missing secret" into a boot error, not a broken checkout. A sandbox key can never touch live data.

**Gotchas**
- No version sent → Stripe uses the **account default** (Workbench: "Specified by account default").
- Workbench doesn't store response bodies for GET requests.
- CLI ≥ 1.50 needs CLI access enabled by an admin.
- On Windows, `localhost` resolves to IPv6 first; use `127.0.0.1` for Docker services bound to IPv4.

**Code:** `apps/api/src/config/env.ts`, `apps/api/.env.example`

**Q&A**
- **Which key goes where, and why is that safe?** `pk_` in the browser only identifies the account and tokenizes card details; it can't charge or read data. `sk_`/`rk_` stay on the server, where every money-moving call and every amount is decided.
- **`sk_test_` pushed to a public repo: impact and response?** Sandbox data only, no real money, but rotate it anyway (Dashboard → API keys → Rotate). With `sk_live_`: an attacker can refund, read customer data and charge saved cards, so rotate immediately, check Workbench logs for unknown IPs, and move to restricted keys with access policies.
- **No API version sent: which applies, and why is that risky?** The account default. If someone upgrades the default, response shapes change under unpinned code, so pin the version in the SDK and on webhook endpoints.
- **"Charged but my order says unpaid": what do you check first?** Our order's stored Stripe IDs (PaymentIntent / Checkout Session) and the event delivery status in the Dashboard. Usually the webhook failed or wasn't processed.

---

## Phase 1 — Stripe objects and the SDK client

**Goal:** know exactly which objects one payment creates, then talk to Stripe from NestJS correctly.

**Sequence (CLI lab, sandbox)**
1. `customers create` → `cus_`.
2. `products create` + `prices create --unit-amount 129900 --currency usd` → `prod_`, `price_` (catalog only).
3. `payment_intents create --amount 129900 --payment-method pm_card_visa --confirm=true` → `pi_` `succeeded`, `latest_charge` → `ch_`.
4. Charge → BalanceTransaction `txn_`: amount 129900, **fee 3797** (2.9% + 30¢), **net 126103**, status `pending`.
5. Declined PM → `card_error / card_declined / generic_decline`; PI goes back to `requires_payment_method`; a failed `ch_` is created.
6. `refunds create --payment-intent pi_...` → `re_` `succeeded`; charge `refunded: true`.
7. Events, in order: `payment_intent.created` → `charge.succeeded` → `payment_intent.succeeded` → `charge.updated` → (decline) `charge.failed`, `payment_intent.payment_failed` → (refund) `refund.created`, `charge.refunded`, `refund.updated`.
8. NestJS: one Stripe client provider (`STRIPE_CLIENT`) with pinned `apiVersion`, `maxNetworkRetries: 2`, `timeout: 20s`. `GET /api/payments/health` calls `balance.retrieve()` and returns the version and request ID.

**Why**
- **Pinned `apiVersion`:** the SDK's TypeScript type only accepts its own version, so upgrades become deliberate code changes.
- **`maxNetworkRetries`:** the SDK retries connection errors, 409 and 5xx (not 429), plus anything Stripe marks with `Stripe-Should-Retry: true`, using exponential backoff. It adds a **random** idempotency key per call, so its own retries can't duplicate. If *our* code retries an operation, the SDK makes a new key, so we pass our own deterministic key derived from a DB row (Phase 4).
- **`timeout` 20s** instead of the 80s default: fail fast on a stuck request rather than hanging checkout.
- **Products/Prices vs `price_data`:** PaymentIntents only know `amount` + `currency`. Checkout accepts either a `price` ID or inline `price_data`. TechCart uses `price_data` so our DB stays the single source of truth for prices, with no sync jobs.

**Gotchas**
- `balance_transaction` can be `null` right after success; Stripe attaches it shortly after (`charge.updated`).
- Confirming server-side with `automatic_payment_methods` needed `allow_redirects: never` because we gave no `return_url`.
- Same idempotency key + different params → `idempotency_error`. Keys can be pruned after 24h.
- Stripe masks keys in error messages; never log keys yourself.
- `curl --retry` retries on 503 too, which matters when testing failure paths.

**Code:** `apps/api/src/modules/payment/stripe.client.ts`, `payment.service.ts` (the Stripe call), `payment.controller.ts` (route) · try it: `curl localhost:4000/api/payments/health` or Swagger at `localhost:4000/api/docs`
- In Workbench, SDK calls show **"Specified by request"** and user agent `Stripe/v1 NodeBindings/23.1.0 TechCart`; curl calls show "Specified by account default". That difference is the version pin, visible.
- HTTP status of failures in Workbench: **402** = card declined (`card_error`), **400** = bad request or idempotency mismatch, **401** = bad key.
- **Logs vs Events:** Logs = every request someone *sent* (reads, writes, errors). Events = state *changes* only: reads never create events, a 400 creates none, a 402 decline does (the attempt happened). `event.request.id` names the request that caused it; `null` means Stripe changed something on its own.
- Lab proof: one `POST /v1/payment_intents` (one request) → `payment_intent.created` + `charge.succeeded` + `payment_intent.succeeded`; then `charge.updated` (fee attached) and `refund.updated` with **no request**. An idempotent replay gets a new `Request-Id` and `Idempotent-Replayed: true`, but **no new event**.
- CLI calls authenticate with the `stripe login` OAuth session (stored in the OS credential store), not with `sk_test_`.
```ts
new Stripe(key, { apiVersion: '2026-10-28.endive', maxNetworkRetries: 2, timeout: 20_000 })
```

**Q&A**
- **Which objects does one successful card payment create?** PaymentIntent → PaymentMethod → Charge → BalanceTransaction (fees/net), with an Event for each change. A Customer is optional but links payments to a buyer.
- **PaymentIntent vs Charge?** A PaymentIntent tracks collecting one payment across attempts. A Charge is a single attempt. A decline creates a failed Charge, and the PaymentIntent returns to `requires_payment_method` for another try.
- **What does an idempotency key guarantee?** Same key + same params returns the first response (even a 500) instead of running again. Different params → `idempotency_error`. Use one on every POST you might retry, e.g. after a timeout.
- **The SDK already adds idempotency keys, so why pass your own?** The SDK's key is random per call and only covers its internal retries. A user double-click or our own job retry is a new call with a new key, so it would charge twice. A key derived from our DB row (e.g. `checkout:<paymentId>`) makes every retry of the *same business operation* safe.
- **Where do you see Stripe's fee and when you get the money?** On the BalanceTransaction: `amount`, `fee`, `net`, and `status` `pending` → `available` (`available_on`).
- **Why not use Stripe Prices for an e-commerce catalog?** You can, but Prices are immutable copies of your prices that need syncing. With inline `price_data` the server sends the amount it trusts from its own DB on every checkout.
- **Workbench Logs vs Events?** Logs record requests sent *to* Stripe. Events record what *changed* as a result, or on Stripe's own schedule. One request can cause several events; some events have no request at all (async changes), which is exactly why you need webhooks.
- **How do you trace an event back to its cause?** `event.request.id` (plus `request.idempotency_key`) points to the request in Workbench Logs. If it's null, Stripe made the change itself, e.g. the fee being attached or a refund settling.
- **How do you debug one failed Stripe call?** Take `requestId` from the error (or `lastResponse`) and open it in Workbench → Logs: request, response, API version, key.

---

## Phase 2 — Catalog: prices the server trusts

**Goal:** prices live in our DB as integer minor units, ready to go to Stripe unchanged. No Stripe calls in this phase.

**Sequence**
1. `Product.priceAmount Int` (cents) + `currency` (`usd`); stock in `Inventory` (`quantityAvailable`, `quantityReserved`).
2. Seed upserts by slug and never resets stock. Edge-case rows: 1 left, 0 left, $0.35, inactive.
3. `GET /api/products` and `/api/products/:slug` return a `select` whitelist; inactive or unknown → 404.
4. Next.js Server Components fetch the API on every request (uncached) and format cents for display only.
5. Phase 4: checkout re-reads `priceAmount` from the DB into `price_data.unit_amount`. The browser never sends amounts.

**Why**
- **Integers:** floats can't hold most decimals exactly, and Stripe uses integer minor units, so the stored value crosses the boundary with no conversion.
- **Uncached catalog reads:** displayed stock and price stay close to what checkout will use. Display is never authoritative; checkout re-reads.
- **Soft hide (`isActive`):** orders and refunds will reference products, so products are never deleted.

**Gotchas**
- Below Stripe's minimum ($0.50 USD) the charge is rejected. Check it in our API before calling Stripe; Phase 4 records the exact Stripe error.
- Zero-decimal (JPY): `amount: 500` = ¥500. Code that always multiplies by 100 overcharges 100×.
- ISK and UGX are zero-decimal, yet Stripe still expects them as two-decimal values (×100). `Intl`'s decimals don't match Stripe there.

**Code:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/src/modules/product/product.service.ts`, `apps/web/src/lib/money.ts`
```ts
format.format(amount / 10 ** format.resolvedOptions().maximumFractionDigits) // display only
```

**Q&A**
- **Why store money as integers in minor units?** Floats can't represent most decimal fractions exactly (0.1 + 0.2 ≠ 0.3), so totals drift by cents. Stripe uses integer minor units too, so the DB value goes to Stripe unchanged.
- **What's a zero-decimal currency?** A currency without a minor unit, like JPY: `amount: 500` means ¥500. Always multiplying by 100 would charge 100× too much.
- **The page shows $1,299 and a user edits the request to $1. What gets charged?** $1,299. The server ignores client amounts and builds `unit_amount` from the DB at checkout.
- **A cart totals $0.35. Where should it fail?** In our API, before calling Stripe: a clear 400 error, and no order or session that can never be paid. Stripe rejecting it is only the backstop.
- **Why not delete discontinued products?** Orders and refunds point at them. `isActive: false` only hides them from the catalog.

---

## Phase 3 — Users and cart: untrusted input

**Goal:** know who is buying (each user later maps to one Stripe Customer) and hold their cart without trusting anything the browser sends. No Stripe calls yet.

**Sequence**
1. The header dropdown saves the demo user in a cookie; every cart call sends `x-demo-user-id`, a stand-in for a session or JWT.
2. `DemoUserGuard` loads the user (401 if missing or unknown); `@CurrentUser()` passes it to the controller.
3. The cart is `CartItem(userId, productId, quantity)` rows. **No prices stored.**
4. Add or update: zod validates (integer 1–10, unknown keys stripped) → product must be active → soft stock check (409).
5. `GET /api/cart` returns lines and a subtotal from current DB prices: a **display estimate**.
6. Next (Phase 4): checkout reads the cart rows, then re-reads prices and stock itself.

**Why**
- Everything from the browser (price, quantity, product id, even the user id here) can be edited in DevTools, so the server re-derives what matters.
- `User.stripeCustomerId @unique` is ready, so one buyer maps to one Stripe Customer (Phase 4).

**Gotchas**
- A tampered `priceAmount` in the body is silently stripped; the cart total still uses the DB price.
- The stock check at add-to-cart is **not a reservation**: two carts can both hold the last unit. Only checkout will reserve.
- Scope by owner inside the query (`where: { id, userId }`), so another user's item id gives 404 (blocks IDOR).
- Header-based demo identity is not auth: anyone can send any id. Production uses an httpOnly session cookie or a server-verified JWT.

**Code:** `apps/api/src/modules/user/demo-user.guard.ts`, `apps/api/src/modules/cart/cart.service.ts`, `apps/web/src/lib/cart-client.ts`

**Q&A**
- **Why doesn't the cart store prices?** Prices change and the browser can lie. Checkout re-reads prices from the DB, so a stored price could only be stale or forged.
- **Two users both have the last Orbit Mini in their carts. Who gets it?** The cart doesn't decide. It only gives early feedback, and the stock reservation at checkout decides.
- **How do you stop a user changing another user's cart item?** Put the authenticated user into every query (`where: { id, userId }`) and return 404, which doesn't even confirm the item exists.

---

## Phase 4 — Hosted Checkout: order, reserve, redirect

**Goal:** turn the cart into a server-priced order with reserved stock, then send the customer to a Stripe-hosted page to pay exactly that amount.

**Sequence**
1. Browser `POST /api/checkout` with `Idempotency-Key: <uuid>` and **no body** (no prices, no amounts).
2. One DB transaction: read cart → active, USD, ≥ $0.50 → insert `Order(PENDING_PAYMENT)` + `OrderItem` snapshots + `Payment(PENDING)` (this claims the key) → reserve stock per item with `UPDATE … WHERE available >= qty`.
3. User's first checkout: `customers.create` with key `customer:<userId>` → save `cus_` on `User`.
4. `checkout.sessions.create` with key `checkout-session:<paymentId>` → `cs_`: `status: open`, `payment_status: unpaid`, `payment_intent: null`, `url`.
5. Save `cs_` + url on `Payment` → `201 { checkoutUrl }` → `window.location.assign(checkoutUrl)`.
6. On Stripe's page, Pay creates the PaymentIntent. A decline adds a failed Charge; the PI returns to `requires_payment_method` and the session stays `open`.
7. Success → `charge.succeeded`, `payment_intent.succeeded`, `checkout.session.completed` → redirect to `success_url?session_id=cs_…`.
8. Our DB still says `PENDING_PAYMENT`: the events exist in Stripe, but nobody receives them yet (Phase 5).

**Why**
- **Hosted page:** Stripe collects card data, 3DS and wallets, so we stay in the lightest PCI scope (SAQ A). No Stripe.js and no publishable key are needed.
- **Snapshots:** `OrderItem` keeps the name and `unitAmount` the customer agreed to; `price_data` is built from them, never from live prices or the browser.
- **Insert the order before reserving:** a duplicate request with the same key collides on the unique index before it touches stock.
- **`expires_at` = reservation end.** 35 min = Stripe's 30-min minimum + 5 min, so a retry can resend the *same* saved `expires_at`.
- **Every session param comes from saved rows** (items sorted by `productId`): a retry is byte-identical, so Stripe returns the session it already made.
- **`client_reference_id` vs `metadata`:** one id on the session vs key-value pairs. `payment_intent_data.metadata` copies them onto the PaymentIntent, and Stripe copied them onto the Charge too, so later events can be traced back to our order.

| Two layers of idempotency | Key | Protects against |
|---|---|---|
| Browser → our API | `Idempotency-Key` header, `@@unique([userId, idempotencyKey])` | double-click, client retry → one order, one reservation |
| Our API → Stripe | `customer:<userId>`, `checkout-session:<paymentId>` | our retry after a timeout → one Customer, one session |

**Gotchas** (each one hit in this phase)
- Reserving stock *before* claiming the key gave a duplicate request a false 409 "Not enough stock". Insert the order first.
- Treating `StripeIdempotencyError` as permanent: a concurrent same-key request gets **409 "in progress"**, which would have cancelled a healthy order. Classify by status code.
- A retry with less than 30 min left → `invalid_request_error`: *"The `expires_at` timestamp must be at least 30 minutes from Checkout Session creation."* Cancel the order and release the stock.
- An unordered relation `include` can reorder `line_items` on retry → `idempotency_error`. Sort.
- `{CHECKOUT_SESSION_ID}` is documented for `success_url` only; our `cancel_url` carries `order_id`.
- **Abandoned checkout:** the session expires at Stripe but our stock stays reserved, which blocked Sarah from re-buying the last Orbit Mini. Phase 5 releases it on `checkout.session.expired`.
- The cart stays until payment is confirmed. Until then a second Checkout click creates a second order, so the same cart can be paid twice.

**Code:** `apps/api/src/modules/order/order.service.ts` (transaction, cancel), `apps/api/src/modules/checkout/checkout.service.ts` (orchestration, error policy), `apps/api/src/modules/payment/payment.service.ts` (the only Stripe calls), `apps/web/src/components/checkout-button.tsx`, `apps/web/src/app/checkout/{success,cancel}/page.tsx`
```ts
tx.inventory.updateMany({ where: { productId, quantityAvailable: { gte: qty } }, data: { quantityAvailable: { decrement: qty }, quantityReserved: { increment: qty } } }) // count 0 → 409
```

**Observed (Aero 14, 13 Nov):** session created 11:10:30; PI created at Pay, 11:12:07. Decline `0002`, then `4242`: one PI, two Charges. Fee 3797, net 126103. 7 events, `checkout.session.completed` at 11:12:49. DB: order `PENDING_PAYMENT`, payment `PENDING`, stock reserved, cart full.

**Q&A**
- **Why does the browser send no amount?** Anything from the browser can be edited. The server reads the cart's product ids and quantities, re-reads prices from the DB, snapshots them, and builds `price_data` from the snapshots.
- **How do you stop a double-click creating two orders or two sessions?** Two idempotency layers: the client key is unique per user in our DB, so a duplicate replays the first order. Our Stripe key is derived from the payment row, so even concurrent duplicates get the same `cs_` (proved with 5 parallel requests: 1 order, 1 Customer, 1 session).
- **Session creation times out. Did Stripe create it?** Unknown. Keep the order and stock and answer 503; a retry with the same key resends the identical request, and Stripe returns the session if it exists or creates it now. A 4xx is different: cancel and release stock.
- **Why can't the success redirect mark the order paid?** Anyone can open that URL with any `session_id`, and the redirect may never happen (closed tab). Only a verified webhook or a server-side session retrieve is proof.
- **What happens to stock if the customer never comes back?** It stays reserved until the session's `expires_at`. Stripe then emits `checkout.session.expired`, and the handler (Phase 5) releases it. Without that handler it stays reserved forever, which we saw.
- **`client_reference_id` or `metadata`: which do you use?** Both carry our ids. `client_reference_id` is a single reconciliation id on the session; `metadata` (plus `payment_intent_data.metadata`) reaches the PaymentIntent and Charge, so `payment_intent.*` and `charge.*` events map back to the order.
