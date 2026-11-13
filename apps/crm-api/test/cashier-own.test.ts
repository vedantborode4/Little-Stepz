import { randomInt, randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashierA: TestSession;
let cashierB: TestSession;
let categoryId: string;
let store: string;
let cash: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const range = () => ({ from: today(), to: today() });

beforeAll(async () => {
  [admin, cashierA, cashierB] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER"), sessionAs("CASHIER")]);
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Own ${uid()}` })
  ).body.data.id;
  store = (
    await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `OW${uid()}`, name: "Own store", type: "STORE" })
  ).body.data.id;
  cash = (
    await api()
      .post("/api/v1/settings/receiving-accounts")
      .set(admin.auth)
      .send({ name: `Till ${uid()}`, method: "CASH" })
  ).body.data.id;
});

/** ₹118 incl. 18% GST at a ₹50 cost: ₹50 of gross profit per unit. */
async function item(stock = 20) {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Own item ${uid()}`, categoryId, gstRate: "18", variants: [{ sku: `OW-${uid()}`, regularPrice: "118" }] });
  const variantId = res.body.data.variants[0].id as string;
  await api()
    .post("/api/v1/inventory/opening")
    .set(admin.auth)
    .send({ locationId: store, lines: [{ variantId, quantity: stock, unitCost: "50" }] });
  return variantId;
}

async function posSale(session: TestSession, variantId: string, salespersonId: string | null = null) {
  const res = await api()
    .post("/api/v1/sales/pos")
    .set(session.auth)
    .send({
      locationId: store,
      idempotencyKey: randomUUID(),
      lines: [{ variantId, quantity: 1 }],
      payments: [{ accountId: cash, amount: "118.00" }],
      salespersonId,
    });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; code: string; payments: { code: string }[] };
}

async function customer() {
  const res = await api()
    .post("/api/v1/customers")
    .set(admin.auth)
    .send({ name: `Buyer ${uid()}`, mobile: `9${String(randomInt(0, 1e9)).padStart(9, "0")}` });
  return res.body.data.id as string;
}

/** A confirmed delivery order with an advance taken by the same cashier. */
async function orderWithAdvance(session: TestSession) {
  const v = await item();
  const buyer = await customer();
  const created = await api()
    .post("/api/v1/sales")
    .set(session.auth)
    .send({
      locationId: store,
      channel: "WHATSAPP",
      customerId: buyer,
      fulfilment: "DELIVERY",
      confirm: true,
      lines: [{ variantId: v, quantity: 2 }],
    });
  expect(created.status).toBe(201);
  const order = created.body.data as { id: string; code: string };
  const paid = await api()
    .post("/api/v1/payments")
    .set(session.auth)
    .send({ customerId: buyer, accountId: cash, amount: "100", allocations: [{ orderId: order.id, amount: "100" }] });
  expect(paid.status).toBe(201);
  return { order, buyer, payment: paid.body.data as { id: string; code: string } };
}

const codes = async (session: TestSession, path: string, query: Record<string, string> = {}) =>
  (
    (
      await api()
        .get(path)
        .query({ pageSize: 100, ...query })
        .set(session.auth)
    ).body.data.items as { code: string }[]
  ).map((r) => r.code);

describe("a cashier's payments pages show only their own", () => {
  it("lists and opens only payments they recorded; the admin sees all", async () => {
    const mine = await orderWithAdvance(cashierA);
    const theirs = await orderWithAdvance(cashierB);

    expect(await codes(cashierA, "/api/v1/payments", { q: mine.payment.code })).toEqual([mine.payment.code]);
    expect(await codes(cashierA, "/api/v1/payments", { q: theirs.payment.code })).toEqual([]);
    expect((await api().get(`/api/v1/payments/${theirs.payment.id}`).set(cashierA.auth)).status).toBe(404);
    expect((await api().get(`/api/v1/payments/${mine.payment.id}`).set(cashierA.auth)).status).toBe(200);
    expect(await codes(admin, "/api/v1/payments", { q: theirs.payment.code })).toEqual([theirs.payment.code]);
  });

  it("shows advances and outstanding only on orders they created", async () => {
    const mine = await orderWithAdvance(cashierA);
    const theirs = await orderWithAdvance(cashierB);
    for (const path of ["/api/v1/payments/advances", "/api/v1/payments/outstanding"]) {
      expect(await codes(cashierA, path, { q: mine.order.code })).toEqual([mine.order.code]);
      expect(await codes(cashierA, path, { q: theirs.order.code })).toEqual([]);
      expect(await codes(admin, path, { q: theirs.order.code })).toEqual([theirs.order.code]);
    }
  });

  it("totals collections and advances from their own payments only", async () => {
    const solo = await sessionAs("CASHIER");
    const v = await item();
    await posSale(solo, v);
    await posSale(solo, v);
    await posSale(cashierB, v);
    const c = (await api().get("/api/v1/payments/collections").query(range()).set(solo.auth)).body.data;
    expect(c.totals).toMatchObject({ payments: 2, received: "236.00" });

    await orderWithAdvance(solo);
    const advances = (await api().get("/api/v1/payments/advances/summary").set(solo.auth)).body.data;
    expect(advances).toMatchObject({ orders: 1, total: "100.00" });
  });

  it("keeps transfers from cashiers and refuses money for another cashier's order", async () => {
    expect((await api().get("/api/v1/payments/transfers").set(cashierA.auth)).status).toBe(403);
    expect((await api().get("/api/v1/payments/transfers").set(admin.auth)).status).toBe(200);

    const theirs = await orderWithAdvance(cashierB);
    const res = await api()
      .post("/api/v1/payments")
      .set(cashierA.auth)
      .send({ customerId: theirs.buyer, accountId: cash, amount: "50", allocations: [{ orderId: theirs.order.id, amount: "50" }] });
    expect(res.status).toBe(404);
  });
});

describe("my commission", () => {
  async function salesperson(rate: string, userId?: string) {
    const res = await api()
      .post("/api/v1/salespeople")
      .set(admin.auth)
      .send({ name: `Seller ${uid()}`, commissionRate: rate, userId });
    return res;
  }

  it("links a login to one salesperson only, and marks it at the till", async () => {
    const cashier = await sessionAs("CASHIER");
    const linked = await salesperson("10", cashier.userId);
    expect(linked.status).toBe(201);
    expect(linked.body.data.user).toMatchObject({ id: cashier.userId });

    const again = await salesperson("10", cashier.userId);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("LOGIN_TAKEN");

    const options = (await api().get("/api/v1/salespeople/options").set(cashier.auth)).body.data as { id: string; isMine: boolean }[];
    expect(options.filter((o) => o.isMine).map((o) => o.id)).toEqual([linked.body.data.id]);

    const unlinked = await api().patch(`/api/v1/salespeople/${linked.body.data.id}`).set(admin.auth).send({ userId: "" });
    expect(unlinked.body.data.user).toBeNull();
    expect((await salesperson("10", cashier.userId)).status).toBe(201);
  });

  it("shows a cashier their own commission without sale value or profit, and the admin what to pay", async () => {
    const cashier = await sessionAs("CASHIER");
    const p = (await salesperson("10", cashier.userId)).body.data as { id: string };
    const v = await item();
    const first = await posSale(cashier, v, p.id);
    await posSale(cashierB, v, p.id);

    const me = (await api().get("/api/v1/commission/me").query(range()).set(cashier.auth)).body.data;
    expect(me.salesperson).toMatchObject({ id: p.id, commissionRate: "10" });
    expect(me.totals).toEqual({ sales: 2, earned: "10.00", returned: "0.00", net: "10.00", paid: "0.00", owed: "10.00" });
    expect(me.entries).toHaveLength(2);
    expect(me.entries[0]).toEqual({
      kind: "SALE",
      date: today(),
      orderCode: expect.any(String),
      returnCode: null,
      rate: "10",
      commission: "5.00",
    });
    expect(JSON.stringify(me)).not.toMatch(/profit|value|cogs/i);
    expect(me.entries.map((e: { orderCode: string }) => e.orderCode)).toContain(first.code);

    const payout = await api()
      .post("/api/v1/commission/payouts")
      .set(admin.auth)
      .send({ salespersonId: p.id, accountId: cash, amount: "6", reference: "This week" });
    expect(payout.status).toBe(201);
    const after = (await api().get("/api/v1/commission/me").query(range()).set(cashier.auth)).body.data;
    expect(after.totals).toMatchObject({ paid: "6.00", owed: "4.00" });
    expect(after.payouts).toEqual([expect.objectContaining({ amount: "6.00", reference: "This week" })]);

    const history = (await api().get("/api/v1/commission/payouts").query(range()).set(admin.auth)).body.data as { id: string }[];
    expect(history.map((x) => x.id)).toContain(payout.body.data.id);
    expect((await api().get("/api/v1/commission/payouts").query(range()).set(cashier.auth)).status).toBe(403);
  });

  it("tells an unlinked cashier they have no commission", async () => {
    const me = (await api().get("/api/v1/commission/me").query(range()).set(cashierA.auth)).body.data;
    expect(me).toMatchObject({ salesperson: null, entries: [], payouts: [], totals: { owed: "0.00" } });
  });
});
