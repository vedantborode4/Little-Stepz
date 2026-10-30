import { randomInt, randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { dec } from "../src/core/money";
import { returnLineAmounts } from "../src/modules/returns/return-maths";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashier: TestSession;
let categoryId: string;
let store: string;
let cash: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

beforeAll(async () => {
  [admin, cashier] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER")]);
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Ret ${uid()}` })
  ).body.data.id;
  store = (
    await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `RT${uid()}`, name: "Return store", type: "STORE" })
  ).body.data.id;
  cash = (
    await api()
      .post("/api/v1/settings/receiving-accounts")
      .set(admin.auth)
      .send({ name: `Cash ${uid()}`, method: "CASH" })
  ).body.data.id;
});

async function item(price: string, stock = 10, unitCost = "500") {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Ret item ${uid()}`, categoryId, gstRate: "18", variants: [{ sku: `R-${uid()}`, regularPrice: price }] });
  const variantId = res.body.data.variants[0].id as string;
  await api()
    .post("/api/v1/inventory/opening")
    .set(admin.auth)
    .send({ locationId: store, lines: [{ variantId, quantity: stock, unitCost }] });
  return variantId;
}

async function customer() {
  const res = await api()
    .post("/api/v1/customers")
    .set(admin.auth)
    .send({ name: `Returner ${uid()}`, mobile: `6${String(randomInt(0, 1e9)).padStart(9, "0")}` });
  return res.body.data.id as string;
}

/** A completed POS sale; walk-ins pay the quoted total in cash unless `payments` is given. */
async function sale(lines: { variantId: string; quantity: number }[], extra: Record<string, unknown> = {}) {
  const body: Record<string, unknown> = { locationId: store, channel: "STORE", idempotencyKey: randomUUID(), lines, ...extra };
  if (!("payments" in extra) && !extra.customerId) {
    const quote = await api().post("/api/v1/sales/quote").set(admin.auth).send(body);
    body.payments = [{ accountId: cash, amount: quote.body.data.totals.grandTotal }];
  }
  const res = await api().post("/api/v1/sales/pos").set(admin.auth).send(body);
  expect(res.status).toBe(201);
  return res.body.data as { id: string; code: string; lines: { id: string; variantId: string }[]; grandTotal: string };
}

const lineOf = (s: { lines: { id: string; variantId: string }[] }, variantId: string) => s.lines.find((l) => l.variantId === variantId)!.id;
const stock = async (variantId: string) => (await api().get(`/api/v1/inventory/variants/${variantId}`).set(admin.auth)).body.data.stock;
const order = async (id: string) => (await api().get(`/api/v1/sales/${id}`).set(admin.auth)).body.data;
const ret = (orderId: string, body: Record<string, unknown>, session = admin) =>
  api()
    .post(`/api/v1/sales/${orderId}/returns`)
    .set(session.auth)
    .send({ reason: "Customer return", ...body });
const summary = async () => (await api().get("/api/v1/sales/summary").query({ from: today(), to: today() }).set(admin.auth)).body.data;

describe("return maths (pure)", () => {
  it("reverses a line in parts that add up exactly, known-cost units first", () => {
    const sold = { sku: "X", quantity: 3, lineTotal: dec(100), taxableValue: dec(84.75), cogs: dec(100), unknownCostQty: 1 };
    const prior = { quantity: 0, amount: dec(0), taxableValue: dec(0), cogs: dec(0), knownQty: 0 };
    const first = returnLineAmounts(sold, prior, 1);
    expect([first.amount.toFixed(2), first.taxableValue.toFixed(2), first.cogs.toFixed(2), first.knownQty]).toEqual([
      "33.33",
      "28.25",
      "50.00",
      1,
    ]);
    const second = returnLineAmounts(
      sold,
      { quantity: 1, amount: first.amount, taxableValue: first.taxableValue, cogs: first.cogs, knownQty: 1 },
      2,
    );
    expect([second.amount.toFixed(2), second.taxableValue.toFixed(2), second.cogs.toFixed(2), second.unknownCostQty]).toEqual([
      "66.67",
      "56.50",
      "50.00",
      1,
    ]);
    expect(() =>
      returnLineAmounts(sold, { quantity: 3, amount: dec(100), taxableValue: dec(84.75), cogs: dec(100), knownQty: 2 }, 1),
    ).toThrow(/can still be returned/);
  });
});

describe("Scenario J — a refunded return updates payments, sales and stock by condition", () => {
  it("restocks the resellable item, moves the damaged one aside, refunds the money and nets the sales", async () => {
    const [good, broken] = [await item("1180"), await item("590")];
    const s = await sale([
      { variantId: good, quantity: 1 },
      { variantId: broken, quantity: 1 },
    ]);
    const before = await summary();

    const preview = await api()
      .post(`/api/v1/sales/${s.id}/returns/preview`)
      .set(admin.auth)
      .send({
        lines: [
          { orderLineId: lineOf(s, good), quantity: 1, condition: "RESELLABLE" },
          { orderLineId: lineOf(s, broken), quantity: 1, condition: "DAMAGED" },
        ],
      });
    expect(preview.body.data).toMatchObject({
      amount: "1770.00",
      taxableValue: "1500.00",
      netValueAfter: "0.00",
      paid: "1770.00",
      refundDue: "1770.00",
    });

    const lines = [
      { orderLineId: lineOf(s, good), quantity: 1, condition: "RESELLABLE" },
      { orderLineId: lineOf(s, broken), quantity: 1, condition: "DAMAGED" },
    ];
    expect((await ret(s.id, { lines })).body.error.code).toBe("REFUND_CHOICE_REQUIRED");
    expect((await ret(s.id, { lines, refund: { method: "REFUND", accountId: cash } }, cashier)).status).toBe(403);
    const created = await ret(s.id, { lines, refund: { method: "REFUND", accountId: cash, reference: "CASH-BACK" } });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      code: expect.stringMatching(/^RET-\d{5}$/),
      refundMethod: "REFUND",
      refundAmount: "1770.00",
      refundPayment: expect.objectContaining({ code: expect.stringMatching(/^PAY-/) }),
      stockDocument: expect.objectContaining({ code: expect.stringMatching(/^STK-/) }),
    });

    expect(await stock(good)).toMatchObject({ physical: 10, sellable: 10, damaged: 0 });
    expect(await stock(broken)).toMatchObject({ physical: 10, sellable: 9, damaged: 1 });

    const o = await order(s.id);
    expect(o).toMatchObject({ returned: "1770.00", paid: "0.00", due: "0.00", paymentStatus: "REFUNDED" });
    expect(o.lines.map((l: { returnedQty: number }) => l.returnedQty)).toEqual([1, 1]);
    expect(o.profit).toMatchObject({ netSales: "0.00", cogs: "0.00", grossProfit: "0.00" });

    const after = await summary();
    expect(Number(after.returns) - Number(before.returns)).toBe(1770);
    expect(Number(before.netSales) - Number(after.netSales)).toBeCloseTo(1500, 2);
    expect(Number(before.cogs) - Number(after.cogs)).toBeCloseTo(1000, 2);

    const refund = await prisma.payment.findUniqueOrThrow({ where: { id: created.body.data.refundPayment.id } });
    expect(refund).toMatchObject({ direction: "OUT", accountId: cash });
    await expect(prisma.salesReturn.update({ where: { id: created.body.data.id }, data: { reason: "x" } })).rejects.toThrow();
  });
});

describe("return rules", () => {
  it("returns a line over several goes but never more than was sold", async () => {
    const v = await item("100");
    const s = await sale([{ variantId: v, quantity: 3 }]);
    const line = lineOf(s, v);
    const settle = { refund: { method: "REFUND", accountId: cash } };
    expect((await ret(s.id, { lines: [{ orderLineId: line, quantity: 1, condition: "RESELLABLE" }], ...settle })).body.data.amount).toBe(
      "100.00",
    );
    expect((await ret(s.id, { lines: [{ orderLineId: line, quantity: 2, condition: "RESELLABLE" }], ...settle })).body.data.amount).toBe(
      "200.00",
    );
    const over = await ret(s.id, { lines: [{ orderLineId: line, quantity: 1, condition: "RESELLABLE" }], ...settle });
    expect(over.body.error.code).toBe("OVER_RETURN");
    expect((await order(s.id)).returned).toBe("300.00");
  });

  it("lets an unpaid credit sale simply owe less, with nothing refunded", async () => {
    const v = await item("1000");
    const buyer = await customer();
    const s = await sale([{ variantId: v, quantity: 2 }], { customerId: buyer, payments: [] });
    const res = await ret(s.id, { lines: [{ orderLineId: lineOf(s, v), quantity: 1, condition: "RESELLABLE" }] });
    expect(res.body.data).toMatchObject({ refundMethod: "NONE", refundAmount: "0.00", amount: "1000.00" });
    expect(await order(s.id)).toMatchObject({ due: "1000.00", paymentStatus: "UNPAID" });
    const outstanding = await api().get("/api/v1/payments/outstanding").query({ customerId: buyer }).set(admin.auth);
    expect(outstanding.body.data.items[0]).toMatchObject({ grandTotal: "1000.00", due: "1000.00" });
  });

  it("gives back only what was paid beyond the new value, as credit", async () => {
    const v = await item("1000");
    const buyer = await customer();
    const s = await sale([{ variantId: v, quantity: 3 }], { customerId: buyer, payments: [{ accountId: cash, amount: "2500" }] });
    const res = await ret(s.id, {
      lines: [{ orderLineId: lineOf(s, v), quantity: 1, condition: "RESELLABLE" }],
      refund: { method: "CREDIT" },
    });
    expect(res.body.data).toMatchObject({ refundMethod: "CREDIT", refundAmount: "500.00" });
    expect(await order(s.id)).toMatchObject({ returned: "1000.00", paid: "2000.00", due: "0.00", paymentStatus: "PAID" });
    expect((await api().get(`/api/v1/payments/credit/${buyer}`).set(admin.auth)).body.data).toMatchObject({
      balance: "500.00",
      entries: [expect.objectContaining({ type: "RETURN" })],
    });
  });

  it("writes off a unit without restocking it, so its cost stays a loss", async () => {
    const v = await item("1180", 5, "400");
    const s = await sale([{ variantId: v, quantity: 2 }]);
    const res = await ret(s.id, {
      lines: [{ orderLineId: lineOf(s, v), quantity: 1, condition: "WRITE_OFF" }],
      refund: { method: "REFUND", accountId: cash },
    });
    expect(res.body.data.stockDocument).toBeNull();
    expect(await stock(v)).toMatchObject({ physical: 3 });
    expect((await order(s.id)).profit).toMatchObject({ netSales: "1000.00", cogs: "800.00", grossProfit: "200.00" });
  });

  it("only takes returns on orders that have left stock, and caps shipping refunds", async () => {
    const v = await item("1000");
    const buyer = await customer();
    const open = await api()
      .post("/api/v1/sales")
      .set(admin.auth)
      .send({
        locationId: store,
        channel: "WHATSAPP",
        fulfilment: "DELIVERY",
        customerId: buyer,
        shippingCharged: "100",
        confirm: true,
        lines: [{ variantId: v, quantity: 1 }],
      });
    const early = await ret(open.body.data.id, {
      lines: [{ orderLineId: open.body.data.lines[0].id, quantity: 1, condition: "RESELLABLE" }],
    });
    expect(early.body.error.code).toBe("NOT_FULFILLED");

    await api().post(`/api/v1/sales/${open.body.data.id}/fulfil`).set(admin.auth);
    const tooMuch = await ret(open.body.data.id, {
      lines: [{ orderLineId: open.body.data.lines[0].id, quantity: 1, condition: "RESELLABLE" }],
      shippingRefund: "150",
    });
    expect(tooMuch.body.error.code).toBe("OVER_REFUND_SHIPPING");
    const ok = await ret(open.body.data.id, {
      lines: [{ orderLineId: open.body.data.lines[0].id, quantity: 1, condition: "RESELLABLE" }],
      shippingRefund: "100",
    });
    expect(ok.body.data).toMatchObject({ amount: "1100.00", shippingRefund: "100.00", refundMethod: "NONE" });
    expect(await order(open.body.data.id)).toMatchObject({ returned: "1100.00", due: "0.00" });
  });
});

describe("exchanges", () => {
  it("returns to credit, then pays a new POS sale from that credit", async () => {
    const [old, replacement] = [await item("800"), await item("1000")];
    const buyer = await customer();
    const first = await sale([{ variantId: old, quantity: 1 }], { customerId: buyer, payments: [{ accountId: cash, amount: "800" }] });
    await ret(first.id, {
      lines: [{ orderLineId: lineOf(first, old), quantity: 1, condition: "RESELLABLE" }],
      refund: { method: "CREDIT" },
    });

    const walkIn = await api()
      .post("/api/v1/sales/pos")
      .set(cashier.auth)
      .send({ locationId: store, idempotencyKey: randomUUID(), lines: [{ variantId: replacement, quantity: 1 }], creditAmount: "800" });
    expect(walkIn.body.error.code).toBe("CUSTOMER_REQUIRED");

    const exchange = await api()
      .post("/api/v1/sales/pos")
      .set(cashier.auth)
      .send({
        locationId: store,
        idempotencyKey: randomUUID(),
        customerId: buyer,
        lines: [{ variantId: replacement, quantity: 1 }],
        creditAmount: "800",
        payments: [{ accountId: cash, amount: "200" }],
      });
    expect(exchange.body.data).toMatchObject({ paid: "1000.00", paymentStatus: "PAID" });
    expect(exchange.body.data.payments.map((p: { source: string }) => p.source)).toEqual(["CREDIT", "PAYMENT"]);
    expect((await api().get(`/api/v1/payments/credit/${buyer}`).set(admin.auth)).body.data.balance).toBe("0.00");
    const profile = await api().get(`/api/v1/customers/${buyer}`).set(admin.auth);
    expect(profile.body.data.stats.lifetimeValue).toBe("1000.00");
  });

  it("lists returns and lets cashiers see them but not create them", async () => {
    const v = await item("500");
    const s = await sale([{ variantId: v, quantity: 1 }]);
    expect((await ret(s.id, { lines: [{ orderLineId: lineOf(s, v), quantity: 1, condition: "RESELLABLE" }] }, cashier)).status).toBe(403);
    await ret(s.id, {
      lines: [{ orderLineId: lineOf(s, v), quantity: 1, condition: "RESELLABLE" }],
      refund: { method: "REFUND", accountId: cash },
    });
    const list = await api().get("/api/v1/returns").query({ q: s.code }).set(cashier.auth);
    expect(list.body.data.items).toEqual([expect.objectContaining({ orderCode: s.code, units: 1, amount: "500.00" })]);
  });
});
