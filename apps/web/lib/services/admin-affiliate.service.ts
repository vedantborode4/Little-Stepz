import { api } from "../api-client"

export interface AdminAffiliate {
  id: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  commissionRate: number
  commissionType: "PERCENTAGE" | "FLAT"
  adminNote?: string
  totalEarnings?: number
  user: {
    id: string
    name: string
    email: string
  }
  payoutDetails?: {
    method: string
    email?: string
  }
  createdAt: string
}

export const AdminAffiliateService = {
  getAll: async (params?: Record<string, any>) => {
    const res = await api.get("/admin/affiliates", { params })
    return res.data.data
  },

  getById: async (id: string) => {
    const res = await api.get(`/admin/affiliates/${id}`)
    return res.data.data
  },

  updateStatus: async (
    id: string,
    payload: {
      status: "APPROVED" | "REJECTED"
      commissionRate?: number
      commissionType?: "PERCENTAGE" | "FLAT"
      adminNote?: string
    }
  ) => {
    const res = await api.patch(`/admin/affiliates/${id}`, payload)
    return res.data.data
  },
}

export const AdminCommissionService = {
  getAll: async (params?: Record<string, any>) => {
    const res = await api.get("/admin/commissions", { params })
    return res.data.data
  },

  approve: async (id: string) => {
    const res = await api.patch(`/admin/commissions/${id}/approve`)
    return res.data.data
  },

  markPaid: async (id: string) => {
    const res = await api.patch(`/admin/commissions/${id}/pay`)
    return res.data.data
  },
}

export const AdminWithdrawalService = {
  getAll: async (params?: Record<string, any>) => {
    const res = await api.get("/admin/withdrawals", { params })
    return res.data.data
  },

  process: async (id: string, payload: { status: "APPROVED" | "REJECTED"; note?: string }) => {
    const res = await api.patch(`/admin/withdrawals/${id}`, payload)
    return res.data.data
  },
}
