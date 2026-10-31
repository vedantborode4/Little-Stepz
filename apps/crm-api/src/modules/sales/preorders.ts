import { prisma, type Prisma } from "@repo/crm-db/client";
import type { PreOrderListQuery, PreOrderRowDto, PreOrderStockState, PreOrderSummaryDto, WaitingItemDto } from "@repo/crm-schema";
import { fromDbDate, todayIST, toDbDate } from "../../core/dates";
import { withTransaction } from "../../core/db";
import { ApiError, type RequestContext } from "../../core/http";
import { pageWindow, paginated } from "../../core/list";
import { Decimal, money } from "../../core/money";
import { availableAt } from "../inventory/reservations";
import { allocateInTx } from "./sales.service";

const OPEN_STATUSES = ["CONFIRMED", "PACKED"] as const;
const d = (v: Prisma.Decimal | null | undefined) => new Decimal((v ?? 0).toString());

const preOrderSelect = {
  id: true,
  code: true,
  status: true,
  locationId: true,
  orderDate: true,
  createdAt: true,
  expectedArrival: true,
  grandTotal: true,
  fulfilledAt: true,
  customer: { select: { id: true, code: true, name: true } },
  location: { select: { id: true, name: true } },
  allocations: { select: { amount: true } },
  lines: {
    select: {
      variantId: true,
      quantity: true,
      variant: { select: { sku: true, name: true, product: { select: { name: true } } } },
      reservations: { where: { releasedAt: null }, select: { id: true } },
    },
    orderBy: { position: "asc" },
  },
} satisfies Prisma.SalesOrderSelect;

type PreOrderRow = Prisma.SalesOrderGetPayload<{ select: typeof preOrderSelect }>;

const isAllocated = (o: PreOrderRow) => o.lines.length > 0 && o.lines.every((l) => l.reservations.length > 0);
const key = (locationId: string, variantId: string) => `${locationId}|${variantId}`;

/**
 * Serves open pre-orders oldest first against what's free right now. An order
 * is READY when stock covers all of it after the older READY orders take
 * theirs; an older order that can't be covered doesn't block a smaller younger one.
 */
async function stockQueue(open: PreOrderRow[]) {
  const waiting = open.filter((o) => !isAllocated(o));
  const free = new Map<string, number>();
  const byLocation = new Map<string, Set<string>>();
  for (const o of waiting)
    for (const l of o.lines) byLocation.set(o.locationId, (byLocation.get(o.locationId) ?? new Set()).add(l.variantId));
  for (const [locationId, variants] of byLocation) {
    for (const [variantId, qty] of await availableAt(prisma, locationId, [...variants])) free.set(key(locationId, variantId), qty);
  }

  const result = new Map<string, { state: PreOrderStockState; position: number | null }>();
  let position = 0;
  for (const o of open) {
    if (isAllocated(o)) {
      result.set(o.id, { state: "ALLOCATED", position: null });
      continue;
    }
    position++;
    const covered = o.lines.every((l) => (free.get(key(o.locationId, l.variantId)) ?? 0) >= l.quantity);
    if (covered) for (const l of o.lines) free.set(key(o.locationId, l.variantId), free.get(key(o.locationId, l.variantId))! - l.quantity);
    result.set(o.id, { state: covered ? "READY" : "AWAITING", position });
  }
  return { result, free };
}

async function openPreOrders(where: Prisma.SalesOrderWhereInput = {}) {
  return prisma.salesOrder.findMany({
    where: { type: "PRE_ORDER", status: { in: [...OPEN_STATUSES] }, fulfilledAt: null, ...where },
    select: preOrderSelect,
    orderBy: [{ orderDate: "asc" }, { createdAt: "asc" }],
  });
}

function toRow(o: PreOrderRow, queue: Map<string, { state: PreOrderStockState; position: number | null }>, today: Date): PreOrderRowDto {
  const paid = o.allocations.reduce((s, a) => s.add(d(a.amount)), new Decimal(0));
  const open = !o.fulfilledAt && o.status !== "CANCELLED";
  const q = open ? queue.get(o.id) : undefined;
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    customer: o.customer,
    location: o.location,
    orderDate: fromDbDate(o.orderDate),
    expectedArrival: o.expectedArrival ? fromDbDate(o.expectedArrival) : null,
    overdue: open && o.expectedArrival !== null && o.expectedArrival < today,
    items: o.lines.map((l) => `${l.quantity} × ${l.variant.product.name} — ${l.variant.name}`).join(", "),
    units: o.lines.reduce((s, l) => s + l.quantity, 0),
    grandTotal: money(o.grandTotal),
    paid: money(paid),
    due: money(Decimal.max(d(o.grandTotal).sub(paid), 0)),
    stockState: q?.state ?? null,
    queuePosition: q?.position ?? null,
  };
}

export async function listPreOrders(query: PreOrderListQuery) {
  const today = toDbDate(todayIST());
  const search: Prisma.SalesOrderWhereInput = {
    customerId: query.customerId,
    ...(query.q && {
      OR: [
        { code: { contains: query.q, mode: "insensitive" } },
        { customer: { name: { contains: query.q, mode: "insensitive" } } },
        { lines: { some: { variant: { sku: { contains: query.q, mode: "insensitive" } } } } },
        { lines: { some: { variant: { product: { name: { contains: query.q, mode: "insensitive" } } } } } },
      ],
    }),
  };
  const [open, closed] = await Promise.all([
    openPreOrders(),
    query.includeClosed
      ? prisma.salesOrder.findMany({
          where: { type: "PRE_ORDER", NOT: { status: { in: [...OPEN_STATUSES, "DRAFT"] }, fulfilledAt: null }, ...search },
          select: preOrderSelect,
          orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
          take: 500,
        })
      : Promise.resolve([]),
  ]);
  // The queue is always worked out over every open pre-order; filters only decide what's shown.
  const { result } = await stockQueue(open);
  const visible = new Set((await openPreOrders(search)).map((o) => o.id));
  let rows = [...open.filter((o) => visible.has(o.id)), ...closed].map((o) => toRow(o, result, today));
  if (query.state) rows = rows.filter((r) => r.stockState === query.state);
  if (query.overdue !== undefined) rows = rows.filter((r) => r.overdue === query.overdue);
  const { skip, take } = pageWindow(query);
  return paginated(rows.slice(skip, skip + take), rows.length, query);
}

export async function preOrderSummary(): Promise<PreOrderSummaryDto> {
  const today = toDbDate(todayIST());
  const open = await openPreOrders();
  const { result } = await stockQueue(open);
  const count = (state: PreOrderStockState) => [...result.values()].filter((r) => r.state === state).length;
  const advances = open.reduce((s, o) => s.add(o.allocations.reduce((t, a) => t.add(d(a.amount)), new Decimal(0))), new Decimal(0));
  return {
    open: open.length,
    awaiting: count("AWAITING"),
    ready: count("READY"),
    allocated: count("ALLOCATED"),
    overdueArrivals: open.filter((o) => o.expectedArrival && o.expectedArrival < today).length,
    advancesHeld: money(advances),
  };
}

/** What open pre-orders are still waiting for, item by item, against what's free now. */
export async function waitingItems(): Promise<WaitingItemDto[]> {
  const open = (await openPreOrders()).filter((o) => !isAllocated(o));
  const items = new Map<string, WaitingItemDto & { locations: Set<string> }>();
  for (const o of open) {
    for (const l of o.lines) {
      const item = items.get(l.variantId) ?? {
        variantId: l.variantId,
        sku: l.variant.sku,
        productName: l.variant.product.name,
        variantName: l.variant.name,
        awaitedUnits: 0,
        preOrders: 0,
        available: 0,
        locations: new Set<string>(),
      };
      item.awaitedUnits += l.quantity;
      item.preOrders += 1;
      item.locations.add(o.locationId);
      items.set(l.variantId, item);
    }
  }
  for (const item of items.values()) {
    for (const locationId of item.locations)
      item.available += Math.max((await availableAt(prisma, locationId, [item.variantId])).get(item.variantId) ?? 0, 0);
  }
  return [...items.values()].map(({ locations: _locations, ...rest }) => rest).sort((a, b) => b.awaitedUnits - a.awaitedUnits);
}

/**
 * When a shipment lands: allocate every pre-order that stock now fully covers,
 * oldest first. Each is its own transaction, so one that loses a race to
 * another sale is skipped rather than failing the rest.
 */
export async function allocateAvailable(variantId: string | undefined, ctx: RequestContext) {
  const open = await openPreOrders();
  const { result } = await stockQueue(open);
  const ready = open.filter((o) => result.get(o.id)?.state === "READY" && (!variantId || o.lines.some((l) => l.variantId === variantId)));
  const allocated: string[] = [];
  const skipped: string[] = [];
  for (const o of ready) {
    try {
      await withTransaction((tx) => allocateInTx(tx, ctx, o.id));
      allocated.push(o.code);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      skipped.push(o.code);
    }
  }
  return { allocated, skipped };
}
