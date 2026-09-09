import { api } from "../api/client";
import { savePdfAndShare } from "../pdf";
import type { Order } from "../../types/order";

export const OrderService = {
  getAll: async (): Promise<Order[] | { orders: Order[] }> => {
    const res = await api.get("/orders");
    return res.data.data;
  },

  getById: async (id: string): Promise<Order> => {
    const res = await api.get(`/orders/${id}`);
    return res.data.data;
  },

  /** POST /orders/:id/return */
  requestReturn: async (id: string, reason: string, description?: string) => {
    const res = await api.post(`/orders/${id}/return`, { reason, description });
    return res.data.data;
  },

  /** POST /orders/:id/cancel */
  /**
   * `confirmForfeit` is the record that the customer was shown, and accepted, that
   * cancelling a deposit-paid order keeps the deposit. The server refuses the
   * cancellation without it, so it must never be sent speculatively — only when the UI
   * has actually displayed the amount.
   */
  cancelOrder: async (id: string, reason?: string, confirmForfeit?: boolean) => {
    const res = await api.post(`/orders/${id}/cancel`, {
      reason,
      ...(confirmForfeit ? { confirmForfeit: true } : {}),
    });
    return res.data.data;
  },

  /**
   * GET /orders/:id/invoice — save the tax invoice, then hand it to the share sheet.
   *
   * Fetched through the axios client so the request carries the auth header; a plain
   * Linking.openURL would hit the endpoint unauthenticated and get a 401. The blob is
   * converted via FileReader because React Native has no Buffer, written to the cache
   * directory (disposable by design), and shared — Expo Go cannot write to the user's
   * Downloads folder, so the share sheet is how the file leaves the app.
   */
  downloadInvoice: async (id: string) => {
    return savePdfAndShare(`/orders/${id}/invoice`, `invoice-${id.slice(0, 8)}.pdf`);
  },

  /**
   * GET /orders/:id/receipt — the deposit acknowledgement on a partial-payment order.
   * A different document from the invoice, available as soon as the deposit is captured.
   */
  downloadReceipt: async (id: string) => {
    return savePdfAndShare(`/orders/${id}/receipt`, `receipt-${id.slice(0, 8)}.pdf`);
  },

  /** GET /orders/:id/track — Shiprocket tracking */
  track: async (id: string) => {
    const res = await api.get(`/orders/${id}/track`);
    return res.data.data;
  },
};
