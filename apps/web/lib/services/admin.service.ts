import { api } from "../api-client"

export interface AdminStats {
  kpis: {
    totalOrders: number
    ordersToday: number
    ordersThisWeek: number
    totalRevenue: number
    avgOrderValue: number
    revenueLast30d: number
    totalUsers: number
    newUsersToday: number
    newUsersThisWeek: number
    totalProducts: number
    lowStockProducts: number
    totalAffiliates: number
    pendingAffiliates: number
    pendingReturns: number
  }
  payments: {
    totalSuccess: number
    totalFailed: number
    successRate: string
  }
  commissions: {
    pending: { count: number; amount: number }
    approved: { count: number; amount: number }
  }
  ordersByStatus: Record<string, number>
  revenueChart: Array<{ day: string; revenue: number; orders: number }>
  topProducts: Array<{
    productId: string
    name: string
    slug: string
    totalQuantity: number
    totalOrders: number
  }>
  meta: { rangeFrom: string; rangeTo: string; generatedAt: string }
}

export const AdminService = {
  /** GET /admin/stats */
  getStats: async (params?: { from?: string; to?: string }): Promise<AdminStats> => {
    const res = await api.get("/admin/stats", { params })
    return res.data.data
  },
}
