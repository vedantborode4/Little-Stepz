import { api } from "../../../lib/api/client";
import { savePdfAndShare } from "../../../lib/pdf";

// ───────────────────────── Stats ─────────────────────────
export interface AdminStats {
  kpis: {
    totalOrders: number;
    ordersToday: number;
    ordersThisWeek: number;
    totalRevenue: number;
    avgOrderValue: number;
    revenueLast30d: number;
    totalUsers: number;
    newUsersToday: number;
    totalProducts: number;
    lowStockProducts: number;
    totalAffiliates: number;
    pendingAffiliates: number;
    pendingReturns: number;
  };
  commissions: {
    pending: { count: number; amount: number };
    approved: { count: number; amount: number };
  };
  ordersByStatus: Record<string, number>;
  revenueChart: Array<{ day: string; revenue: number; orders: number }>;
  topProducts: Array<{ productId: string; name: string; slug: string; totalQuantity: number; totalOrders: number }>;
}

// ───────────────────────── Profit & Loss ─────────────────────────
export interface PnlData {
  range: string;
  orderCount: number;
  revenue: number;
  gst: number;
  taxable: number;
  productCost: number;
  grossProfit: number;
  shippingCost: number;
  commissions: number;
  discounts: number;
  netProfit: number;
  margin: number; // 0..1
  hasActualCosts: boolean;
  costRatio: number;
  shippingPerOrder: number;
  gstRate: number;
  monthly: Array<{ label: string; revenue: number; grossProfit: number }>;
}

export const AdminService = {
  getStats: async (): Promise<AdminStats> => {
    const res = await api.get("/admin/stats");
    return res.data.data;
  },
  getPnl: async (range: string): Promise<PnlData> => {
    const res = await api.get("/admin/pnl", { params: { range } });
    return res.data.data;
  },
};

// ───────────────────────── Orders ─────────────────────────
export interface AdminOrder {
  id: string;
  status: string;
  subtotal: number;
  discount: number;
  shippingCharges: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
  user?: { id: string; name: string };
  payment?: { status: string; amount: number } | null;
  /** Id of the Return raised against this order, if any — what `resolveReturn` addresses. */
  returnId?: string | null;
  returnStatus?: "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED" | null;
  paymentPlan?: "FULL" | "PARTIAL";
  /** Delivered by hand rather than Delhivery — skipped by auto-ship. */
  manualFulfilment?: boolean;
  /** Still to collect, in rupees. 0 on a full-payment or settled order. */
  balanceOutstanding?: number;
}

export interface AdminOrdersQuery {
  page?: number;
  limit?: number;
  status?: string;
  paymentPlan?: "FULL" | "PARTIAL";
  /** "due" is the operational queue: deposit paid, balance not yet collected. */
  balanceState?: "due" | "settled";
  fromDate?: string;
  toDate?: string;
}

export interface AdminOrdersResponse {
  orders: AdminOrder[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  /** Money still to collect across the whole filtered set, not just this page. */
  outstandingTotal?: number;
  outstandingCount?: number;
}

export type BalanceCollectionMethod = "CASH" | "BANK_TRANSFER" | "UPI" | "OTHER";

export interface AdminOrderItem {
  id: string;
  quantity: number;
  price: number;
  subtotal: number;
  /** Snapshot taken at order time — never the live product name. */
  productName: string;
  variantName: string | null;
  image: string | null;
  productSlug: string;
}

export interface AdminOrderAddress {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

/** Deposit / balance terms of a partial-payment order, as the admin detail returns them. */
export interface AdminOrderPartial {
  depositAmount: number;
  balanceAmount: number;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  balanceStatus: "DUE" | "PAID" | "WRITTEN_OFF";
  balanceMethod: string | null;
  balanceReference: string | null;
  collectedAtDoor: boolean;
  depositForfeited: boolean;
  depositForfeitedAt: string | null;
  manualRefundAmount: number | null;
  manualRefundSettledAt: string | null;
}

export type CancellationParty = "MERCHANT" | "CUSTOMER";

export interface AdminOrderDetail extends AdminOrder {
  partial: AdminOrderPartial | null;
  user: { id: string; name: string; email: string; phone: string | null };
  address: AdminOrderAddress | null;
  items: AdminOrderItem[];
  coupon: { code: string; type: string; value: number } | null;
  payment:
    | {
        id: string;
        method: string;
        gateway: string;
        status: string;
        amount: number;
        refundId: string | null;
        refundAmount: number | null;
        refundReason: string | null;
        codCollectedAt: string | null;
        balanceSettledAt?: string | null;
        balanceMethod?: string | null;
      }
    | null;
  shipments: {
    id: string;
    awbCode: string | null;
    courierName: string | null;
    trackingUrl: string | null;
    status: string;
    deliveredAt: string | null;
    createdAt: string;
  }[];
}

export const AdminOrderService = {
  getOrders: async (params?: AdminOrdersQuery): Promise<AdminOrdersResponse> => {
    const res = await api.get("/admin/orders", { params });
    return res.data.data;
  },
  getById: async (id: string): Promise<AdminOrderDetail> => {
    const res = await api.get(`/admin/orders/${id}`);
    return res.data.data;
  },
  /**
   * `cancellationParty` is required by the API when cancelling a deposit-paid order: a
   * MERCHANT cancellation refunds the deposit, a CUSTOMER one forfeits it.
   */
  updateStatus: async (id: string, status: string, cancellationParty?: CancellationParty) => {
    const res = await api.put(`/admin/orders/${id}/status`, {
      status,
      ...(cancellationParty ? { cancellationParty } : {}),
    });
    return res.data.data;
  },
  createShipment: async (id: string) => {
    const res = await api.post(`/admin/orders/${id}/ship`);
    return res.data.data;
  },
  /** Cancels the Delhivery waybill. */
  cancelShipment: async (id: string) => {
    const res = await api.post(`/admin/orders/${id}/cancel-shipment`);
    return res.data.data;
  },
  /** Route an order by hand instead of Delhivery, or put it back on the courier. */
  setFulfilmentMode: async (id: string, manual: boolean) => {
    const res = await api.post(`/admin/orders/${id}/fulfilment`, { manual });
    return res.data.data as { id: string; manualFulfilment: boolean; changed: boolean };
  },
  /**
   * Record a partial order's balance as collected outside the gateway — a late COD
   * remittance, a bank transfer, or an order delivered without a COD manifest.
   */
  markBalancePaid: async (
    id: string,
    body: { method: BalanceCollectionMethod; reference?: string; note?: string }
  ) => {
    const res = await api.post(`/admin/orders/${id}/balance/mark-paid`, body);
    return res.data.data;
  },
  /** The tax invoice PDF, saved and shared. */
  downloadInvoice: async (id: string) => {
    return savePdfAndShare(`/admin/orders/${id}/invoice`, `invoice-${id.slice(0, 8)}.pdf`);
  },
  /**
   * PUT /admin/returns/:id/resolve
   *
   * `returnId` is the Return's id, NOT the order's — the route resolves a Return.
   * The body must match `resolveReturnBodySchema`, which is `.strict()`; this used to
   * send the order id plus `{ action, reason }`, so every call 400'd.
   */
  resolveReturn: async (
    returnId: string,
    body: { status: "APPROVED" | "REJECTED"; adminNote?: string; refundAmount?: number }
  ) => {
    const res = await api.put(`/admin/returns/${returnId}/resolve`, body);
    return res.data.data;
  },
};

// ───────────────────────── Products ─────────────────────────
export interface AdminProductImage { id: string; url: string; alt?: string | null; sortOrder: number }
export interface AdminProductVariant {
  id: string;
  name: string;
  sku?: string | null;
  price: number | null;
  salePrice?: number | null;
  isOnSale?: boolean;
  sortOrder?: number;
  stock: number;
  images?: AdminProductImage[];
  optionValues?: { optionValueId: string }[];
  /** Per-variant overrides. The product switch is the master — these can only opt out;
   *  a null amount/percent inherits the product's. */
  preOrderEnabled?: boolean;
  bookingAmount?: number | string | null;
  preOrderLimit?: number | null;
  partialPaymentEnabled?: boolean;
  depositPercent?: number | string | null;
  codEnabled?: boolean;
}

export interface AdminVariantBody {
  name?: string;
  sku?: string | null;
  price?: number | null;
  salePrice?: number | null;
  isOnSale?: boolean;
  stock?: number;
  sortOrder?: number;
  preOrderEnabled?: boolean;
  bookingAmount?: number | null;
  preOrderLimit?: number | null;
  partialPaymentEnabled?: boolean;
  depositPercent?: number | null;
  codEnabled?: boolean;
}
export interface AdminProductOptionValue { id: string; value: string; swatchHex?: string | null; sortOrder?: number }
export interface AdminProductOption { id: string; name: string; sortOrder?: number; values: AdminProductOptionValue[] }
export interface AdminMatrixBody {
  options: { name: string; values: { value: string; swatchHex?: string | null }[] }[];
  defaults?: { price?: number; salePrice?: number; isOnSale?: boolean; stock?: number };
}
export type PriceDisplayMode = "BOTH" | "REGULAR" | "SALE";
export interface ProductSpec {
  label: string;
  value: string;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description?: string;
  longDescription?: string | null;
  price: number;
  salePrice?: number | null;
  isOnSale?: boolean;
  priceDisplay?: PriceDisplayMode;
  costPrice?: number | null;
  quantity: number;
  inStock: boolean;
  categoryId?: string;
  category?: { id: string; name: string; slug: string };
  specifications?: ProductSpec[] | null;
  images: AdminProductImage[];
  variants: AdminProductVariant[];
  options?: AdminProductOption[];
  // Pre-order
  preOrderEnabled?: boolean;
  bookingAmount?: number | string | null;
  preOrderLimit?: number | null;
  preOrderNote?: string | null;
  // Partial payment + Cash on Delivery
  partialPaymentEnabled?: boolean;
  depositPercent?: number | string | null;
  codEnabled?: boolean;
  // SEO + Google Shopping
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
  noindex?: boolean;
  brand?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  condition?: "new" | "used" | "refurbished" | null;
}

/** Everything beyond name/slug/price/stock/category that create + update payloads carry. */
type ProductPricingFields = {
  salePrice?: number | null;
  isOnSale?: boolean;
  priceDisplay?: PriceDisplayMode;
  specifications?: ProductSpec[];
  preOrderEnabled?: boolean;
  bookingAmount?: number;
  preOrderLimit?: number;
  preOrderNote?: string;
  partialPaymentEnabled?: boolean;
  depositPercent?: number | null;
  codEnabled?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  noindex?: boolean;
  brand?: string;
  gtin?: string;
  mpn?: string;
  condition?: "new" | "used" | "refurbished";
};

export const AdminProductService = {
  getProducts: async (params?: { page?: number; limit?: number; sort?: string }) => {
    const res = await api.get("/products", { params });
    const d = res.data.data;
    return { products: d.products as AdminProduct[], total: d.total, page: d.page, pages: d.pages };
  },
  getProductById: async (id: string): Promise<AdminProduct> => {
    try {
      const res = await api.get(`/admin/products/${id}`);
      return res.data.data;
    } catch {
      const res = await api.get("/products", { params: { limit: 200 } });
      const products: AdminProduct[] = res.data.data?.products ?? [];
      const found = products.find((p) => p.id === id);
      if (!found) throw new Error("Product not found");
      return found;
    }
  },
  createProduct: async (
    body: { name: string; slug: string; description?: string; longDescription?: string; price: number; costPrice?: number; quantity?: number; inStock?: boolean; categoryId: string } & ProductPricingFields
  ) => {
    const res = await api.post("/admin/products", body);
    return res.data.data as AdminProduct;
  },
  updateProduct: async (
    id: string,
    body: Partial<{ name: string; slug: string; description: string | null; longDescription: string | null; price: number; costPrice: number; quantity: number; inStock: boolean; categoryId: string } & ProductPricingFields>
  ) => {
    const res = await api.put(`/admin/products/${id}`, body);
    return res.data.data as AdminProduct;
  },
  deleteProduct: async (id: string) => {
    await api.delete(`/admin/products/${id}`);
  },
  // variants
  /** Admin product search — the same endpoint the web product table uses. */
  searchProducts: async (q: string): Promise<AdminProduct[]> => {
    const res = await api.get("/products/search", { params: { q, limit: 50 } });
    const d = res.data.data;
    return (d?.products ?? d ?? []) as AdminProduct[];
  },
  createVariant: async (productId: string, body: AdminVariantBody & { name: string }) => {
    const res = await api.post(`/admin/products/${productId}/variants`, body);
    return res.data.data as AdminProductVariant;
  },
  updateVariant: async (id: string, body: AdminVariantBody) => {
    const res = await api.put(`/admin/products/variants/${id}`, body);
    return res.data.data as AdminProductVariant;
  },
  deleteVariant: async (id: string) => {
    await api.delete(`/admin/products/variants/${id}`);
  },
  generateVariantMatrix: async (productId: string, body: AdminMatrixBody) => {
    const res = await api.post(`/admin/products/${productId}/variants/matrix`, body);
    return res.data.data as { created: number; skipped: number; total: number };
  },
  deleteOption: async (optionId: string) => {
    await api.delete(`/admin/products/options/${optionId}`);
  },
  // images
  getImageSignature: async (context: string) => {
    const res = await api.get("/admin/products/images/upload-signature", { params: { productId: context } });
    return res.data.data as { cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string };
  },
  getVariantImageSignature: async (variantId: string) => {
    const res = await api.get("/admin/products/images/upload-signature", { params: { variantId } });
    return res.data.data as { cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string };
  },
  addImage: async (productId: string, body: { url: string; publicId: string; alt?: string; sortOrder?: number }) => {
    const res = await api.post(`/admin/products/${productId}/images`, body);
    return res.data.data as AdminProductImage;
  },
  addVariantImage: async (variantId: string, body: { url: string; publicId: string; alt?: string; sortOrder?: number }) => {
    const res = await api.post(`/admin/products/variants/${variantId}/images`, body);
    return res.data.data as AdminProductImage;
  },
  /** Swap an image's file, keeping its position and alt text. */
  replaceImage: async (imageId: string, body: { url: string; publicId: string }) => {
    const res = await api.put(`/admin/products/images/${imageId}/replace`, body);
    return res.data.data as AdminProductImage;
  },
  /** Alt text — read by screen readers and search engines. */
  updateImageAlt: async (imageId: string, alt: string) => {
    const res = await api.patch(`/admin/products/images/${imageId}/alt`, { alt });
    return res.data.data as AdminProductImage;
  },
  reorderImage: async (imageId: string, sortOrder: number) => {
    const res = await api.put(`/admin/products/images/${imageId}/reorder`, { sortOrder });
    return res.data.data;
  },
  deleteImage: async (imageId: string) => {
    await api.delete(`/admin/products/images/${imageId}`);
  },
};

// ───────────────────────── Categories ─────────────────────────
export interface AdminCategory { id: string; name: string; slug: string; description?: string | null; image?: string | null; parentId?: string | null; isActive?: boolean }

export const AdminCategoryService = {
  // Admin list — includes inactive categories (storefront hides them).
  getAll: async (): Promise<AdminCategory[]> => {
    const res = await api.get("/admin/categories");
    const d = res.data.data;
    return Array.isArray(d) ? d : d.categories ?? [];
  },
  create: async (body: { name: string; slug: string; description?: string; image?: string; parentId?: string; isActive?: boolean }) => {
    const res = await api.post("/admin/categories", body);
    return res.data.data as AdminCategory;
  },
  update: async (id: string, body: { name?: string; slug?: string; description?: string | null; image?: string; parentId?: string | null; isActive?: boolean }) => {
    const res = await api.put(`/admin/categories/${id}`, body);
    return res.data.data as AdminCategory;
  },
  delete: async (id: string) => {
    await api.delete(`/admin/categories/${id}`);
  },
};

// ───────────────────────── Coupons ─────────────────────────
export interface AdminCoupon {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  minOrderValue?: number | null;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  usedCount: number;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive: boolean;
}
export interface CreateCouponBody {
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  minOrderValue?: number;
  maxDiscount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  validFrom?: string;
  validUntil?: string;
  isActive?: boolean;
}

export const AdminCouponService = {
  getAll: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get("/admin/coupons", { params });
    const d = res.data.data;
    return { coupons: d.coupons as AdminCoupon[], total: d.total, pages: d.pages };
  },
  create: async (body: CreateCouponBody) => {
    const res = await api.post("/admin/coupons", body);
    return res.data.data as AdminCoupon;
  },
  update: async (id: string, body: Partial<CreateCouponBody>) => {
    const res = await api.put(`/admin/coupons/${id}`, body);
    return res.data.data as AdminCoupon;
  },
  delete: async (id: string) => {
    await api.delete(`/admin/coupons/${id}`);
  },
};

// ───────────────────────── Banners ─────────────────────────
export type BannerPosition = "HOME_HERO" | "MOBILE_HERO" | "HOME_MID" | "CATEGORY_TOP" | "PRODUCT_SIDEBAR" | "CHECKOUT_TOP";
export interface AdminBanner {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
  altText?: string | null;
  position: BannerPosition;
  sortOrder: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
}
export interface CreateBannerBody {
  title?: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl?: string;
  altText?: string;
  position: BannerPosition;
  sortOrder?: number;
  startsAt?: string;
  endsAt?: string;
  isActive?: boolean;
}

export const AdminBannerService = {
  getAll: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get("/admin/banners", { params });
    const d = res.data.data;
    return { banners: d.banners as AdminBanner[], pagination: d.pagination };
  },
  getById: async (id: string) => {
    const res = await api.get(`/admin/banners/${id}`);
    return res.data.data as AdminBanner;
  },
  create: async (body: CreateBannerBody) => {
    const res = await api.post("/admin/banners", body);
    return res.data.data as AdminBanner;
  },
  update: async (id: string, body: Partial<CreateBannerBody>) => {
    const res = await api.put(`/admin/banners/${id}`, body);
    return res.data.data as AdminBanner;
  },
  delete: async (id: string) => {
    await api.delete(`/admin/banners/${id}`);
  },
  toggle: async (id: string) => {
    const res = await api.patch(`/admin/banners/${id}/toggle`);
    return res.data.data;
  },
};

// ───────────────────────── Affiliates / Commissions / Withdrawals ─────────────────────────
export interface AdminAffiliate {
  id: string;
  status: string;
  referralCode: string;
  commissionRate: number;
  totalClicks: number;
  totalConversions: number;
  totalCommission: number;
  pendingBalance: number;
  adminNote?: string;
  createdAt: string;
  user: { id: string; name: string; email: string; phone?: string };
}

export interface AffiliateStats {
  affiliates: { total: number; approved: number; pending: number; rejected: number };
  commissions: { earned: number; pending: number; approved: number; paid: number };
  withdrawals: { pendingCount: number; pendingAmount: number; paid: number };
  referrals: { signups: number; orders: number; revenue: number };
}

export const AdminAffiliateService = {
  getStats: async () => {
    const res = await api.get("/admin/affiliates/stats");
    return res.data.data as AffiliateStats;
  },
  getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
    const res = await api.get("/admin/affiliates", { params });
    return res.data.data as { affiliates: AdminAffiliate[]; pagination: any };
  },
  getById: async (id: string) => {
    const res = await api.get(`/admin/affiliates/${id}/details`);
    return res.data.data;
  },
  /** Emails an invite to apply for the affiliate program. */
  invite: async (email: string) => {
    const res = await api.post("/admin/affiliates/invite", { email });
    return res.data.data as { email: string; inviteUrl: string; emailSent: boolean };
  },
  approve: async (id: string, body: { commissionRate?: number; adminNote?: string }) => {
    const res = await api.put(`/admin/affiliates/${id}/approve`, body);
    return res.data.data;
  },
  reject: async (id: string, body: { adminNote?: string }) => {
    const res = await api.put(`/admin/affiliates/${id}/reject`, body);
    return res.data.data;
  },
  update: async (id: string, body: { commissionRate?: number; adminNote?: string }) => {
    const res = await api.patch(`/admin/affiliates/${id}/update`, body);
    return res.data.data;
  },
};

export interface AdminWithdrawal {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  payoutDetails?: Record<string, any>;
  affiliate: { id: string; user: { name: string; email: string } };
}

export const AdminWithdrawalService = {
  getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
    const res = await api.get("/admin/affiliates/withdrawals", { params });
    return res.data.data as { withdrawals: AdminWithdrawal[]; pagination: any };
  },
  process: async (id: string, body: { status: "PAID" | "REJECTED"; transactionRef?: string; adminNote?: string }) => {
    const res = await api.put(`/admin/affiliates/withdrawals/${id}/process`, body);
    return res.data.data;
  },
};

export interface AdminCommission {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  affiliate: { referralCode: string; user: { name: string; email: string } };
  order: { total: number; status: string };
}

export const AdminCommissionService = {
  getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
    const res = await api.get("/admin/affiliates/commissions", { params });
    return res.data.data as { commissions: AdminCommission[]; pagination: any; summary: any };
  },
  approve: async (id: string, note?: string) => {
    const res = await api.put(`/admin/affiliates/commissions/${id}/approve`, { note });
    return res.data.data;
  },
  markPaid: async (id: string, transactionRef?: string, note?: string) => {
    const res = await api.put(`/admin/affiliates/commissions/${id}/pay`, { transactionRef, note });
    return res.data.data;
  },
};

// ───────────────────────── Customers ─────────────────────────
export type CustomerSegment = "all" | "with-orders" | "without-orders" | "affiliates";
export type CustomerSort = "recent" | "oldest" | "name" | "spend" | "orders";

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  registeredAt: string;
  isAffiliate: boolean;
  city: string | null;
  state: string | null;
  orders: number;
  totalSpend: number;
  aov: number;
  lastOrderAt: string | null;
}

export interface CartActivityEvent {
  id: string;
  createdAt: string;
  product: { id: string; name: string; slug: string | null };
  variantId: string | null;
  quantity: number;
  ip: string | null;
  userAgent: string | null;
  sessionId: string | null;
  user?: { id: string; name: string; email: string } | null;
}

export interface AdminCustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  referredBy: { id: string; name: string; email: string } | null;
  affiliate: { id: string; status: string; referralCode: string; commissionRate: string } | null;
  addresses: {
    id: string; name: string; phone: string; address: string; city: string;
    state: string; pincode: string; country: string; isDefault: boolean;
  }[];
  orders: {
    id: string; status: string; total: string; paymentMethod: string; createdAt: string;
    payment: { status: string; method: string } | null;
    _count: { items: number };
  }[];
  reviews: {
    id: string; rating: number; comment: string | null; createdAt: string;
    product: { id: string; name: string; slug: string };
  }[];
  stats: { orders: number; totalSpend: number; aov: number; lastOrderAt: string | null };
  cartActivity: CartActivityEvent[];
}

export interface CustomerPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const AdminCustomerService = {
  list: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    segment?: CustomerSegment;
    sort?: CustomerSort;
  }): Promise<{ customers: AdminCustomer[]; pagination: CustomerPagination }> => {
    const res = await api.get("/admin/customers", { params });
    return res.data.data;
  },
  get: async (id: string): Promise<AdminCustomerDetail> => {
    const res = await api.get(`/admin/customers/${id}`);
    return res.data.data;
  },
  cartActivity: async (params: {
    page?: number;
    limit?: number;
    userId?: string;
  }): Promise<{ events: CartActivityEvent[]; pagination: CustomerPagination }> => {
    const res = await api.get("/admin/customers/activity", { params });
    return res.data.data;
  },
};

// ───────────────────────── Shipping ─────────────────────────
export interface WarehouseStatus {
  configuredName: string | null;
  /** null = Delhivery gives no way to read this back — NOT "missing". */
  registered: boolean | null;
  /** False when Delhivery rejected the API token, so nothing could be checked. */
  authenticated?: boolean;
  message: string;
}

export const AdminShippingService = {
  getWarehouse: async (): Promise<WarehouseStatus> => {
    const res = await api.get("/admin/shipping/warehouse");
    return res.data.data;
  },
  registerWarehouse: async (): Promise<{ created: boolean; alreadyRegistered: boolean }> => {
    const res = await api.post("/admin/shipping/warehouse");
    return res.data.data;
  },
};

// ───────────────────────── Reviews ─────────────────────────
export interface AdminReview {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  user?: { id: string; name: string };
  product?: { id: string; name: string; slug: string };
}

export const AdminReviewService = {
  getAll: async (params?: { page?: number; limit?: number }): Promise<{ reviews: AdminReview[]; total: number; pages: number }> => {
    try {
      const res = await api.get("/admin/reviews", { params });
      const d = res.data.data;
      return {
        reviews: (Array.isArray(d) ? d : d?.reviews ?? []) as AdminReview[],
        total: d?.total ?? 0,
        pages: d?.pages ?? 1,
      };
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) throw err;
      // Fallback: aggregate reviews from products
      try {
        const productsRes = await api.get("/products", { params: { limit: 50 } });
        const products = productsRes.data.data?.products ?? [];
        const all: AdminReview[] = [];
        await Promise.allSettled(
          products.map(async (p: any) => {
            try {
              const r = await api.get(`/products/${p.id}/reviews`, { params: { limit: 20 } });
              const list: any[] = Array.isArray(r.data.data) ? r.data.data : r.data.data?.reviews ?? [];
              list.forEach((rev) => all.push({ ...rev, product: rev.product ?? { id: p.id, name: p.name, slug: p.slug } }));
            } catch {}
          })
        );
        all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return { reviews: all, total: all.length, pages: 1 };
      } catch {
        return { reviews: [], total: 0, pages: 1 };
      }
    }
  },
  delete: async (reviewId: string) => {
    await api.delete(`/admin/reviews/${reviewId}`);
  },
};

// ───────────────────────── Pre-Orders ─────────────────────────
export type AdminPreOrderStatus =
  | "PENDING_BOOKING"
  | "BOOKED"
  | "AWAITING_BALANCE"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED";

export interface AdminPreOrder {
  id: string;
  status: AdminPreOrderStatus;
  quantity: number;
  unitPrice: number;
  bookingAmount: number;
  totalAmount: number;
  balanceAmount: number;
  bookingPaidAt?: string | null;
  balancePaidAt?: string | null;
  balanceDueAt?: string | null;
  notifiedAt?: string | null;
  refundedAt?: string | null;
  orderId?: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  product: { id: string; name: string; slug: string };
  variant?: { id: string; name: string } | null;
}

export const AdminPreOrderService = {
  list: async (params?: { page?: number; limit?: number; status?: string }): Promise<{
    preOrders: AdminPreOrder[];
    total: number;
    page: number;
    pages: number;
  }> => {
    const res = await api.get("/admin/pre-orders", { params });
    const d = res.data.data;
    return {
      preOrders: (d?.preOrders ?? []) as AdminPreOrder[],
      total: d?.total ?? 0,
      page: d?.page ?? 1,
      pages: d?.pages ?? 1,
    };
  },

  getById: async (id: string): Promise<AdminPreOrder> => {
    const res = await api.get(`/admin/pre-orders/${id}`);
    return res.data.data;
  },

  /** The customer's booking receipt PDF. Only exists once the booking was paid. */
  downloadReceipt: async (id: string) => {
    return savePdfAndShare(`/admin/pre-orders/${id}/receipt`, `receipt-${id.slice(0, 8)}.pdf`);
  },

  refundBooking: async (id: string) => {
    const res = await api.post(`/admin/pre-orders/${id}/refund-booking`);
    return res.data.data;
  },

  cancel: async (id: string) => {
    const res = await api.post(`/admin/pre-orders/${id}/cancel`);
    return res.data.data;
  },

  resendLink: async (id: string) => {
    const res = await api.post(`/admin/pre-orders/${id}/resend-link`);
    return res.data.data;
  },
};
