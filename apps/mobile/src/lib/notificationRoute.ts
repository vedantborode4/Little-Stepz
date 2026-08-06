/**
 * Maps a notification's `data` payload (set by the backend) to an in-app route.
 * Returns null when there's nothing meaningful to open.
 */
export function notificationRoute(
  data: Record<string, unknown> | null | undefined
): string | null {
  if (!data) return null;
  const screen = typeof data.screen === "string" ? data.screen : undefined;
  const orderId = typeof data.orderId === "string" ? data.orderId : undefined;

  switch (screen) {
    case "Order":
      return orderId ? `/orders/${orderId}` : "/orders";
    case "AdminOrder":
      return orderId ? `/admin/orders/${orderId}` : "/admin/orders";
    case "AffiliateEarnings":
      return "/affiliate/commissions";
    case "AffiliateDashboard":
      return "/affiliate";
    case "AdminWithdrawals":
      return "/admin/withdrawals";
    default:
      return null;
  }
}
