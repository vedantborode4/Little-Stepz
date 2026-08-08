import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { QueryClient, focusManager, onlineManager, type Query } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * React Query has no idea about React Native's lifecycle out of the box: it uses
 * browser `window` focus and `navigator.onLine`, neither of which exists here.
 * Without this wiring, queries fail outright when offline instead of pausing, and
 * nothing ever refreshes when the app comes back from the background.
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
  })
);

AppState.addEventListener("change", (status: AppStateStatus) => {
  focusManager.setFocused(status === "active");
});

/** 4xx responses are the client's fault — retrying them just delays the error. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      // Catalog data (products/categories/banners) changes rarely, so keep it
      // fresh for 5 min — revisiting a screen shows cached data instantly
      // instead of a network round-trip, and cache is kept for 30 min.
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      // Now meaningful thanks to the focusManager wiring above. Only *stale*
      // queries refetch, so returning to the app doesn't cause a request storm.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Query keys whose data is safe and useful to keep on disk: public catalog data
 * only. Personal data (orders, addresses, notifications, the wishlist, the user
 * profile) is deliberately NOT persisted — AsyncStorage is unencrypted, and it
 * would also survive a sign-out into the next user's session.
 */
const PERSISTED_ROOTS = new Set(["banners", "categories", "products", "product"]);

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "rq-catalog-cache",
  throttleTime: 2_000,
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: 24 * 60 * 60 * 1000,
  // Bump when a cached response shape changes, to discard stale disk data.
  buster: "v1",
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === "success" && PERSISTED_ROOTS.has(String(query.queryKey[0])),
  },
};

/**
 * Centralized query keys.
 *
 * Product list keys are built through one helper so every caller produces the same
 * key shape for the same filters. Previously the home rails passed `{sort, limit}`
 * while the shop grid passed `{search, category, sort, ...}`, so two requests for
 * an identical result set never shared a cache entry.
 */
export type ProductListParams = {
  search?: string;
  category?: string;
  sort?: string;
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
  preOrder?: boolean;
  page?: number;
  limit?: number;
};

/** Drops undefined/empty values and orders the keys, so equal filters hash equal. */
export function productListKey(params: ProductListParams = {}) {
  const normalized: Record<string, unknown> = {};
  (Object.keys(params) as (keyof ProductListParams)[])
    .sort()
    .forEach((k) => {
      const v = params[k];
      if (v !== undefined && v !== null && v !== "" && v !== false) normalized[k] = v;
    });
  return ["products", "list", normalized] as const;
}

export const qk = {
  banners: ["banners"] as const,
  categories: ["categories"] as const,
  products: (params?: ProductListParams) => productListKey(params),
  /** Every product list, for coarse invalidation. */
  productsAll: ["products"] as const,
  productsByCategory: (slug: string, params?: ProductListParams) =>
    ["products", "category", slug, params ?? {}] as const,
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
