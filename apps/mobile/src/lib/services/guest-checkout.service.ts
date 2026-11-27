import { api } from "../api/client";
import type { GuestCheckoutStartInput, GuestCheckoutVerifyInput } from "@repo/zod-schema/index";
import type { GuestContact } from "../../store/guestSession.store";

export const GuestCheckoutService = {
  /** Sends the SMS code. 409 ACCOUNT_EXISTS: the email belongs to an account — sign in instead. */
  start: async (input: GuestCheckoutStartInput) => {
    const res = await api.post("/guest-checkout/start", input);
    return res.data.data as { expiresInSeconds?: number; resendAfterSeconds?: number };
  },

  verify: async (input: GuestCheckoutVerifyInput) => {
    const res = await api.post("/guest-checkout/verify", input);
    return res.data.data as { accessToken: string; user: GuestContact };
  },
};
