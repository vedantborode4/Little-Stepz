import { Role } from "@repo/db/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: Role;
        /**
         * Set for a guest-checkout session (see AccessTokenPayload.guest). Only routes that
         * opt in with `authOrGuestMiddleware` ever see it; everything else refuses guests.
         */
        guest?: { since: Date; orderId?: string };
      };
    }
  }
}
