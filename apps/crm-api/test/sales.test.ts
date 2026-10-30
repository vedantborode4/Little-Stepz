import { randomInt, randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { dec } from "../src/core/money";
import { resolveUnitPrice } from "../src/modules/sales/pricing";
import { financialYear } from "../src/modules/sales/sales.service";
import { computeSaleTotals } from "../src/modules/sales/totals";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashier: TestSession;
let ops: TestSession;
let categoryId: string;
let store: string;
let cash: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

beforeAll(async () => {
  [admin, cashier, ops] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER"), sessionAs("OPS")]);
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Sales ${uid()}` })
  ).body.data.id;
  store = (
    await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `SS${uid()}`, name: "Sales store", type: "STORE" })
  ).body.data.id;
  cash = (
    await api()
      .post("/api/v1/settings/receiving-accounts")
      .set(admin.auth)
      .send({ name: `Till ${uid()}`, method: "CASH" })
  ).body.data.id;
});

async function product(variants: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Item ${uid()}`, categoryId, gstRate: "18", variants, ...extra });
  expect(res.status).toBe(201);
  return res.body.data.variants as { id: string; sku: string }[];
}

/** `unitCost: null` enters the opening stock with an unknown cost. */
async function simple(prices: Record<string, unknown> = {}, stock = 10, unitCost: string | null = "100") {
  const [v] = await product([{ sku: `S-${uid()}`, regularPrice: "1000", ...prices }]);
  if (stock) await opening([{ variantId: v!.id, quantity: stock, unitCost: unitCost ?? undefined }]);
  return v!.id;
}

async function opening(lines: { variantId: string; quantity: number; unitCost?: string }[]) {
  const res = await api().post("/api/v1/inventory/opening").set(admin.auth).send({ locationId: store, lines });
  expect(res.status).toBe(201);
}

async function card(variantId: string) {
  return (await api().get(`/api/v1/inventory/variants/${variantId}`).set(admin.auth)).body.data.stock;
}

/**
 * A POS sale. Walk-ins must pay in full, so unless the test says otherwise the
 * helper pays the quoted total in cash, as the till would.
 */
async function pos(session: TestSession, body: Record<string, unknown>) {
  const payload = { locationId: store, channel: "STORE", idempotencyKey: randomUUID(), ...body };
  if (!("payments" in body) && !body.customerId) {
    const quote = await api().post("/api/v1/sales/quote").set(session.auth).send(payload);
    if (quote.status === 200) Object.assign(payload, { payments: [{ accountId: cash, amount: quote.body.data.totals.grandTotal }] });
  }
  return api().post("/api/v1/sales/pos").set(session.auth).send(payload);
}

const order = (session: TestSession, body: Record<string, unknown>) =>
  api()
    .post("/api/v1/sales")
    .set(session.auth)
    .send({ locationId: store, channel: "WHATSAPP", ...body });

async function customer(body: Record<string, unknown> = {}) {
  const res = await api()
    .post("/api/v1/customers")
    .set(admin.auth)
    .send({ name: `Buyer ${uid()}`, mobile: `9${String(randomInt(0, 1e9)).padStart(9, "0")}`, ...body });
  return res.body.data.id as string;
}

describe("price resolution and totals (pure)", () => {
  const prices = {
    regularPrice: dec(1000),
    offerPrice: dec(900),
    wholesalePrice: dec(700),
    tiers: [
      { minQty: 10, price: dec(650) },
      { minQty: 50, price: dec(600) },
    ],
    customerPrice: null,
  };

  it("applies customer > tier > wholesale > offer > regular, with tiers and wholesale only for wholesale sales", () => {
    expect(resolveUnitPrice({ ...prices, customerPrice: dec(500) }, 1, false)).toMatchObject({ source: "CUSTOMER" });
    expect(resolveUnitPrice(prices, 60, true)).toMatchObject({ source: "TIER", unitPrice: dec(600) });
    expect(resolveUnitPrice(prices, 12, true)).toMatchObject({ source: "TIER", unitPrice: dec(650) });
    expect(resolveUnitPrice(prices, 5, true)).toMatchObject({ source: "WHOLESALE" });
    expect(resolveUnitPrice(prices, 60, false)).toMatchObject({ source: "OFFER" });
    expect(resolveUnitPrice({ ...prices, offerPrice: null }, 1, false)).toMatchObject({ source: "REGULAR" });
  });

  it("backs GST out of an inclusive price so taxable + GST equals the price exactly", () => {
    const { totals, lines } = computeSaleTotals(
      [{ quantity: 1, unitPrice: dec(20000), lineDiscount: dec(2000), gstRate: dec(18) }],
      dec(0),
      dec(0),
    );
    expect(lines[0]!.taxableValue.toFixed(2)).toBe("15254.24");
    expect(lines[0]!.gstAmount.toFixed(2)).toBe("2745.76");
    expect(totals.grandTotal.toFixed(2)).toBe("18000.00");
  });

  it("splits an order discount by value with the remainder on the last line", () => {
    const { lines, totals } = computeSaleTotals(
      [
        { quantity: 1, unitPrice: dec(100), lineDiscount: dec(0), gstRate: dec(18) },
        { quantity: 1, unitPrice: dec(100), lineDiscount: dec(0), gstRate: dec(12) },
        { quantity: 1, unitPrice: dec(100), lineDiscount: dec(0), gstRate: dec(5) },
      ],
      dec(10),
      dec(50),
    );
    expect(lines.map((l) => l.orderDiscountShare.toFixed(2))).toEqual(["3.33", "3.33", "3.34"]);
    expect(totals.grandTotal.toFixed(2)).toBe("340.00");
    expect(totals.taxableTotal.add(totals.gstTotal).toFixed(2)).toBe("340.00");
  });

  it("names orders by Indian financial year", () => {
    expect(financialYear("2026-10-30")).toBe("2627");
    expect(financialYear("2027-03-31")).toBe("2627");
    expect(financialYear("2027-04-01")).toBe("2728");
  });
});

describe("Scenario B — ₹18,000 sale of a ₹12,500 item", () => {
  it("records GST, cost and profit both net of GST and before GST", async () => {
    const variantId = await simple({ regularPrice: "20000" }, 1, "12500");
    const res = await pos(admin, { lines: [{ variantId, quantity: 1, lineDiscount: "2000" }] });
    expect(res.status).toBe(201);
    const sale = res.body.data;
    expect(sale).toMatchObject({ status: "COMPLETED", code: expect.stringMatching(/^SO-\d{4}-\d{5}$/), fulfilment: "COUNTER" });
    expect(sale.totals).toMatchObject({ grandTotal: "18000.00", taxableTotal: "15254.24", gstTotal: "2745.76", lineDiscounts: "2000.00" });
    expect(sale.lines[0]).toMatchObject({ priceSource: "REGULAR", unitPrice: "20000.00", lineTotal: "18000.00", cogs: "12500.00" });
    expect(sale.profit).toMatchObject({
      netSales: "15254.24",
      cogs: "12500.00",
      grossProfit: "2754.24",
      profitBeforeGst: "5500.00",
      marginPercent: "18.1",
      unknownCostUnits: 0,
    });
    expect((await card(variantId)).physical).toBe(0);
  });
});

describe("Scenario F — selling a colour variant", () => {
  it("2 Blue YEGAO reduce only Blue stock", async () => {
    const colours = ["Red", "Blue", "Black", "White"];
    const variants = await product(
      colours.map((c) => ({ optionValues: [c], sku: `YG-${c}-${uid()}`, regularPrice: "499" })),
      { options: [{ name: "Colour", values: colours }] },
    );
    await opening(variants.map((v, i) => ({ variantId: v.id, quantity: [5, 8, 4, 3][i]!, unitCost: "300" })));
    const blue = variants[1]!.id;

    const res = await pos(cashier, { lines: [{ variantId: blue, quantity: 2 }] });
    expect(res.status).toBe(201);
    const after = await Promise.all(variants.map((v) => card(v.id)));
    expect(after.map((s) => s.physical)).toEqual([5, 6, 4, 3]);
    expect(after.reduce((s, x) => s + x.physical, 0)).toBe(18);
  });
});

describe("a POS sale is never deducted twice", () => {
  it("returns the same sale for a repeated checkout key, even when submitted concurrently", async () => {
    const variantId = await simple({}, 5);
    const body = { idempotencyKey: randomUUID(), lines: [{ variantId, quantity: 2 }] };
    const [a, b] = await Promise.all([pos(cashier, body), pos(cashier, body)]);
    const c = await pos(cashier, body);
    expect(new Set([a.body.data.id, b.body.data.id, c.body.data.id]).size).toBe(1);
    expect((await card(variantId)).physical).toBe(3);
    const docs = await prisma.stockDocument.count({ where: { sourceType: "SALE", sourceId: a.body.data.id } });
    expect(docs).toBe(1);
  });

  it("refuses to sell more than is available", async () => {
    const variantId = await simple({}, 1);
    const res = await pos(cashier, { lines: [{ variantId, quantity: 2 }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STOCK_INSUFFICIENT");
    expect((await card(variantId)).physical).toBe(1);
  });
});

describe("shipped orders reserve at confirmation and deduct at dispatch", () => {
  it("holds stock, blocks others from taking it, then deducts once at dispatch", async () => {
    const variantId = await simple({}, 5);
    const buyer = await customer();
    const created = await order(admin, { customerId: buyer, fulfilment: "DELIVERY", confirm: true, lines: [{ variantId, quantity: 4 }] });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("CONFIRMED");
    expect(created.body.data.lines[0].reservedQty).toBe(4);

    let stock = await card(variantId);
    expect(stock).toMatchObject({ physical: 5, reserved: 4, available: 1 });

    const walkIn = await pos(cashier, { lines: [{ variantId, quantity: 2 }] });
    expect(walkIn.body.error.code).toBe("STOCK_RESERVED");
    const writeOff = await api()
      .post("/api/v1/inventory/write-offs")
      .set(admin.auth)
      .send({ locationId: store, bucket: "SELLABLE", reason: "Broken", reasonCode: "DAMAGED", lines: [{ variantId, quantity: 2 }] });
    expect(writeOff.body.error.code).toBe("STOCK_RESERVED");

    const id = created.body.data.id;
    expect((await api().post(`/api/v1/sales/${id}/fulfil`).set(cashier.auth)).status).toBe(403);
    expect((await api().post(`/api/v1/sales/${id}/pack`).set(ops.auth)).body.data.status).toBe("PACKED");
    const dispatched = await api().post(`/api/v1/sales/${id}/fulfil`).set(ops.auth);
    expect(dispatched.body.data).toMatchObject({ status: "DISPATCHED", fulfilledAt: expect.any(String) });
    expect(dispatched.body.data.lines[0].reservedQty).toBe(0);
    expect(dispatched.body.data.cogs).toBeUndefined();

    stock = await card(variantId);
    expect(stock).toMatchObject({ physical: 1, reserved: 0, available: 1 });

    const again = await api().post(`/api/v1/sales/${id}/fulfil`).set(admin.auth);
    expect(again.status).toBe(409);
    expect((await api().post(`/api/v1/sales/${id}/deliver`).set(ops.auth)).body.data.status).toBe("DELIVERED");
    const cancel = await api().post(`/api/v1/sales/${id}/cancel`).set(admin.auth).send({ reason: "Too late" });
    expect(cancel.body.error.code).toBe("USE_RETURN");
  });

  it("releases reserved stock when a confirmed order is cancelled", async () => {
    const variantId = await simple({}, 3);
    const created = await order(admin, {
      customerId: await customer(),
      fulfilment: "DELIVERY",
      confirm: true,
      lines: [{ variantId, quantity: 3 }],
    });
    expect((await card(variantId)).available).toBe(0);
    expect((await api().post(`/api/v1/sales/${created.body.data.id}/cancel`).set(cashier.auth).send({ reason: "x" })).status).toBe(403);
    const cancelled = await api()
      .post(`/api/v1/sales/${created.body.data.id}/cancel`)
      .set(admin.auth)
      .send({ reason: "Customer changed mind" });
    expect(cancelled.body.data.status).toBe("CANCELLED");
    expect(await card(variantId)).toMatchObject({ physical: 3, reserved: 0, available: 3 });
  });

  it("never lets two orders claim the last units", async () => {
    const variantId = await simple({}, 3);
    const buyer = await customer();
    const results = await Promise.all(
      [1, 2, 3].map(() => order(admin, { customerId: buyer, fulfilment: "DELIVERY", confirm: true, lines: [{ variantId, quantity: 2 }] })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect((await card(variantId)).reserved).toBe(2);
  });

  it("keeps a draft out of stock until it is confirmed, and lets a counter order be handed over", async () => {
    const variantId = await simple({}, 2);
    const draft = await order(cashier, { channel: "STORE", lines: [{ variantId, quantity: 1 }] });
    expect(draft.body.data.status).toBe("DRAFT");
    expect((await card(variantId)).reserved).toBe(0);
    const edited = await api()
      .put(`/api/v1/sales/${draft.body.data.id}`)
      .set(cashier.auth)
      .send({ locationId: store, channel: "STORE", lines: [{ variantId, quantity: 2 }], orderDiscount: "100" });
    expect(edited.body.data.totals.grandTotal).toBe("1900.00");
    await api().post(`/api/v1/sales/${draft.body.data.id}/confirm`).set(cashier.auth);
    expect((await card(variantId)).reserved).toBe(2);
    const handed = await api().post(`/api/v1/sales/${draft.body.data.id}/fulfil`).set(cashier.auth);
    expect(handed.body.data.status).toBe("COMPLETED");
    expect(await card(variantId)).toMatchObject({ physical: 0, reserved: 0 });
    expect(handed.body.data.events.map((e: { action: string }) => e.action)).toEqual(["created", "edited", "confirmed", "handed_over"]);
  });

  it("requires a customer for delivery orders", async () => {
    const variantId = await simple({}, 1);
    const res = await order(admin, { fulfilment: "DELIVERY", lines: [{ variantId, quantity: 1 }] });
    expect(res.body.error.code).toBe("CUSTOMER_REQUIRED");
  });
});

describe("pricing rules through the API", () => {
  it("gives wholesale customers wholesale and quantity prices, and customer prices win", async () => {
    const variantId = await simple({ offerPrice: "900", wholesalePrice: "700" }, 30);
    await api()
      .put(`/api/v1/variants/${variantId}/tiers`)
      .set(admin.auth)
      .send({ tiers: [{ minQty: 10, price: "650" }] });
    const wholesaler = await customer({ type: "WHOLESALE", creditDays: 30 });
    const quote = (body: Record<string, unknown>) =>
      api()
        .post("/api/v1/sales/quote")
        .set(cashier.auth)
        .send({ locationId: store, channel: "STORE", ...body });

    expect((await quote({ lines: [{ variantId, quantity: 1 }] })).body.data.lines[0]).toMatchObject({
      priceSource: "OFFER",
      unitPrice: "900.00",
    });
    const w = await quote({ customerId: wholesaler, lines: [{ variantId, quantity: 12 }] });
    expect(w.body.data).toMatchObject({ wholesale: true });
    expect(w.body.data.lines[0]).toMatchObject({ priceSource: "TIER", unitPrice: "650.00", available: 30 });

    await api().put(`/api/v1/customers/${wholesaler}/prices/${variantId}`).set(admin.auth).send({ price: "620" });
    expect((await quote({ customerId: wholesaler, lines: [{ variantId, quantity: 12 }] })).body.data.lines[0]).toMatchObject({
      priceSource: "CUSTOMER",
      unitPrice: "620.00",
    });

    const sale = await order(admin, { customerId: wholesaler, channel: "WHOLESALE", confirm: true, lines: [{ variantId, quantity: 12 }] });
    const dueDate = new Date(`${today()}T00:00:00Z`);
    dueDate.setUTCDate(dueDate.getUTCDate() + 30);
    expect(sale.body.data.dueDate).toBe(dueDate.toISOString().slice(0, 10));
  });

  it("lets only admins override a price, and caps discounts at the value", async () => {
    const variantId = await simple({}, 5);
    expect((await pos(cashier, { lines: [{ variantId, quantity: 1, unitPrice: "1" }] })).status).toBe(403);
    const manual = await pos(admin, { lines: [{ variantId, quantity: 1, unitPrice: "750" }] });
    expect(manual.body.data.lines[0]).toMatchObject({ priceSource: "MANUAL", unitPrice: "750.00" });
    const tooMuch = await pos(cashier, { lines: [{ variantId, quantity: 1, lineDiscount: "1001" }] });
    expect(tooMuch.body.error.code).toBe("DISCOUNT_TOO_HIGH");
  });
});

describe("records, visibility and revenue timing", () => {
  it("freezes a completed sale's amounts and price snapshot at the database", async () => {
    const variantId = await simple({}, 1);
    const sale = (await pos(cashier, { lines: [{ variantId, quantity: 1 }] })).body.data;
    await expect(prisma.salesOrder.update({ where: { id: sale.id }, data: { grandTotal: 1 } })).rejects.toThrow(/can no longer change/);
    await expect(prisma.salesOrderLine.update({ where: { id: sale.lines[0].id }, data: { unitPrice: 1 } })).rejects.toThrow(/locked/);
    await expect(prisma.salesOrderEvent.deleteMany({ where: { orderId: sale.id } })).rejects.toThrow();
    // A later list-price change leaves the sale untouched.
    await api().patch(`/api/v1/variants/${variantId}`).set(admin.auth).send({ regularPrice: "1500" });
    expect((await api().get(`/api/v1/sales/${sale.id}`).set(admin.auth)).body.data.lines[0].unitPrice).toBe("1000.00");
  });

  it("hides cost and profit from cashiers", async () => {
    const variantId = await simple({}, 1);
    const sale = await pos(cashier, { lines: [{ variantId, quantity: 1 }] });
    expect(sale.body.data.profit).toBeUndefined();
    expect(sale.body.data.lines[0].cogs).toBeUndefined();
    const summary = await api().get("/api/v1/sales/summary").query({ from: today(), to: today() }).set(cashier.auth);
    expect(summary.body.data.grossProfit).toBeUndefined();
  });

  it("counts revenue only once an order is fulfilled", async () => {
    const summary = async () => (await api().get("/api/v1/sales/summary").query({ from: today(), to: today() }).set(admin.auth)).body.data;
    const variantId = await simple({}, 2);
    const before = await summary();
    const confirmed = await order(admin, {
      customerId: await customer(),
      fulfilment: "DELIVERY",
      confirm: true,
      lines: [{ variantId, quantity: 2 }],
    });
    expect((await summary()).grossSales).toBe(before.grossSales);
    await api().post(`/api/v1/sales/${confirmed.body.data.id}/fulfil`).set(admin.auth);
    const after = await summary();
    expect(Number(after.grossSales) - Number(before.grossSales)).toBe(2000);
    expect(after.orders - before.orders).toBe(1);
  });

  it("leaves unknown-cost units out of profit instead of guessing", async () => {
    const variantId = await simple({}, 2, null);
    const sale = await pos(admin, { lines: [{ variantId, quantity: 1 }] });
    expect(sale.body.data.lines[0]).toMatchObject({ cogs: "0.00", unknownCostQty: 1 });
    expect(sale.body.data.profit).toMatchObject({ unknownCostUnits: 1, netSales: "0.00", grossProfit: "0.00" });
  });

  it("keeps operations staff off the till", async () => {
    const variantId = await simple({}, 1);
    expect((await pos(ops, { lines: [{ variantId, quantity: 1 }] })).status).toBe(403);
    expect((await api().get("/api/v1/sales").set(ops.auth)).status).toBe(200);
  });

  it("shows order totals on the customer and moves orders when customers merge", async () => {
    const variantId = await simple({}, 3);
    const [keep, dup] = await Promise.all([customer(), customer()]);
    await pos(cashier, { customerId: dup, lines: [{ variantId, quantity: 1 }] });
    await pos(cashier, { customerId: keep, lines: [{ variantId, quantity: 1 }] });
    const merged = await api().post(`/api/v1/customers/${dup}/merge`).set(admin.auth).send({ intoId: keep, reason: "Same person" });
    expect(merged.body.data.stats).toMatchObject({ orders: 2, lifetimeValue: "2000.00", lastOrderDate: today() });
    const list = await api().get("/api/v1/sales").query({ customerId: keep }).set(admin.auth);
    expect(list.body.data.total).toBe(2);
  });
});
