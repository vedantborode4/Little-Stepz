"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import type { FulfilmentMethod, SaleQuoteInput, SalesChannel } from "@repo/crm-schema"
import { useDebounced } from "@/lib/use-debounced"
import { quoteSale } from "./api"

export interface CartLine {
  variantId: string
  sku: string
  label: string
  quantity: number
  /** Rupees off the line, as typed ("" = none). */
  lineDiscount: string
  /** Admin price override, as typed ("" = use the resolved price). */
  unitPrice: string
}

export interface CartState {
  customerId: string | null
  channel: SalesChannel
  fulfilment: FulfilmentMethod
  locationId: string
  lines: CartLine[]
  orderDiscount: string
  shippingCharged: string
}

export function cartPayload(cart: CartState): SaleQuoteInput {
  return {
    customerId: cart.customerId,
    channel: cart.channel,
    fulfilment: cart.fulfilment,
    locationId: cart.locationId,
    lines: cart.lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      lineDiscount: l.lineDiscount.trim() || "0",
      unitPrice: l.unitPrice.trim() || null,
    })),
    orderDiscount: cart.orderDiscount.trim() || "0",
    shippingCharged: cart.shippingCharged.trim() || "0",
  }
}

/**
 * Cart state plus a live quote from the server, which alone decides prices,
 * discounts split and GST. The quote follows edits after a short pause.
 */
export function useCart(initial: CartState) {
  const [cart, setCart] = useState<CartState>(initial)
  const payload = useDebounced(cartPayload(cart), 300)
  const enabled = payload.lines.length > 0 && Boolean(payload.locationId)
  const quote = useQuery({
    queryKey: ["sales", "quote", payload],
    queryFn: () => quoteSale(payload),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 5_000,
  })

  const update = (patch: Partial<CartState>) => setCart((c) => ({ ...c, ...patch }))
  const updateLine = (variantId: string, patch: Partial<CartLine>) =>
    setCart((c) => ({ ...c, lines: c.lines.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)) }))
  const addItem = (item: { variantId: string; sku: string; label: string }) =>
    setCart((c) => {
      const existing = c.lines.find((l) => l.variantId === item.variantId)
      if (existing) return { ...c, lines: c.lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l)) }
      return { ...c, lines: [...c.lines, { ...item, quantity: 1, lineDiscount: "", unitPrice: "" }] }
    })
  const removeLine = (variantId: string) => setCart((c) => ({ ...c, lines: c.lines.filter((l) => l.variantId !== variantId) }))
  const reset = (patch: Partial<CartState> = {}) => setCart({ ...initial, ...patch })

  const current = enabled && quote.data && quote.data.lines.length === cart.lines.length ? quote.data : null
  const stale = enabled && (quote.isFetching || JSON.stringify(payload) !== JSON.stringify(cartPayload(cart)))

  return { cart, update, updateLine, addItem, removeLine, reset, quote: current, quoteError: enabled ? quote.error : null, stale }
}

export type Cart = ReturnType<typeof useCart>
