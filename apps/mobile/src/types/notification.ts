export type NotificationCategory =
  | "ORDER"
  | "PAYMENT"
  | "AFFILIATE"
  | "MARKETING"
  | "SYSTEM";

export type NotificationType =
  | "ORDER_PLACED"
  | "ORDER_CONFIRMED"
  | "ORDER_PROCESSING"
  | "ORDER_SHIPPED"
  | "ORDER_OUT_FOR_DELIVERY"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "REFUND_PROCESSED"
  | "COMMISSION_EARNED"
  | "COMMISSION_APPROVED"
  | "COMMISSION_PAID"
  | "WITHDRAWAL_PAID"
  | "AFFILIATE_APPROVED"
  | "REFERRAL_SIGNUP"
  | "MARKETING"
  | "ADMIN_NEW_ORDER"
  | "ADMIN_WITHDRAWAL_REQUEST"
  | "ADMIN_CUSTOM";

export interface AppNotification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: AppNotification[];
  unreadCount: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  orderUpdates: boolean;
  paymentUpdates: boolean;
  affiliateUpdates: boolean;
  marketing: boolean;
}

export type DevicePlatform = "IOS" | "ANDROID";

export interface BroadcastRecord {
  id: string;
  adminId: string;
  adminName: string | null;
  title: string;
  body: string;
  type: NotificationType;
  targetType: string;
  targetLabel: string | null;
  recipientCount: number;
  createdAt: string;
}

export interface BroadcastHistoryResponse {
  items: BroadcastRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export type TargetSearchKind = "user" | "product" | "order";

export interface TargetSearchResult {
  id: string;
  label: string;
  sublabel?: string;
}
