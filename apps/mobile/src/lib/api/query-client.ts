import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Catalog data (products/categories/banners) changes rarely, so keep it
      // fresh for 5 min — revisiting a screen shows cached data instantly
      // instead of a network round-trip, and cache is kept for 30 min.
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

/** Centralized query keys. */
export const qk = {
  banners: ["banners"] as const,
  categories: ["categories"] as const,
  products: (params?: unknown) => ["products", params] as const,
  productsByCategory: (slug: string, params?: unknown) =>
    ["products", "category", slug, params] as const,
  product: (slug: string) => ["product", slug] as const,
  productReviews: (productId: string) => ["product", productId, "reviews"] as const,
  cart: ["cart"] as const,
  wishlist: ["wishlist"] as const,
  orders: ["orders"] as const,
  order: (id: string) => ["order", id] as const,
  orderTrack: (id: string) => ["order", id, "track"] as const,
  addresses: ["addresses"] as const,
  me: ["me"] as const,
  // notifications
  notifications: ["notifications"] as const,
  notificationsUnread: ["notifications", "unread"] as const,
  notificationPrefs: ["notifications", "preferences"] as const,
  // affiliate
  affiliateMe: ["affiliate", "me"] as const,
  affiliateStats: ["affiliate", "stats"] as const,
  affiliateLink: ["affiliate", "link"] as const,
  affiliateClicks: ["affiliate", "clicks"] as const,
  affiliateConversions: ["affiliate", "conversions"] as const,
  affiliateCommissions: ["affiliate", "commissions"] as const,
  affiliateOrders: ["affiliate", "orders"] as const,
  // admin
  adminStats: ["admin", "stats"] as const,
  adminPnl: (range: string) => ["admin", "pnl", range] as const,
  adminOrders: (params?: unknown) => ["admin", "orders", params] as const,
  adminProducts: (params?: unknown) => ["admin", "products", params] as const,
  adminProduct: (id: string) => ["admin", "product", id] as const,
  adminCategories: ["admin", "categories"] as const,
  adminCoupons: ["admin", "coupons"] as const,
  adminBanners: ["admin", "banners"] as const,
  adminAffiliates: (params?: unknown) => ["admin", "affiliates", params] as const,
  adminAffiliate: (id: string) => ["admin", "affiliate", id] as const,
  adminWithdrawals: ["admin", "withdrawals"] as const,
  adminCommissions: ["admin", "commissions"] as const,
  adminPreOrders: (params?: unknown) => ["admin", "pre-orders", params] as const,
};
