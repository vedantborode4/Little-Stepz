# Dark Mode — apps/web

Full-coverage dark mode (storefront + account + admin + affiliate), OS-default with a
persisted manual toggle, no flash on load. Tailwind v4 + Next 16 App Router.

## Approach

The app hardcodes light colors (`bg-white`, `text-gray-*`, `border-gray-*`) in ~1474 places
across 132 files. Rather than bolt `dark:` onto every one, we convert to **semantic tokens
that flip at runtime**. Tokens already partly exist (`bg-bg`, `text-text`, `text-muted`,
`border-border`, used ~396×); we extend the set and redefine it under `.dark`.

### Token system (globals.css)
- `@custom-variant dark` (class-based, driven by next-themes `class="dark"` on `<html>`).
- `:root` = light values, `.dark` = dark values, mapped via `@theme inline` so utilities
  like `bg-surface` / `text-text` resolve to the live CSS var and flip automatically.
- Tokens: `bg`, `surface`, `surface-2`, `surface-3`, `text`, `muted`, `faint`, `border`,
  `primary`, `secondary`, plus `--shadow-card`.
- `body` gets `bg-bg` / `text-text` as the base so uncovered areas flip too.

### Conversion rulebook (applied everywhere)
- `bg-white`→`bg-surface`; `bg-gray-50|100`→`bg-surface-2`; `bg-gray-200`(incl hover)→`bg-surface-3`
- `text-gray-900|800`/`text-black`→`text-text`; `text-gray-700|600|500`→`text-muted`; `text-gray-400|300`→`text-faint`
- `border-gray-50|100|200|300`→`border-border`
- Pale status fills: `bg-{hue}-50`→ add `dark:bg-{hue}-950/40`; `bg-{hue}-100`→ add `dark:bg-{hue}-900/40` (keep the text color)
- Keep untouched: `bg-primary`, `text-primary`, `text-white` on colored buttons, `bg-black/xx` overlays, brand gradients.

## Tasks
- [x] Install `next-themes` in apps/web
- [x] Refactor `app/globals.css` to token/`.dark` system
- [x] Add `ThemeProvider` (next-themes) + wire into `app/layout.tsx` (`suppressHydrationWarning`, base bg/text)
- [x] Build `ThemeToggle` component (sun/moon, hydration-safe) + theme-aware `ThemedToaster`
- [x] Place toggle in storefront Navbar, admin mobile topbar + sidebar, affiliate topbar
- [x] Convert Navbar (chrome + status pills); leave Footer (intentionally dark both themes)
- [x] Sweep all components via deterministic scripts (gray→token, bg-white→surface, colored→dark variants)
- [x] `pnpm --filter web check-types` clean
- [x] Verify compiled CSS: tokens flip, `.dark` variants + surface utilities generated, no-flash script injected
- [ ] Human visual QA in browser (see Review notes)

## Review

**What shipped**
- **Token system** (`globals.css`): `@custom-variant dark`, `:root`/`.dark` value blocks mapped through
  `@theme inline`. Tokens: `bg, surface, surface-2, surface-3, text, muted, faint, border, primary, secondary`
  + `--shadow-card`. `body` uses `bg` / `text` as the base so uncovered areas flip too.
- **Provider/toggle**: `app/providers/theme-provider.tsx` (next-themes, system default, persisted, no-flash),
  `components/common/ThemeToggle.tsx` (hydration-safe sun/moon), `components/common/ThemedToaster.tsx`.
  Toggle placed in storefront Navbar, admin sidebar + mobile topbar, affiliate topbar.
- **Component sweep** (scripted, deterministic — ~130 files):
  - grays: `text-gray-*`→`text-text|muted|faint`, `bg-gray-50/100`→`surface-2`, `bg-gray-200/300`→`surface-3`,
    `border-gray-*`→`border`, `divide-gray-100`→`divide-border`.
  - `bg-white` (opaque)→`bg-surface`; translucent `bg-white/xx` glass overlays on images/hero left as-is.
  - Chromatic status chips/text/borders got `dark:` variants (e.g. `bg-green-50 dark:bg-green-500/15`,
    `text-red-600 dark:text-red-400`).
  - Fixes: empty star fill, admin drawer scrim → `bg-black/50`, filter sidebar hex → `bg-surface-2`.
- **Intentionally untouched**: Footer (permanently dark), `text-white`/`bg-black/xx` overlays, brand gradients,
  `via-white` shimmer, a few mid-gray placeholders/hover borders that read fine in both themes.

**Verified**: typecheck clean; compiled dev CSS shows both light+dark token values, the `:where(.dark, .dark *)`
variant rules, generated surface utilities, and the injected no-flash script; homepage 200.

**Needs eyeballs (headless can't verify visuals)** — all tunable centrally in the `.dark` block:
- Dark elevation: `surface` (cards) is darker than `surface-2` (subtle panels). For white-cards-on-gray-section
  layouts the card sits slightly darker than its band. Looks fine for modals/inputs; if cards should pop more,
  bump `--color-surface` lighter than `--color-surface-2` in the `.dark` block.

## Second pass — per-component contrast audit (7 parallel agents, disjoint scopes)

Fixed the contrast bugs the scripted sweep couldn't catch by reasoning:
- **Glass-over-content chips** (light bg + now-light token text): ProductCard wishlist/share, ProductGallery
  zoom/badge, HeroFallback badge → `bg-white/NN`→`bg-surface/NN` (dark glass in dark, identical in light).
- **Hero controls over banner imagery** (must NOT vanish): DynamicHeroBanner / MobileHeroBanner / HeroCarousel
  arrows + active dots kept **light** (`bg-white`) with **fixed-dark icons** (`text-gray-700`) in both themes.
- **`.ts` files** (missed by the `.tsx`-only scripts): `admin/orders/orderStatusMeta.ts` — 13 order-status badges
  had light-only classes → added `dark:` variants.
- **Form placeholders**: `placeholder-gray-400`→`placeholder:text-faint` (address dialogs, review form).
- **Dark-on-dark hover text**: affiliate ReferralLinkCard share buttons, apply-page error ring → dark variants.
- **Opaque white ring**: ProfileCard avatar `border-white`→`border-surface`.
- Everything else (cart, checkout, orders, admin tables/modals, affiliate dashboard, reviews, policy, auth)
  audited and confirmed already correct.

**Verified**: `check-types` clean; compiled dev CSS confirms new utilities generated
(`placeholder:text-faint`, `bg-surface/90`, `dark:hover:border-green-500/40`, `dark:bg-blue-500/20`);
391 dark-variant rules in the served stylesheet.

---

# Todo — per-variant pre-order terms

Per-variant pre-order toggle and booking price, plus a per-variant cap.

## Decisions
- Product switch is the **master**; a variant can only opt OUT (`Variant.preOrderEnabled`
  defaults to true, so every existing variant keeps inheriting).
- Blank booking amount **inherits** the product's, exactly like `price` overrides.
- Caps enforced at **both** levels: the product cap is the total across all variants,
  a variant cap bounds that one variant.
- Booking amount shown **on each chip and on the button**.

## Done
- [x] `Variant.preOrderEnabled / bookingAmount / preOrderLimit / preOrderCount`
      + migration (applied to the live DB and recorded).
- [x] `utils/preOrderTerms.ts` — `resolvePreOrderTerms`, `wouldExceedCap`,
      `reservePreOrderSlots`, `releasePreOrderSlots`. Every release path now goes
      through one helper, so a new path cannot forget the variant counter.
- [x] `preorder.services.ts` — enable/amount resolved after the variant is loaded,
      atomic reservation on both counters, stale-reclaim releases both.
- [x] Admin cancel/refund and the stock sweeper release both counters.
- [x] zod + admin variant service/controller carry the new fields.
- [x] Admin editor: per-variant pre-order toggle, booking amount (placeholder shows
      the product's), and variant limit — only shown when the product allows pre-orders.
- [x] Storefront web + mobile: `getPreOrderTerms` mirrors the backend rule; chips show
      their own amount; PDP banner/button and the pre-order page use the resolved one.

## Two bugs found while building
- The create-variant controller **destructures** fields rather than spreading, so the
  new ones were silently dropped. Now named explicitly, with a comment saying why.
- `price` / `salePrice` / `bookingAmount` were `.optional()`, not nullish — but the
  admin editor sends **null** for a cleared field. Saving a variant with a blank price
  was already rejected before this work (the controller carried a comment recommending
  exactly this fix); clearing a booking override would have hit the same wall. All
  three are now `.nullish()`, with the sale-price rules unchanged.

## Verified
- Resolver: inherit / override / opt-out / product-off-wins / no-amount-anywhere.
- Caps: product-only, variant-only and both, each blocking correctly.
- Counters, against the live schema in a rolled-back transaction: reserve increments
  both; hitting the variant cap fails AND rolls the product counter back (no leaked
  slot); release decrements both; a double release is guarded and never goes negative.
- API contract: null clears an override, negative amounts and limit 0 rejected,
  existing sale-price validation intact.
- Backend, web and mobile typecheck clean; lint back at baseline (web 268, mobile 12).

## Note — the earlier review fixes were lost and have been re-applied
The commits `34609ce` / `bc78baa` / `c93024b` captured the **staged** versions of those
files; the seven code-review fixes were unstaged and were discarded. All seven have
been re-applied in this pass (CORS Content-Disposition, GSTIN boot check, invoice
counter + P2002, invoice line rounding, customer stats aggregate, admin download
toast, pre-order in-stock guard). The `.env` GST values were untracked and survived.

---

# Todo — local fulfilment + pre-order invoicing

Production repo: smallest change that does the job, no refactors in passing.

## 1. Become Affiliate footer link
- [x] Already shipped last turn: 'Become Affiliate' -> /affiliate/apply, wording matched
      to the Navbar account-menu item.

## 2. Manual (local) fulfilment, Delhivery untouched for pan-India
Client couriers pan-India through Delhivery but delivers locally himself and wants to
drive those orders' statuses by hand.

- [x] `Order.manualFulfilment Boolean @default(false)` + migration. A boolean, not a new
      enum: enums have to be re-exported by hand from @repo/db and this needs exactly two
      states.
- [x] Auto-ship sweeper skips manual orders, so a local order is never handed to Delhivery.
- [x] `POST /admin/orders/:id/fulfilment` toggles it. Refused while a live (non-FAILED)
      shipment exists — cancel the waybill first, otherwise the parcel is with the courier
      and the panel would claim otherwise.
- [x] `createShipmentService` refuses a manual order, so the Ship button cannot
      accidentally book a courier for a local delivery.
- [x] Statuses stay the existing sequence (PROCESSING -> SHIPPED -> OUT_FOR_DELIVERY ->
      DELIVERED); no new transitions, so emails, stock and notifications behave as now.
- [x] Guard: an admin cannot mark a PARTIAL order DELIVERED while its balance is
      unsettled. Only the admin path is affected — the courier webhook writes status
      directly, not through updateOrderStatusService.
- [x] A manual order reaching SHIPPED raises the tax invoice when a balance is
      outstanding, mirroring what Delhivery dispatch already does. Without this a local
      partial order would ship with no invoice at all.
- [x] Admin UI: toggle + badge on the order page; Ship button hidden when manual.

**Accepted risk (client's call):** the sweeper manifests 5 minutes after CONFIRMED, so an
admin must flag a local order inside that window; otherwise cancel the Delhivery shipment
and then switch. The toggle refuses while a live shipment exists, which makes that
ordering explicit rather than silent.

## 3. Pre-order paperwork
Confirmed gap: when a pre-order balance is paid, an Order and a SUCCESS Payment are
created but `issueInvoiceForOrder` is never called, and the balance-paid email carries
nothing.

- [x] Booking paid -> non-GST advance receipt, reusing `renderReceiptPdf`. Not a tax
      invoice and it must not consume an InvoiceCounter number: that series is legally
      gap-free, and GST is not payable on advances for goods (Notification 66/2017).
- [x] Completion -> one tax invoice for the FULL amount, attached to the balance-paid
      email. One supply, one tax invoice.
- [x] No backfill: older completed pre-orders can still download on demand, since
      `getInvoicePdfService` issues on first view.

## Review

All three done. Backend, web and mobile typecheck clean; web lint unchanged at 268.

**Two problems found while verifying, both pre-existing:**

1. `20260901120000_partial_payment` had never been applied, while the code reading those
   columns was already merged. `createShipmentService` — the admin Ship button — was
   returning 500 with `P2022: The column Order.paymentPlan does not exist`. Reported;
   the client deployed it, and the admin order detail and Ship path now work.
2. The admin status API accepted only PENDING/CONFIRMED/SHIPPED/DELIVERED/CANCELLED,
   while the service's own transition map requires OUT_FOR_DELIVERY before DELIVERED.
   The panel's Processing and Out-for-delivery buttons had therefore been failing with a
   400, and a locally-delivered order could never be completed at all. Added the two
   missing values; legality is still decided by `statusTransitions`, so nothing loosened.

**Verified live against the database:**
- Toggle sets an order local (200) and is refused on a cancelled one
  (`INVALID_STATUS_TRANSITION`).
- Auto-ship candidate query held the local order back — 2 of 3 confirmed-unshipped.
- Shipping a local order returns 400 `ORDER_IS_MANUAL_FULFILMENT` and creates **no**
  waybill (shipment count stayed 0), so the guard runs before any courier call.
- Full manual walk on a synthetic PARTIAL order: PROCESSING -> SHIPPED -> OUT_FOR_DELIVERY,
  DELIVERED refused with `BALANCE_UNSETTLED` while the balance was outstanding, then
  accepted once settled.
- Manual dispatch raised the tax invoice: `LS/2026-27/00001`, taxable 847.46 + IGST
  152.54 = 1000.00, IGST because the buyer state differs from the seller's.
- Pre-order booking receipt rendered from a real record: `ADV/2026-27/PO-5264D2F0`,
  correct GSTIN, "Pre-order ID" label, and the "not a tax invoice" strapline.

**All test data removed:** the synthetic order, its payment, item, audit row and invoice
were hard-deleted and the InvoiceCounter reset, so the first real invoice is still
LS/2026-27/00001. The one live order I toggled was reverted to courier, and the cancelled
pre-order's temporary `bookingPaidAt` was reverted to null. Final state: 0 invoices,
0 counters, 0 orders flagged local, 0 partial orders.

---

# Todo — email coverage audit (10 cases)

Audited every requested case against what exists AND what is actually called, since a
defined template that nothing invokes is the same as no email at all.

| # | Case | Before | Action |
|---|------|--------|--------|
| 1 | Order confirmed | present (`sendOrderConfirmationEmail`, plus the partial-payment variant) | none |
| 2 | Order delivered | push/in-app only | **added** |
| 3 | Invoice by mail | present — attached to the confirmation, and to pre-order completion | none |
| 4 | Password reset link | present | none |
| 5 | Email verification | present (signup OTP) | none |
| 6 | Account creation | nothing at all | **added** |
| 7 | Pre-order back in stock | present | none |
| 8 | Affiliate application pending | nothing at all — not even a push | **added** |
| 9 | Affiliate approved | push/in-app only | **added** |
| 10 | Referral purchase | push/in-app only (`COMMISSION_EARNED`) | **added** |

## Added
- [x] `sendWelcomeEmail` — wired to all three account-creation paths (email/OTP, Google,
      Apple), and only on the brand-new-account branch so signing in again is not greeted
      as a fresh signup. Sent after the transaction commits: before that there is no
      account, and a signup abandoned at the OTP step would have been welcomed for one
      that never existed.
- [x] `sendOrderDeliveredEmail` — wired to the two places that own a real DELIVERED
      *transition*, not to `settleOnDeliverySafe`. Settlement is deliberately idempotent
      and re-runs on every repeated "delivered" scan Delhivery sends; an email is not, so
      hanging it there would have mailed the customer again on each replay. The admin path
      is safe by the transition map, the webhook by its existing `mapped !== prevStatus`
      guard — the same rule the push notification already follows.
- [x] `sendAffiliateAppliedEmail` — the API response already promised "you will be
      notified" and nothing ever was.
- [x] `sendAffiliateApprovedEmail` — both approval paths (admin panel and the review
      service), sent after commit so a rolled-back approval is never announced. Carries
      the referral link, which is the thing the affiliate actually needs.
- [x] `sendCommissionEarnedEmail` — alongside the existing push, since this is the record
      an affiliate wants outside the app.

## Verified
- Every new template built and its payload captured through a stubbed transport: correct
  subject, to/from, and links built from FRONTEND_URL (including `/ref/<code>`).
- HTML escaping holds — `<script>alert(1)</script>` renders as `&lt;script&gt;...` with no
  live tag, and `O'Brien & Co` as `O&#39;Brien &amp; Co`.
- All five are fire-and-forget and fail-soft, matching every existing send: a bounced
  email can never disturb an order, a signup or a settled payment.
- `pnpm build` 6/6; web lint unchanged at 268.

No new env vars. Sends still depend on `RESEND_API_KEY`, which the boot check already
warns about when missing.
