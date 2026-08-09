/**
 * GA4 ecommerce events (plan W7).
 *
 * Sent via gtag() because GA4 is loaded directly (gtag.js) in the root layout.
 * They are NOT pushed for GTM to relay — routing GA4 through GTM as well would
 * double-count every hit. If you later move GA4 into GTM, delete the direct
 * <GoogleAnalytics /> loader first and re-point these at dataLayer.
 *
 * All values are INR and plain numbers. Every helper is a safe no-op on the
 * server and when gtag is absent (e.g. analytics disabled in local dev).
 */
import { getChargedPrice } from "../pricing"
import type { Product, Variant } from "../../types/product"
import type { CartItem } from "../../types/cart"

const CURRENCY = "INR"

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function gtagEvent(name: string, params: Record<string, unknown>) {
  if (typeof window === "undefined") return
  const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag
  if (typeof gtag !== "function") return
  gtag("event", name, params)
}

/**
 * Meta Pixel standard events. The base pixel is loaded via GTM (Option A), so
 * this is a safe no-op until fbq exists — conversion events fire after the user
 * interacts / navigates, by which point GTM has initialised the pixel.
 */
function fbqTrack(event: string, params: Record<string, unknown>) {
  if (typeof window === "undefined") return
  const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq
  if (typeof fbq !== "function") return
  fbq("track", event, params)
}

// ── item builders ──────────────────────────────────────────────────────────

function itemFromProduct(product: Product, variant?: Variant | null, quantity = 1) {
  return {
    item_id: product.id,
    item_name: product.name,
    price: round2(getChargedPrice(product, variant ?? null)),
    quantity,
    item_category: product.category?.name,
    item_variant: variant?.name,
  }
}

function itemFromCartItem(ci: CartItem) {
  return {
    item_id: ci.productId,
    item_name: ci.product?.name,
    price: round2(getChargedPrice(ci.product, ci.variant)),
    quantity: ci.quantity,
    item_variant: ci.variant?.name ?? undefined,
  }
}

// ── events ─────────────────────────────────────────────────────────────────

export function trackViewItem(product: Product, variant?: Variant | null) {
  const item = itemFromProduct(product, variant, 1)
  gtagEvent("view_item", { currency: CURRENCY, value: item.price, items: [item] })
  fbqTrack("ViewContent", {
    content_type: "product",
    content_ids: [product.id],
    content_name: product.name,
    content_category: product.category?.name,
    value: item.price,
    currency: CURRENCY,
  })
}

/** Fired from the cart store after the server confirms the add. */
export function trackAddToCartItem(ci: CartItem, quantityAdded: number) {
  const price = round2(getChargedPrice(ci.product, ci.variant))
  gtagEvent("add_to_cart", {
    currency: CURRENCY,
    value: round2(price * quantityAdded),
    items: [
      {
        item_id: ci.productId,
        item_name: ci.product?.name,
        price,
        quantity: quantityAdded,
        item_variant: ci.variant?.name ?? undefined,
      },
    ],
  })
  fbqTrack("AddToCart", {
    content_type: "product",
    content_ids: [ci.productId],
    content_name: ci.product?.name,
    contents: [{ id: ci.productId, quantity: quantityAdded }],
    value: round2(price * quantityAdded),
    currency: CURRENCY,
  })
}

export function trackBeginCheckout(items: CartItem[], value: number, coupon?: string | null) {
  gtagEvent("begin_checkout", {
    currency: CURRENCY,
    value: round2(value),
    coupon: coupon ?? undefined,
    items: items.map(itemFromCartItem),
  })
  fbqTrack("InitiateCheckout", {
    content_type: "product",
    content_ids: items.map((i) => i.productId),
    contents: items.map((i) => ({ id: i.productId, quantity: i.quantity })),
    num_items: items.reduce((n, i) => n + i.quantity, 0),
    value: round2(value),
    currency: CURRENCY,
  })
}

/** `order` is the store's currentOrder — kept loose because the API shape varies. */
export function trackPurchase(order: {
  id?: string
  total?: unknown
  shippingCharges?: unknown
  coupon?: { code?: string } | null
  items?: Array<{
    productId?: string
    product?: { id?: string; name?: string }
    variant?: { name?: string } | null
    price?: unknown
    quantity?: unknown
  }>
}) {
  if (!order?.id) return
  const items = order.items ?? []
  gtagEvent("purchase", {
    transaction_id: String(order.id),
    currency: CURRENCY,
    value: num(order.total),
    shipping: num(order.shippingCharges),
    coupon: order.coupon?.code ?? undefined,
    items: items.map((it) => ({
      item_id: it.productId ?? it.product?.id,
      item_name: it.product?.name,
      price: num(it.price),
      quantity: num(it.quantity),
      item_variant: it.variant?.name ?? undefined,
    })),
  })
  fbqTrack("Purchase", {
    content_type: "product",
    content_ids: items.map((it) => it.productId ?? it.product?.id),
    contents: items.map((it) => ({
      id: it.productId ?? it.product?.id,
      quantity: num(it.quantity),
    })),
    num_items: items.reduce((n, it) => n + num(it.quantity), 0),
    value: num(order.total),
    currency: CURRENCY,
  })
}
