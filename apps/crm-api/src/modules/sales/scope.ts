import type { NextFunction, Request, Response } from "express";
import { prisma, type Prisma } from "@repo/crm-db/client";
import { idParam } from "@repo/crm-schema";
import { can, currentUser } from "../../core/auth";
import { notFound } from "../../core/http";

/** Null when the user sees every sale; otherwise the id of the user whose own sales they see. */
export type SalesScope = { userId: string } | null;

/** Unfinished counter orders: any cashier on shift may take the balance and hand them over. */
const OPEN_COUNTER: Prisma.SalesOrderWhereInput = { fulfilment: "COUNTER", status: { in: ["CONFIRMED", "PACKED"] }, fulfilledAt: null };

export function salesScope(req: Request): SalesScope {
  return can(req, "sales.view.all") ? null : { userId: currentUser(req).id };
}

export function scopeWhere(scope: SalesScope): Prisma.SalesOrderWhereInput {
  return scope ? { OR: [{ createdById: scope.userId }, OPEN_COUNTER] } : {};
}

export function inScope(
  scope: SalesScope,
  o: { createdById: string | null; fulfilment: string; status: string; fulfilledAt: Date | null },
): boolean {
  if (!scope || o.createdById === scope.userId) return true;
  return o.fulfilment === "COUNTER" && (o.status === "CONFIRMED" || o.status === "PACKED") && !o.fulfilledAt;
}

/** Someone else's order looks the same as a missing one. */
export async function orderInScope(req: Request, _res: Response, next: NextFunction) {
  const scope = salesScope(req);
  if (scope) {
    const { id } = idParam.parse(req.params);
    const visible = await prisma.salesOrder.count({ where: { AND: [{ id }, scopeWhere(scope)] } });
    if (!visible) throw notFound("Order");
  }
  next();
}

/** A cashier can take money for, or put credit on, only an order they can see. */
export async function assertOrdersInScope(req: Request, orderIds: string[]) {
  const scope = salesScope(req);
  if (!scope || orderIds.length === 0) return;
  const ids = [...new Set(orderIds)];
  const visible = await prisma.salesOrder.count({ where: { AND: [{ id: { in: ids } }, scopeWhere(scope)] } });
  if (visible !== ids.length) throw notFound("Order");
}
