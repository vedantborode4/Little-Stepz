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

/** Human-readable description of a broadcast target, stored on the history record. */
function targetLabel(target: BroadcastTarget): string {
  switch (target.type) {
    case "ALL":
      return "Everyone";
    case "ROLE":
      return `Role: ${target.role}`;
    case "USER":
      return `User: ${target.userId}`;
    case "PRODUCT_BUYERS":
      return `Buyers of product: ${target.productId}`;
    case "ORDER":
      return `Order buyer: ${target.orderId}`;
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

  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { name: true },
  });

  await prisma.notificationBroadcast.create({
    data: {
      adminId,
      adminName: admin?.name ?? null,
      title: input.title,
      body: input.body,
      type,
      targetType: input.target.type,
      targetLabel: targetLabel(input.target),
      recipientCount: recipients.length,
    },
  });

  return {
    sent: true,
    recipientCount: recipients.length,
    type,
  };
}

export type TargetSearchKind = "user" | "product" | "order";

export interface TargetSearchResult {
  id: string;
  label: string;
  sublabel?: string;
}

/** Searches entities for the broadcast target picker. Returns a normalized list. */
export async function searchBroadcastTargetsService(
  kind: TargetSearchKind,
  q: string,
  limit = 10
): Promise<TargetSearchResult[]> {
  const query = q.trim();

  if (kind === "user") {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return users.map((u) => ({ id: u.id, label: u.name, sublabel: u.email }));
  }

  if (kind === "product") {
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      },
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return products.map((p) => ({ id: p.id, label: p.name, sublabel: p.slug }));
  }

  // order — match by (partial) id, or by the buyer's name/email
  const orders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { id: { contains: query.toLowerCase() } },
              { user: { name: { contains: query, mode: "insensitive" } } },
              { user: { email: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      total: true,
      createdAt: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return orders.map((o) => ({
    id: o.id,
    label: `#${o.id.slice(-8).toUpperCase()} · ${o.user?.name ?? "Customer"}`,
    sublabel: `₹${o.total.toNumber().toLocaleString("en-IN")} · ${o.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
  }));
}

export async function listBroadcastsService(page: number, limit: number) {
  const [items, total] = await prisma.$transaction([
    prisma.notificationBroadcast.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notificationBroadcast.count(),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
