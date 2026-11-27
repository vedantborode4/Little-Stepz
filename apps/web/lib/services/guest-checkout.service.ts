import { api } from "../api-client"
import type { GuestCheckoutStartInput, GuestCheckoutVerifyInput } from "@repo/zod-schema/index"
import type { GuestContact } from "../../store/useGuestSessionStore"

export interface TrackedOrder {
  reference: string
  placedAt: string
  status: string
  awbCode: string | null
  trackingUrl: string | null
  courierName: string | null
  message?: string
}

export const GuestCheckoutService = {
  /** Sends the SMS code. 409 ACCOUNT_EXISTS: the email belongs to an account — sign in instead. */
  start: async (input: GuestCheckoutStartInput) => {
    const res = await api.post("/guest-checkout/start", input)
    return res.data.data as { expiresInSeconds?: number; resendAfterSeconds?: number }
  },

  verify: async (input: GuestCheckoutVerifyInput) => {
    const res = await api.post("/guest-checkout/verify", input)
    return res.data.data as { accessToken: string; user: GuestContact }
  },

  /** Public tracking by order number + the email or phone used on the order. */
  track: async (reference: string, contact: string) => {
    const res = await api.post("/orders/track", { reference, contact })
    return res.data.data as TrackedOrder
  },
}
