import { prisma } from "@repo/db/client";
import { NotificationType } from "@repo/db/client";
import type { AdminBroadcastBody, BroadcastTarget } from "@repo/zod-schema/index";
import { notifyMany } from "../notification.services";
import { ApiError } from "../../utils/api";
import { NotificationErrorCode } from "../../utils/notificationErrors";
import { createAuditLog } from "../../utils/auditLog";

/**
 * Bulk/segment sends (ALL, ROLE, PRODUCT_BUYERS) go out as MARKETING so a user's
 * marketing opt-out is respected. Targeted operational sends (a specific USER or
 * ORDER buyer) go out as ADMIN_CUSTOM — a SYSTEM-category message that is always
 * delivered, since these are follow-ups the recipient expects.
 */
function typeForTarget(target: BroadcastTarget): NotificationType {
  switch (target.type) {
    case "USER":
    case "ORDER":
      return "ADMIN_CUSTOM";
    default:
      return "MARKETING";
  }
}

async function resolveRecipients(target: BroadcastTarget): Promise<string[]> {
  switch (target.type) {
    case "ALL": {
      const users = await prisma.user.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    case "ROLE": {
      const users = await prisma.user.findMany({
        where: { role: target.role, deletedAt: null },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    case "USER": {
      const user = await prisma.user.findFirst({
        where: { id: target.userId, deletedAt: null },
        select: { id: true },
      });
      if (!user) {
        throw new ApiError(404, NotificationErrorCode.BROADCAST_TARGET_NOT_FOUND, {
          userId: ["User not found"],
        });
      }
      return [user.id];
    }
    case "PRODUCT_BUYERS": {
      const orders = await prisma.order.findMany({
        where: {
          deletedAt: null,
          items: { some: { productId: target.productId } },
        },
        select: { userId: true },
        distinct: ["userId"],
      });
      return orders.map((o) => o.userId);
    }
    case "ORDER": {
      const order = await prisma.order.findFirst({
        where: { id: target.orderId, deletedAt: null },
        select: { userId: true },
      });
      if (!order) {
        throw new ApiError(404, NotificationErrorCode.BROADCAST_TARGET_NOT_FOUND, {
          orderId: ["Order not found"],
        });
      }
      return [order.userId];
    }
  }
}

export async function adminBroadcastService(
  adminId: string,
  input: AdminBroadcastBody
) {
  const recipients = await resolveRecipients(input.target);
  if (recipients.length === 0) {
    throw new ApiError(400, NotificationErrorCode.NO_RECIPIENTS, {
      target: ["No recipients matched the target"],
    });
  }

  const type = typeForTarget(input.target);

  await notifyMany(recipients, {
    type,
    title: input.title,
    body: input.body,
    data: input.data,
  });

  await createAuditLog({
    userId: adminId,
    action: "NOTIFICATION_BROADCAST",
    entity: "Notification",
    entityId: input.target.type,
    metadata: {
      targetType: input.target.type,
      recipientCount: recipients.length,
      title: input.title,
    },
  });

  return {
    sent: true,
    recipientCount: recipients.length,
    type,
  };
}
