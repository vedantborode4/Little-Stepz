import { NextFunction, Request, Response } from "express";
import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";
import { OrderErrorCode } from "../utils/orderErrors";
import { PreOrderErrorCode } from "../utils/preorderErrors";

/**
 * Guest-checkout sessions run as the shopper's password-less account, and that account may
 * hold rows from an earlier guest session — possibly one started by someone else who typed
 * the same email. So a guest session only ever sees what it created itself (from
 * `guest.since` on), or, for an emailed "View your order" link, exactly one order.
 *
 * Every id a guest can address goes through one of these. Signed-in customers pass
 * straight through; their ownership checks live in the services as before.
 */

type Guest = NonNullable<NonNullable<Request["user"]>["guest"]>;

function visibleToGuest(guest: Guest, row: { id: string; createdAt: Date } | null): boolean {
  if (!row) return false;
  if (guest.orderId) return row.id === guest.orderId;
  return row.createdAt >= guest.since;
}

async function guestOwnsOrder(req: Request, orderId: string): Promise<boolean> {
  const guest = req.user!.guest!;
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: req.user!.userId, deletedAt: null },
    select: { id: true, createdAt: true },
  });
  return visibleToGuest(guest, order);
}

/** `router.param("id", ...)` on the orders router. */
export async function guestOrderParam(req: Request, _res: Response, next: NextFunction, id: string) {
  try {
    if (req.user?.guest && !(await guestOwnsOrder(req, id))) {
      throw new ApiError(404, OrderErrorCode.ORDER_NOT_FOUND);
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Payment routes name the order in the body rather than the path. */
export async function guestOrderBodyScope(req: Request, _res: Response, next: NextFunction) {
  try {
    const orderId = typeof req.body?.orderId === "string" ? req.body.orderId : undefined;
    if (req.user?.guest && orderId && !(await guestOwnsOrder(req, orderId))) {
      throw new ApiError(404, OrderErrorCode.ORDER_NOT_FOUND);
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** `router.param("id", ...)` on the pre-orders router. Single-order links never cover pre-orders. */
export async function guestPreOrderParam(req: Request, _res: Response, next: NextFunction, id: string) {
  try {
    const guest = req.user?.guest;
    if (guest) {
      const preOrder = guest.orderId
        ? null
        : await prisma.preOrder.findFirst({
            where: { id, userId: req.user!.userId, deletedAt: null },
            select: { id: true, createdAt: true },
          });
      if (!visibleToGuest(guest, preOrder)) throw new ApiError(404, PreOrderErrorCode.PREORDER_NOT_FOUND);
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** `router.param("id", ...)` on the address router. */
export async function guestAddressParam(req: Request, _res: Response, next: NextFunction, id: string) {
  try {
    const guest = req.user?.guest;
    if (guest) {
      const address = guest.orderId
        ? null
        : await prisma.address.findFirst({
            where: { id, userId: req.user!.userId, deletedAt: null },
            select: { id: true, createdAt: true },
          });
      if (!visibleToGuest(guest, address)) throw new ApiError(404, "Address not found");
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Rows a guest session may list: only those it created. */
export function guestSinceFilter(req: Request): { createdAt?: { gte: Date } } {
  const guest = req.user?.guest;
  if (!guest) return {};
  // A single-order link lists nothing (the future-dated bound matches no row).
  return { createdAt: { gte: guest.orderId ? new Date(8.64e15) : guest.since } };
}
