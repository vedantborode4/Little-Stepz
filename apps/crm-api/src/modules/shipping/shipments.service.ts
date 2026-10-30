import { prisma, Prisma, type ShipmentStatus, type Tx } from "@repo/crm-db/client";
import {
  CLOSED_SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUSES,
  SHIPMENT_TRANSITIONS,
  type CreateShipmentInput,
  type PackageInput,
  type ShipmentDetailDto,
  type ShipmentListItemDto,
  type ShipmentListQuery,
  type ShipmentStatusInput,
  type ShipmentSummaryDto,
  type UpdateShipmentInput,
} from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { toDbDate } from "../../core/dates";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { pageWindow, paginated } from "../../core/list";
import { dec, Decimal, money } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { addEvent, deliverInTx, fulfilInTx, packInTx } from "../sales/sales.service";
import { trackingUrl } from "./couriers.service";

const d = (v: Prisma.Decimal | null | undefined) => new Decimal((v ?? 0).toString());
const CLOSED = [...CLOSED_SHIPMENT_STATUSES];

const shipmentInclude = {
  order: {
    select: {
      id: true,
      code: true,
      shippingCharged: true,
      customer: { select: { id: true, code: true, name: true, city: true, pincode: true } },
      returns: { select: { shippingRefund: true } },
    },
  },
  courier: { select: { id: true, name: true, trackingUrlTemplate: true } },
  packages: { orderBy: { createdAt: "asc" } },
  events: { include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ShipmentInclude;

type ShipmentRow = Prisma.ShipmentGetPayload<{ include: typeof shipmentInclude }>;

const charged = (o: ShipmentRow["order"]) =>
  d(o.shippingCharged).sub(o.returns.reduce((s, r) => s.add(d(r.shippingRefund)), new Decimal(0)));

function toListItem(s: ShipmentRow): ShipmentListItemDto {
  const customer = s.order.customer;
  return {
    id: s.id,
    code: s.code,
    status: s.status,
    order: { id: s.order.id, code: s.order.code },
    customer: customer ? { id: customer.id, code: customer.code, name: customer.name } : null,
    courier: s.courier ? { id: s.courier.id, name: s.courier.name } : null,
    awbs: s.packages.map((p) => p.awb),
    courierCost: money(s.courierCost),
    chargedToCustomer: money(charged(s.order)),
    dispatchedAt: s.dispatchedAt?.toISOString() ?? null,
    deliveredAt: s.deliveredAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

function toDetail(s: ShipmentRow): ShipmentDetailDto {
  return {
    ...toListItem(s),
    notes: s.notes,
    city: s.order.customer?.city ?? null,
    pincode: s.order.customer?.pincode ?? null,
    packages: s.packages.map((p) => ({
      id: p.id,
      awb: p.awb,
      weightKg: p.weightKg?.toString() ?? null,
      notes: p.notes,
      trackingUrl: trackingUrl(s.courier?.trackingUrlTemplate, p.awb),
    })),
    events: s.events.map((e) => ({
      id: e.id,
      status: e.status,
      note: e.note,
      userName: e.createdBy?.name ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
    nextStatuses: [...SHIPMENT_TRANSITIONS[s.status]],
  };
}

export async function getShipment(id: string) {
  const row = await prisma.shipment.findUnique({ where: { id }, include: shipmentInclude });
  if (!row) throw notFound("Shipment");
  return toDetail(row);
}

export async function listShipments(query: ShipmentListQuery) {
  const where: Prisma.ShipmentWhereInput = {
    status: query.status ?? (query.open ? { notIn: CLOSED } : undefined),
    courierId: query.courierId,
    createdAt:
      query.from || query.to
        ? {
            gte: query.from ? toDbDate(query.from) : undefined,
            lt: query.to ? new Date(toDbDate(query.to).getTime() + 86_400_000) : undefined,
          }
        : undefined,
    ...(query.q && {
      OR: [
        { code: { contains: query.q, mode: "insensitive" } },
        { order: { code: { contains: query.q, mode: "insensitive" } } },
        { order: { customer: { name: { contains: query.q, mode: "insensitive" } } } },
        { packages: { some: { awb: { contains: query.q.toUpperCase() } } } },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.shipment.findMany({ where, include: shipmentInclude, orderBy: [{ createdAt: "desc" }], ...pageWindow(query) }),
    prisma.shipment.count({ where }),
  ]);
  return paginated(rows.map(toListItem), total, query);
}

/** Counts by status, delivery orders still waiting for a shipment, and courier cost against shipping charged on open and finished shipments. */
export async function shipmentSummary(): Promise<ShipmentSummaryDto> {
  const [byStatus, awaiting, rows] = await Promise.all([
    prisma.shipment.groupBy({ by: ["status"], _count: true }),
    prisma.salesOrder.count({
      where: {
        fulfilment: "DELIVERY",
        status: { in: ["CONFIRMED", "PACKED"] },
        shipments: { none: { status: { notIn: ["CANCELLED", "RETURNED"] } } },
      },
    }),
    prisma.shipment.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { courierCost: true, order: { select: { shippingCharged: true, returns: { select: { shippingRefund: true } } } } },
    }),
  ]);
  const counts = Object.fromEntries(SHIPMENT_STATUSES.map((s) => [s, 0])) as Record<ShipmentStatus, number>;
  for (const r of byStatus) counts[r.status] = r._count;
  return {
    counts,
    awaitingShipment: awaiting,
    courierCost: money(rows.reduce((s, r) => s.add(d(r.courierCost)), new Decimal(0))),
    chargedToCustomer: money(
      rows.reduce(
        (s, r) => s.add(d(r.order.shippingCharged)).sub(r.order.returns.reduce((t, x) => t.add(d(x.shippingRefund)), new Decimal(0))),
        new Decimal(0),
      ),
    ),
  };
}

async function assertActiveCourier(tx: Tx, courierId: string | null | undefined) {
  if (!courierId) return;
  const courier = await tx.courierPartner.findUnique({ where: { id: courierId }, select: { isActive: true } });
  if (!courier?.isActive)
    throw new ApiError(400, "INVALID_COURIER", "Choose an active courier", { fieldErrors: { courierId: ["Choose an active courier"] } });
}

/** The AWB is unique; the index is the final word if two requests race. */
function mapAwbClash(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new ApiError(409, "AWB_TAKEN", "That AWB is already on another shipment", { fieldErrors: { awb: ["Already used"] } });
  }
  throw err;
}

async function assertAwbsFree(tx: Tx, awbs: string[]) {
  if (awbs.length !== new Set(awbs).size) throw new ApiError(400, "AWB_DUPLICATE", "The same AWB is listed twice");
  const used = await tx.shipmentPackage.findMany({ where: { awb: { in: awbs } }, select: { awb: true } });
  if (used.length) throw new ApiError(409, "AWB_TAKEN", `Already on another shipment: ${used.map((u) => u.awb).join(", ")}`);
}

/**
 * Starts a shipment for a delivery order. It picks up wherever the order is:
 * still to pack, packed, or already dispatched (tracking added afterwards).
 * Only one open shipment per order; the order row is the lock.
 */
export async function createShipment(input: CreateShipmentInput, ctx: RequestContext) {
  const id = await withTransaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SalesOrder" WHERE id = ${input.orderId} FOR UPDATE`;
    const order = await tx.salesOrder.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        code: true,
        status: true,
        fulfilment: true,
        fulfilledAt: true,
        shipments: { where: { status: { notIn: CLOSED } }, select: { code: true } },
      },
    });
    if (!order) throw notFound("Order");
    if (order.fulfilment !== "DELIVERY") throw new ApiError(409, "NOT_DELIVERY", `${order.code} is a counter order; it doesn't ship`);
    if (!["CONFIRMED", "PACKED", "DISPATCHED"].includes(order.status)) {
      throw new ApiError(409, "INVALID_STATUS", `${order.code} is ${order.status.toLowerCase()}; only confirmed orders can be shipped`);
    }
    if (order.shipments.length)
      throw new ApiError(409, "SHIPMENT_EXISTS", `${order.code} already has shipment ${order.shipments[0]!.code}`);
    await assertActiveCourier(tx, input.courierId);
    await assertAwbsFree(
      tx,
      input.packages.map((p) => p.awb),
    );

    const status: ShipmentStatus = order.status === "CONFIRMED" ? "PENDING" : order.status === "PACKED" ? "PACKED" : "DISPATCHED";
    const shipment = await tx.shipment.create({
      data: {
        code: await nextCode(tx, "SHP", 5),
        orderId: order.id,
        courierId: input.courierId ?? null,
        status,
        courierCost: dec(input.courierCost),
        notes: input.notes ?? null,
        dispatchedAt: status === "DISPATCHED" ? order.fulfilledAt : null,
        createdById: ctx.userId,
        packages: {
          createMany: { data: input.packages.map((p) => ({ awb: p.awb, weightKg: p.weightKg ?? null, notes: p.notes ?? null })) },
        },
        events: { create: { status, note: "Shipment created", createdById: ctx.userId } },
      },
    });
    await recordAudit(tx, ctx, {
      action: "shipment.created",
      entity: "Shipment",
      entityId: shipment.id,
      after: { code: shipment.code, order: order.code, status, awbs: input.packages.map((p) => p.awb) },
    });
    return shipment.id;
  }).catch(mapAwbClash);
  return getShipment(id);
}

async function lockShipment(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "Shipment" WHERE id = ${id} FOR UPDATE`;
  const shipment = await tx.shipment.findUnique({
    where: { id },
    include: { packages: { select: { id: true } }, order: { select: { id: true, code: true, status: true } } },
  });
  if (!shipment) throw notFound("Shipment");
  return shipment;
}

export async function updateShipment(id: string, input: UpdateShipmentInput, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    const before = await lockShipment(tx, id);
    if (before.status === "CANCELLED") throw new ApiError(409, "SHIPMENT_CLOSED", `${before.code} was cancelled`);
    const changingCourier = input.courierId !== undefined && input.courierId !== before.courierId;
    if (changingCourier && !["PENDING", "PACKED"].includes(before.status)) {
      throw new ApiError(409, "ALREADY_DISPATCHED", "The courier can't change once the parcel has gone");
    }
    if (changingCourier) await assertActiveCourier(tx, input.courierId);
    const after = await tx.shipment.update({
      where: { id },
      data: {
        ...(input.courierId !== undefined && { courierId: input.courierId }),
        ...(input.courierCost !== undefined && { courierCost: dec(input.courierCost) }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
    await recordAudit(tx, ctx, {
      action: "shipment.updated",
      entity: "Shipment",
      entityId: id,
      before: { courierId: before.courierId, courierCost: before.courierCost, notes: before.notes },
      after: { courierId: after.courierId, courierCost: after.courierCost, notes: after.notes },
    });
  });
  return getShipment(id);
}

export async function addPackage(id: string, input: PackageInput, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    const shipment = await lockShipment(tx, id);
    if (!["PENDING", "PACKED"].includes(shipment.status))
      throw new ApiError(409, "ALREADY_DISPATCHED", "Parcels can't be added after dispatch");
    await assertAwbsFree(tx, [input.awb]);
    await tx.shipmentPackage.create({
      data: { shipmentId: id, awb: input.awb, weightKg: input.weightKg ?? null, notes: input.notes ?? null },
    });
    await recordAudit(tx, ctx, { action: "shipment.updated", entity: "Shipment", entityId: id, after: { addedAwb: input.awb } });
  }).catch(mapAwbClash);
  return getShipment(id);
}

export async function removePackage(id: string, packageId: string, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    const shipment = await lockShipment(tx, id);
    if (!["PENDING", "PACKED"].includes(shipment.status))
      throw new ApiError(409, "ALREADY_DISPATCHED", "Parcels can't be removed after dispatch");
    const pkg = await tx.shipmentPackage.findFirst({ where: { id: packageId, shipmentId: id } });
    if (!pkg) throw notFound("Parcel");
    await tx.shipmentPackage.delete({ where: { id: packageId } });
    await recordAudit(tx, ctx, { action: "shipment.updated", entity: "Shipment", entityId: id, before: { removedAwb: pkg.awb } });
  });
  return getShipment(id);
}

/** Order timeline notes for shipment moves the sales engine doesn't already record. */
const ORDER_NOTES: Partial<Record<ShipmentStatus, string>> = {
  RTO: "shipment_rto",
  RETURNED: "shipment_returned",
  CANCELLED: "shipment_cancelled",
};

/**
 * Moves a shipment on, in the allowed order. Packing, dispatching and delivering
 * go through the sales engine in the same transaction, so stock leaves exactly
 * once (at dispatch) and the order and shipment never disagree.
 */
export async function changeStatus(id: string, input: ShipmentStatusInput, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    const shipment = await lockShipment(tx, id);
    const next = input.status;
    if (!SHIPMENT_TRANSITIONS[shipment.status].includes(next)) {
      throw new ApiError(
        409,
        "INVALID_TRANSITION",
        `A ${SHIPMENT_STATUS_LABELS[shipment.status].toLowerCase()} shipment can't move to ${SHIPMENT_STATUS_LABELS[next].toLowerCase()}`,
      );
    }
    const order = shipment.order;
    const now = new Date();
    const data: Prisma.ShipmentUpdateInput = { status: next };

    if (next === "PACKED") {
      if (order.status === "CONFIRMED") await packInTx(tx, ctx, order.id);
      data.packedAt = now;
    }
    if (next === "DISPATCHED") {
      if (!shipment.courierId) throw new ApiError(409, "COURIER_REQUIRED", "Choose the courier before dispatching");
      if (shipment.packages.length === 0)
        throw new ApiError(409, "AWB_REQUIRED", "Add at least one parcel with its AWB before dispatching");
      if (order.status === "CONFIRMED" || order.status === "PACKED") await fulfilInTx(tx, ctx, order.id);
      data.dispatchedAt = now;
    }
    if (next === "DELIVERED") {
      if (order.status === "DISPATCHED") await deliverInTx(tx, ctx, order.id);
      data.deliveredAt = now;
    }

    await tx.shipment.update({ where: { id }, data });
    await tx.shipmentEvent.create({ data: { shipmentId: id, status: next, note: input.note ?? null, createdById: ctx.userId } });
    const note = ORDER_NOTES[next];
    if (note) await addEvent(tx, ctx, order.id, note, null, `${shipment.code}${input.note ? `: ${input.note}` : ""}`);
    await recordAudit(tx, ctx, {
      action: "shipment.status_changed",
      entity: "Shipment",
      entityId: id,
      before: { status: shipment.status },
      after: { status: next, note: input.note ?? null },
    });
  });
  return getShipment(id);
}
