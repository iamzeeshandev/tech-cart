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

**Money:** integers in minor units. `129900` = $1,299.00. Zero-decimal currencies (e.g. JPY) have no ×100.

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
| Checkout Session | `cs_` | Hosted payment page (Phase 4) |

**PaymentIntent statuses:** `requires_payment_method` → (`requires_confirmation`) → `requires_action` (3DS) → `processing` → `succeeded` · also `requires_capture`, `canceled`. A decline sends it back to `requires_payment_method` (retryable).

**Events seen so far:** `payment_intent.created/succeeded/payment_failed` · `charge.succeeded/failed/updated/refunded` · `refund.created/updated` (`charge.refund.updated` is deprecated).

**Test cards:** `4242 4242 4242 4242` success · `4000 0000 0000 0002` generic decline · `4000 0000 0000 9995` insufficient funds · more as we use them.

**CLI:** `stripe login` · `stripe <resource> create|retrieve|list` (`-d key=val`, `-e` expand, `-i` idempotency key) · `stripe listen --forward-to <url>` · `stripe trigger <event>` · `stripe events resend <evt>` · `stripe logs tail`.

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

**Code:** `apps/api/src/payments/stripe.client.ts`, `apps/api/src/payments/payments.controller.ts` · try it: `curl localhost:4000/api/payments/health` or Swagger at `localhost:4000/api/docs`
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
