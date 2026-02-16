import { create } from "zustand"
import { CartService } from "../lib/services/cart.service"
import type { CartItem } from "../types/cart"
import { toast } from "sonner"

interface AddItemPayload {
  productId: string
  variantId?: string
  quantity: number
}

interface CartState {
  items: CartItem[]
  subtotal: number
  isLoading: boolean
  updatingKey: string | null

  fetchCart: () => Promise<void>

  addItem: (payload: AddItemPayload) => Promise<void>
  updateQuantity: (
    productId: string,
    variantId: string | undefined,
    quantity: number
  ) => Promise<void>

  removeItem: (productId: string, variantId?: string) => Promise<void>
  clearCart: () => Promise<void>
}

const calcSubtotal = (items: CartItem[]) =>
  items.reduce((acc, item) => acc + item.subtotal, 0)

const matchItem = (
  item: CartItem,
  productId: string,
  variantId?: string
) =>
  item.productId === productId &&
  (item.variantId ?? undefined) === variantId

const getKey = (productId: string, variantId?: string) =>
  `${productId}-${variantId ?? "no-variant"}`

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  subtotal: 0,
  isLoading: false,
  updatingKey: null,

  fetchCart: async () => {
    set({ isLoading: true })
    try {
      const data = await CartService.getCart()
      set({ items: data.items, subtotal: data.subtotal })
    } finally {
      set({ isLoading: false })
    }
  },

  addItem: async (payload) => {
    const prev = get().items

    const existing = prev.find((i) =>
      matchItem(i, payload.productId, payload.variantId)
    )

    let optimistic: CartItem[]

    if (existing) {
      optimistic = prev.map((i) =>
        matchItem(i, payload.productId, payload.variantId)
          ? {
              ...i,
              quantity: i.quantity + payload.quantity,
              subtotal:
                (i.quantity + payload.quantity) *
                Number(i.product.price),
            }
          : i
      )
    } else {
      optimistic = [
        ...prev,
        {
          id: crypto.randomUUID(),
          productId: payload.productId,
          variantId: payload.variantId ?? null,
          quantity: payload.quantity,
          product: {
            id: payload.productId,
            name: "Updating...",
            slug: "",
            price: "0",
            images: [],
          },
          variant: null,
          subtotal: 0,
        },
      ]
    }

    set({
      items: optimistic,
      subtotal: calcSubtotal(optimistic),
    })

    try {
      const data = await CartService.add(payload)
      set({ items: data.items, subtotal: data.subtotal })
      toast.success("Added to cart")
    } catch {
      set({ items: prev, subtotal: calcSubtotal(prev) })
      toast.error("Failed to add to cart")
    }
  },

  updateQuantity: async (productId, variantId, quantity) => {
    if (quantity < 1) return

    const prev = get().items
    const key = getKey(productId, variantId)

    const target = prev.find((i) =>
      matchItem(i, productId, variantId)
    )

    if (!target) return

    const stock =
      (target.variant as any)?.stock ??
      (target.product as any)?.quantity ??
      10

    if (quantity > stock) {
      toast.error(`Only ${stock} items available`)
      quantity = stock
    }

    const optimistic = prev.map((i) =>
      matchItem(i, productId, variantId)
        ? {
            ...i,
            quantity,
            subtotal: quantity * Number(i.product.price),
          }
        : i
    )

    set({
      items: optimistic,
      subtotal: calcSubtotal(optimistic),
      updatingKey: key,
    })

    try {
      const data = await CartService.update({
        productId,
        variantId,
        quantity,
      })

      set({
        items: data.items,
        subtotal: data.subtotal,
        updatingKey: null,
      })
    } catch {
      set({
        items: prev,
        subtotal: calcSubtotal(prev),
        updatingKey: null,
      })
      toast.error("Update failed")
    }
  },

  removeItem: async (productId, variantId) => {
    const prev = get().items
    const key = getKey(productId, variantId)

    const optimistic = prev.filter(
      (i) => !matchItem(i, productId, variantId)
    )

    set({
      items: optimistic,
      subtotal: calcSubtotal(optimistic),
      updatingKey: key,
    })

    try {
      const data = await CartService.remove({
        productId,
        variantId,
      })

      set({
        items: data.items,
        subtotal: data.subtotal,
        updatingKey: null,
      })
    } catch {
      set({
        items: prev,
        subtotal: calcSubtotal(prev),
        updatingKey: null,
      })
      toast.error("Remove failed")
    }
  },

  clearCart: async () => {
    const prev = get().items
    set({ items: [], subtotal: 0 })

    try {
      await CartService.clear()
    } catch {
      set({ items: prev, subtotal: calcSubtotal(prev) })
    }
  },
}))
