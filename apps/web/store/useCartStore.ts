import { create } from "zustand"
import { CartService } from "../lib/services/cart.service"
import { CouponService } from "../lib/services/coupon.service"
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
  total: number

  couponCode: string | null
  discount: number
  isValidatingCoupon: boolean

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

  applyCoupon: (code: string) => Promise<void>
  removeCoupon: () => void

  /** 🔒 internal but typed */
  revalidateCoupon: () => Promise<void>
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
  total: 0,

  couponCode: null,
  discount: 0,
  isValidatingCoupon: false,

  isLoading: false,
  updatingKey: null,

  /* ---------------- FETCH ---------------- */

  fetchCart: async () => {
    set({ isLoading: true })
    try {
      const data = await CartService.getCart()
      // Preserve any applied coupon — revalidateCoupon() will re-check it
      const { couponCode, discount } = get()
      set({
        items: data.items,
        subtotal: data.subtotal,
        total: data.subtotal - discount,
      })
    } finally {
      set({ isLoading: false })
    }
  },

  /* ---------------- COUPON ---------------- */

applyCoupon: async (code) => {
  if (!code.trim()) {
    throw new Error("Enter coupon code")
  }

  set({ isValidatingCoupon: true })

  try {
    const subtotal = get().subtotal
    const res = await CouponService.validate(code, subtotal)

    if (!res?.valid) {
      throw new Error(res?.message || "Invalid coupon")
    }

    set({
      couponCode: code,
      discount: res.discount,
      total: subtotal - res.discount,
    })

  } catch (e: any) {
    throw e   // 🚨 IMPORTANT
  } finally {
    set({ isValidatingCoupon: false })
  }
},




  removeCoupon: () => {
    const subtotal = get().subtotal

    set({
      couponCode: null,
      discount: 0,
      total: subtotal,
    })
  },

revalidateCoupon: async () => {
  const { couponCode, subtotal } = get()
  if (!couponCode) return

  try {
    const res = await CouponService.validate(couponCode, subtotal)

    set({
      discount: res.discount,
      total: subtotal - res.discount,
    })
  } catch {
    toast.error("Coupon removed — cart updated")

    set({
      couponCode: null,
      discount: 0,
      total: subtotal,
    })
  }
},


  /* ---------------- ADD ---------------- */

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

    const newSubtotal = calcSubtotal(optimistic)

    set({
      items: optimistic,
      subtotal: newSubtotal,
      total: newSubtotal - get().discount,
    })

    try {
      const data = await CartService.add(payload)

      set({
        items: data.items,
        subtotal: data.subtotal,
        total: data.subtotal - get().discount,
      })

      get().revalidateCoupon()
    } catch {
      set({ items: prev, subtotal: calcSubtotal(prev) })
      toast.error("Failed to add to cart")
    }
  },

  /* ---------------- UPDATE ---------------- */

  updateQuantity: async (productId, variantId, quantity) => {
    if (quantity < 1) return

    const prev = get().items
    const key = getKey(productId, variantId)

    const optimistic = prev.map((i) =>
      matchItem(i, productId, variantId)
        ? {
            ...i,
            quantity,
            subtotal: quantity * Number(i.product.price),
          }
        : i
    )

    const newSubtotal = calcSubtotal(optimistic)

    set({
      items: optimistic,
      subtotal: newSubtotal,
      total: newSubtotal - get().discount,
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
        total: data.subtotal - get().discount,
        updatingKey: null,
      })

      get().revalidateCoupon()
    } catch {
      set({
        items: prev,
        subtotal: calcSubtotal(prev),
        updatingKey: null,
      })

      toast.error("Update failed")
    }
  },

  /* ---------------- REMOVE ---------------- */

  removeItem: async (productId, variantId) => {
    const prev = get().items
    const key = getKey(productId, variantId)

    const optimistic = prev.filter(
      (i) => !matchItem(i, productId, variantId)
    )

    const newSubtotal = calcSubtotal(optimistic)

    set({
      items: optimistic,
      subtotal: newSubtotal,
      total: newSubtotal - get().discount,
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
        total: data.subtotal - get().discount,
        updatingKey: null,
      })

      get().revalidateCoupon()
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

    set({
      items: [],
      subtotal: 0,
      total: 0,
      discount: 0,
      couponCode: null,
    })

    try {
      await CartService.clear()
    } catch {
      set({ items: prev, subtotal: calcSubtotal(prev) })
    }
  },
}))
