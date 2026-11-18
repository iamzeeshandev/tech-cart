# Prompt: TechCart storefront redesign + real product images

> Paste this whole file into a new Claude Code session at the repo root. It's one feature on its own branch, the last piece of Milestone 1 (`v0.1.0`).

## Your role

Act as a **senior frontend engineer with a product designer's eye**: someone who has shipped real e-commerce storefronts and cares about typography, spacing, hierarchy and copy as much as about clean React. You make deliberate design decisions, explain them briefly, and build them with restraint.

## The goal

Make TechCart look and feel like a **real, trustworthy online electronics store**: simple, easy to use, elegant, neat and clean. A visitor should never think "an AI made this". Replace the placeholder product images with real photos.

Success means a first-time visitor can, without thinking:
1. see what's for sale and what it costs;
2. open a product, see whether it's in stock, and add it to the cart;
3. check out with confidence and find the order afterwards.

## Design skill to follow

Use Anthropic's **`frontend-design`** skill (Apache-2.0): https://github.com/anthropics/skills/tree/main/skills/frontend-design

1. It is installed **for this project only** at `.claude/skills/frontend-design/` (`SKILL.md` + `LICENSE.txt`). Invoke it before planning. If it doesn't load, read `.claude/skills/frontend-design/SKILL.md` and follow it as instructions.
2. Follow its process exactly: **brief → design plan (tokens + ASCII wireframes) → review the plan against generic defaults and revise → build → critique with screenshots.**
3. Take its list of "AI-generated design tells" seriously. That list is the main tool for meeting the "must not feel AI-designed" requirement.

## Project context (read before planning)

- Monorepo (`pnpm`): `apps/web` (Next.js **16.4**, App Router, React 19.3, Tailwind **4.3**, TypeScript) and `apps/api` (NestJS + Prisma + Stripe). This task is almost entirely `apps/web`; in `apps/api` only `prisma/seed.ts` changes.
- **Read `apps/web/AGENTS.md` first.** Next.js 16 differs from your training data: check the bundled docs in `apps/web/node_modules/next/dist/docs/` before using any Next API (especially `next/image`, `next/font` and Cache Components), and heed deprecation notices.
- `cacheComponents: true`: request-time data (cookies, `searchParams`) must sit inside `<Suspense>` or a route `loading.tsx`. `params` and `searchParams` are Promises. Pages are typed with the global `PageProps<'/route'>`; run `npx next typegen` after adding a route.
- Tailwind 4 is configured CSS-first in `src/app/globals.css` (`@theme`); there is no `tailwind.config.js`. Define design tokens there as CSS variables.
- Current UI: plain create-next-app defaults. Geist fonts are loaded, but `body` still forces `Arial`. Zinc greys and a few `dark:` classes. No component library, no icon set.
- Routes: `/` (catalog), `/products/[slug]`, `/cart`, `/checkout/success`, `/checkout/cancel`, `/orders`, `/orders/[orderId]`, plus the root `layout.tsx` and `loading.tsx`.
- Components in `src/components/`: `add-to-cart-button`, `cart-item-controls`, `checkout-button`, `demo-user-menu`, `demo-user-switcher`, `order-status`, `order-summary`, `stock-label`.
- Data (from `src/lib/api.ts`):
  - products have `name`, `slug`, `description`, `priceAmount` (integer cents), `currency`, `category {slug, name}`, `inventory.quantityAvailable`, `imageUrl`;
  - 4 categories: Laptops, Phones, Audio, Accessories;
  - 9 active products, with edge cases: Orbit Mini has 1 in stock, Echo Buds has 0, Cable Ties costs $0.35 (below Stripe's $0.50 minimum on its own), Retro Dock is inactive.
- "Login" is a **demo-user dropdown** (Sarah, James, Emily) that sets a cookie. It's a learning stand-in for auth and should stay, styled as a clearly secondary demo control.
- Payments run in **Stripe test mode**. Hosted Checkout handles card entry, so nothing here touches card data.

## Design brief

- **Subject:** TechCart, a small independent online electronics shop (laptops, phones, audio, accessories). The brands are fictional.
- **Audience:** everyday shoppers buying a device for themselves; mostly on a phone, often on a laptop.
- **Primary job of every page:** help the shopper decide and act. **The products are the hero, not marketing.**
- **Tone:** calm, precise, trustworthy, like a well-run specialist shop: confident whitespace, honest information, no hype.
- **Principles:** neat, elegant, simple, clean. One clear primary action per page. Price and stock are always easy to read. Consistent spacing and alignment everywhere.

### Must not (on top of the skill's list of tells)

- No marketing filler ("Elevate your…", "Unleash…", "Experience the future…").
- No fake social proof: no star ratings, review counts, testimonials, "bestseller" badges, countdowns, fake discounts or strikethrough prices.
- No decorative gradients, blobs, glassmorphism, emoji as icons, or newsletter pop-ups.
- No identical-card grid where every element has the same radius and the same soft shadow.
- No ALL-CAPS eyebrow labels, "→" glued to every link, or monospace text for ordinary labels.
- Don't keep Geist/Arial by inertia. Choose the typefaces deliberately (loaded with `next/font`), and explain the choice in the plan.

### Must

- **Responsive** from 360 px to 1440 px; on phones the cart and the checkout button stay reachable without hunting.
- **Accessible:** semantic HTML, a visible keyboard focus style, WCAG AA contrast, 44 px touch targets, `prefers-reduced-motion` respected, meaningful `alt` text.
- **Product photos look like one set:** the same aspect ratio and the same treatment (for example `object-contain` on a quiet neutral surface, or `object-cover` with consistent framing), so the grid feels curated.
- **Copy:** sentence case, plain verbs, specific. Buttons say what happens ("Add to cart", "Go to checkout"). Errors say what went wrong and how to fix it. Empty states invite the next action.
- **Theme:** either design a real dark theme from the same tokens, or ship light only and remove the half-done `dark:` classes. Don't leave a half-styled dark mode.
- **Test mode is visible but quiet:** a small persistent notice (for example in the footer) saying payments are in Stripe test mode, with the test card `4242 4242 4242 4242`.
- **Motion:** at most one deliberate moment, plus small feedback motion that answers an action (added to cart, quantity changed).

## Hard constraints (don't break these)

1. **Change no business or payment logic.** Treat these as behaviour you must preserve while restyling:
   - the `Idempotency-Key` handling in `checkout-button.tsx`;
   - `cartRequest` and `startCheckout` in `src/lib/cart-client.ts`;
   - the server-side data fetching in `src/lib/api.ts`;
   - the success page's server-verified status;
   - every API request and response.

   If a UX idea needs an API change, **stop and ask**.
2. **Money:** display only, via `formatMoney` (amounts are integer cents). The cart subtotal stays labelled as an estimate; the server decides the real total at checkout.
3. **Don't touch any Stripe code**, and add no Stripe.js. Never put a secret key in `apps/web`.
4. **Dependencies:** none by default. If you believe one is needed (for example an icon set such as `lucide-react`), propose it with a reason and wait for approval. Fonts come through `next/font/google`.
5. **Code style:**
   - small, readable components in `src/components/` (kebab-case files);
   - Server Components by default; `"use client"` only where there is interaction;
   - **very sparse comments**: only a short "why" where it prevents a real mistake, never "what" comments;
   - no `*.spec.ts` files: test by running the app.
6. **Database:** never run seed or migration commands yourself. Give the user the exact command and say what it does; they run it.
7. **The user's dev servers** (`next dev` on :3000, `nest start --watch` on :4000) are running. Don't run `next build` or `nest build`, and never kill their processes. Check your work with `npx tsc --noEmit`, `npx next typegen`, `pnpm --filter web lint` and the running app.

## Git workflow for this feature

- **Create the branch yourself** (allowed for this feature), from an up-to-date **local** `dev`, after checking the working tree is clean:
  ```bash
  git switch dev
  git pull --ff-only
  git switch -c feature/m1-storefront-design
  ```
  Don't branch from `origin/dev`. That makes the branch track `dev`, and in Phase 5 that sent pushes straight to `dev`, bypassing the PR.
- **Don't commit, push or merge.** At the end of each task, give the user the exact `git add` / `git commit` commands (Conventional Commits, one commit per task) and say what each stages. The user commits, pushes with `git push -u origin feature/m1-storefront-design`, and opens the PR into `dev`. Then comes Milestone 1: PR `dev → main`, tag `v0.1.0`.

## Tasks (stop for the user's review where marked ⏸)

### Task 1 — Real product images

**Decisions (already agreed):**
- Files live in `apps/web/public/products/<slug>.jpg`, served by Next at `/products/<slug>.jpg`, committed to git.
- The database stores only the **path**: `Product.imageUrl = "/products/<slug>.jpg"`. No base64 in Postgres, no cloud storage yet. Moving to object storage (e.g. Cloudflare R2) later changes only this value plus one `next.config.ts` line.
- 10 images, one per product slug, including the inactive `retro-dock`: `aero-14-laptop`, `nimbus-16-pro`, `pixelon-9`, `orbit-mini`, `pulse-anc-headphones`, `echo-buds`, `usb-c-charger-65w`, `usb-c-cable-2m`, `cable-ties`, `retro-dock`.
- JPG, **1200×800** (3:2), quality about 80, ideally under 250 KB each. `next/image` serves WebP/AVIF at the right width (`sharp` is installed).
- Images on Stripe's Checkout page are out of scope: `product_data.images` needs public HTTPS URLs, which comes with cloud storage later.

**Steps:**
1. **Source the photos.** If the user has supplied their own files, use those. Otherwise use **Unsplash** (free use under the Unsplash License):
   - prefer clean product shots on plain backgrounds, with **no visible real brands or logos** (our brands are fictional) and a consistent style across the set;
   - skip paid "Unsplash+" images (`plus.unsplash.com`);
   - download at exact size: `https://images.unsplash.com/photo-<id>?w=1200&h=800&fit=crop&q=80&fm=jpg`;
   - **open every image and look at it** to confirm it really shows that product type and fits the set, and confirm each file is a real JPEG;
   - list each source (photo page URL and photographer) in `apps/web/public/products/CREDITS.md`.
2. `apps/api/prisma/seed.ts`: set `imageUrl` to `` `/products/${product.slug}.jpg` ``. The upsert already updates `imageUrl` on existing products, and stock is only written on create.
3. `apps/web/next.config.ts`: remove the `placehold.co` `remotePatterns` entry. First check the bundled Next 16 image docs for local images (for example `localPatterns` and the allowed `qualities`) and configure only what's needed.
4. Every `next/image`: a correct `sizes` attribute (a grid card isn't full width; a cart thumbnail is about 96 px), consistent aspect ratio and fit, real `alt` text.
5. Ask the user to run `pnpm --filter api db:seed`. It updates `imageUrl` on existing products; stock, users, carts and orders are untouched.
6. Verify:
   - all pages show the photos;
   - DevTools shows `/_next/image?url=%2Fproducts%2F…&w=…` served as WebP/AVIF;
   - nothing is requested from `placehold.co`;
   - the cart thumbnail downloads a small width;
   - type-check and lint pass.

⏸ Show the 10 chosen images (names + sources) and the results, and give the commit commands.

### Task 2 — Design plan (no code yet)

Following the skill, produce a compact plan:
- **Palette:** 4–6 named hex values, with contrast checked.
- **Type:** families, roles, a type scale and weights.
- **Spacing and radius scale.**
- **Layout concept:** ASCII wireframes for the header, catalog, product page and cart, at mobile and desktop widths.
- **The one memorable element**, and **3–5 principles** for this store.

Then review the plan against the skill's list of generic defaults and the "Must not" list above. Say what you changed and why.

⏸ **Stop and wait for the user's approval before writing any UI code.**

### Task 3 — Build the design

Build it in this order, keeping each step small and checking it in the running app:
1. **Tokens and shell:**
   - tokens in `globals.css`, fonts in `layout.tsx`;
   - header: wordmark, Orders, Cart with item count (server-rendered from `getCart`, inside `<Suspense>`), and the demo-user control styled as secondary;
   - footer with the test-mode notice;
   - focus styles.
2. **Catalog `/`:**
   - products **grouped by category** (the API already sorts by category; no filter or search UI);
   - clear name, price and stock; out of stock looks clearly unavailable but stays visible;
   - no marketing hero: at most a short, honest intro line.
3. **Product page:**
   - large image, name, price, a stock line ("In stock", "Only 1 left", "Out of stock"), description, add to cart with clear feedback and a path to the cart;
   - a back link to the catalog.
4. **Cart:**
   - lines with image, quantity controls and remove;
   - subtotal (labelled as an estimate) and the checkout button as the one primary action;
   - empty and no-user states;
   - API errors (e.g. "Only 1 in stock", the $0.50 minimum) shown inline and clearly.
5. **Checkout success and cancel:** a clear outcome, the order summary, and the next step (view order / back to cart / resume payment).
6. **Orders list and detail:**
   - a readable list with status;
   - the detail shows items, total and payment;
   - the **Stripe events timeline stays** (it's a learning aid) but becomes a quiet secondary section, for example a collapsed `<details>` labelled for developers.
7. **`loading.tsx`, plus a custom `not-found.tsx`.**

### Task 4 — Critique and polish

- Take screenshots at **375 px and 1280 px** (use a browser tool if one is available) of every page, including the empty, out-of-stock, error and success states. Critique them against the brief and the skill, then fix what's off. "Remove one accessory."
- Keyboard-only run: browse → add to cart → checkout button. Focus must always be visible, and the order must be logical.
- Check contrast and `prefers-reduced-motion`.
- Pass type-check, `next typegen` and lint.
- Do the full purchase in test mode (`4242 4242 4242 4242`) and confirm nothing in the payment flow changed.

⏸ Show the before/after screenshots and give the commit commands.

## Progress tracking

- `DEVELOPMENT_PROGRESS.md`:
  - add a "Milestone 1: storefront" task list;
  - add decision rows for the image storage choice, the design system and the font choice;
  - in the Pull requests table, note that Phase 5 reached `dev` by direct push (the branch tracked `origin/dev`), with no PR.
- `docs/STRIPE_NOTES.md` doesn't change (not a Stripe topic).

## Out of scope

Search, filters, sorting, wishlists, reviews or ratings, user accounts or auth, an admin panel, image uploads or cloud storage, images on Stripe's Checkout page, internationalization, and any change to the API, the database schema or the payment flow.

## Definition of done

- [ ] 10 real photos in `public/products/`, credited, the seed updated, and no `placehold.co` left anywhere
- [ ] Design plan approved by the user before UI code
- [ ] Every route restyled consistently; nothing in the "Must not" list appears
- [ ] Responsive at 360–1440 px; keyboard, contrast and reduced-motion checks pass
- [ ] Payment flow, API calls and business logic unchanged; a full test purchase works
- [ ] Type-check, typegen and lint pass; no `next build` or `nest build` run against the user's dev servers
- [ ] Progress file updated; commit commands handed to the user, one per task
