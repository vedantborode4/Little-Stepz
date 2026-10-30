"use client"

import clsx from "clsx"
import { Minus, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/Form"
import { formatMoney } from "@/lib/format"
import { PriceSourceBadge } from "./shared"
import type { Cart } from "./use-cart"

/** Editable cart lines; prices and line totals come from the server quote. */
/** `allowShort`: pre-orders sell ahead of stock, so missing stock isn't flagged as a problem. */
export default function CartLines({
  cart,
  canOverridePrice,
  allowShort = false,
}: {
  cart: Cart
  canOverridePrice: boolean
  allowShort?: boolean
}) {
  const quoted = new Map(cart.quote?.lines.map((l) => [l.variantId, l]))

  if (cart.cart.lines.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted">No items yet. Search above to add one.</p>
  }

  return (
    <ul className="divide-y divide-border">
      {cart.cart.lines.map((line) => {
        const q = quoted.get(line.variantId)
        const short = !allowShort && q !== undefined && q.available < line.quantity
        const discounted = q !== undefined && Number(q.unitPrice) < Number(q.regularPrice)
        return (
          <li key={line.variantId} className="px-4 py-3 space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{line.label}</p>
                <p className="text-xs text-faint">
                  <span className="font-mono">{line.sku}</span>
                  {q && (
                    <span className={clsx("ml-2", short && "text-red-500 font-medium")}>
                      {short ? `Only ${Math.max(q.available, 0)} free` : `${q.available} free`}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular">{q ? formatMoney(q.lineTotal) : "…"}</p>
                {q && (
                  <p className="text-xs text-muted tabular">
                    {discounted && <span className="line-through mr-1 text-faint">{formatMoney(q.regularPrice)}</span>}
                    {formatMoney(q.unitPrice)} each
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-xl border border-border">
                <button
                  type="button"
                  aria-label={`Fewer ${line.sku}`}
                  className="p-2 text-muted hover:text-text disabled:opacity-40"
                  disabled={line.quantity <= 1}
                  onClick={() => cart.updateLine(line.variantId, { quantity: line.quantity - 1 })}
                >
                  <Minus size={14} />
                </button>
                <input
                  aria-label={`Quantity for ${line.sku}`}
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value.replace(/\D/g, ""), 10)
                    cart.updateLine(line.variantId, { quantity: Number.isFinite(n) && n > 0 ? n : 1 })
                  }}
                  className="w-12 text-center text-sm bg-transparent tabular focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={`More ${line.sku}`}
                  className="p-2 text-muted hover:text-text"
                  onClick={() => cart.updateLine(line.variantId, { quantity: line.quantity + 1 })}
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="w-24">
                <Input
                  aria-label={`Discount for ${line.sku}`}
                  inputMode="decimal"
                  placeholder="₹ off"
                  value={line.lineDiscount}
                  onChange={(e) => cart.updateLine(line.variantId, { lineDiscount: e.target.value })}
                  className="py-1.5"
                />
              </div>
              {canOverridePrice && (
                <div className="w-28">
                  <Input
                    aria-label={`Price for ${line.sku}`}
                    inputMode="decimal"
                    placeholder="Set price"
                    title="Override the unit price (admin)"
                    value={line.unitPrice}
                    onChange={(e) => cart.updateLine(line.variantId, { unitPrice: e.target.value })}
                    className="py-1.5"
                  />
                </div>
              )}
              {q && <PriceSourceBadge source={q.priceSource} />}
              <span className="flex-1" />
              <button
                type="button"
                aria-label={`Remove ${line.sku}`}
                className="p-2 rounded-lg text-faint hover:text-red-500 hover:bg-surface-2"
                onClick={() => cart.removeLine(line.variantId)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function CartTotals({ cart }: { cart: Cart }) {
  const t = cart.quote?.totals
  const discounts = t ? Number(t.lineDiscounts) + Number(t.orderDiscount) : 0
  return (
    <dl className={clsx("space-y-1.5 text-sm", cart.stale && "opacity-60")}>
      <div className="flex justify-between">
        <dt className="text-muted">
          Subtotal ({t?.units ?? 0} {t?.units === 1 ? "item" : "items"})
        </dt>
        <dd className="tabular">{formatMoney(t?.subtotal ?? 0)}</dd>
      </div>
      {discounts > 0 && (
        <div className="flex justify-between text-green-600 dark:text-green-400">
          <dt>Discounts</dt>
          <dd className="tabular">−{formatMoney(discounts)}</dd>
        </div>
      )}
      {t && Number(t.shippingCharged) > 0 && (
        <div className="flex justify-between">
          <dt className="text-muted">Shipping</dt>
          <dd className="tabular">{formatMoney(t.shippingCharged)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular">{formatMoney(t?.grandTotal ?? 0)}</dd>
      </div>
      <div className="flex justify-between text-xs text-faint">
        <dt>Includes GST</dt>
        <dd className="tabular">{formatMoney(t?.gstTotal ?? 0)}</dd>
      </div>
    </dl>
  )
}
