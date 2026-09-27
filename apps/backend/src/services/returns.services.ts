import { prisma, Prisma } from "@repo/db/client";
import type { ReturnStatus } from "@repo/db/client";
import { Decimal } from "decimal.js";
import type { Request } from "express";
import {
  SELLER_FAULT_REASON_CODES,
  type CreateItemReturnBody,
  type ReturnMedia,
  type ReturnReasonCode,
  type ReceiveReturnBody,
  type AdminReturnsQuery,
} from "@repo/zod-schema/index";
import { ApiError } from "../utils/api";
import { ReturnErrorCode } from "../utils/returnErrors";
import { PaymentErrorCode } from "../utils/paymentErrors";
import {
  itemReturnsEnabled,
  reversePickupEnabled,
  resolveDeliveredAt,
  returnWindowEnd,
  allocateLineNet,
  unitsValue,
  needsManualRefund,
  maskUpi,
  round2,
  QUANTITY_HOLDING_STATUSES,
  OPEN_RETURN_STATUSES,
  RECEIVED_RETURN_STATUSES,
  MIN_GATEWAY_REFUND,
} from "../utils/returns";
import { amountPaid } from "../utils/partialPayment";
import { createAuditLog, createAuditLogInTx } from "../utils/auditLog";
import { notify, notifyAdmins } from "./notification.services";
import { money, orderShortRef } from "../utils/notificationCopy";
import { sendReturnRequestedEmail, sendReturnStatusEmail } from "../utils/email";
import { refundReturnMoney } from "./refund.services";
import { reduceAffiliateCommissionForReturn } from "./affiliate.services";
import { restoreReturnedUnits } from "../utils/stock";
import { cloudinary } from "../utils/cloudinary";
import {
  checkServiceability,
  createDelhiveryReversePickup,
  cancelDelhiveryShipment,
  mapReversePickupStatus,
} from "../utils/delhivery.client";

type Tx = Prisma.TransactionClient;

const REASON_LABELS: Record<ReturnReasonCode, string> = {
  DAMAGED: "Item arrived damaged",
  DEFECTIVE: "Item is defective",
  WRONG_ITEM: "Wrong item delivered",
  MISSING_PARTS: "Parts or accessories missing",
  NOT_WORKING: "Item not working",
  CHANGED_MIND: "Changed my mind",
  OTHER: "Other",
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 65;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const serial =
        err?.code === "P2034" ||
        err?.message?.includes("could not serialize") ||
        err?.message?.includes("deadlock");
      if (!serial || attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 2 ** (attempt + 1) * 100 + Math.random() * 100));
    }
  }
}

// ── Loading ──────────────────────────────────────────────────────────────────

const imageSelect = {
  where: { deletedAt: null },
  orderBy: { sortOrder: "asc" as const },
  select: { url: true },
  take: 1,
};

const orderForReturnsInclude = {
  items: {
    select: {
      id: true, productId: true, variantId: true, quantity: true, price: true,
      productName: true, variantName: true,
      product: { select: { name: true, returnable: true, images: { ...imageSelect, where: { variantId: null, deletedAt: null } } } },
      variant: { select: { name: true, images: imageSelect } },
    },
  },
  payment: {
    select: {
      status: true, method: true, amount: true, balanceAmount: true,
      razorpayPaymentId: true, balanceRazorpayPaymentId: true, balanceSettledAt: true,
      refundAmount: true, balanceRefundAmount: true, manualRefundAmount: true,
    },
  },
  preOrder: { select: { id: true } },
  shipments: {
    where: { deliveredAt: { not: null } },
    orderBy: { deliveredAt: "desc" as const },
    take: 1,
    select: { deliveredAt: true },
  },
  returns: {
    orderBy: { createdAt: "desc" as const },
    include: {
      items: true,
      refunds: { orderBy: { createdAt: "asc" as const } },
    },
  },
} satisfies Prisma.OrderInclude;

type OrderForReturns = Prisma.OrderGetPayload<{ include: typeof orderForReturnsInclude }>;
type ReturnWithRelations = OrderForReturns["returns"][number];

async function loadOrder(db: Tx | typeof prisma, orderId: string, userId?: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, deletedAt: null, ...(userId ? { userId } : {}) },
    include: orderForReturnsInclude,
  });
  if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);
  return order;
}

async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
}

const isItemReturn = (r: { items: unknown[] }) => r.items.length > 0;

// ── Quantity & money bookkeeping ─────────────────────────────────────────────

/** Units of each order line already claimed by a return that still holds them. */
function heldUnits(order: OrderForReturns, excludeReturnId?: string): Map<string, number> {
  const held = new Map<string, number>();
  for (const r of order.returns) {
    if (r.id === excludeReturnId || !QUANTITY_HOLDING_STATUSES.includes(r.status)) continue;
    for (const i of r.items) held.set(i.orderItemId, (held.get(i.orderItemId) ?? 0) + i.quantity);
  }
  return held;
}

/** Units of each line accepted at inspection — the units whose refund is final. */
function acceptedUnits(order: OrderForReturns, excludeReturnId?: string): Map<string, number> {
  const accepted = new Map<string, number>();
  for (const r of order.returns) {
    if (r.id === excludeReturnId || !RECEIVED_RETURN_STATUSES.includes(r.status)) continue;
    for (const i of r.items) {
      accepted.set(i.orderItemId, (accepted.get(i.orderItemId) ?? 0) + (i.acceptedQuantity ?? 0));
    }
  }
  return accepted;
}

/** Money that can still be returned on this order, across every channel. */
function refundCapacity(order: OrderForReturns): Decimal {
  const received = amountPaid({ ...order, payment: order.payment });
  const ledger = order.returns
    .flatMap((r) => r.refunds)
    .filter((f) => f.status !== "FAILED")
    .reduce((s, f) => s.plus(f.amount.toString()), new Decimal(0));
  const legacy = [order.payment?.refundAmount, order.payment?.balanceRefundAmount, order.payment?.manualRefundAmount]
    .reduce<Decimal>((s, v) => s.plus(v ? v.toString() : 0), new Decimal(0));
  return Decimal.max(received.minus(ledger).minus(legacy), 0);
}

function valueOf(
  order: OrderForReturns,
  lineNet: Map<string, Decimal>,
  selection: Array<{ orderItemId: string; quantity: number }>,
  excludeReturnId?: string
) {
  const accepted = acceptedUnits(order, excludeReturnId);
  const lines = selection.map((s) => {
    const item = order.items.find((i) => i.id === s.orderItemId)!;
    const amount = unitsValue(lineNet.get(item.id) ?? new Decimal(0), item.quantity, accepted.get(item.id) ?? 0, s.quantity);
    return { orderItemId: item.id, quantity: s.quantity, amount };
  });
  const total = lines.reduce((s, l) => s.plus(l.amount), new Decimal(0));
  return { lines, total };
}

// ── Eligibility ──────────────────────────────────────────────────────────────

type OrderBlock = "DISABLED" | "NOT_DELIVERED" | "WINDOW_CLOSED" | "LEGACY_RETURN" | null;

function orderBlock(order: OrderForReturns): { block: OrderBlock; windowEndsAt: Date | null } {
  const windowEndsAt =
    order.status === "DELIVERED" || order.shipments.length ? returnWindowEnd(resolveDeliveredAt(order)) : null;
  if (!itemReturnsEnabled()) return { block: "DISABLED", windowEndsAt };
  if (order.returns.some((r) => !isItemReturn(r))) return { block: "LEGACY_RETURN", windowEndsAt };
  if (order.status !== "DELIVERED") return { block: "NOT_DELIVERED", windowEndsAt };
  if (windowEndsAt && new Date() > windowEndsAt) return { block: "WINDOW_CLOSED", windowEndsAt };
  return { block: null, windowEndsAt };
}

function itemEligibility(order: OrderForReturns) {
  const held = heldUnits(order);
  return order.items.map((item) => {
    const remaining = Math.max(item.quantity - (held.get(item.id) ?? 0), 0);
    const returnable = item.product.returnable;
    return {
      item,
      remaining,
      returnable,
      blockedReason: !returnable ? "NOT_RETURNABLE" : remaining === 0 ? "ALREADY_RETURNED" : null,
    };
  });
}

function assertSelectionValid(
  order: OrderForReturns,
  selection: Array<{ orderItemId: string; quantity: number }>
) {
  const { block } = orderBlock(order);
  if (block === "DISABLED") throw new ApiError(404, ReturnErrorCode.RETURNS_DISABLED);
  if (block === "WINDOW_CLOSED") throw new ApiError(400, ReturnErrorCode.RETURN_WINDOW_CLOSED);
  if (block === "LEGACY_RETURN") throw new ApiError(409, ReturnErrorCode.RETURN_LEGACY_EXISTS);
  if (block) throw new ApiError(400, ReturnErrorCode.RETURN_NOT_ELIGIBLE);

  const eligibility = new Map(itemEligibility(order).map((e) => [e.item.id, e]));
  for (const s of selection) {
    const e = eligibility.get(s.orderItemId);
    if (!e) throw new ApiError(400, ReturnErrorCode.RETURN_ITEM_INVALID);
    if (!e.returnable) throw new ApiError(400, ReturnErrorCode.RETURN_ITEM_NOT_RETURNABLE);
    if (s.quantity > e.remaining) throw new ApiError(409, ReturnErrorCode.RETURN_QUANTITY_EXCEEDED);
  }
}

// ── Serialisation ────────────────────────────────────────────────────────────

function itemDisplay(order: OrderForReturns, orderItemId: string) {
  const item = order.items.find((i) => i.id === orderItemId);
  return {
    productName: item?.productName ?? item?.product.name ?? "Item",
    variantName: item?.variantName ?? item?.variant?.name ?? null,
    image: item?.variant?.images[0]?.url ?? item?.product.images[0]?.url ?? null,
    unitPrice: item ? Number(item.price) : 0,
    orderedQuantity: item?.quantity ?? 0,
  };
}

function estimateFor(order: OrderForReturns, r: ReturnWithRelations): number {
  if (r.refundAmount != null && RECEIVED_RETURN_STATUSES.includes(r.status)) return Number(r.refundAmount);
  const lineNet = allocateLineNet(order, order.items);
  const { total } = valueOf(order, lineNet, r.items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })), r.id);
  return Number(Decimal.min(total, refundCapacity(order)).toFixed(2));
}

function serializeReturn(order: OrderForReturns, r: ReturnWithRelations, audience: "customer" | "admin") {
  return {
    id: r.id,
    orderId: r.orderId,
    kind: isItemReturn(r) ? ("ITEM" as const) : ("LEGACY" as const),
    status: r.status,
    reasonCode: r.reasonCode,
    reason: r.reason,
    description: r.description,
    media: (r.media as ReturnMedia[] | null) ?? [],
    refundUpiId: audience === "admin" ? r.refundUpiId : maskUpi(r.refundUpiId),
    adminNote: r.adminNote,
    pickupMode: r.pickupMode,
    pickupStatus: r.pickupStatus,
    pickupAwb: r.pickupAwb,
    pickupTrackingUrl: r.pickupTrackingUrl,
    inspectionNote: r.inspectionNote,
    estimatedRefund: estimateFor(order, r),
    refundAmount: r.refundAmount != null ? Number(r.refundAmount) : null,
    shippingRefund: r.shippingRefund != null ? Number(r.shippingRefund) : null,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
    pickedUpAt: r.pickedUpAt,
    receivedAt: r.receivedAt,
    refundedAt: r.refundedAt,
    cancelledAt: r.cancelledAt,
    canCancel: ["PENDING", "APPROVED"].includes(r.status) && !r.pickedUpAt && r.pickupStatus !== "PICKED_UP",
    items: r.items.map((i) => ({
      id: i.id,
      orderItemId: i.orderItemId,
      quantity: i.quantity,
      acceptedQuantity: i.acceptedQuantity,
      restocked: i.restocked,
      refundAmount: i.refundAmount != null ? Number(i.refundAmount) : null,
      ...itemDisplay(order, i.orderItemId),
    })),
    refunds: r.refunds.map((f) => ({
      id: f.id,
      channel: f.channel,
      amount: Number(f.amount),
      status: f.status,
      processedAt: f.processedAt,
      ...(audience === "admin"
        ? { razorpayRefundId: f.razorpayRefundId, manualReference: f.manualReference, failureReason: f.failureReason }
        : {}),
    })),
  };
}

// ── Customer ─────────────────────────────────────────────────────────────────

export async function getOrderReturnsService(userId: string, orderId: string) {
  const order = await loadOrder(prisma, orderId, userId);
  const { block, windowEndsAt } = orderBlock(order);
  const items = itemEligibility(order);

  return {
    enabled: itemReturnsEnabled(),
    eligible: !block && items.some((i) => i.returnable && i.remaining > 0),
    blockedReason: block,
    windowEndsAt,
    needsUpi: needsManualRefund(order),
    isPreOrder: Boolean(order.preOrder),
    items: items.map(({ item, remaining, returnable, blockedReason }) => ({
      orderItemId: item.id,
      ...itemDisplay(order, item.id),
      quantity: item.quantity,
      remainingQuantity: remaining,
      returnable,
      blockedReason: block ? block : blockedReason,
    })),
    returns: order.returns.filter(isItemReturn).map((r) => serializeReturn(order, r, "customer")),
  };
}

export async function quoteReturnService(
  userId: string,
  orderId: string,
  selection: Array<{ orderItemId: string; quantity: number }>
) {
  const order = await loadOrder(prisma, orderId, userId);
  assertSelectionValid(order, selection);

  const lineNet = allocateLineNet(order, order.items);
  const { lines, total } = valueOf(order, lineNet, selection);
  const capped = Decimal.min(total, refundCapacity(order));

  return {
    items: lines.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity, amount: Number(l.amount.toFixed(2)) })),
    estimatedRefund: Number(capped.toFixed(2)),
    shippingNote: Number(order.shippingCharges) > 0
      ? "Shipping is refunded only when the whole order is returned because of a problem on our side."
      : null,
    needsUpi: needsManualRefund(order),
  };
}

export function returnMediaFolder(userId: string, orderId: string) {
  return `returns/${userId}/${orderId}`;
}

export async function getReturnUploadSignatureService(userId: string, orderId: string) {
  if (!itemReturnsEnabled()) throw new ApiError(404, ReturnErrorCode.RETURNS_DISABLED);
  const order = await prisma.order.findFirst({ where: { id: orderId, userId, deletedAt: null }, select: { id: true } });
  if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);

  const timestamp = Math.round(Date.now() / 1000);
  const folder = returnMediaFolder(userId, orderId);
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET!);

  return {
    timestamp,
    signature,
    folder,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    limits: { maxImageBytes: MAX_IMAGE_BYTES, maxVideoBytes: MAX_VIDEO_BYTES, maxVideoSeconds: 60 },
  };
}

/**
 * Every evidence file must be an upload we signed for this customer's order.
 *
 * The URL and public id are client-supplied, so both are checked against our cloud and
 * the order's folder, and then the asset itself is fetched from Cloudinary to confirm it
 * exists and respects the size and duration limits (a signed upload cannot enforce them).
 */
async function verifyMedia(userId: string, orderId: string, media: ReturnMedia[]) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const folder = `${returnMediaFolder(userId, orderId)}/`;
  if (!cloud) throw new ApiError(503, ReturnErrorCode.RETURN_MEDIA_UNVERIFIED);

  for (const m of media) {
    let url: URL;
    try { url = new URL(m.url); } catch { throw new ApiError(400, ReturnErrorCode.RETURN_MEDIA_INVALID); }
    const expectedPrefix = `/${cloud}/${m.type}/upload/`;
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.startsWith(expectedPrefix)) {
      throw new ApiError(400, ReturnErrorCode.RETURN_MEDIA_INVALID);
    }
    if (!m.publicId.startsWith(folder) || !url.pathname.includes(m.publicId)) {
      throw new ApiError(400, ReturnErrorCode.RETURN_MEDIA_INVALID);
    }

    let asset: any;
    try {
      asset = await cloudinary.api.resource(m.publicId, { resource_type: m.type });
    } catch (err: any) {
      const status = err?.error?.http_code ?? err?.http_code;
      if (status === 404) throw new ApiError(400, ReturnErrorCode.RETURN_MEDIA_INVALID);
      throw new ApiError(503, ReturnErrorCode.RETURN_MEDIA_UNVERIFIED);
    }
    const limit = m.type === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (Number(asset?.bytes ?? 0) > limit) throw new ApiError(400, ReturnErrorCode.RETURN_MEDIA_INVALID);
    if (m.type === "video" && Number(asset?.duration ?? 0) > MAX_VIDEO_SECONDS) {
      throw new ApiError(400, ReturnErrorCode.RETURN_MEDIA_INVALID);
    }
  }
}

async function findByIdempotencyKey(userId: string, orderId: string, key: string) {
  const existing = await prisma.return.findUnique({ where: { idempotencyKey: key }, select: { id: true, userId: true, orderId: true } });
  if (!existing) return null;
  if (existing.userId !== userId || existing.orderId !== orderId) {
    throw new ApiError(409, ReturnErrorCode.RETURN_INVALID_STATE);
  }
  const order = await loadOrder(prisma, orderId, userId);
  const r = order.returns.find((x) => x.id === existing.id)!;
  return serializeReturn(order, r, "customer");
}

export async function createItemReturnService(
  userId: string,
  orderId: string,
  body: CreateItemReturnBody,
  req?: Request
) {
  if (!itemReturnsEnabled()) throw new ApiError(404, ReturnErrorCode.RETURNS_DISABLED);

  const replay = await findByIdempotencyKey(userId, orderId, body.idempotencyKey);
  if (replay) return replay;

  // Cheap, lock-free validation first, then the network checks on the evidence, then
  // the authoritative re-check under the order lock.
  const preview = await loadOrder(prisma, orderId, userId);
  assertSelectionValid(preview, body.items);
  if (preview.preOrder && !SELLER_FAULT_REASON_CODES.includes(body.reasonCode)) {
    throw new ApiError(400, ReturnErrorCode.RETURN_REASON_NOT_ALLOWED);
  }
  if (needsManualRefund(preview) && !body.refundUpiId) {
    throw new ApiError(400, ReturnErrorCode.RETURN_UPI_REQUIRED);
  }
  await verifyMedia(userId, orderId, body.media);

  let created: { id: string; estimate: number; itemNames: Array<{ name: string; quantity: number }> };
  try {
    created = await withRetry(() =>
      prisma.$transaction(async (tx) => {
        await lockOrder(tx, orderId);
        const order = await loadOrder(tx, orderId, userId);
        assertSelectionValid(order, body.items);

        const lineNet = allocateLineNet(order, order.items);
        const { total } = valueOf(order, lineNet, body.items);

        const r = await tx.return.create({
          data: {
            orderId,
            userId,
            reasonCode: body.reasonCode,
            reason: REASON_LABELS[body.reasonCode],
            description: body.description || null,
            media: body.media,
            refundUpiId: body.refundUpiId ?? null,
            idempotencyKey: body.idempotencyKey,
            status: "PENDING",
            items: { create: body.items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })) },
          },
        });

        await createAuditLogInTx(tx, {
          userId,
          action: "RETURN_REQUESTED",
          entity: "Return",
          entityId: r.id,
          newValue: { orderId, items: body.items, reasonCode: body.reasonCode, kind: "ITEM" },
          req,
        });

        return {
          id: r.id,
          estimate: Number(Decimal.min(total, refundCapacity(order)).toFixed(2)),
          itemNames: body.items.map((i) => ({ name: itemDisplay(order, i.orderItemId).productName, quantity: i.quantity })),
        };
      })
    );
  } catch (err: any) {
    // A concurrent double-submit with the same key lost the unique race — hand back the winner.
    if (err?.code === "P2002") {
      const winner = await findByIdempotencyKey(userId, orderId, body.idempotencyKey);
      if (winner) return winner;
    }
    throw err;
  }

  void emitReturnRequested(userId, orderId, created.estimate, created.itemNames);

  const order = await loadOrder(prisma, orderId, userId);
  return serializeReturn(order, order.returns.find((r) => r.id === created.id)!, "customer");
}

/**
 * The legacy `POST /orders/:id/return` while item returns are on.
 *
 * Published app binaries still call it with only a reason. It becomes an item return
 * for every remaining returnable unit — with no evidence or UPI, which the admin sees —
 * and answers with the legacy response shape. Nothing left to return reuses the legacy
 * RETURN_ALREADY_REQUESTED code, which those binaries already have copy for.
 */
export async function createReturnFromLegacyRequest(
  userId: string,
  orderId: string,
  data: { reason: string; description?: string },
  req?: Request
) {
  const result = await withRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await loadOrder(tx, orderId, userId);
      const { block } = orderBlock(order);
      if (block === "LEGACY_RETURN") throw new ApiError(409, PaymentErrorCode.RETURN_ALREADY_REQUESTED);
      if (block) throw new ApiError(400, PaymentErrorCode.RETURN_NOT_ELIGIBLE);

      const eligible = itemEligibility(order).filter((e) => e.returnable && e.remaining > 0);
      if (eligible.length === 0) {
        const anyHeld = heldUnits(order).size > 0;
        throw new ApiError(anyHeld ? 409 : 400, anyHeld ? PaymentErrorCode.RETURN_ALREADY_REQUESTED : PaymentErrorCode.RETURN_NOT_ELIGIBLE);
      }
      const selection = eligible.map((e) => ({ orderItemId: e.item.id, quantity: e.remaining }));
      const lineNet = allocateLineNet(order, order.items);
      const { total } = valueOf(order, lineNet, selection);

      const r = await tx.return.create({
        data: {
          orderId,
          userId,
          reasonCode: "OTHER",
          reason: data.reason,
          description: data.description ?? null,
          media: [],
          status: "PENDING",
          items: { create: selection },
        },
      });
      await createAuditLogInTx(tx, {
        userId,
        action: "RETURN_REQUESTED",
        entity: "Return",
        entityId: r.id,
        newValue: { orderId, items: selection, reason: data.reason, kind: "ITEM", via: "legacy_endpoint" },
        req,
      });
      return {
        returnId: r.id,
        estimate: Number(Decimal.min(total, refundCapacity(order)).toFixed(2)),
        itemNames: selection.map((s) => ({ name: itemDisplay(order, s.orderItemId).productName, quantity: s.quantity })),
      };
    })
  );

  void emitReturnRequested(userId, orderId, result.estimate, result.itemNames);

  return {
    returnId: result.returnId,
    orderId,
    status: "PENDING",
    message: "Return request submitted. Our team will review within 2-3 business days.",
  };
}

async function emitReturnRequested(
  userId: string,
  orderId: string,
  estimate: number,
  items: Array<{ name: string; quantity: number }>
) {
  const ref = orderShortRef(orderId);
  void notify({
    userId,
    type: "RETURN_REQUESTED",
    title: "Return requested",
    body: `We've received your return request for order #${ref}. We'll review it within 2–3 business days.`,
    data: { screen: "Order", orderId },
  });
  void notifyAdmins({
    type: "ADMIN_CUSTOM",
    title: "New return request 📦",
    body: `Order #${ref}: ${items.map((i) => `${i.name} × ${i.quantity}`).join(", ")} (est. ${money(estimate)}).`,
    data: { screen: "AdminOrder", orderId },
  });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }).catch(() => null);
  if (user?.email) void sendReturnRequestedEmail(user.email, { orderId, items, estimatedRefund: estimate });
}

export async function cancelReturnService(userId: string, orderId: string, returnId: string, req?: Request) {
  const cancelled = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; userId: string; orderId: string; status: ReturnStatus; pickedUpAt: Date | null; pickupStatus: string | null; pickupAwb: string | null }>>`
      SELECT id, "userId", "orderId", status, "pickedUpAt", "pickupStatus", "pickupAwb"
      FROM "Return" WHERE id = ${returnId} FOR UPDATE`;
    const r = rows[0];
    if (!r || r.userId !== userId || r.orderId !== orderId) throw new ApiError(404, ReturnErrorCode.RETURN_NOT_FOUND);
    if (!["PENDING", "APPROVED"].includes(r.status) || r.pickedUpAt || r.pickupStatus === "PICKED_UP") {
      throw new ApiError(409, ReturnErrorCode.RETURN_INVALID_STATE);
    }
    await tx.return.update({ where: { id: returnId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await createAuditLogInTx(tx, {
      userId, action: "RETURN_CANCELLED", entity: "Return", entityId: returnId,
      oldValue: { status: r.status }, newValue: { status: "CANCELLED", by: "customer" }, req,
    });
    return r;
  });

  if (cancelled.pickupAwb) void cancelPickupSafe(cancelled.pickupAwb, returnId);
  return { returnId, status: "CANCELLED" as const };
}

async function cancelPickupSafe(awb: string, returnId: string) {
  try {
    await cancelDelhiveryShipment(awb);
  } catch (err: any) {
    await createAuditLog({
      action: "RETURN_PICKUP_FAILED", entity: "Return", entityId: returnId,
      newValue: { awb, stage: "cancel", error: String(err?.message ?? err).slice(0, 300) },
    });
    void notifyAdmins({
      type: "ADMIN_CUSTOM",
      title: "Cancel reverse pickup manually",
      body: `A cancelled return still has Delhivery pickup ${awb} booked. Cancel it in the Delhivery panel.`,
      data: { screen: "AdminReturn", returnId },
    });
  }
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function listReturnsService(query: AdminReturnsQuery) {
  const where: Prisma.ReturnWhereInput = query.status ? { status: query.status } : {};
  const [rows, total] = await Promise.all([
    prisma.return.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        items: { select: { quantity: true } },
        order: {
          select: {
            id: true, total: true, paymentMethod: true, paymentPlan: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.return.count({ where }),
  ]);

  return {
    returns: rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      kind: r.items.length ? "ITEM" : "LEGACY",
      status: r.status,
      reason: r.reason,
      reasonCode: r.reasonCode,
      units: r.items.reduce((s, i) => s + i.quantity, 0),
      pickupMode: r.pickupMode,
      pickupStatus: r.pickupStatus,
      refundAmount: r.refundAmount != null ? Number(r.refundAmount) : null,
      hasEvidence: Array.isArray(r.media) && (r.media as unknown[]).length > 0,
      createdAt: r.createdAt,
      order: {
        id: r.order.id,
        total: Number(r.order.total),
        paymentMethod: r.order.paymentMethod,
        paymentPlan: r.order.paymentPlan,
      },
      customer: r.order.user,
    })),
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.ceil(total / query.limit),
  };
}

/** Everything the receive screen needs to show the refund before an admin commits it. */
function receivePreview(order: OrderForReturns, r: ReturnWithRelations) {
  const lineNet = allocateLineNet(order, order.items);
  const { lines, total } = valueOf(order, lineNet, r.items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })), r.id);
  const accepted = acceptedUnits(order, r.id);
  const wouldFullyReturn = order.items.every((item) => {
    const mine = r.items.find((i) => i.orderItemId === item.id)?.quantity ?? 0;
    return (accepted.get(item.id) ?? 0) + mine >= item.quantity;
  });
  const shippingAlreadyRefunded = order.returns.some((x) => x.id !== r.id && x.shippingRefund && Number(x.shippingRefund) > 0);
  return {
    lines: lines.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity, amount: Number(l.amount.toFixed(2)) })),
    itemsTotal: Number(total.toFixed(2)),
    shippingRefundable: wouldFullyReturn && !shippingAlreadyRefunded ? Number(order.shippingCharges) : 0,
    shippingDefaultOn: SELLER_FAULT_REASON_CODES.includes((r.reasonCode ?? "OTHER") as ReturnReasonCode),
    refundCapacity: Number(refundCapacity(order).toFixed(2)),
    manualRefundLikely: needsManualRefund(order),
  };
}

export async function getReturnDetailService(returnId: string) {
  const base = await prisma.return.findUnique({ where: { id: returnId }, select: { orderId: true } });
  if (!base) throw new ApiError(404, ReturnErrorCode.RETURN_NOT_FOUND);

  const order = await loadOrder(prisma, base.orderId);
  const r = order.returns.find((x) => x.id === returnId)!;
  const meta = await prisma.order.findUnique({
    where: { id: order.id },
    select: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      address: true,
    },
  });

  return {
    ...serializeReturn(order, r, "admin"),
    preview: isItemReturn(r) ? receivePreview(order, r) : null,
    pickupAvailable: reversePickupEnabled(),
    order: {
      id: order.id,
      status: order.status,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shippingCharges: Number(order.shippingCharges),
      paymentMethod: order.paymentMethod,
      paymentPlan: order.paymentPlan,
      isPreOrder: Boolean(order.preOrder),
      createdAt: order.createdAt,
    },
    customer: meta?.user ?? null,
    address: meta?.address ?? null,
  };
}

async function lockReturn(tx: Tx, returnId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string; orderId: string; userId: string; status: ReturnStatus }>>`
    SELECT id, "orderId", "userId", status FROM "Return" WHERE id = ${returnId} FOR UPDATE`;
  const r = rows[0];
  if (!r) throw new ApiError(404, ReturnErrorCode.RETURN_NOT_FOUND);
  return r;
}

async function emailCustomer(userId: string, p: Parameters<typeof sendReturnStatusEmail>[1]) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }).catch(() => null);
  if (user?.email) void sendReturnStatusEmail(user.email, p);
}

/**
 * Approve or reject an item return. No money and no stock move here — both happen at
 * receipt — so an older admin client calling the legacy resolve endpoint is safe.
 */
export async function resolveItemReturnService(
  adminUserId: string,
  returnId: string,
  data: { status: "APPROVED" | "REJECTED"; adminNote?: string },
  req?: Request
) {
  const r = await prisma.$transaction(async (tx) => {
    const locked = await lockReturn(tx, returnId);
    if (locked.status !== "PENDING") throw new ApiError(409, PaymentErrorCode.RETURN_ALREADY_RESOLVED);
    await tx.return.update({
      where: { id: returnId },
      data: { status: data.status, adminNote: data.adminNote ?? null, resolvedBy: adminUserId, resolvedAt: new Date() },
    });
    await createAuditLogInTx(tx, {
      userId: adminUserId,
      action: data.status === "APPROVED" ? "RETURN_APPROVED" : "RETURN_REJECTED",
      entity: "Return",
      entityId: returnId,
      oldValue: { status: "PENDING" },
      newValue: { status: data.status, adminNote: data.adminNote, kind: "ITEM" },
      req,
    });
    return locked;
  });

  const ref = orderShortRef(r.orderId);
  void notify({
    userId: r.userId,
    type: data.status === "APPROVED" ? "RETURN_APPROVED" : "RETURN_REJECTED",
    title: data.status === "APPROVED" ? "Return approved ✅" : "Return request update",
    body: data.status === "APPROVED"
      ? `Your return for order #${ref} is approved. We'll arrange collection of the items.`
      : `We couldn't approve your return for order #${ref}.${data.adminNote ? ` ${data.adminNote}` : ""}`,
    data: { screen: "Order", orderId: r.orderId },
  });
  void emailCustomer(r.userId, { orderId: r.orderId, status: data.status, note: data.adminNote });

  return { returnId, orderId: r.orderId, status: data.status, refundInitiated: false };
}

export async function scheduleReturnPickupService(
  adminUserId: string,
  returnId: string,
  mode: "MANUAL" | "DELHIVERY",
  req?: Request
) {
  if (mode === "MANUAL") {
    const updated = await prisma.return.updateMany({
      where: { id: returnId, status: "APPROVED", pickupAwb: null },
      data: { pickupMode: "MANUAL", pickupStatus: "SCHEDULED" },
    });
    if (updated.count === 0) throw new ApiError(409, ReturnErrorCode.RETURN_INVALID_STATE);
    await createAuditLog({
      userId: adminUserId, action: "RETURN_PICKUP_SCHEDULED", entity: "Return", entityId: returnId,
      newValue: { mode }, req,
    });
    return getReturnDetailService(returnId);
  }

  if (!reversePickupEnabled()) throw new ApiError(400, ReturnErrorCode.RETURN_PICKUP_UNAVAILABLE);

  // Claim before the courier call so two clicks cannot book two pickups.
  const claimed = await prisma.return.updateMany({
    where: { id: returnId, status: "APPROVED", pickupAwb: null, NOT: { pickupStatus: "BOOKING" } },
    data: { pickupMode: "DELHIVERY", pickupStatus: "BOOKING" },
  });
  if (claimed.count === 0) throw new ApiError(409, ReturnErrorCode.RETURN_INVALID_STATE);

  try {
    const r = await prisma.return.findUniqueOrThrow({
      where: { id: returnId },
      include: {
        items: { include: { orderItem: { select: { productName: true, price: true, product: { select: { name: true } } } } } },
        order: { select: { address: true } },
      },
    });
    const address = r.order.address;
    const service = await checkServiceability(address.pincode);
    if (!service.serviceable || !service.pickup) throw new ApiError(400, ReturnErrorCode.RETURN_PICKUP_UNAVAILABLE);

    const units = r.items.reduce((s, i) => s + i.quantity, 0);
    const value = r.items.reduce((s, i) => s + Number(i.orderItem.price) * i.quantity, 0);
    const booked = await createDelhiveryReversePickup({
      returnRef: `RET-${returnId.slice(0, 8).toUpperCase()}`,
      name: address.name,
      add: address.address,
      city: address.city,
      state: address.state,
      country: address.country,
      pin: address.pincode,
      phone: address.phone,
      totalAmount: Math.round(value),
      productsDesc: r.items.map((i) => i.orderItem.productName ?? i.orderItem.product.name).join(", "),
      quantity: units,
    });

    await prisma.return.update({
      where: { id: returnId },
      data: {
        pickupAwb: booked.waybill,
        pickupTrackingUrl: `https://www.delhivery.com/track/package/${booked.waybill}`,
        pickupStatus: "SCHEDULED",
      },
    });
    await createAuditLog({
      userId: adminUserId, action: "RETURN_PICKUP_SCHEDULED", entity: "Return", entityId: returnId,
      newValue: { mode, awb: booked.waybill }, req,
    });
  } catch (err: any) {
    await prisma.return.updateMany({
      where: { id: returnId, pickupStatus: "BOOKING" },
      data: { pickupMode: null, pickupStatus: null },
    });
    await createAuditLog({
      userId: adminUserId, action: "RETURN_PICKUP_FAILED", entity: "Return", entityId: returnId,
      newValue: { stage: "book", error: String(err?.message ?? err).slice(0, 300) }, req,
    });
    throw err;
  }

  return getReturnDetailService(returnId);
}

export async function markReturnPickedUpService(adminUserId: string, returnId: string, req?: Request) {
  const updated = await prisma.return.updateMany({
    where: { id: returnId, status: "APPROVED" },
    data: { status: "PICKED_UP", pickedUpAt: new Date(), pickupStatus: "PICKED_UP" },
  });
  if (updated.count === 0) throw new ApiError(409, ReturnErrorCode.RETURN_INVALID_STATE);
  await createAuditLog({
    userId: adminUserId, action: "RETURN_PICKED_UP", entity: "Return", entityId: returnId,
    newValue: { source: "admin" }, req,
  });
  void emitPickedUp(returnId);
  return getReturnDetailService(returnId);
}

async function emitPickedUp(returnId: string) {
  const r = await prisma.return.findUnique({ where: { id: returnId }, select: { userId: true, orderId: true } });
  if (!r) return;
  void notify({
    userId: r.userId,
    type: "RETURN_PICKED_UP",
    title: "Return picked up 🚚",
    body: `Your return for order #${orderShortRef(r.orderId)} has been collected. We'll inspect it as soon as it reaches us.`,
    data: { screen: "Order", orderId: r.orderId },
  });
}

/**
 * The goods are back. Inspection decides accepted units, and that one decision moves the
 * stock, the commission and the money together, in one transaction under the order lock
 * — the lock serialises every return on the order, so their refunds can never jointly
 * exceed what the customer paid.
 *
 * The gateway calls run after commit; the ledger rows written here are their intent.
 */
export async function receiveReturnService(
  adminUserId: string,
  returnId: string,
  body: ReceiveReturnBody,
  req?: Request
) {
  const base = await prisma.return.findUnique({ where: { id: returnId }, select: { orderId: true } });
  if (!base) throw new ApiError(404, ReturnErrorCode.RETURN_NOT_FOUND);

  const outcome = await withRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockOrder(tx, base.orderId);
      const locked = await lockReturn(tx, returnId);
      if (!["APPROVED", "PICKED_UP"].includes(locked.status)) throw new ApiError(409, ReturnErrorCode.RETURN_INVALID_STATE);

      const order = await loadOrder(tx, base.orderId);
      const r = order.returns.find((x) => x.id === returnId)!;
      if (!isItemReturn(r)) throw new ApiError(409, ReturnErrorCode.RETURN_INVALID_STATE);

      const decisions = new Map(body.items.map((d) => [d.returnItemId, d]));
      if (decisions.size !== r.items.length || r.items.some((i) => !decisions.has(i.id))) {
        throw new ApiError(400, ReturnErrorCode.RETURN_ITEM_INVALID);
      }
      for (const i of r.items) {
        if (decisions.get(i.id)!.acceptedQuantity > i.quantity) throw new ApiError(400, ReturnErrorCode.RETURN_QUANTITY_EXCEEDED);
      }

      // ── Value of what was accepted ──
      const lineNet = allocateLineNet(order, order.items);
      const acceptedBefore = acceptedUnits(order, returnId);
      const itemAmounts = r.items.map((i) => {
        const item = order.items.find((o) => o.id === i.orderItemId)!;
        const decision = decisions.get(i.id)!;
        return {
          returnItem: i,
          item,
          accepted: decision.acceptedQuantity,
          restock: decision.restock,
          amount: unitsValue(lineNet.get(item.id) ?? new Decimal(0), item.quantity, acceptedBefore.get(item.id) ?? 0, decision.acceptedQuantity),
        };
      });
      const totalAccepted = itemAmounts.reduce((s, a) => s + a.accepted, 0);
      const itemsTotal = itemAmounts.reduce((s, a) => s.plus(a.amount), new Decimal(0));

      const fullyReturned = order.items.every((item) => {
        const mine = itemAmounts.find((a) => a.item.id === item.id)?.accepted ?? 0;
        return (acceptedBefore.get(item.id) ?? 0) + mine >= item.quantity;
      });
      const shippingAlreadyRefunded = order.returns.some((x) => x.id !== returnId && x.shippingRefund && Number(x.shippingRefund) > 0);
      const shipping =
        body.refundShipping && fullyReturned && !shippingAlreadyRefunded ? new Decimal(order.shippingCharges.toString()) : new Decimal(0);

      const maxRefund = Decimal.min(itemsTotal.plus(shipping), refundCapacity(order));
      if (body.refundAmount !== undefined && new Decimal(body.refundAmount).gt(maxRefund.plus(0.001))) {
        throw new ApiError(400, ReturnErrorCode.RETURN_REFUND_TOO_HIGH);
      }
      const refund = totalAccepted === 0
        ? new Decimal(0)
        : round2(body.refundAmount !== undefined ? new Decimal(body.refundAmount) : maxRefund);

      for (const a of itemAmounts) {
        await tx.returnItem.update({
          where: { id: a.returnItem.id },
          data: { acceptedQuantity: a.accepted, refundAmount: a.amount, restocked: a.restock && a.accepted > 0 },
        });
      }

      // ── Stock ──
      if (totalAccepted > 0) {
        const skipped = await restoreReturnedUnits(
          tx,
          itemAmounts
            .filter((a) => a.restock && a.accepted > 0)
            .map((a) => ({ productId: a.item.productId, variantId: a.item.variantId, quantity: a.accepted }))
        );
        if (skipped.length) {
          await createAuditLogInTx(tx, {
            userId: adminUserId, action: "RETURN_STOCK_SKIPPED", entity: "Return", entityId: returnId,
            newValue: { skipped, reason: "product or variant deleted since sale" },
          });
        }
      }

      // ── Money: one ledger row per channel, gateway legs first, cash last ──
      const payment = order.payment;
      const ledgerOn = (channel: string) =>
        order.returns
          .flatMap((x) => x.refunds)
          .filter((f) => f.channel === channel && f.status !== "FAILED")
          .reduce((s, f) => s.plus(f.amount.toString()), new Decimal(0));
      const primaryRoom = payment?.razorpayPaymentId
        ? Decimal.max(new Decimal(payment.amount.toString()).minus(payment.refundAmount?.toString() ?? 0).minus(ledgerOn("RAZORPAY_PRIMARY")), 0)
        : new Decimal(0);
      const balanceRoom = payment?.balanceRazorpayPaymentId && payment.balanceAmount
        ? Decimal.max(new Decimal(payment.balanceAmount.toString()).minus(payment.balanceRefundAmount?.toString() ?? 0).minus(ledgerOn("RAZORPAY_BALANCE")), 0)
        : new Decimal(0);

      type Channel = "RAZORPAY_PRIMARY" | "RAZORPAY_BALANCE" | "MANUAL";
      let remaining = refund;
      const plan: Array<{ channel: Channel; amount: Decimal }> = [];
      const gatewayLegs: Array<[Channel, Decimal]> = [["RAZORPAY_PRIMARY", primaryRoom], ["RAZORPAY_BALANCE", balanceRoom]];
      for (const [channel, room] of gatewayLegs) {
        const take = Decimal.min(remaining, room);
        if (take.gt(0)) { plan.push({ channel, amount: take }); remaining = remaining.minus(take); }
      }
      if (remaining.gt(0)) plan.push({ channel: "MANUAL", amount: remaining });

      const rows: typeof plan = [];
      for (const p of plan) {
        if (p.channel !== "MANUAL" && p.amount.lt(MIN_GATEWAY_REFUND)) {
          await createAuditLogInTx(tx, {
            userId: adminUserId, action: "REFUND_SKIPPED_BELOW_MINIMUM", entity: "Return", entityId: returnId,
            newValue: { channel: p.channel, amount: p.amount.toNumber() },
          });
          continue;
        }
        await tx.returnRefund.create({ data: { returnId, orderId: order.id, channel: p.channel, amount: p.amount } });
        rows.push(p);
      }

      const status: ReturnStatus = totalAccepted === 0 ? "INSPECTION_FAILED" : rows.length ? "RECEIVED" : "REFUNDED";
      const now = new Date();
      await tx.return.update({
        where: { id: returnId },
        data: {
          status,
          receivedAt: now,
          receivedBy: adminUserId,
          inspectionNote: body.inspectionNote ?? null,
          refundAmount: refund,
          shippingRefund: totalAccepted > 0 ? shipping : new Decimal(0),
          ...(status === "REFUNDED" ? { refundedAt: now } : {}),
        },
      });

      // ── Commission ──
      const { clawback } = totalAccepted > 0
        ? await reduceAffiliateCommissionForReturn({
            tx, orderId: order.id, orderTotal: new Decimal(order.total.toString()),
            refundAmount: refund, fullyReturned, adminUserId,
          })
        : { clawback: null };

      if (fullyReturned && totalAccepted > 0) {
        await tx.order.updateMany({ where: { id: order.id, status: "DELIVERED" }, data: { status: "RETURNED" } });
      }

      await createAuditLogInTx(tx, {
        userId: adminUserId, action: "RETURN_RECEIVED", entity: "Return", entityId: returnId,
        oldValue: { status: locked.status },
        newValue: {
          status, refund: refund.toNumber(), shipping: shipping.toNumber(), fullyReturned,
          items: itemAmounts.map((a) => ({ orderItemId: a.item.id, accepted: a.accepted, restock: a.restock, amount: a.amount.toNumber() })),
          channels: rows.map((p) => ({ channel: p.channel, amount: p.amount.toNumber() })),
        },
        req,
      });

      return {
        orderId: order.id,
        userId: order.userId,
        status,
        refund: refund.toNumber(),
        manual: rows.find((p) => p.channel === "MANUAL")?.amount.toNumber() ?? 0,
        upi: r.refundUpiId,
        clawback,
      };
    })
  );

  const ref = orderShortRef(outcome.orderId);
  if (outcome.status !== "INSPECTION_FAILED") {
    await refundReturnMoney(returnId, body.inspectionNote || "Item return received");
  }
  await finalizeReturn(returnId);

  void notify({
    userId: outcome.userId,
    type: "RETURN_RECEIVED",
    title: outcome.status === "INSPECTION_FAILED" ? "Return inspection result" : "Return received",
    body: outcome.status === "INSPECTION_FAILED"
      ? `Your returned items for order #${ref} did not pass inspection, so no refund is due.`
      : `We've received your returned items for order #${ref}.${outcome.refund > 0 ? ` Your ${money(outcome.refund)} refund is being processed.` : ""}`,
    data: { screen: "Order", orderId: outcome.orderId },
  });
  void emailCustomer(outcome.userId, {
    orderId: outcome.orderId,
    status: outcome.status === "INSPECTION_FAILED" ? "INSPECTION_FAILED" : "RECEIVED",
    note: body.inspectionNote,
    refundAmount: outcome.refund,
  });
  if (outcome.manual > 0) {
    void notifyAdmins({
      type: "ADMIN_CUSTOM",
      title: "Manual return refund owed 💸",
      body: `Order #${ref}: pay ${money(outcome.manual)} by hand${outcome.upi ? ` to UPI ${outcome.upi}` : " (no UPI on file — contact the customer)"}, then mark it settled.`,
      data: { screen: "AdminReturn", returnId },
    });
  }
  if (outcome.clawback) {
    void notifyAdmins({
      type: "ADMIN_CUSTOM",
      title: "Affiliate commission clawback needed",
      body: `Order #${ref}: ${money(outcome.clawback.amount)} of commission relates to returned items but was already paid or is in a withdrawal. Recover it manually.`,
      data: { screen: "AdminOrder", orderId: outcome.orderId },
    });
  }

  return getReturnDetailService(returnId);
}

/**
 * Close a return once every ledger row has settled, and close the order once every unit
 * came back and every refund on it settled. Safe to call repeatedly from any settling path.
 */
export async function finalizeReturn(returnId: string): Promise<void> {
  const done = await prisma.$transaction(async (tx) => {
    const locked = await lockReturn(tx, returnId);
    let justRefunded = false;
    if (locked.status === "RECEIVED") {
      const open = await tx.returnRefund.count({ where: { returnId, status: { not: "PROCESSED" } } });
      if (open === 0) {
        await tx.return.update({ where: { id: returnId }, data: { status: "REFUNDED", refundedAt: new Date() } });
        justRefunded = true;
      }
    }

    // The order closes only when fully returned (it is RETURNED) and nothing is outstanding.
    const order = await tx.order.findUnique({ where: { id: locked.orderId }, select: { status: true } });
    if (order?.status === "RETURNED") {
      const [openReturns, unsettled] = await Promise.all([
        tx.return.count({ where: { orderId: locked.orderId, status: { in: [...OPEN_RETURN_STATUSES, "RECEIVED"] } } }),
        tx.returnRefund.count({ where: { orderId: locked.orderId, status: { not: "PROCESSED" } } }),
      ]);
      if (openReturns === 0 && unsettled === 0) {
        await tx.order.updateMany({ where: { id: locked.orderId, status: "RETURNED" }, data: { status: "REFUNDED" } });
        await tx.payment.updateMany({
          where: { orderId: locked.orderId, status: { in: ["SUCCESS", "PARTIALLY_PAID", "PARTIALLY_REFUNDED"] } },
          data: { status: "REFUNDED" },
        });
      }
    }
    return justRefunded ? locked : null;
  });

  if (done) {
    const r = await prisma.return.findUnique({ where: { id: returnId }, select: { refundAmount: true } });
    void emailCustomer(done.userId, {
      orderId: done.orderId,
      status: "REFUNDED",
      refundAmount: r?.refundAmount ? Number(r.refundAmount) : null,
    });
  }
}

export async function settleReturnRefundService(adminUserId: string, refundId: string, reference: string, req?: Request) {
  const row = await prisma.returnRefund.findUnique({
    where: { id: refundId },
    select: { id: true, returnId: true, orderId: true, channel: true, amount: true, status: true, return: { select: { userId: true } } },
  });
  if (!row) throw new ApiError(404, ReturnErrorCode.RETURN_REFUND_NOT_FOUND);

  const updated = await prisma.returnRefund.updateMany({
    where: { id: refundId, status: { not: "PROCESSED" } },
    data: { status: "PROCESSED", manualReference: reference, settledBy: adminUserId, processedAt: new Date() },
  });
  if (updated.count === 0) throw new ApiError(409, ReturnErrorCode.RETURN_REFUND_INVALID_STATE);

  await createAuditLog({
    userId: adminUserId, action: "RETURN_REFUND_SETTLED", entity: "ReturnRefund", entityId: refundId,
    oldValue: { status: row.status },
    newValue: { reference, channel: row.channel, amount: Number(row.amount), returnId: row.returnId }, req,
  });

  void notify({
    userId: row.return.userId,
    type: "REFUND_PROCESSED",
    title: "Refund sent 💸",
    body: `Your refund of ${money(Number(row.amount))} for returned items on order #${orderShortRef(row.orderId)} has been sent.`,
    data: { screen: "Order", orderId: row.orderId },
  });

  await finalizeReturn(row.returnId);
  return getReturnDetailService(row.returnId);
}

export async function retryReturnRefundService(adminUserId: string, refundId: string, req?: Request) {
  const row = await prisma.returnRefund.findUnique({ where: { id: refundId }, select: { returnId: true, channel: true } });
  if (!row) throw new ApiError(404, ReturnErrorCode.RETURN_REFUND_NOT_FOUND);
  if (row.channel === "MANUAL") throw new ApiError(400, ReturnErrorCode.RETURN_REFUND_INVALID_STATE);

  const reset = await prisma.returnRefund.updateMany({
    where: { id: refundId, status: "FAILED" },
    data: { status: "PENDING", failureReason: null },
  });
  if (reset.count === 0) throw new ApiError(409, ReturnErrorCode.RETURN_REFUND_INVALID_STATE);

  await createAuditLog({
    userId: adminUserId, action: "RETURN_REFUND_RETRIED", entity: "ReturnRefund", entityId: refundId,
    newValue: { returnId: row.returnId }, req,
  });
  await refundReturnMoney(row.returnId, "Item return refund retry");
  await finalizeReturn(row.returnId);
  return getReturnDetailService(row.returnId);
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

const ledgerRowSelect = { id: true, returnId: true, orderId: true, amount: true, razorpayRefundId: true } as const;

/**
 * Route a Razorpay refund event to the return ledger when it belongs there.
 *
 * Returns false for anything that is not an item-return refund, so the caller's legacy
 * handling runs untouched. Matching on `notes.returnRefundId` first covers the event
 * arriving before `refundReturnMoney` has written the refund id back.
 */
export async function handleReturnRefundWebhook(kind: "processed" | "failed", refundEntity: any): Promise<boolean> {
  const noteId = refundEntity?.notes?.returnRefundId;
  const razorpayRefundId = refundEntity?.id as string | undefined;

  const byNote = typeof noteId === "string" && noteId
    ? await prisma.returnRefund.findUnique({ where: { id: noteId }, select: ledgerRowSelect }).catch(() => null)
    : null;
  const row = byNote ?? (razorpayRefundId
    ? await prisma.returnRefund.findUnique({ where: { razorpayRefundId }, select: ledgerRowSelect })
    : null);
  if (!row) return false;

  if (kind === "processed") {
    await prisma.returnRefund.updateMany({
      where: { id: row.id, status: { in: ["PENDING", "INITIATED", "FAILED"] } },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        failureReason: null,
        ...(row.razorpayRefundId ? {} : { razorpayRefundId: razorpayRefundId ?? null }),
      },
    });
    await createAuditLog({
      action: "REFUND_SUCCESS", entity: "ReturnRefund", entityId: row.id,
      newValue: { refundId: razorpayRefundId, returnId: row.returnId, orderId: row.orderId, source: "webhook" },
    });
    await finalizeReturn(row.returnId);
    return true;
  }

  const reason = String(refundEntity?.error_description ?? refundEntity?.status ?? "unknown").slice(0, 300);
  const failed = await prisma.returnRefund.updateMany({
    where: { id: row.id, status: { in: ["PENDING", "INITIATED"] } },
    data: { status: "FAILED", failureReason: reason },
  });
  if (failed.count > 0) {
    await createAuditLog({
      action: "REFUND_FAILED", entity: "ReturnRefund", entityId: row.id,
      newValue: { refundId: razorpayRefundId, returnId: row.returnId, reason, source: "webhook" },
    });
    void notifyAdmins({
      type: "ADMIN_CUSTOM",
      title: "Return refund failed at Razorpay ⚠️",
      body: `The ${money(Number(row.amount))} refund for a return on order #${orderShortRef(row.orderId)} failed. Retry it or settle it manually.`,
      data: { screen: "AdminReturn", returnId: row.returnId },
    });
  }
  return true;
}

/**
 * A Delhivery scan for a reverse-pickup waybill. Must run before the forward shipment
 * handling: that path reads a returned/DTO scan as an RTO and would restore stock.
 */
export async function handleReturnPickupScan(waybill: string, statusText: string, statusType: string): Promise<boolean> {
  const r = await prisma.return.findUnique({ where: { pickupAwb: waybill }, select: { id: true, status: true, orderId: true } });
  if (!r) return false;

  const mapped = mapReversePickupStatus(statusText, statusType);
  if (mapped === "PICKED_UP") {
    const moved = await prisma.return.updateMany({
      where: { id: r.id, status: "APPROVED" },
      data: { status: "PICKED_UP", pickedUpAt: new Date(), pickupStatus: "PICKED_UP" },
    });
    if (moved.count > 0) {
      await createAuditLog({ action: "RETURN_PICKED_UP", entity: "Return", entityId: r.id, newValue: { source: "delhivery", waybill } });
      void emitPickedUp(r.id);
    }
  } else if (mapped === "ARRIVED") {
    const moved = await prisma.return.updateMany({
      where: { id: r.id, status: { in: ["APPROVED", "PICKED_UP"] }, NOT: { pickupStatus: "ARRIVED" } },
      data: { status: "PICKED_UP", pickupStatus: "ARRIVED" },
    });
    if (moved.count > 0) {
      void notifyAdmins({
        type: "ADMIN_CUSTOM",
        title: "Returned parcel arrived 📦",
        body: `The return for order #${orderShortRef(r.orderId)} reached the warehouse. Inspect it and mark it received to release the refund.`,
        data: { screen: "AdminReturn", returnId: r.id },
      });
    }
  } else if (mapped === "CANCELLED") {
    const moved = await prisma.return.updateMany({
      where: { id: r.id, status: "APPROVED" },
      data: { pickupAwb: null, pickupStatus: "FAILED", pickupTrackingUrl: null },
    });
    if (moved.count > 0) {
      await createAuditLog({ action: "RETURN_PICKUP_FAILED", entity: "Return", entityId: r.id, newValue: { stage: "courier", waybill, statusText } });
      void notifyAdmins({
        type: "ADMIN_CUSTOM",
        title: "Reverse pickup cancelled",
        body: `Delhivery cancelled the pickup for a return on order #${orderShortRef(r.orderId)}. Rebook it or arrange collection manually.`,
        data: { screen: "AdminReturn", returnId: r.id },
      });
    }
  }
  return true;
}

/** Returns still being worked per order, for the admin order list badge. */
export async function openReturnCounts(orderIds: string[]): Promise<Map<string, number>> {
  if (orderIds.length === 0) return new Map();
  const rows = await prisma.return.groupBy({
    by: ["orderId"],
    where: { orderId: { in: orderIds }, status: { in: [...OPEN_RETURN_STATUSES, "RECEIVED"] } },
    _count: { id: true },
  });
  return new Map(rows.map((r) => [r.orderId, r._count.id]));
}
