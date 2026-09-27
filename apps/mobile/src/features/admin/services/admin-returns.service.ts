import { api } from "../../../lib/api/client";
import type { ReturnRequest, ReturnStatus } from "../../../lib/services/return.service";

// Mirrors apps/web/lib/services/admin-return.service.ts — keep the two in step.

export type AdminReturnListRow = {
  id: string;
  orderId: string;
  kind: "ITEM" | "LEGACY";
  status: ReturnStatus;
  reason: string;
  units: number;
  pickupMode: "MANUAL" | "DELHIVERY" | null;
  pickupStatus: string | null;
  refundAmount: number | null;
  hasEvidence: boolean;
  createdAt: string;
  order: { id: string; total: number; paymentMethod: string; paymentPlan: string };
  customer: { id: string; name: string; email: string };
};

export type AdminReturnDetail = ReturnRequest & {
  preview: {
    lines: { orderItemId: string; quantity: number; amount: number }[];
    itemsTotal: number;
    shippingRefundable: number;
    shippingDefaultOn: boolean;
    refundCapacity: number;
    manualRefundLikely: boolean;
  } | null;
  pickupAvailable: boolean;
  order: {
    id: string;
    status: string;
    total: number;
    shippingCharges: number;
    paymentMethod: string;
    paymentPlan: string;
    isPreOrder: boolean;
  };
  customer: { id: string; name: string; email: string; phone: string | null } | null;
  address: { name: string; phone: string; address: string; city: string; state: string; pincode: string } | null;
};

export type ReceiveReturnInput = {
  items: { returnItemId: string; acceptedQuantity: number; restock: boolean }[];
  refundAmount?: number;
  refundShipping: boolean;
  inspectionNote?: string;
};

export const AdminReturnService = {
  list: async (params: { status?: ReturnStatus; page?: number; limit?: number }) => {
    const res = await api.get("/admin/returns", { params });
    return res.data.data as { returns: AdminReturnListRow[]; total: number; page: number; pages: number };
  },
  get: async (id: string): Promise<AdminReturnDetail> => {
    const res = await api.get(`/admin/returns/${id}`);
    return res.data.data;
  },
  /** Goes through the existing resolve route, which branches on the return's kind. */
  resolve: async (id: string, status: "APPROVED" | "REJECTED", adminNote?: string) => {
    const res = await api.put(`/admin/returns/${id}/resolve`, { status, ...(adminNote ? { adminNote } : {}) });
    return res.data.data;
  },
  schedulePickup: async (id: string, mode: "MANUAL" | "DELHIVERY") => {
    const res = await api.post(`/admin/returns/${id}/pickup`, { mode });
    return res.data.data as AdminReturnDetail;
  },
  markPickedUp: async (id: string) => {
    const res = await api.post(`/admin/returns/${id}/picked-up`);
    return res.data.data as AdminReturnDetail;
  },
  receive: async (id: string, body: ReceiveReturnInput) => {
    const res = await api.post(`/admin/returns/${id}/receive`, body);
    return res.data.data as AdminReturnDetail;
  },
  settleRefund: async (refundId: string, reference: string) => {
    const res = await api.post(`/admin/return-refunds/${refundId}/settle`, { reference });
    return res.data.data as AdminReturnDetail;
  },
  retryRefund: async (refundId: string) => {
    const res = await api.post(`/admin/return-refunds/${refundId}/retry`, { confirmNotRefunded: true });
    return res.data.data as AdminReturnDetail;
  },
};
