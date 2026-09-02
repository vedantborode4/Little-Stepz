import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { api } from "../api/client";
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
    const res = await api.get(`/orders/${id}/invoice`, { responseType: "blob" });

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("Could not read the invoice"));
      reader.readAsDataURL(res.data as Blob);
    });

    const disposition = res.headers?.["content-disposition"] as string | undefined;
    const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? `invoice-${id.slice(0, 8)}.pdf`;

    const file = new File(Paths.cache, filename);
    if (file.exists) file.delete();
    file.create();
    file.write(base64, { encoding: "base64" });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    }
    return file.uri;
  },

  /** GET /orders/:id/track — Shiprocket tracking */
  track: async (id: string) => {
    const res = await api.get(`/orders/${id}/track`);
    return res.data.data;
  },
};
