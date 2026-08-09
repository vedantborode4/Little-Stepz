import { api } from "../api/client";
import type {
  AppNotification,
  DevicePlatform,
  NotificationListResponse,
  NotificationPreferences,
  NotificationType,
  BroadcastHistoryResponse,
  TargetSearchKind,
  TargetSearchResult,
} from "../../types/notification";

export type BroadcastTarget =
  | { type: "ALL" }
  | { type: "ROLE"; role: "USER" | "ADMIN" | "AFFILIATE" }
  | { type: "USER"; userId: string }
  | { type: "PRODUCT_BUYERS"; productId: string }
  | { type: "ORDER"; orderId: string };

export interface BroadcastBody {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  target: BroadcastTarget;
}

export interface BroadcastResult {
  sent: boolean;
  recipientCount: number;
  type: NotificationType;
}

export const NotificationService = {
  /** POST /notifications/devices — register this device's Expo push token. */
  registerDevice: async (input: {
    token: string;
    platform: DevicePlatform;
    deviceName?: string;
  }) => {
    const res = await api.post("/notifications/devices", input);
    return res.data.data;
  },

  /** DELETE /notifications/devices — unregister on logout. */
  unregisterDevice: async (token: string) => {
    const res = await api.delete("/notifications/devices", { data: { token } });
    return res.data.data;
  },

  /** GET /notifications — paginated feed. */
  list: async (params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<NotificationListResponse> => {
    const res = await api.get("/notifications", {
      params: {
        page: params?.page,
        limit: params?.limit,
        unreadOnly: params?.unreadOnly ? "true" : undefined,
      },
    });
    return res.data.data;
  },

  /** GET /notifications/unread-count */
  unreadCount: async (): Promise<number> => {
    const res = await api.get("/notifications/unread-count");
    return res.data.data.unreadCount;
  },

  /** PATCH /notifications/:id/read */
  markRead: async (id: string): Promise<AppNotification> => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data.data;
  },

  /** PATCH /notifications/read-all */
  markAllRead: async (): Promise<{ updated: number }> => {
    const res = await api.patch("/notifications/read-all");
    return res.data.data;
  },

  /** GET /notifications/preferences */
  getPreferences: async (): Promise<NotificationPreferences> => {
    const res = await api.get("/notifications/preferences");
    return res.data.data;
  },

  /** PATCH /notifications/preferences */
  updatePreferences: async (
    input: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> => {
    const res = await api.patch("/notifications/preferences", input);
    return res.data.data;
  },

  /** POST /admin/notifications/broadcast — admin only. */
  broadcast: async (body: BroadcastBody): Promise<BroadcastResult> => {
    const res = await api.post("/admin/notifications/broadcast", body);
    return res.data.data;
  },

  /** GET /admin/notifications/broadcasts — sent history (admin only). */
  broadcastHistory: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<BroadcastHistoryResponse> => {
    const res = await api.get("/admin/notifications/broadcasts", { params });
    return res.data.data;
  },

  /** GET /admin/notifications/search?kind=&q= — target picker (admin only). */
  searchTargets: async (
    kind: TargetSearchKind,
    q: string
  ): Promise<TargetSearchResult[]> => {
    const res = await api.get("/admin/notifications/search", { params: { kind, q } });
    return res.data.data.results;
  },
};
