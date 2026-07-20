import { prisma } from "@repo/db/client";
import {
  NotificationType,
  NotificationCategory,
  Prisma,
} from "@repo/db/client";
import type { ExpoPushMessage } from "expo-server-sdk";
import type {
  RegisterDeviceBody,
  UnregisterDeviceBody,
  NotificationListQuery,
  UpdatePreferencesBody,
} from "@repo/zod-schema/index";
import { sendExpoPush, isValidExpoPushToken } from "../utils/expo.client";
import { ApiError } from "../utils/api";
import { NotificationErrorCode } from "../utils/notificationErrors";

/** Maps each notification type to the category used for preference gating. */
const TYPE_CATEGORY: Record<NotificationType, NotificationCategory> = {
  ORDER_PLACED: "ORDER",
  ORDER_CONFIRMED: "ORDER",
  ORDER_PROCESSING: "ORDER",
  ORDER_SHIPPED: "ORDER",
  ORDER_OUT_FOR_DELIVERY: "ORDER",
  ORDER_DELIVERED: "ORDER",
  ORDER_CANCELLED: "ORDER",
  PAYMENT_SUCCESS: "PAYMENT",
  PAYMENT_FAILED: "PAYMENT",
  REFUND_PROCESSED: "PAYMENT",
  COMMISSION_EARNED: "AFFILIATE",
  COMMISSION_APPROVED: "AFFILIATE",
  COMMISSION_PAID: "AFFILIATE",
  WITHDRAWAL_PAID: "AFFILIATE",
  AFFILIATE_APPROVED: "AFFILIATE",
  REFERRAL_SIGNUP: "AFFILIATE",
  MARKETING: "MARKETING",
  ADMIN_NEW_ORDER: "SYSTEM",
  ADMIN_WITHDRAWAL_REQUEST: "SYSTEM",
  ADMIN_CUSTOM: "SYSTEM",
};

type PrefField =
  | "orderUpdates"
  | "paymentUpdates"
  | "affiliateUpdates"
  | "marketing";

/** Category → the preference flag that gates it. SYSTEM has none (always allowed). */
const CATEGORY_PREF_FIELD: Partial<Record<NotificationCategory, PrefField>> = {
  ORDER: "orderUpdates",
  PAYMENT: "paymentUpdates",
  AFFILIATE: "affiliateUpdates",
  MARKETING: "marketing",
};

const DEFAULT_PREFS = {
  pushEnabled: true,
  orderUpdates: true,
  paymentUpdates: true,
  affiliateUpdates: true,
  marketing: true,
};

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Single emit point for a notification. Persists the in-app feed row and, when
 * the user's preferences allow, sends an Expo push to their devices. Fail-soft:
 * never throws, so callers can fire it after a committed transaction without
 * risking the business flow. Marketing that a user has opted out of is dropped
 * entirely; transactional categories always land in the feed and only the push
 * channel is gated.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const category = TYPE_CATEGORY[input.type];
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: input.userId },
    });

    const prefField = CATEGORY_PREF_FIELD[category];
    const categoryAllowed = !prefField || !prefs || prefs[prefField] !== false;

    // Marketing opt-out suppresses the feed row too; other categories always store.
    if (category === "MARKETING" && !categoryAllowed) return;

    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        category,
        title: input.title,
        body: input.body,
        data: (input.data ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });

    const pushAllowed = (!prefs || prefs.pushEnabled) && categoryAllowed;
    if (!pushAllowed) return;

    const tokens = await prisma.deviceToken.findMany({
      where: { userId: input.userId },
      select: { token: true },
    });
    const valid = tokens.map((t) => t.token).filter(isValidExpoPushToken);
    if (valid.length === 0) return;

    const messages: ExpoPushMessage[] = valid.map((token) => ({
      to: token,
      sound: "default",
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      channelId: "default",
    }));

    const { invalidTokens } = await sendExpoPush(messages);
    if (invalidTokens.length > 0) {
      await prisma.deviceToken.deleteMany({
        where: { token: { in: invalidTokens } },
      });
    }
  } catch (err) {
    console.error("[notify] failed for user", input.userId, err);
  }
}

/** Fan-out to many users in bounded batches to avoid exhausting the pool. */
export async function notifyMany(
  userIds: string[],
  payload: Omit<NotifyInput, "userId">
): Promise<void> {
  const unique = [...new Set(userIds)];
  const BATCH = 25;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    await Promise.all(batch.map((userId) => notify({ ...payload, userId })));
  }
}

/** Notify every active admin (in-app feed; push only if an admin registered a device). */
export async function notifyAdmins(
  payload: Omit<NotifyInput, "userId">
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", deletedAt: null },
    select: { id: true },
  });
  await notifyMany(
    admins.map((a) => a.id),
    payload
  );
}

export async function registerDeviceService(
  userId: string,
  input: RegisterDeviceBody
) {
  const token = input.token.trim();
  if (!isValidExpoPushToken(token)) {
    throw new ApiError(400, NotificationErrorCode.INVALID_PUSH_TOKEN, {
      token: ["Not a valid Expo push token"],
    });
  }

  const device = await prisma.deviceToken.upsert({
    where: { token },
    create: {
      userId,
      token,
      platform: input.platform,
      deviceName: input.deviceName,
      lastUsedAt: new Date(),
    },
    update: {
      userId,
      platform: input.platform,
      deviceName: input.deviceName,
      lastUsedAt: new Date(),
    },
  });

  return {
    id: device.id,
    token: device.token,
    platform: device.platform,
  };
}

export async function unregisterDeviceService(
  userId: string,
  input: UnregisterDeviceBody
) {
  await prisma.deviceToken.deleteMany({
    where: { token: input.token.trim(), userId },
  });
  return { success: true };
}

export async function listNotificationsService(
  userId: string,
  query: NotificationListQuery
) {
  const { page, limit, unreadOnly } = query;
  const where = {
    userId,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [items, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    items,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function unreadCountService(userId: string) {
  const unreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  });
  return { unreadCount };
}

export async function markReadService(userId: string, id: string) {
  const notif = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notif) {
    throw new ApiError(404, NotificationErrorCode.NOTIFICATION_NOT_FOUND, {
      id: ["Notification not found"],
    });
  }
  if (notif.readAt) return notif;

  return prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

export async function markAllReadService(userId: string) {
  const res = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: res.count };
}

export async function getPreferencesService(userId: string) {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs) return { userId, ...DEFAULT_PREFS };
  return prefs;
}

export async function updatePreferencesService(
  userId: string,
  input: UpdatePreferencesBody
) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...input },
    update: { ...input },
  });
}
