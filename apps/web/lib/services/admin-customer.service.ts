import { api } from "../api-client"

export interface AdminCustomer {
  id: string
  name: string
  email: string
  phone: string | null
  registeredAt: string
  isAffiliate: boolean
  city: string | null
  state: string | null
  orders: number
  totalSpend: number
  aov: number
  lastOrderAt: string | null
}

export interface AdminCustomerDetail {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  avatarUrl: string | null
  emailVerified: boolean
  createdAt: string
  referralCode: string | null
  referredBy: { id: string; name: string; email: string } | null
  affiliate: { id: string; status: string; referralCode: string; commissionRate: string } | null
  addresses: {
    id: string; name: string; phone: string; address: string; city: string
    state: string; pincode: string; country: string; isDefault: boolean
  }[]
  orders: {
    id: string; status: string; total: string; paymentMethod: string; createdAt: string
    payment: { status: string; method: string } | null
    _count: { items: number }
  }[]
  reviews: {
    id: string; rating: number; comment: string | null; createdAt: string
    product: { id: string; name: string; slug: string }
  }[]
  stats: { orders: number; totalSpend: number; aov: number; lastOrderAt: string | null }
  cartActivity: CartActivityEvent[]
}

export interface CartActivityEvent {
  id: string
  createdAt: string
  product: { id: string; name: string; slug: string | null }
  variantId: string | null
  quantity: number
  ip: string | null
  userAgent: string | null
  sessionId: string | null
  user?: { id: string; name: string; email: string } | null
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type CustomerSegment = "all" | "with-orders" | "without-orders" | "affiliates"
export type CustomerSort = "recent" | "oldest" | "name" | "spend" | "orders"

export const AdminCustomerService = {
  list: async (params: {
    page?: number
    limit?: number
    search?: string
    segment?: CustomerSegment
    sort?: CustomerSort
  }): Promise<{ customers: AdminCustomer[]; pagination: Pagination }> => {
    const res = await api.get("/admin/customers", { params })
    return res.data.data
  },

  get: async (id: string): Promise<AdminCustomerDetail> => {
    const res = await api.get(`/admin/customers/${id}`)
    return res.data.data
  },

  cartActivity: async (params: {
    page?: number
    limit?: number
    userId?: string
  }): Promise<{ events: CartActivityEvent[]; pagination: Pagination }> => {
    const res = await api.get("/admin/customers/activity", { params })
    return res.data.data
  },
}
