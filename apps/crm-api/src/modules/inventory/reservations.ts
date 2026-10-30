import { prisma, type Tx } from "@repo/crm-db/client";
import { ApiError } from "../../core/http";
import { lockVariants } from "./stock-engine";

export interface ReservationRequest {
  orderLineId: string;
  variantId: string;
  locationId: string;
  quantity: number;
}

export type ReleaseReason = "FULFILLED" | "CANCELLED";

/** Units reserved per variant at one location (active reservations only). */
export async function reservedAt(tx: Tx | typeof prisma, locationId: string, variantIds: string[]): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map();
  const rows = await tx.reservation.groupBy({
    by: ["variantId"],
    where: { locationId, variantId: { in: variantIds }, releasedAt: null },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.variantId, r._sum.quantity ?? 0]));
}

/** Sellable minus reserved, per variant at one location. */
export async function availableAt(tx: Tx | typeof prisma, locationId: string, variantIds: string[]): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map();
  const [balances, reserved] = await Promise.all([
    tx.stockBalance.findMany({ where: { locationId, bucket: "SELLABLE", variantId: { in: variantIds } } }),
    reservedAt(tx, locationId, variantIds),
  ]);
  const sellable = new Map(balances.map((b) => [b.variantId, b.quantity]));
  return new Map(variantIds.map((id) => [id, (sellable.get(id) ?? 0) - (reserved.get(id) ?? 0)]));
}

/**
 * Holds units for confirmed orders. Runs under the same per-variant lock as
 * stock postings, so two orders can never both claim the last unit.
 */
export async function reserveStock(tx: Tx, requests: ReservationRequest[]) {
  if (requests.length === 0) return;
  await lockVariants(
    tx,
    requests.map((r) => r.variantId),
  );
  const byLocation = new Map<string, ReservationRequest[]>();
  for (const r of requests) byLocation.set(r.locationId, [...(byLocation.get(r.locationId) ?? []), r]);

  for (const [locationId, group] of byLocation) {
    const available = await availableAt(
      tx,
      locationId,
      group.map((r) => r.variantId),
    );
    const short = group.filter((r) => (available.get(r.variantId) ?? 0) < r.quantity);
    if (short.length) {
      const skus = await tx.variant.findMany({ where: { id: { in: short.map((r) => r.variantId) } }, select: { id: true, sku: true } });
      const sku = new Map(skus.map((v) => [v.id, v.sku]));
      throw new ApiError(
        409,
        "STOCK_INSUFFICIENT",
        `Not enough available stock: ${short.map((r) => `${sku.get(r.variantId)} (${Math.max(available.get(r.variantId) ?? 0, 0)} available, ${r.quantity} needed)`).join(", ")}`,
        { shortages: short.map((r) => ({ sku: sku.get(r.variantId), available: available.get(r.variantId) ?? 0, needed: r.quantity })) },
      );
    }
  }
  await tx.reservation.createMany({ data: requests });
}

export async function releaseReservations(tx: Tx, orderLineIds: string[], reason: ReleaseReason) {
  if (orderLineIds.length === 0) return;
  await tx.reservation.updateMany({
    where: { orderLineId: { in: orderLineIds }, releasedAt: null },
    data: { releasedAt: new Date(), releaseReason: reason },
  });
}

/** Active reservations summed per variant across all locations (for stock lists). */
export async function reservedTotals(db: Tx | typeof prisma, variantIds: string[]): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map();
  const rows = await db.reservation.groupBy({
    by: ["variantId"],
    where: { variantId: { in: variantIds }, releasedAt: null },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.variantId, r._sum.quantity ?? 0]));
}
