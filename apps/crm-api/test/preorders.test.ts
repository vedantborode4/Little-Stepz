import { randomInt, randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashier: TestSession;
let ops: TestSession;
let categoryId: string;
let store: string;
let supplierId: string;
let gateway: string;
let phonePe: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const shift = (days: number) => {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

beforeAll(async () => {
  [admin, cashier, ops] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER"), sessionAs("OPS")]);
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Pre ${uid()}` })
  ).body.data.id;
  store = (
    await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `PO${uid()}`, name: "Pre store", type: "STORE" })
  ).body.data.id;
  supplierId = (
    await api()
      .post("/api/v1/suppliers")
      .set(admin.auth)
      .send({ name: `Importer ${uid()}`, currency: "INR" })
  ).body.data.id;
  gateway = (
    await api()
      .post("/api/v1/settings/receiving-accounts")
      .set(admin.auth)
      .send({ name: `Gateway ${uid()}`, method: "GATEWAY", feePercent: "2" })
  ).body.data.id;
  phonePe = (
    await api()
      .post("/api/v1/settings/receiving-accounts")
      .set(admin.auth)
      .send({ name: `PhonePe ${uid()}`, method: "UPI" })
  ).body.data.id;
});

async function variant(price: string) {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Pre item ${uid()}`, categoryId, gstRate: "18", variants: [{ sku: `PRE-${uid()}`, regularPrice: price }] });
  return res.body.data.variants[0].id as string;
}

async function customer() {
  const res = await api()
    .post("/api/v1/customers")
    .set(admin.auth)
    .send({ name: `Waiting ${uid()}`, mobile: `7${String(randomInt(0, 1e9)).padStart(9, "0")}` });
  return res.body.data.id as string;
}

async function preOrder(customerId: string, variantId: string, quantity = 1, extra: Record<string, unknown> = {}) {
  const res = await api()
    .post("/api/v1/sales")
    .set(cashier.auth)
    .send({
      type: "PRE_ORDER",
      channel: "WEBSITE",
      fulfilment: "COUNTER",
      locationId: store,
      customerId,
      expectedArrival: shift(20),
      confirm: true,
      lines: [{ variantId, quantity }],
      ...extra,
    });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; code: string };
}

/** Goods arriving: a received INR purchase at `unitCost`. */
async function arrive(variantId: string, quantity: number, unitCost = "12500") {
  const draft = await api()
    .post("/api/v1/purchases")
    .set(admin.auth)
    .send({
      supplierId,
      invoiceDate: today(),
      locationId: store,
      currency: "INR",
      exchangeRate: "1",
      allocationMethod: "VALUE",
      lines: [{ variantId, quantity, unitPrice: unitCost }],
      charges: [],
    });
  expect(draft.status).toBe(201);
  expect((await api().post(`/api/v1/purchases/${draft.body.data.id}/receive`).set(admin.auth).send({})).status).toBe(200);
}

const stock = async (variantId: string) => (await api().get(`/api/v1/inventory/variants/${variantId}`).set(admin.auth)).body.data.stock;
const order = async (id: string) => (await api().get(`/api/v1/sales/${id}`).set(admin.auth)).body.data;
const revenueToday = async () =>
  Number((await api().get("/api/v1/sales/summary").query({ from: today(), to: today() }).set(admin.auth)).body.data.grossSales);
const advances = async () => Number((await api().get("/api/v1/payments/advances/summary").set(admin.auth)).body.data.preOrders);
const pay = (customerId: string, accountId: string, orderId: string, amount: string) =>
  api()
    .post("/api/v1/payments")
    .set(cashier.auth)
    .send({ customerId, accountId, amount, allocations: [{ orderId, amount }] });

describe("Scenario E — ₹4,000 website advance + ₹16,000 PhonePe balance", () => {
  it("holds the advance as a liability, drops no stock before allocation, and counts revenue once at handover", async () => {
    const variantId = await variant("20000");
    const buyer = await customer();
    const revenueBefore = await revenueToday();
    const advancesBefore = await advances();

    const po = await preOrder(buyer, variantId);
    expect(await order(po.id)).toMatchObject({ type: "PRE_ORDER", status: "CONFIRMED", allocated: false, grandTotal: "20000.00" });
    expect((await pay(buyer, gateway, po.id, "4000")).body.data.fee).toBe("80.00");

    expect(await stock(variantId)).toMatchObject({ physical: 0, reserved: 0 });
    expect(await revenueToday()).toBe(revenueBefore);
    expect((await advances()) - advancesBefore).toBe(4000);

    const early = await api().post(`/api/v1/sales/${po.id}/fulfil`).set(cashier.auth);
    expect(early.body.error.code).toBe("NOT_ALLOCATED");

    await arrive(variantId, 1);
    expect(await stock(variantId)).toMatchObject({ physical: 1, available: 1 });
    const allocated = await api().post(`/api/v1/sales/${po.id}/allocate`).set(ops.auth);
    expect(allocated.body.data).toMatchObject({ allocated: true, lines: [expect.objectContaining({ reservedQty: 1 })] });
    expect(await stock(variantId)).toMatchObject({ physical: 1, reserved: 1, available: 0 });

    await pay(buyer, phonePe, po.id, "16000");
    expect(await order(po.id)).toMatchObject({ paid: "20000.00", paymentStatus: "PAID" });
    expect(await revenueToday()).toBe(revenueBefore);
    expect((await advances()) - advancesBefore).toBe(20000);

    const handed = await api().post(`/api/v1/sales/${po.id}/fulfil`).set(cashier.auth);
    expect(handed.body.data).toMatchObject({ status: "COMPLETED", allocated: false });
    expect(handed.body.data.lines[0].cogs).toBeUndefined();
    expect((await order(po.id)).lines[0].cogs).toBe("12500.00");
    expect(await stock(variantId)).toMatchObject({ physical: 0, reserved: 0 });
    expect((await revenueToday()) - revenueBefore).toBe(20000);
    expect(await advances()).toBe(advancesBefore);
  });
});

describe("allocation", () => {
  it("serves waiting pre-orders oldest first when stock arrives", async () => {
    const variantId = await variant("1000");
    const [a, b] = [await customer(), await customer()];
    const older = await preOrder(a, variantId, 1, { orderDate: shift(-3) });
    const newer = await preOrder(b, variantId, 1);

    let list = (await api().get("/api/v1/pre-orders").query({ q: older.code }).set(admin.auth)).body.data.items;
    expect(list[0]).toMatchObject({ stockState: "AWAITING" });

    await arrive(variantId, 1, "600");
    const states = async () => {
      const rows = (await api().get("/api/v1/pre-orders").query({ limit: 100 }).set(admin.auth)).body.data.items as {
        id: string;
        stockState: string;
      }[];
      return [rows.find((r) => r.id === older.id)!.stockState, rows.find((r) => r.id === newer.id)!.stockState];
    };
    expect(await states()).toEqual(["READY", "AWAITING"]);

    const waiting = (await api().get("/api/v1/pre-orders/waiting").set(admin.auth)).body.data.find(
      (w: { variantId: string }) => w.variantId === variantId,
    );
    expect(waiting).toMatchObject({ awaitedUnits: 2, preOrders: 2, available: 1 });

    const result = await api().post("/api/v1/pre-orders/allocate-available").set(ops.auth).send({ variantId });
    expect(result.body.data.allocated).toEqual([older.code]);
    expect(await states()).toEqual(["ALLOCATED", "AWAITING"]);

    list = (await api().get("/api/v1/pre-orders").query({ q: newer.code }).set(admin.auth)).body.data.items;
    expect(list[0]).toMatchObject({ queuePosition: expect.any(Number) });
  });

  it("refuses to allocate without enough free stock, and never takes units held for others", async () => {
    const variantId = await variant("1000");
    const buyer = await customer();
    const po = await preOrder(buyer, variantId, 2);
    await arrive(variantId, 1, "600");
    const res = await api().post(`/api/v1/sales/${po.id}/allocate`).set(cashier.auth);
    expect(res.body.error.code).toBe("STOCK_INSUFFICIENT");
    expect(await stock(variantId)).toMatchObject({ reserved: 0, available: 1 });
  });

  it("lets an admin release an allocation so the stock can go to someone else, then allocate again", async () => {
    const variantId = await variant("1000");
    const [a, b] = [await customer(), await customer()];
    const first = await preOrder(a, variantId);
    const second = await preOrder(b, variantId);
    await arrive(variantId, 1, "600");
    await api().post(`/api/v1/sales/${first.id}/allocate`).set(cashier.auth);

    expect((await api().post(`/api/v1/sales/${second.id}/allocate`).set(cashier.auth)).body.error.code).toBe("STOCK_INSUFFICIENT");
    expect((await api().post(`/api/v1/sales/${first.id}/deallocate`).set(cashier.auth).send({ reason: "x" })).status).toBe(403);
    const released = await api().post(`/api/v1/sales/${first.id}/deallocate`).set(admin.auth).send({ reason: "VIP customer first" });
    expect(released.body.data.allocated).toBe(false);
    expect((await api().post(`/api/v1/sales/${second.id}/allocate`).set(cashier.auth)).body.data.allocated).toBe(true);

    await arrive(variantId, 1, "600");
    expect((await api().post(`/api/v1/sales/${first.id}/allocate`).set(cashier.auth)).body.data.allocated).toBe(true);
    const lineId = (await order(first.id)).lines[0].id as string;
    const history = await prisma.reservation.findMany({ where: { orderLineId: lineId }, orderBy: { createdAt: "asc" } });
    expect(history.map((r) => r.releaseReason)).toEqual(["DEALLOCATED", null]);
    await expect(prisma.reservation.create({ data: { orderLineId: lineId, variantId, locationId: store, quantity: 1 } })).rejects.toThrow(
      /Unique constraint|active reservation/,
    );
  });

  it("only allocates pre-orders, and regular orders reserve at confirmation as before", async () => {
    const variantId = await variant("1000");
    await arrive(variantId, 1, "600");
    const buyer = await customer();
    const regular = await api()
      .post("/api/v1/sales")
      .set(cashier.auth)
      .send({ channel: "WHATSAPP", locationId: store, customerId: buyer, confirm: true, lines: [{ variantId, quantity: 1 }] });
    expect(regular.body.data.allocated).toBe(true);
    expect((await api().post(`/api/v1/sales/${regular.body.data.id}/allocate`).set(cashier.auth)).body.error.code).toBe("NOT_PRE_ORDER");
  });
});

describe("pre-order housekeeping", () => {
  it("flags late arrivals and lets the expected date move", async () => {
    const variantId = await variant("1000");
    const buyer = await customer();
    const po = await preOrder(buyer, variantId, 1, { orderDate: shift(-10), expectedArrival: shift(-1) });
    let row = (await api().get("/api/v1/pre-orders").query({ q: po.code }).set(admin.auth)).body.data.items[0];
    expect(row.overdue).toBe(true);
    const moved = await api()
      .put(`/api/v1/sales/${po.id}/expected-arrival`)
      .set(cashier.auth)
      .send({ expectedArrival: shift(7) });
    expect(moved.body.data.expectedArrival).toBe(shift(7));
    row = (await api().get("/api/v1/pre-orders").query({ q: po.code }).set(admin.auth)).body.data.items[0];
    expect(row.overdue).toBe(false);
    expect(moved.body.data.events.at(-1)).toMatchObject({ action: "rescheduled" });
  });

  it("returns an advance as credit when a pre-order is cancelled", async () => {
    const variantId = await variant("5000");
    const buyer = await customer();
    const po = await preOrder(buyer, variantId);
    await pay(buyer, gateway, po.id, "1000");
    const cancelled = await api()
      .post(`/api/v1/sales/${po.id}/cancel`)
      .set(admin.auth)
      .send({ reason: "Supplier discontinued it", settlement: { mode: "CREDIT" } });
    expect(cancelled.body.data.status).toBe("CANCELLED");
    expect((await api().get(`/api/v1/payments/credit/${buyer}`).set(admin.auth)).body.data.balance).toBe("1000.00");
    const adv = await api().get("/api/v1/payments/advances").query({ customerId: buyer }).set(admin.auth);
    expect(adv.body.data.total).toBe(0);
  });

  it("lists advances on any unfulfilled order and keeps ops away from creating pre-orders", async () => {
    const variantId = await variant("3000");
    const buyer = await customer();
    const po = await preOrder(buyer, variantId);
    await pay(buyer, phonePe, po.id, "500");
    const adv = await api().get("/api/v1/payments/advances").query({ customerId: buyer }).set(admin.auth);
    expect(adv.body.data.items).toEqual([expect.objectContaining({ code: po.code, type: "PRE_ORDER", paid: "500.00", due: "2500.00" })]);

    const denied = await api()
      .post("/api/v1/sales")
      .set(ops.auth)
      .send({ type: "PRE_ORDER", channel: "WEBSITE", locationId: store, customerId: buyer, lines: [{ variantId, quantity: 1 }] });
    expect(denied.status).toBe(403);
    expect((await api().get("/api/v1/pre-orders/summary").set(ops.auth)).status).toBe(200);
  });
});
