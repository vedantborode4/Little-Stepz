import { prisma } from "@repo/db/client";
import { orderReference, type TrackOrderInput } from "@repo/zod-schema/index";
import { ApiError } from "../utils/api";
import { OrderErrorCode } from "../utils/orderErrors";
import { trackOrderService } from "./payment.services";

/** The order behind a private "View your order" link, or 404. */
export async function resolveOrderAccessTokenService(token: string) {
  const order = await prisma.order.findUnique({
    where: { accessToken: token },
    select: { id: true, userId: true, deletedAt: true },
  });
  if (!order || order.deletedAt) throw new ApiError(404, OrderErrorCode.ORDER_NOT_FOUND);
  return { orderId: order.id, userId: order.userId };
}

const PHONE = /^[6-9]\d{9}$/;

/**
 * Public tracking: the order number from the email plus the email or phone used on the order.
 * Returns status and courier tracking only — never the address, items, payment or the
 * private link, so guessing a pair reveals no more than a parcel tracking page does.
 */
export async function trackOrderByReferenceService({ reference, contact }: TrackOrderInput) {
  const matches = await prisma.order.findMany({
    where: {
      id: { endsWith: reference },
      deletedAt: null,
      ...(PHONE.test(contact) ? { address: { phone: contact } } : { user: { email: contact } }),
    },
    select: { id: true, userId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  const order = matches[0];
  if (!order) throw new ApiError(404, OrderErrorCode.ORDER_NOT_FOUND);

  const { orderId: _orderId, ...tracking } = await trackOrderService(order.userId, order.id);
  return { reference: orderReference(order.id), placedAt: order.createdAt, ...tracking };
}
