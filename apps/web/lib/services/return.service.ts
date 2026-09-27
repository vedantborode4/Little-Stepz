import { api } from "../api-client"
import type { ReturnMedia, ReturnReasonCode } from "@repo/zod-schema/index"

export type ReturnStatus =
  | "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED"
  | "PICKED_UP" | "RECEIVED" | "INSPECTION_FAILED" | "CANCELLED"

export type ReturnRefundRow = {
  id: string
  channel: "RAZORPAY_PRIMARY" | "RAZORPAY_BALANCE" | "MANUAL"
  amount: number
  status: "PENDING" | "INITIATED" | "PROCESSED" | "FAILED"
  processedAt: string | null
  razorpayRefundId?: string | null
  manualReference?: string | null
  failureReason?: string | null
}

export type ReturnItemRow = {
  id: string
  orderItemId: string
  quantity: number
  acceptedQuantity: number | null
  restocked: boolean
  refundAmount: number | null
  productName: string
  variantName: string | null
  image: string | null
  unitPrice: number
  orderedQuantity: number
}

export type ReturnRequest = {
  id: string
  orderId: string
  kind: "ITEM" | "LEGACY"
  status: ReturnStatus
  reasonCode: ReturnReasonCode | null
  reason: string
  description: string | null
  media: ReturnMedia[]
  refundUpiId: string | null
  adminNote: string | null
  pickupMode: "MANUAL" | "DELHIVERY" | null
  pickupStatus: string | null
  pickupAwb: string | null
  pickupTrackingUrl: string | null
  inspectionNote: string | null
  estimatedRefund: number
  refundAmount: number | null
  shippingRefund: number | null
  createdAt: string
  resolvedAt: string | null
  pickedUpAt: string | null
  receivedAt: string | null
  refundedAt: string | null
  cancelledAt: string | null
  canCancel: boolean
  items: ReturnItemRow[]
  refunds: ReturnRefundRow[]
}

export type ReturnBlock = "DISABLED" | "NOT_DELIVERED" | "WINDOW_CLOSED" | "LEGACY_RETURN" | null

export type ReturnableItem = {
  orderItemId: string
  productName: string
  variantName: string | null
  image: string | null
  unitPrice: number
  quantity: number
  remainingQuantity: number
  returnable: boolean
  blockedReason: ReturnBlock | "NOT_RETURNABLE" | "ALREADY_RETURNED" | null
}

export type OrderReturns = {
  enabled: boolean
  eligible: boolean
  blockedReason: ReturnBlock
  windowEndsAt: string | null
  needsUpi: boolean
  isPreOrder: boolean
  items: ReturnableItem[]
  returns: ReturnRequest[]
}

export type ReturnQuote = {
  items: Array<{ orderItemId: string; quantity: number; amount: number }>
  estimatedRefund: number
  shippingNote: string | null
  needsUpi: boolean
}

export type ReturnSelection = Array<{ orderItemId: string; quantity: number }>

export type UploadSignature = {
  timestamp: number
  signature: string
  folder: string
  cloudName: string
  apiKey: string
  limits: { maxImageBytes: number; maxVideoBytes: number; maxVideoSeconds: number }
}

export const ReturnService = {
  getForOrder: async (orderId: string): Promise<OrderReturns> => {
    const res = await api.get(`/orders/${orderId}/returns`)
    return res.data.data
  },

  quote: async (orderId: string, items: ReturnSelection): Promise<ReturnQuote> => {
    const res = await api.post(`/orders/${orderId}/returns/quote`, { items })
    return res.data.data
  },

  uploadSignature: async (orderId: string): Promise<UploadSignature> => {
    const res = await api.post(`/orders/${orderId}/returns/upload-signature`)
    return res.data.data
  },

  create: async (
    orderId: string,
    body: {
      items: ReturnSelection
      reasonCode: ReturnReasonCode
      description?: string
      media: ReturnMedia[]
      refundUpiId?: string
      idempotencyKey: string
    }
  ): Promise<ReturnRequest> => {
    const res = await api.post(`/orders/${orderId}/returns`, body)
    return res.data.data
  },

  cancel: async (orderId: string, returnId: string) => {
    const res = await api.post(`/orders/${orderId}/returns/${returnId}/cancel`)
    return res.data.data
  },
}

/** Upload one evidence file straight to Cloudinary under the order's signed folder. */
export async function uploadReturnMedia(file: File, sig: UploadSignature): Promise<ReturnMedia> {
  const type: ReturnMedia["type"] = file.type.startsWith("video/") ? "video" : "image"
  const form = new FormData()
  form.append("file", file)
  form.append("api_key", sig.apiKey)
  form.append("timestamp", String(sig.timestamp))
  form.append("signature", sig.signature)
  form.append("folder", sig.folder)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/${type}/upload`, {
    method: "POST",
    body: form,
  })
  const data = await res.json()
  if (!res.ok || !data?.secure_url) throw new Error(data?.error?.message ?? "Upload failed")
  return { url: data.secure_url, publicId: data.public_id, type }
}

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  PENDING: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PICKED_UP: "Picked up",
  RECEIVED: "Received",
  INSPECTION_FAILED: "Inspection failed",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
}

export const RETURN_STATUS_CLASS: Record<ReturnStatus, string> = {
  PENDING: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400",
  APPROVED: "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300",
  REJECTED: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400",
  PICKED_UP: "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300",
  RECEIVED: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  INSPECTION_FAILED: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400",
  REFUNDED: "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300",
  CANCELLED: "bg-surface-2 text-muted",
}

export const RETURN_REASONS: Array<{ code: ReturnReasonCode; label: string }> = [
  { code: "DAMAGED", label: "Item arrived damaged" },
  { code: "DEFECTIVE", label: "Item is defective" },
  { code: "WRONG_ITEM", label: "Wrong item delivered" },
  { code: "MISSING_PARTS", label: "Parts or accessories missing" },
  { code: "NOT_WORKING", label: "Item not working" },
  { code: "CHANGED_MIND", label: "Changed my mind" },
  { code: "OTHER", label: "Other" },
]
