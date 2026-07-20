import { api } from "../api-client"

export type NotificationType =
  | "ORDER_PLACED" | "ORDER_CONFIRMED" | "ORDER_PROCESSING" | "ORDER_SHIPPED"
  | "ORDER_OUT_FOR_DELIVERY" | "ORDER_DELIVERED" | "ORDER_CANCELLED"
  | "PAYMENT_SUCCESS" | "PAYMENT_FAILED" | "REFUND_PROCESSED"
  | "COMMISSION_EARNED" | "COMMISSION_APPROVED" | "COMMISSION_PAID" | "WITHDRAWAL_PAID"
  | "AFFILIATE_APPROVED" | "REFERRAL_SIGNUP" | "MARKETING"
  | "ADMIN_NEW_ORDER" | "ADMIN_WITHDRAWAL_REQUEST" | "ADMIN_CUSTOM"

export type NotificationCategory = "ORDER" | "PAYMENT" | "AFFILIATE" | "MARKETING" | "SYSTEM"

export interface AdminNotification {
  id: string
  type: NotificationType
  category: NotificationCategory
  title: string
  body: string
  data?: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}

export interface NotificationFeed {
  items: AdminNotification[]
  unreadCount: number
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export type BroadcastTarget =
  | { type: "ALL" }
  | { type: "ROLE"; role: "USER" | "ADMIN" | "AFFILIATE" }
  | { type: "USER"; userId: string }
  | { type: "PRODUCT_BUYERS"; productId: string }
  | { type: "ORDER"; orderId: string }

export interface BroadcastBody {
  title: string
  body: string
  data?: Record<string, unknown>
  target: BroadcastTarget
}

export interface BroadcastResult {
  sent: boolean
  recipientCount: number
  type: NotificationType
}

export interface BroadcastRecord {
  id: string
  adminId: string
  adminName: string | null
  title: string
  body: string
  type: NotificationType
  targetType: string
  targetLabel: string | null
  recipientCount: number
  createdAt: string
}

export interface BroadcastHistory {
  items: BroadcastRecord[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export type TargetSearchKind = "user" | "product" | "order"

export interface TargetSearchResult {
  id: string
  label: string
  sublabel?: string
}

export const AdminNotificationService = {
  /** POST /admin/notifications/broadcast */
  broadcast: async (body: BroadcastBody): Promise<BroadcastResult> => {
    const res = await api.post("/admin/notifications/broadcast", body)
    return res.data.data
  },

  /** GET /notifications — the admin's own in-app feed (new orders, withdrawal requests, …) */
  feed: async (params?: { page?: number; limit?: number; unreadOnly?: boolean }): Promise<NotificationFeed> => {
    const res = await api.get("/notifications", {
      params: {
        page: params?.page,
        limit: params?.limit,
        unreadOnly: params?.unreadOnly ? "true" : undefined,
      },
    })
    return res.data.data
  },

  /** GET /notifications/unread-count */
  unreadCount: async (): Promise<number> => {
    const res = await api.get("/notifications/unread-count")
    return res.data.data.unreadCount
  },

  /** PATCH /notifications/:id/read */
  markRead: async (id: string): Promise<AdminNotification> => {
    const res = await api.patch(`/notifications/${id}/read`)
    return res.data.data
  },

  /** PATCH /notifications/read-all */
  markAllRead: async (): Promise<{ updated: number }> => {
    const res = await api.patch("/notifications/read-all")
    return res.data.data
  },

  /** GET /admin/notifications/broadcasts — sent history */
  broadcastHistory: async (params?: { page?: number; limit?: number }): Promise<BroadcastHistory> => {
    const res = await api.get("/admin/notifications/broadcasts", { params })
    return res.data.data
  },

  /** GET /admin/notifications/search?kind=&q= — target picker search */
  searchTargets: async (kind: TargetSearchKind, q: string): Promise<TargetSearchResult[]> => {
    const res = await api.get("/admin/notifications/search", { params: { kind, q } })
    return res.data.data.results
  },
}
