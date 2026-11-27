import { Role } from "@repo/db/client";

export interface AccessTokenPayload {
  userId: string;
  role: Role;
  /**
   * Present only on guest-checkout tokens. `since` (epoch ms) is when the guest session
   * began: the session may only see addresses, verified phones and orders it created from
   * then on. `orderId` narrows it further to one order (the emailed "View your order" link).
   */
  guest?: { since: number; orderId?: string };
}
