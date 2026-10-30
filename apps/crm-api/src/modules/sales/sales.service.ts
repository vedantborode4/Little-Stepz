import { prisma, Prisma, type SalesOrderStatus, type Tx } from "@repo/crm-db/client";
import type {
  CancelOrderInput,
  PosSaleInput,
  SaleQuoteDto,
  SaleQuoteInput,
  SalesListQuery,
  SalesOrderInput,
  SellableItemDto,
  SellableSearchQuery,
} from "@repo/crm-schema";
import { recordAudit, type AuditAction } from "../../core/audit";
import { resolveBusinessDate, todayIST, toDbDate } from "../../core/dates";
import { withTransaction } from "../../core/db";
import { ApiError, forbidden, notFound, type RequestContext } from "../../core/http";
import { buildOrderBy, pageWindow, paginated } from "../../core/list";
import { dec, Decimal, money } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { assertActiveLocations } from "../inventory/inventory.service";
import { availableAt, releaseReservations, reserveStock } from "../inventory/reservations";
import { postStockDocument } from "../inventory/stock-engine";
import { applyCredit, recordReceipt, settleCancelledOrder } from "../payments/ledger";
import { resolveUnitPrice } from "./pricing";
import { orderDetailInclude, orderListInclude, toOrderDetailDto, toOrderListItemDto, type Visibility } from "./sales.mappers";
import { computeSaleTotals } from "./totals";

export interface SaleRights {
  /** May set a unit price by hand instead of the resolved price. */
  overridePrice: boolean;
}

type CartInput = Pick<
  SaleQuoteInput,
  "customerId" | "channel" | "fulfilment" | "locationId" | "lines" | "orderDiscount" | "shippingCharged"
>;

const SORTABLE = { orderDate: "orderDate", code: "code", grandTotal: "grandTotal", createdAt: "createdAt", customer: "customer.name" };

/** "2026-10-30" → "2627": the Indian financial year (April–March) the date falls in. */
export function financialYear(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number) as [number, number];
  const start = month >= 4 ? year : year - 1;
  return `${String(start % 100).padStart(2, "0")}${String((start + 1) % 100).padStart(2, "0")}`;
}

const addDays = (isoDate: string, days: number) => {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

async function loadCustomer(tx: Tx | typeof prisma, customerId: string | null | undefined) {
  if (!customerId) return null;
  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (!customer || !customer.isActive || customer.mergedIntoId) {
    throw new ApiError(400, "INVALID_CUSTOMER", "Choose an active customer", {
      fieldErrors: { customerId: ["Choose an active customer"] },
    });
  }
  return customer;
}

/**
 * Resolves every line's price and works out discounts and GST. The server is
 * the only place prices are decided; the POS and order form show what this returns.
 */
async function priceCart(db: Tx | typeof prisma, input: CartInput, rights: SaleRights) {
  const customer = await loadCustomer(db, input.customerId);
  const wholesale = customer?.type === "WHOLESALE" || input.channel === "WHOLESALE";
  const ids = input.lines.map((l) => l.variantId);

  const [variants, customerPrices, business] = await Promise.all([
    db.variant.findMany({
      where: { id: { in: ids } },
      include: { product: { select: { name: true, status: true, gstRate: true } }, priceTiers: true },
    }),
    customer ? db.customerPrice.findMany({ where: { customerId: customer.id, variantId: { in: ids } } }) : Promise.resolve([]),
    db.businessProfile.findUnique({ where: { id: "default" }, select: { stateCode: true } }),
  ]);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const customerPrice = new Map(customerPrices.map((p) => [p.variantId, dec(p.price.toString())]));

  const priced = input.lines.map((line, i) => {
    const v = byId.get(line.variantId);
    if (!v) throw new ApiError(400, "INVALID_VARIANT", "One of the items no longer exists");
    if (v.status !== "ACTIVE" || v.product.status === "ARCHIVED") {
      throw new ApiError(409, "VARIANT_INACTIVE", `${v.sku} is archived and can't be sold`, {
        fieldErrors: { [`lines.${i}.variantId`]: ["Archived"] },
      });
    }
    const resolved = resolveUnitPrice(
      {
        regularPrice: dec(v.regularPrice.toString()),
        offerPrice: v.offerPrice ? dec(v.offerPrice.toString()) : null,
        wholesalePrice: v.wholesalePrice ? dec(v.wholesalePrice.toString()) : null,
        tiers: v.priceTiers.map((t) => ({ minQty: t.minQty, price: dec(t.price.toString()) })),
        customerPrice: customerPrice.get(v.id) ?? null,
      },
      line.quantity,
      wholesale,
    );
    if (line.unitPrice && !rights.overridePrice) throw forbidden("Only admins can change an item's price; use a discount instead");
    const unitPrice = line.unitPrice ? dec(line.unitPrice) : resolved.unitPrice;
    return {
      variant: v,
      quantity: line.quantity,
      regularPrice: dec(v.regularPrice.toString()),
      unitPrice,
      priceSource: line.unitPrice ? ("MANUAL" as const) : resolved.source,
      lineDiscount: dec(line.lineDiscount),
      gstRate: dec(v.product.gstRate.toString()),
    };
  });

  const { lines, totals } = computeSaleTotals(priced, dec(input.orderDiscount), dec(input.shippingCharged));
  const isInterState = input.fulfilment === "DELIVERY" && Boolean(customer?.stateCode) && customer?.stateCode !== business?.stateCode;
  return { customer, wholesale, isInterState, totals, lines: priced.map((p, i) => ({ ...p, ...lines[i]! })) };
}

type PricedCart = Awaited<ReturnType<typeof priceCart>>;

function pricingDto(line: PricedCart["lines"][number]) {
  return {
    variantId: line.variant.id,
    sku: line.variant.sku,
    productName: line.variant.product.name,
    variantName: line.variant.name,
    quantity: line.quantity,
    regularPrice: money(line.regularPrice),
    unitPrice: money(line.unitPrice),
    priceSource: line.priceSource,
    lineDiscount: money(line.lineDiscount),
    orderDiscountShare: money(line.orderDiscountShare),
    lineTotal: money(line.lineTotal),
    gstRate: line.gstRate.toString(),
    taxableValue: money(line.taxableValue),
    gstAmount: money(line.gstAmount),
  };
}

export async function quoteSale(input: SaleQuoteInput, rights: SaleRights): Promise<SaleQuoteDto> {
  const cart = await priceCart(prisma, input, rights);
  const available = await availableAt(
    prisma,
    input.locationId,
    cart.lines.map((l) => l.variant.id),
  );
  const t = cart.totals;
  return {
    wholesale: cart.wholesale,
    isInterState: cart.isInterState,
    lines: cart.lines.map((l) => ({ ...pricingDto(l), available: available.get(l.variant.id) ?? 0 })),
    totals: {
      units: t.units,
      subtotal: money(t.subtotal),
      lineDiscounts: money(t.lineDiscounts),
      orderDiscount: money(t.orderDiscount),
      shippingCharged: money(t.shippingCharged),
      grandTotal: money(t.grandTotal),
      taxableTotal: money(t.taxableTotal),
      gstTotal: money(t.gstTotal),
    },
  };
}

/** POS typeahead: active items with their list prices and what's free to sell at the location. */
export async function searchSellable(query: SellableSearchQuery): Promise<SellableItemDto[]> {
  const rows = await prisma.variant.findMany({
    where: {
      status: "ACTIVE",
      product: { status: { not: "ARCHIVED" } },
      OR: [
        { sku: { contains: query.q, mode: "insensitive" } },
        { name: { contains: query.q, mode: "insensitive" } },
        { product: { name: { contains: query.q, mode: "insensitive" } } },
        { product: { code: { contains: query.q, mode: "insensitive" } } },
      ],
    },
    include: { product: { select: { name: true, imageUrl: true, gstRate: true } } },
    orderBy: [{ product: { name: "asc" } }, { position: "asc" }],
    take: 24,
  });
  const available = await availableAt(
    prisma,
    query.locationId,
    rows.map((r) => r.id),
  );
  return rows.map((v) => ({
    variantId: v.id,
    sku: v.sku,
    productName: v.product.name,
    variantName: v.name,
    imageUrl: v.product.imageUrl,
    regularPrice: money(v.regularPrice),
    offerPrice: v.offerPrice ? money(v.offerPrice) : null,
    gstRate: v.product.gstRate.toString(),
    available: available.get(v.id) ?? 0,
  }));
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function listOrders(query: SalesListQuery) {
  const where: Prisma.SalesOrderWhereInput = {
    status: query.status,
    channel: query.channel,
    type: query.type,
    fulfilment: query.fulfilment,
    customerId: query.customerId,
    orderDate:
      query.from || query.to
        ? { gte: query.from ? toDbDate(query.from) : undefined, lte: query.to ? toDbDate(query.to) : undefined }
        : undefined,
    ...(query.q && {
      OR: [
        { code: { contains: query.q, mode: "insensitive" } },
        { externalRef: { contains: query.q, mode: "insensitive" } },
        { customerName: { contains: query.q, mode: "insensitive" } },
        { customer: { code: { contains: query.q, mode: "insensitive" } } },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      include: orderListInclude,
      orderBy: buildOrderBy(query.sort, SORTABLE, "orderDate:desc"),
      ...pageWindow(query),
    }),
    prisma.salesOrder.count({ where }),
  ]);
  return paginated(rows.map(toOrderListItemDto), total, query);
}

export async function fulfilmentOf(id: string) {
  const order = await prisma.salesOrder.findUnique({ where: { id }, select: { fulfilment: true } });
  if (!order) throw notFound("Order");
  return order.fulfilment;
}

export async function getOrder(id: string, visibility: Visibility) {
  const row = await prisma.salesOrder.findUnique({ where: { id }, include: orderDetailInclude });
  if (!row) throw notFound("Order");
  return toOrderDetailDto(row, visibility);
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export async function addEvent(
  tx: Tx,
  ctx: RequestContext,
  orderId: string,
  action: string,
  status: SalesOrderStatus | null,
  note?: string,
) {
  await tx.salesOrderEvent.create({ data: { orderId, action, status, note: note ?? null, createdById: ctx.userId } });
}

async function audit(
  tx: Tx,
  ctx: RequestContext,
  action: AuditAction,
  order: { id: string; code: string },
  extra?: Record<string, unknown>,
) {
  await recordAudit(tx, ctx, { action, entity: "SalesOrder", entityId: order.id, after: { code: order.code, ...extra } });
}

function lineRows(cart: PricedCart) {
  return cart.lines.map((l, position) => ({
    variantId: l.variant.id,
    position,
    quantity: l.quantity,
    regularPrice: l.regularPrice,
    unitPrice: l.unitPrice,
    priceSource: l.priceSource,
    lineDiscount: l.lineDiscount,
    orderDiscountShare: l.orderDiscountShare,
    lineTotal: l.lineTotal,
    gstRate: l.gstRate,
    taxableValue: l.taxableValue,
    gstAmount: l.gstAmount,
  }));
}

function headerAmounts(cart: PricedCart) {
  const t = cart.totals;
  return {
    customerId: cart.customer?.id ?? null,
    customerName: cart.customer?.name ?? null,
    wholesale: cart.wholesale,
    isInterState: cart.isInterState,
    subtotal: t.subtotal,
    lineDiscounts: t.lineDiscounts,
    orderDiscount: t.orderDiscount,
    shippingCharged: t.shippingCharged,
    grandTotal: t.grandTotal,
    taxableTotal: t.taxableTotal,
    gstTotal: t.gstTotal,
  };
}

const dueDateFor = (orderDate: string, creditDays: number | null | undefined, explicit?: string) =>
  toDbDate(explicit ?? (creditDays ? addDays(orderDate, creditDays) : orderDate));

/**
 * Takes the order's units out of stock at their current average cost and fixes
 * each line's cost of goods. Its own reservations are released first, so they
 * cover it; nothing else's are touched.
 */
async function deductOrderStock(tx: Tx, ctx: RequestContext, order: { id: string; code: string; locationId: string }) {
  const lines = await tx.salesOrderLine.findMany({ where: { orderId: order.id }, select: { id: true, variantId: true, quantity: true } });
  await releaseReservations(
    tx,
    lines.map((l) => l.id),
    "FULFILLED",
  );
  const document = await postStockDocument(tx, ctx, {
    type: "SALE",
    businessDate: resolveBusinessDate(undefined),
    reason: `Sale ${order.code}`,
    reference: order.code,
    sourceType: "SALE",
    sourceId: order.id,
    lines: lines.map((l) => ({
      variantId: l.variantId,
      locationId: order.locationId,
      bucket: "SELLABLE" as const,
      quantity: -l.quantity,
      cost: { kind: "issue" as const },
    })),
  });

  const movements = await tx.stockMovement.findMany({ where: { documentId: document.id } });
  for (const line of lines) {
    const parts = movements.filter((m) => m.variantId === line.variantId);
    const cogs = parts
      .filter((m) => m.unitCost !== null)
      .reduce((s, m) => s.add(dec(m.unitCost!.toString()).mul(-m.quantity)), new Decimal(0));
    const unknownCostQty = parts.filter((m) => m.unitCost === null).reduce((s, m) => s - m.quantity, 0);
    await tx.salesOrderLine.update({ where: { id: line.id }, data: { cogs, unknownCostQty } });
  }
  return document;
}

/** Locks the order row so two fulfilments or cancellations can't run at once. */
async function lockOrder(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "SalesOrder" WHERE id = ${id} FOR UPDATE`;
  const order = await tx.salesOrder.findUnique({
    where: { id },
    include: { lines: { include: { reservations: { where: { releasedAt: null } } } } },
  });
  if (!order) throw notFound("Order");
  return order;
}

const wrongStatus = (code: string, status: SalesOrderStatus, action: string) =>
  new ApiError(409, "INVALID_STATUS", `Order ${code} is ${status.toLowerCase()} and can't be ${action}`);

/**
 * Walk-in sales must be paid in full (there's no one to collect from later). A
 * known customer may pay part now and owe the rest, or overpay and keep the
 * excess as credit — but only when that's explicitly chosen.
 */
function assertTenderCovers(input: PosSaleInput, cart: PricedCart) {
  const credit = dec(input.creditAmount);
  const total = cart.totals.grandTotal;
  if (credit.gt(0) && !cart.customer) throw new ApiError(400, "CUSTOMER_REQUIRED", "Choose the customer whose credit is being used");
  if (credit.gt(total)) {
    throw new ApiError(400, "CREDIT_EXCEEDS_TOTAL", "Use no more credit than the sale total", {
      fieldErrors: { creditAmount: ["More than the total"] },
    });
  }
  const tendered = input.payments.reduce((s, p) => s.add(dec(p.amount)), credit);
  if (tendered.lt(total) && !cart.customer) {
    throw new ApiError(400, "PAYMENT_INCOMPLETE", `Walk-in sales must be paid in full: ${money(total.sub(tendered))} is still due`, {
      due: money(total.sub(tendered)),
    });
  }
  if (tendered.gt(total) && !(input.excessToCredit && cart.customer)) {
    throw new ApiError(
      400,
      "PAYMENT_EXCEEDS_TOTAL",
      `Payments are ${money(tendered.sub(total))} more than the total. Enter what was kept, not the cash handed over.`,
      {
        excess: money(tendered.sub(total)),
      },
    );
  }
}

/**
 * Customer credit is applied first (an exchange after a return), then one
 * payment per tender leg in order; any excess goes to the customer's credit.
 */
async function recordTender(tx: Tx, ctx: RequestContext, orderId: string, cart: PricedCart, input: PosSaleInput) {
  const credit = dec(input.creditAmount);
  if (credit.gt(0)) await applyCredit(tx, ctx, cart.customer!.id, orderId, credit);
  let remaining = cart.totals.grandTotal.sub(credit);
  for (const tender of input.payments) {
    const amount = dec(tender.amount);
    const applied = Decimal.min(amount, remaining);
    remaining = remaining.sub(applied);
    await recordReceipt(tx, ctx, {
      customerId: cart.customer?.id ?? null,
      accountId: tender.accountId,
      amount,
      reference: tender.reference,
      businessDate: resolveBusinessDate(undefined),
      allocations: applied.gt(0) ? [{ orderId, amount: applied }] : [],
      excessToCredit: true,
    });
  }
}

/**
 * A completed counter sale in one step: priced, saved and taken out of stock in
 * one transaction. The idempotency key makes a double-submitted checkout return
 * the first sale rather than sell the items twice.
 */
export async function createPosSale(input: PosSaleInput, ctx: RequestContext, rights: SaleRights, visibility: Visibility) {
  const existing = await prisma.salesOrder.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
  if (existing) return getOrder(existing.id, visibility);

  try {
    const id = await withTransaction(async (tx) => {
      await assertActiveLocations(tx, [input.locationId]);
      const cart = await priceCart(tx, input, rights);
      assertTenderCovers(input, cart);
      const today = todayIST();
      const order = await tx.salesOrder.create({
        data: {
          ...headerAmounts(cart),
          code: await nextCode(tx, `SO-${financialYear(today)}`, 5),
          type: "REGULAR",
          channel: input.channel,
          fulfilment: "COUNTER",
          locationId: input.locationId,
          orderDate: toDbDate(today),
          dueDate: dueDateFor(today, cart.customer?.creditDays),
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey,
          createdById: ctx.userId,
          lines: { createMany: { data: lineRows(cart) } },
        },
      });
      const document = await deductOrderStock(tx, ctx, order);
      const now = new Date();
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: "COMPLETED", confirmedAt: now, fulfilledAt: now, fulfilledDate: toDbDate(today), stockDocumentId: document.id },
      });
      await addEvent(tx, ctx, order.id, "sold_at_counter", "COMPLETED");
      await audit(tx, ctx, "sale.completed", order, { grandTotal: money(cart.totals.grandTotal), lines: cart.lines.length });
      await recordTender(tx, ctx, order.id, cart, input);
      return order.id;
    });
    return getOrder(id, visibility);
  } catch (err) {
    // Two identical submits raced past the first check: the unique key lets only one through.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await prisma.salesOrder.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
      if (winner) return getOrder(winner.id, visibility);
    }
    throw err;
  }
}

function assertOrderShape(input: SalesOrderInput, customer: PricedCart["customer"]) {
  if (input.fulfilment === "DELIVERY" && !customer) {
    throw new ApiError(400, "CUSTOMER_REQUIRED", "Delivery orders need a customer", { fieldErrors: { customerId: ["Choose a customer"] } });
  }
  if (input.type === "PRE_ORDER" && !customer) {
    throw new ApiError(400, "CUSTOMER_REQUIRED", "Pre-orders need a customer", { fieldErrors: { customerId: ["Choose a customer"] } });
  }
}

async function confirmInTx(tx: Tx, ctx: RequestContext, orderId: string) {
  const order = await lockOrder(tx, orderId);
  if (order.status !== "DRAFT") throw wrongStatus(order.code, order.status, "confirmed");
  // Pre-orders are sold before the stock exists; they are allocated when it arrives.
  if (order.type === "REGULAR") {
    await reserveStock(
      tx,
      order.lines.map((l) => ({ orderLineId: l.id, variantId: l.variantId, locationId: order.locationId, quantity: l.quantity })),
    );
  }
  await tx.salesOrder.update({ where: { id: order.id }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
  await addEvent(tx, ctx, order.id, "confirmed", "CONFIRMED");
  await audit(tx, ctx, "sale.confirmed", order);
}

export async function createOrder(input: SalesOrderInput, ctx: RequestContext, rights: SaleRights, visibility: Visibility) {
  const id = await withTransaction(async (tx) => {
    await assertActiveLocations(tx, [input.locationId]);
    const cart = await priceCart(tx, input, rights);
    assertOrderShape(input, cart.customer);
    const orderDate = input.orderDate ?? todayIST();
    resolveBusinessDate(orderDate);
    const order = await tx.salesOrder.create({
      data: {
        ...headerAmounts(cart),
        code: await nextCode(tx, `SO-${financialYear(orderDate)}`, 5),
        type: input.type,
        channel: input.channel,
        fulfilment: input.fulfilment,
        locationId: input.locationId,
        orderDate: toDbDate(orderDate),
        dueDate: dueDateFor(orderDate, cart.customer?.creditDays, input.dueDate),
        expectedArrival: input.expectedArrival ? toDbDate(input.expectedArrival) : null,
        externalRef: input.externalRef ?? null,
        notes: input.notes ?? null,
        createdById: ctx.userId,
        lines: { createMany: { data: lineRows(cart) } },
      },
    });
    await addEvent(tx, ctx, order.id, "created", "DRAFT");
    await audit(tx, ctx, "sale.created", order, { grandTotal: money(cart.totals.grandTotal), type: input.type });
    if (input.confirm) await confirmInTx(tx, ctx, order.id);
    return order.id;
  });
  return getOrder(id, visibility);
}

export async function updateDraft(id: string, input: SalesOrderInput, ctx: RequestContext, rights: SaleRights, visibility: Visibility) {
  await withTransaction(async (tx) => {
    const before = await lockOrder(tx, id);
    if (before.status !== "DRAFT") throw wrongStatus(before.code, before.status, "edited");
    await assertActiveLocations(tx, [input.locationId]);
    const cart = await priceCart(tx, input, rights);
    assertOrderShape(input, cart.customer);
    const orderDate = input.orderDate ?? todayIST();
    resolveBusinessDate(orderDate);
    await tx.salesOrderLine.deleteMany({ where: { orderId: id } });
    await tx.salesOrder.update({
      where: { id },
      data: {
        ...headerAmounts(cart),
        type: input.type,
        channel: input.channel,
        fulfilment: input.fulfilment,
        locationId: input.locationId,
        orderDate: toDbDate(orderDate),
        dueDate: dueDateFor(orderDate, cart.customer?.creditDays, input.dueDate),
        expectedArrival: input.expectedArrival ? toDbDate(input.expectedArrival) : null,
        externalRef: input.externalRef ?? null,
        notes: input.notes ?? null,
        lines: { createMany: { data: lineRows(cart) } },
      },
    });
    await addEvent(tx, ctx, id, "edited", "DRAFT");
    await recordAudit(tx, ctx, {
      action: "sale.updated",
      entity: "SalesOrder",
      entityId: id,
      before: { grandTotal: money(before.grandTotal), lines: before.lines.length },
      after: { grandTotal: money(cart.totals.grandTotal), lines: cart.lines.length },
    });
    if (input.confirm) await confirmInTx(tx, ctx, id);
  });
  return getOrder(id, visibility);
}

export async function confirmOrder(id: string, ctx: RequestContext, visibility: Visibility) {
  await withTransaction((tx) => confirmInTx(tx, ctx, id));
  return getOrder(id, visibility);
}

export async function packInTx(tx: Tx, ctx: RequestContext, id: string) {
  const order = await lockOrder(tx, id);
  if (order.fulfilment !== "DELIVERY") throw new ApiError(409, "NOT_DELIVERY", "Only delivery orders are packed; hand counter orders over");
  if (order.status !== "CONFIRMED") throw wrongStatus(order.code, order.status, "packed");
  assertAllocated(order);
  await tx.salesOrder.update({ where: { id }, data: { status: "PACKED" } });
  await addEvent(tx, ctx, id, "packed", "PACKED");
  await audit(tx, ctx, "sale.packed", order);
}

export async function packOrder(id: string, ctx: RequestContext, visibility: Visibility) {
  await withTransaction((tx) => packInTx(tx, ctx, id));
  return getOrder(id, visibility);
}

function assertAllocated(order: Awaited<ReturnType<typeof lockOrder>>) {
  const unreserved = order.lines.filter((l) => l.reservations.length === 0);
  if (unreserved.length) {
    throw new ApiError(409, "NOT_ALLOCATED", "Stock hasn't been allocated to this pre-order yet");
  }
}

/**
 * Pre-orders are sold before the stock exists. When it arrives, allocating
 * reserves every line at once (all or nothing), under the same lock as any
 * other reservation, so it can't take units another order already holds.
 */
export async function allocateInTx(tx: Tx, ctx: RequestContext, id: string) {
  const order = await lockOrder(tx, id);
  if (order.type !== "PRE_ORDER") throw new ApiError(409, "NOT_PRE_ORDER", "Regular orders reserve their stock when confirmed");
  if (order.status !== "CONFIRMED") throw wrongStatus(order.code, order.status, "allocated");
  if (order.lines.some((l) => l.reservations.length > 0))
    throw new ApiError(409, "ALREADY_ALLOCATED", `${order.code} already holds its stock`);
  await reserveStock(
    tx,
    order.lines.map((l) => ({ orderLineId: l.id, variantId: l.variantId, locationId: order.locationId, quantity: l.quantity })),
  );
  await addEvent(tx, ctx, id, "allocated", null);
  await audit(tx, ctx, "sale.allocated", order);
  return order;
}

export async function allocateOrder(id: string, ctx: RequestContext, visibility: Visibility) {
  await withTransaction((tx) => allocateInTx(tx, ctx, id));
  return getOrder(id, visibility);
}

/** Frees a pre-order's stock (e.g. for a more urgent customer). It goes back to waiting; nothing is lost. */
export async function deallocateOrder(id: string, reason: string, ctx: RequestContext, visibility: Visibility) {
  await withTransaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (order.type !== "PRE_ORDER")
      throw new ApiError(409, "NOT_PRE_ORDER", "Only pre-order allocations can be released; cancel a regular order instead");
    if (order.status !== "CONFIRMED") throw wrongStatus(order.code, order.status, "released");
    if (!order.lines.some((l) => l.reservations.length > 0))
      throw new ApiError(409, "NOT_ALLOCATED", `${order.code} doesn't hold any stock`);
    await releaseReservations(
      tx,
      order.lines.map((l) => l.id),
      "DEALLOCATED",
    );
    await addEvent(tx, ctx, id, "deallocated", null, reason);
    await audit(tx, ctx, "sale.deallocated", order, { reason });
  });
  return getOrder(id, visibility);
}

export async function setExpectedArrival(id: string, expectedArrival: string | null, ctx: RequestContext, visibility: Visibility) {
  await withTransaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (order.fulfilledAt || order.status === "CANCELLED") throw wrongStatus(order.code, order.status, "rescheduled");
    await tx.salesOrder.update({ where: { id }, data: { expectedArrival: expectedArrival ? toDbDate(expectedArrival) : null } });
    await addEvent(tx, ctx, id, "rescheduled", null, expectedArrival ? `Expected ${expectedArrival}` : "Expected date cleared");
    await recordAudit(tx, ctx, {
      action: "sale.rescheduled",
      entity: "SalesOrder",
      entityId: id,
      before: { expectedArrival: order.expectedArrival },
      after: { expectedArrival },
    });
  });
  return getOrder(id, visibility);
}

/** Handover (counter) or dispatch (delivery): the moment stock leaves and revenue is recognised. */
/** Handover or dispatch inside the caller's transaction (shipments dispatch through here too). */
export async function fulfilInTx(tx: Tx, ctx: RequestContext, id: string) {
  const order = await lockOrder(tx, id);
  const action = order.fulfilment === "COUNTER" ? "handed over" : "dispatched";
  if (order.status !== "CONFIRMED" && order.status !== "PACKED") throw wrongStatus(order.code, order.status, action);
  if (order.stockDocumentId) throw new ApiError(409, "ALREADY_FULFILLED", `${order.code} has already left stock`);
  assertAllocated(order);

  const document = await deductOrderStock(tx, ctx, order);
  const status = order.fulfilment === "COUNTER" ? "COMPLETED" : "DISPATCHED";
  await tx.salesOrder.update({
    where: { id },
    data: { status, fulfilledAt: new Date(), fulfilledDate: toDbDate(todayIST()), stockDocumentId: document.id },
  });
  await addEvent(tx, ctx, id, order.fulfilment === "COUNTER" ? "handed_over" : "dispatched", status);
  await audit(tx, ctx, "sale.fulfilled", order, { status, stockDocument: document.code });
}

export async function fulfilOrder(id: string, ctx: RequestContext, visibility: Visibility) {
  await withTransaction((tx) => fulfilInTx(tx, ctx, id));
  return getOrder(id, visibility);
}

export async function deliverInTx(tx: Tx, ctx: RequestContext, id: string) {
  const order = await lockOrder(tx, id);
  if (order.status !== "DISPATCHED") throw wrongStatus(order.code, order.status, "marked delivered");
  await tx.salesOrder.update({ where: { id }, data: { status: "DELIVERED" } });
  await addEvent(tx, ctx, id, "delivered", "DELIVERED");
  await audit(tx, ctx, "sale.delivered", order);
}

export async function deliverOrder(id: string, ctx: RequestContext, visibility: Visibility) {
  await withTransaction((tx) => deliverInTx(tx, ctx, id));
  return getOrder(id, visibility);
}

/** Before fulfilment an order can be cancelled; held stock is released. After, it's a return. */
export async function cancelOrder(id: string, input: CancelOrderInput, ctx: RequestContext, visibility: Visibility) {
  await withTransaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (order.fulfilledAt) throw new ApiError(409, "USE_RETURN", `${order.code} has left stock; record a return instead`);
    if (order.status === "CANCELLED") throw wrongStatus(order.code, order.status, "cancelled");
    await settleCancelledOrder(tx, ctx, order, input.settlement);
    await releaseReservations(
      tx,
      order.lines.map((l) => l.id),
      "CANCELLED",
    );
    await tx.salesOrder.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: input.reason } });
    await addEvent(tx, ctx, id, "cancelled", "CANCELLED", input.reason);
    await audit(tx, ctx, "sale.cancelled", order, { reason: input.reason });
  });
  return getOrder(id, visibility);
}
