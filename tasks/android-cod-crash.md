# Android crash on COD order placement

## Symptom
Production Android build closed itself every time a Cash on Delivery order was placed.
iOS was unaffected. Online and deposit checkout were unaffected.

## Cause
Play Console stack trace:
```
java.lang.IllegalStateException
  at com.facebook.react.fabric.mounting.SurfaceMountingManager.addViewAt
Caused by: java.lang.IllegalStateException:
  The specified child already has a parent. You must call removeView() on the child's parent first.
  at com.facebook.react.views.view.ReactClippingViewManager.addView
```
A Fabric view-**reparenting** crash: the mount transaction told Android to attach a host
`View` to a new parent while it was still attached to its old one.

The COD branch of `onPlaceOrder` in `apps/mobile/src/app/checkout/index.tsx` did:
```ts
router.replace({ pathname: "/checkout/success", ... });
useCheckoutStore.getState().resetSession();   // sets step back to 0
```
Both in the same JS tick, so React batched them into **one commit**. That single commit
contained the screen swap *and* a step 2 -> 0 change, and the checkout screen renders a
different subtree for each step (~14 sibling conditionals on `step`). Fabric resolved the
combined result as moving host views across parents, which Android's `ViewGroup` rejects.

Why only COD: the online and deposit branches `router.push` to `/checkout/payment` and reset
later in `verifying.tsx`, so they never mutate the outgoing screen's state during its own
teardown. Why only Android: iOS mounts the same transaction without objecting.

## Fix
- [x] `checkout/index.tsx` — COD branch navigates only; no store mutation in that tick.
- [x] `checkout/success.tsx` — owns the reset now, in a mount effect, so it lands after the
      navigation has committed. Idempotent; `verifying.tsx` still resets for the online flow.
- [x] `checkout/index.tsx` — `leavingForCodRef` freezes the rendered step at 2 once the COD
      flow starts navigating, so a late store change cannot swap subtrees during the
      transition animation either. Belt and braces for the overlap window.

Typecheck and lint clean. The one lint error in `features/affiliate/hooks.ts` is pre-existing.

## Verify
Place a COD order on an Android production/preview build. Expect the success screen, no
close. Then re-enter checkout and confirm it opens on the Address step with ONLINE selected
(i.e. the session really was reset).

## Second attempt (1.0.6) — the first fix was incomplete

The crash persisted on 1.0.5, which contains the first fix (`f68443a`).

What the first fix got wrong: it assumed the checkout screen was already unmounted by the
time `success.tsx` ran its effects. It is not — a native-stack `replace` keeps the outgoing
screen mounted until its closing animation ends. And checkout calls `useCartStore()` and
`useCheckoutStore()` with **no selector**, so it re-renders on any change to either store.
Freezing `step` covered only one of the things that reshape it. On arrival, success.tsx runs:
- `resetSession()` — also flips `paymentMethod` to `ONLINE`, so `isCod` goes false and the COD
  card and footer swap for the online card and payment badges;
- `fetchCart()` — empties `items`, removing the item list and resetting the COD quote.

Both restructured a still-mounted checkout mid-transition: the same reparenting condition,
moved one screen over rather than removed.

### Fix
- [x] The COD branch no longer navigates directly. It sets `leavingForCodOrderId`, which makes
      the screen render a static placeholder (header + spinner) that reads **no store state**.
- [x] A `useEffect` keyed on that id performs `router.replace` — i.e. only after the collapse
      has committed, so the collapse and the navigation are never in one mount transaction.
- [x] From then on, store updates re-render the placeholder with identical props, which
      produces no host-view mutations at all, regardless of when they land.
- [x] Removed `leavingForCodRef` / `renderStep` (dead once the whole tree is replaced) and
      corrected the success.tsx comment that stated the false assumption.

iOS takes the same path; the only visible difference is a brief spinner frame between
"Place Order" and the success screen.

Confidence: higher than the first attempt, because this no longer depends on *when* any
store update lands. Still not verified on a device.
