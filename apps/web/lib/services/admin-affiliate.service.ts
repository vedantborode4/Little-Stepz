import { api } from "../api-client"

export type AffiliateStatus = "PENDING" | "APPROVED" | "REJECTED"
export type CommissionStatus = "PENDING" | "APPROVED" | "PAID" | "CANCELLED"
export type WithdrawalStatus = "PENDING" | "PROCESSING" | "PAID" | "REJECTED"

export interface AdminAffiliate {
  id: string
  status: AffiliateStatus
  referralCode: string
  commissionRate: number
  commissionType: "PER_ORDER" | "LIFETIME"
  totalClicks: number
  totalConversions: number
  totalCommission: number
  pendingBalance: number
  adminNote?: string
  approvedAt?: string
  createdAt: string
  user: { id: string; name: string; email: string; phone?: string }
}

export interface AdminCommission {
  id: string
  affiliateId: string
  orderId: string
  amount: number
  status: CommissionStatus
  paidAt?: string
  approvedBy?: string
  approvedAt?: string
  createdAt: string
  affiliate: {
    referralCode: string
    commissionRate: number
    user: { id: string; name: string; email: string }
  }
  order: { total: number; status: string; createdAt: string; paymentMethod: string }
}

export interface AdminWithdrawal {
  id: string
  affiliateId: string
  amount: number
  status: WithdrawalStatus
  payoutDetails: Record<string, any>
  processedAt?: string
  transactionRef?: string
  adminNote?: string
  createdAt: string
  affiliate: {
    id: string
    user: { name: string; email: string }
  }
}

// ── Affiliates ──────────────────────────────────────────────────────────────

export const AdminAffiliateService = {
  /** GET /admin/affiliates?status=&page=&limit= */
  getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
    const res = await api.get("/admin/affiliates", { params })
    // Response: { affiliates, pagination }
    return res.data.data as { affiliates: AdminAffiliate[]; pagination: { total: number; page: number; limit: number; pages: number } }
  },

  /** GET /admin/affiliates/:id/details */
  getById: async (id: string) => {
    const res = await api.get(`/admin/affiliates/${id}/details`)
    return res.data.data
  },

  /** PUT /admin/affiliates/:id/approve  body: { commissionRate?, commissionType?, adminNote? } */
  approve: async (id: string, body: { commissionRate?: number; commissionType?: string; adminNote?: string }) => {
    const res = await api.put(`/admin/affiliates/${id}/approve`, body)
    return res.data.data
  },

  /** PUT /admin/affiliates/:id/reject  body: { adminNote? } */
  reject: async (id: string, body: { adminNote?: string }) => {
    const res = await api.put(`/admin/affiliates/${id}/reject`, body)
    return res.data.data
  },
}

// ── Commissions ─────────────────────────────────────────────────────────────

export const AdminCommissionService = {
  /** GET /admin/affiliates/commissions?status=&page=&limit=&affiliateId= */
  getAll: async (params?: { status?: string; page?: number; limit?: number; affiliateId?: string; from?: string; to?: string }) => {
    const res = await api.get("/admin/affiliates/commissions", { params })
    return res.data.data as { commissions: AdminCommission[]; pagination: any; summary: any }
  },

  /** PUT /admin/affiliates/commissions/:id/approve  body: { note? } */
  approve: async (id: string, note?: string) => {
    const res = await api.put(`/admin/affiliates/commissions/${id}/approve`, { note })
    return res.data.data
  },

  /** PUT /admin/affiliates/commissions/:id/pay  body: { transactionRef?, note? } */
  markPaid: async (id: string, transactionRef?: string, note?: string) => {
    const res = await api.put(`/admin/affiliates/commissions/${id}/pay`, { transactionRef, note })
    return res.data.data
  },
}

// ── Withdrawals ──────────────────────────────────────────────────────────────

export const AdminWithdrawalService = {
  /** GET /admin/affiliates/withdrawals?status=&page=&limit= */
  getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
    const res = await api.get("/admin/affiliates/withdrawals", { params })
    return res.data.data as { withdrawals: AdminWithdrawal[]; pagination: any }
  },

  /** PUT /admin/affiliates/withdrawals/:id/process  body: { status, transactionRef?, adminNote? } */
  process: async (id: string, body: { status: "PAID" | "REJECTED"; transactionRef?: string; adminNote?: string }) => {
    const res = await api.put(`/admin/affiliates/withdrawals/${id}/process`, body)
    return res.data.data
  },
}
