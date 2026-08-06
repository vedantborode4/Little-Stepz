import { Ionicons } from "@expo/vector-icons";
import type { NotificationType } from "../types/notification";

/** Ionicon for a notification type, for the feed row leading avatar. */
export function notificationIcon(type: NotificationType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "ORDER_PLACED":
      return "bag-check-outline";
    case "ORDER_CONFIRMED":
      return "checkmark-circle-outline";
    case "ORDER_PROCESSING":
      return "cube-outline";
    case "ORDER_SHIPPED":
      return "car-outline";
    case "ORDER_OUT_FOR_DELIVERY":
      return "bicycle-outline";
    case "ORDER_DELIVERED":
      return "gift-outline";
    case "ORDER_CANCELLED":
      return "close-circle-outline";
    case "PAYMENT_SUCCESS":
      return "card-outline";
    case "PAYMENT_FAILED":
      return "alert-circle-outline";
    case "REFUND_PROCESSED":
      return "cash-outline";
    case "COMMISSION_EARNED":
    case "COMMISSION_APPROVED":
    case "COMMISSION_PAID":
    case "WITHDRAWAL_PAID":
      return "wallet-outline";
    case "AFFILIATE_APPROVED":
    case "REFERRAL_SIGNUP":
      return "people-outline";
    case "MARKETING":
      return "pricetag-outline";
    case "ADMIN_NEW_ORDER":
      return "receipt-outline";
    case "ADMIN_WITHDRAWAL_REQUEST":
      return "cash-outline";
    default:
      return "notifications-outline";
  }
}
