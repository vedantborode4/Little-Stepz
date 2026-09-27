import type * as ImagePicker from "expo-image-picker";
import type { ReturnMedia, ReturnReasonCode } from "@repo/zod-schema/index";
import { api } from "../api/client";

// Mirrors apps/web/lib/services/return.service.ts — keep the two in step.

export type ReturnStatus =
  | "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED"
  | "PICKED_UP" | "RECEIVED" | "INSPECTION_FAILED" | "CANCELLED";

export type ReturnRefundRow = {
  id: string;
  channel: "RAZORPAY_PRIMARY" | "RAZORPAY_BALANCE" | "MANUAL";
  amount: number;
  status: "PENDING" | "INITIATED" | "PROCESSED" | "FAILED";
  processedAt: string | null;
  razorpayRefundId?: string | null;
  manualReference?: string | null;
  failureReason?: string | null;
};

export type ReturnItemRow = {
  id: string;
  orderItemId: string;
  quantity: number;
  acceptedQuantity: number | null;
  restocked: boolean;
  refundAmount: number | null;
  productName: string;
  variantName: string | null;
  image: string | null;
  unitPrice: number;
  orderedQuantity: number;
};

export type ReturnRequest = {
  id: string;
  orderId: string;
  kind: "ITEM" | "LEGACY";
  status: ReturnStatus;
  reasonCode: ReturnReasonCode | null;
  reason: string;
  description: string | null;
  media: ReturnMedia[];
  refundUpiId: string | null;
  adminNote: string | null;
  pickupMode: "MANUAL" | "DELHIVERY" | null;
  pickupStatus: string | null;
  pickupAwb: string | null;
  pickupTrackingUrl: string | null;
  inspectionNote: string | null;
  estimatedRefund: number;
  refundAmount: number | null;
  shippingRefund: number | null;
  createdAt: string;
  resolvedAt: string | null;
  pickedUpAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  cancelledAt: string | null;
  canCancel: boolean;
  items: ReturnItemRow[];
  refunds: ReturnRefundRow[];
};

export type ReturnableItem = {
  orderItemId: string;
  productName: string;
  variantName: string | null;
  image: string | null;
  unitPrice: number;
  quantity: number;
  remainingQuantity: number;
  returnable: boolean;
  blockedReason: string | null;
};

export type OrderReturns = {
  enabled: boolean;
  eligible: boolean;
  blockedReason: "DISABLED" | "NOT_DELIVERED" | "WINDOW_CLOSED" | "LEGACY_RETURN" | null;
  windowEndsAt: string | null;
  needsUpi: boolean;
  isPreOrder: boolean;
  items: ReturnableItem[];
  returns: ReturnRequest[];
};

export type ReturnQuote = {
  items: { orderItemId: string; quantity: number; amount: number }[];
  estimatedRefund: number;
  shippingNote: string | null;
  needsUpi: boolean;
};

export type ReturnSelection = { orderItemId: string; quantity: number }[];

export type UploadSignature = {
  timestamp: number;
  signature: string;
  folder: string;
  cloudName: string;
  apiKey: string;
  limits: { maxImageBytes: number; maxVideoBytes: number; maxVideoSeconds: number };
};

export const ReturnService = {
  getForOrder: async (orderId: string): Promise<OrderReturns> => {
    const res = await api.get(`/orders/${orderId}/returns`);
    return res.data.data;
  },

  quote: async (orderId: string, items: ReturnSelection): Promise<ReturnQuote> => {
    const res = await api.post(`/orders/${orderId}/returns/quote`, { items });
    return res.data.data;
  },

  uploadSignature: async (orderId: string): Promise<UploadSignature> => {
    const res = await api.post(`/orders/${orderId}/returns/upload-signature`);
    return res.data.data;
  },

  create: async (
    orderId: string,
    body: {
      items: ReturnSelection;
      reasonCode: ReturnReasonCode;
      description?: string;
      media: ReturnMedia[];
      refundUpiId?: string;
      idempotencyKey: string;
    }
  ): Promise<ReturnRequest> => {
    const res = await api.post(`/orders/${orderId}/returns`, body);
    return res.data.data;
  },

  cancel: async (orderId: string, returnId: string) => {
    const res = await api.post(`/orders/${orderId}/returns/${returnId}/cancel`);
    return res.data.data;
  },
};

/**
 * Upload one picked photo or video straight to Cloudinary under the order's signed folder.
 * Raw fetch, not the api client, so no Bearer header or baseURL is attached.
 */
export async function uploadReturnMedia(
  asset: ImagePicker.ImagePickerAsset,
  sig: UploadSignature
): Promise<ReturnMedia> {
  const type: ReturnMedia["type"] = asset.type === "video" ? "video" : "image";
  const form = new FormData();
  form.append("file", {
    uri: asset.uri,
    name: asset.fileName ?? (type === "video" ? "return.mp4" : "return.jpg"),
    type: asset.mimeType ?? (type === "video" ? "video/mp4" : "image/jpeg"),
  } as any);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/${type}/upload`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json?.secure_url) throw new Error(json?.error?.message || "Upload failed");
  return { url: json.secure_url, publicId: json.public_id, type };
}

export const RETURN_REASONS: { code: ReturnReasonCode; label: string }[] = [
  { code: "DAMAGED", label: "Item arrived damaged" },
  { code: "DEFECTIVE", label: "Item is defective" },
  { code: "WRONG_ITEM", label: "Wrong item delivered" },
  { code: "MISSING_PARTS", label: "Parts or accessories missing" },
  { code: "NOT_WORKING", label: "Item not working" },
  { code: "CHANGED_MIND", label: "Changed my mind" },
  { code: "OTHER", label: "Other" },
];

export const REFUND_CHANNEL_LABEL: Record<string, string> = {
  RAZORPAY_PRIMARY: "Razorpay",
  RAZORPAY_BALANCE: "Razorpay (balance payment)",
  MANUAL: "Manual payout (UPI)",
};
