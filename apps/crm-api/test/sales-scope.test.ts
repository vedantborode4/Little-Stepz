import { randomInt, randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let ops: TestSession;
let cashierA: TestSession;
let cashierB: TestSession;
let categoryId: string;
let store: string;
let cash: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

beforeAll(async () => {
  [admin, ops, cashierA, cashierB] = await Promise.all([sessionAs("ADMIN"), sessionAs("OPS"), sessionAs("CASHIER"), sessionAs("CASHIER")]);
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Scope ${uid()}` })
  ).body.data.id;
  store = (
    await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `SC${uid()}`, name: "Scope store", type: "STORE" })
  ).body.data.id;
  cash = (
    await api()
      .post("/api/v1/settings/receiving-accounts")
      .set(admin.auth)
      .send({ name: `Till ${uid()}`, method: "CASH" })
  ).body.data.id;
});

/** ₹1,180 incl. 18% GST. */
async function item(stock = 20) {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Scope item ${uid()}`, categoryId, gstRate: "18", variants: [{ sku: `SC-${uid()}`, regularPrice: "1180" }] });
  const variantId = res.body.data.variants[0].id as string;
  await api()
    .post("/api/v1/inventory/opening")
    .set(admin.auth)
    .send({ locationId: store, lines: [{ variantId, quantity: stock, unitCost: "500" }] });
  return variantId;
}

async function posSale(session: TestSession, variantId: string) {
  const res = await api()
    .post("/api/v1/sales/pos")
    .set(session.auth)
    .send({
      locationId: store,
      idempotencyKey: randomUUID(),
      lines: [{ variantId, quantity: 1 }],
      payments: [{ accountId: cash, amount: "1180.00" }],
    });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; code: string; lines: { id: string }[] };
}

async function customer() {
  const res = await api()
    .post("/api/v1/customers")
    .set(admin.auth)
    .send({ name: `Buyer ${uid()}`, mobile: `9${String(randomInt(0, 1e9)).padStart(9, "0")}` });
  return res.body.data.id as string;
}

async function order(session: TestSession, body: Record<string, unknown>) {
  const res = await api()
    .post("/api/v1/sales")
    .set(session.auth)
    .send({ locationId: store, channel: "WHATSAPP", confirm: true, ...body });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; code: string };
}

const codes = async (session: TestSession, path: string, q?: string) =>
  ((await api().get(path).query({ q, pageSize: 100 }).set(session.auth)).body.data.items as { code: string; orderCode?: string }[]).map(
    (r) => r.orderCode ?? r.code,
  );

describe("a cashier sees only their own sales", () => {
  it("lists and opens only their own sales; admin and ops see everyone's", async () => {
    const v = await item();
    const mine = await posSale(cashierA, v);
    const theirs = await posSale(cashierB, v);

    expect(await codes(cashierA, "/api/v1/sales", mine.code)).toEqual([mine.code]);
    expect(await codes(cashierA, "/api/v1/sales", theirs.code)).toEqual([]);
    expect((await api().get(`/api/v1/sales/${mine.id}`).set(cashierA.auth)).status).toBe(200);
    expect((await api().get(`/api/v1/sales/${theirs.id}`).set(cashierA.auth)).status).toBe(404);

    for (const session of [admin, ops]) {
      expect(await codes(session, "/api/v1/sales", theirs.code)).toEqual([theirs.code]);
      expect((await api().get(`/api/v1/sales/${theirs.id}`).set(session.auth)).status).toBe(200);
    }
  });

  it("counts only their own sales in the summary", async () => {
    const solo = await sessionAs("CASHIER");
    const v = await item();
    await posSale(solo, v);
    await posSale(solo, v);
    await posSale(cashierB, v);
    const summary = (await api().get("/api/v1/sales/summary").query({ from: today(), to: today() }).set(solo.auth)).body.data;
    expect(summary).toMatchObject({ orders: 2, grossSales: "2360.00" });
  });

  it("lets any cashier find and hand over an open counter order, and hides it again once it's handed over", async () => {
    const v = await item();
    const pickup = await order(cashierA, { lines: [{ variantId: v, quantity: 1 }] });
    expect(await codes(cashierB, "/api/v1/sales", pickup.code)).toEqual([pickup.code]);

    const paid = await api()
      .post("/api/v1/payments")
      .set(cashierB.auth)
      .send({ accountId: cash, amount: "1180.00", allocations: [{ orderId: pickup.id, amount: "1180.00" }] });
    expect(paid.status).toBe(201);
    const handed = await api().post(`/api/v1/sales/${pickup.id}/fulfil`).set(cashierB.auth);
    expect(handed.body.data.status).toBe("COMPLETED");

    expect(await codes(cashierB, "/api/v1/sales", pickup.code)).toEqual([]);
    expect((await api().get(`/api/v1/sales/${pickup.id}`).set(cashierB.auth)).status).toBe(404);
    expect(await codes(cashierA, "/api/v1/sales", pickup.code)).toEqual([pickup.code]);
  });

  it("hides another cashier's drafts and delivery orders, including from actions", async () => {
    const v = await item();
    const buyer = await customer();
    const draft = await order(cashierA, { confirm: false, lines: [{ variantId: v, quantity: 1 }] });
    const delivery = await order(cashierA, { customerId: buyer, fulfilment: "DELIVERY", lines: [{ variantId: v, quantity: 1 }] });

    for (const o of [draft, delivery]) expect(await codes(cashierB, "/api/v1/sales", o.code)).toEqual([]);
    expect((await api().post(`/api/v1/sales/${draft.id}/confirm`).set(cashierB.auth)).status).toBe(404);
    expect(
      (await api().put(`/api/v1/sales/${delivery.id}/expected-arrival`).set(cashierB.auth).send({ expectedArrival: today() })).status,
    ).toBe(404);
    expect((await api().post(`/api/v1/sales/${draft.id}/confirm`).set(cashierA.auth)).status).toBe(200);
  });

  it("shows only returns on their own sales, and keeps shipments for ops and admin", async () => {
    const v = await item();
    const mine = await posSale(cashierA, v);
    const back = await api()
      .post(`/api/v1/sales/${mine.id}/returns`)
      .set(admin.auth)
      .send({
        reason: "Changed mind",
        lines: [{ orderLineId: mine.lines[0]!.id, quantity: 1, condition: "RESELLABLE" }],
        refund: { method: "REFUND", accountId: cash },
      });
    expect(back.status).toBe(201);

    expect(await codes(cashierA, "/api/v1/returns", mine.code)).toEqual([mine.code]);
    expect(await codes(cashierB, "/api/v1/returns", mine.code)).toEqual([]);
    expect((await api().get(`/api/v1/returns/${back.body.data.id}`).set(cashierB.auth)).status).toBe(404);
    expect((await api().get(`/api/v1/returns/${back.body.data.id}`).set(cashierA.auth)).status).toBe(200);

    expect((await api().get("/api/v1/shipments").set(cashierA.auth)).status).toBe(403);
    expect((await api().get("/api/v1/shipments").set(ops.auth)).status).toBe(200);
  });
});
