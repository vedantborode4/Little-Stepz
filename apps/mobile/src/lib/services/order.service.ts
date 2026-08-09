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
  cancelOrder: async (id: string, reason?: string) => {
    const res = await api.post(`/orders/${id}/cancel`, { reason });
    return res.data.data;
  },

  /** GET /orders/:id/track — Shiprocket tracking */
  track: async (id: string) => {
    const res = await api.get(`/orders/${id}/track`);
    return res.data.data;
  },
};
