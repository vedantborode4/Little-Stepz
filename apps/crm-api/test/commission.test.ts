import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { dec } from "../src/core/money";
import { commissionEntries, totalEntries, type CommissionLine, type CommissionReturn } from "../src/modules/commission/commission-maths";
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
      .send({ name: `Com ${uid()}` })
  ).body.data.id;
  store = (
    await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `CM${uid()}`, name: "Commission store", type: "STORE" })
  ).body.data.id;
  cash = (
    await api()
      .post("/api/v1/settings/receiving-accounts")
      .set(admin.auth)
      .send({ name: `Cash ${uid()}`, method: "CASH" })
  ).body.data.id;
});

/** ₹118 incl. 18% GST at a ₹50 cost: ₹100 of goods value and ₹50 of gross profit per unit. */
async function item(stock = 20) {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Com item ${uid()}`, categoryId, gstRate: "18", variants: [{ sku: `CM-${uid()}`, regularPrice: "118" }] });
  const variantId = res.body.data.variants[0].id as string;
  await api()
    .post("/api/v1/inventory/opening")
    .set(admin.auth)
    .send({ locationId: store, lines: [{ variantId, quantity: stock, unitCost: "50" }] });
  return variantId;
}

async function salesperson(rate: string) {
  const res = await api()
    .post("/api/v1/salespeople")
    .set(admin.auth)
    .send({ name: `Seller ${uid()}`, commissionRate: rate });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; staffCode: string; commissionRate: string };
}

async function sale(variantId: string, quantity: number, salespersonId: string | null, session = admin) {
  const res = await api()
    .post("/api/v1/sales/pos")
    .set(session.auth)
    .send({
      locationId: store,
      idempotencyKey: randomUUID(),
      lines: [{ variantId, quantity }],
      payments: [{ accountId: cash, amount: (118 * quantity).toFixed(2) }],
      salespersonId,
    });
  return res;
}

const detail = async (id: string) =>
  (await api().get(`/api/v1/commission/salespeople/${id}`).query({ from: today(), to: today() }).set(admin.auth)).body.data;

const giveBack = (orderId: string, orderLineId: string, quantity: number) =>
  api()
    .post(`/api/v1/sales/${orderId}/returns`)
    .set(admin.auth)
    .send({
      reason: "Customer return",
      lines: [{ orderLineId, quantity, condition: "RESELLABLE" }],
      refund: { method: "REFUND", accountId: cash },
    });

describe("commission maths (pure)", () => {
  const order = (lines: CommissionLine[], returns: CommissionReturn[] = [], rate = "10") => ({
    id: "o",
    code: "SO-1",
    salespersonId: "p",
    rate: dec(rate),
    fulfilledDate: "2026-11-01",
    lines,
    returns,
  });
  const line = (quantity: number, taxable: string, cogs: string, unknownCostQty = 0): CommissionLine => ({
    id: "l1",
    quantity,
    taxable: dec(taxable),
    cogs: dec(cogs),
    unknownCostQty,
  });
  const giveBack = (i: number, quantity: number, cogs: string, unknownCostQty = 0): CommissionReturn => ({
    id: `r${i}`,
    code: `RET-${i}`,
    businessDate: "2026-11-02",
    createdAt: new Date(i),
    lines: [{ orderLineId: "l1", quantity, cogs: dec(cogs), unknownCostQty }],
  });

  it("pays the rate on gross profit and takes it back to exactly zero over awkward partial returns", () => {
    const entries = commissionEntries(
      order([line(3, "100.01", "30.00")], [giveBack(1, 1, "10.00"), giveBack(2, 1, "10.00"), giveBack(3, 1, "10.00")], "3.33"),
    );
    expect(entries[0]).toMatchObject({ kind: "SALE" });
    expect(entries[0]!.profit.toFixed(2)).toBe("70.01");
    expect(entries[0]!.commission.toFixed(2)).toBe("2.33");
    expect(entries).toHaveLength(4);
    expect(totalEntries(entries).net.toFixed(2)).toBe("0.00");
    expect(totalEntries(entries).grossProfit.toFixed(2)).toBe("0.00");
  });

  it("earns nothing on a loss-making sale, and its return takes nothing back", () => {
    const entries = commissionEntries(order([line(1, "100.00", "120.00")], [giveBack(1, 1, "120.00")]));
    expect(entries.map((e) => e.commission.toFixed(2))).toEqual(["0.00", "0.00"]);
  });

  it("earns nothing on units without a cost and counts them", () => {
    const [sale] = commissionEntries(order([line(2, "200.00", "50.00", 1)]));
    expect(sale!.profit.toFixed(2)).toBe("50.00");
    expect(sale!.commission.toFixed(2)).toBe("5.00");
    expect(sale!.costMissingUnits).toBe(1);
  });

  it("earns nothing before the goods leave", () => {
    expect(commissionEntries({ ...order([line(1, "100.00", "0")]), fulfilledDate: null })).toEqual([]);
  });
});

describe("salespeople and who can see what", () => {
  it("lets the till pick a salesperson by name without ever seeing rates or earnings", async () => {
    const p = await salesperson("2.5");
    expect(p.staffCode).toMatch(/^S\d{2,}$/);

    const options = await api().get("/api/v1/salespeople/options").set(cashier.auth);
    expect(options.status).toBe(200);
    const mine = options.body.data.find((o: { id: string }) => o.id === p.id);
    expect(mine).toEqual({ id: p.id, staffCode: p.staffCode, name: expect.any(String) });

    expect((await api().get("/api/v1/salespeople").set(cashier.auth)).status).toBe(403);
    expect((await api().post("/api/v1/salespeople").set(cashier.auth).send({ name: "X", commissionRate: "1" })).status).toBe(403);
    expect((await api().get("/api/v1/commission").query({ from: today(), to: today() }).set(cashier.auth)).status).toBe(403);

    const v = await item();
    const sold = await sale(v, 1, p.id, cashier);
    expect(sold.status).toBe(201);
    expect(sold.body.data.salesperson).toMatchObject({ id: p.id, staffCode: p.staffCode });
    expect(sold.body.data).not.toHaveProperty("commissionRate");
    const asAdmin = (await api().get(`/api/v1/sales/${sold.body.data.id}`).set(admin.auth)).body.data;
    expect(asAdmin.commissionRate).toBe("2.5");
  });

  it("gives staff IDs in order, ignores a typed one, and refuses an inactive salesperson at checkout", async () => {
    const p = await salesperson("1");
    const next = await api().post("/api/v1/salespeople").set(admin.auth).send({ staffCode: "MINE", name: "Next", commissionRate: "1" });
    expect(next.status).toBe(201);
    expect(next.body.data.staffCode).toBe(`S${String(Number(p.staffCode.slice(1)) + 1).padStart(2, "0")}`);
    const renamed = await api().patch(`/api/v1/salespeople/${p.id}`).set(admin.auth).send({ staffCode: "MINE", name: "Renamed" });
    expect(renamed.body.data).toMatchObject({ staffCode: p.staffCode, name: "Renamed" });

    await api().patch(`/api/v1/salespeople/${p.id}`).set(admin.auth).send({ isActive: false });
    const res = await sale(await item(), 1, p.id);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_SALESPERSON");
  });
});

describe("Scenario — a salesperson's commission through a rate change, returns and a payout", () => {
  it("freezes the rate per sale, takes back returns exactly, and tracks what is owed", async () => {
    const p = await salesperson("2.5");
    const v = await item();

    const first = (await sale(v, 3, p.id)).body.data;
    await api().patch(`/api/v1/salespeople/${p.id}`).set(admin.auth).send({ commissionRate: "5" });
    const second = (await sale(v, 2, p.id)).body.data;
    expect((await sale(v, 1, null)).status).toBe(201);

    let d = await detail(p.id);
    expect(d.entries.map((e: { kind: string; rate: string; commission: string }) => [e.kind, e.rate, e.commission])).toEqual([
      ["SALE", "2.5", "3.75"],
      ["SALE", "5", "5.00"],
    ]);
    expect(d.totals).toMatchObject({
      sales: 2,
      salesValue: "500.00",
      grossProfit: "250.00",
      costMissingUnits: 0,
      earned: "8.75",
      returned: "0.00",
      net: "8.75",
      owed: "8.75",
    });

    // The first sale comes back in two goes: its whole 3.75 is taken back, nothing more.
    const line = first.lines[0].id as string;
    expect((await giveBack(first.id, line, 1)).status).toBe(201);
    expect((await giveBack(first.id, line, 2)).status).toBe(201);
    d = await detail(p.id);
    expect(d.totals).toMatchObject({ grossProfit: "100.00", earned: "8.75", returned: "3.75", net: "5.00", owed: "5.00" });

    const payout = await api()
      .post("/api/v1/commission/payouts")
      .set(admin.auth)
      .send({ salespersonId: p.id, accountId: cash, amount: "4", reference: "Nov" });
    expect(payout.status).toBe(201);
    expect(payout.body.data).toMatchObject({ amount: "4.00", category: { name: "Staff commission" }, salesperson: { id: p.id } });
    d = await detail(p.id);
    expect(d.totals).toMatchObject({ paid: "4.00", owed: "1.00" });
    expect(d.payouts).toHaveLength(1);

    const voided = await api().post(`/api/v1/expenses/${payout.body.data.id}/void`).set(admin.auth).send({ reason: "Wrong amount" });
    expect(voided.status).toBe(200);
    d = await detail(p.id);
    expect(d.totals).toMatchObject({ paid: "0.00", owed: "5.00" });

    const summary = (await api().get("/api/v1/commission").query({ from: today(), to: today() }).set(admin.auth)).body.data;
    expect(summary.rows.find((r: { salesperson: { id: string } }) => r.salesperson.id === p.id)).toMatchObject({
      net: "5.00",
      owed: "5.00",
    });
    expect(second.salesperson.id).toBe(p.id);
  });

  it("refuses a commission payout entered as an ordinary expense", async () => {
    const categories = (await api().get("/api/v1/expenses/categories").set(admin.auth)).body.data;
    const staff = categories.find((c: { name: string }) => c.name === "Staff commission");
    expect(staff).toBeDefined();
    const res = await api().post("/api/v1/expenses").set(admin.auth).send({ categoryId: staff.id, accountId: cash, amount: "10" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("USE_COMMISSION_PAYOUT");
  });
});

describe("orders, reassignment and cancellation", () => {
  it("earns only once an order is fulfilled, never when cancelled, and follows a reassignment", async () => {
    const a = await salesperson("10");
    const b = await salesperson("4");
    const v = await item();
    const create = (body: Record<string, unknown>) =>
      api()
        .post("/api/v1/sales")
        .set(admin.auth)
        .send({
          locationId: store,
          channel: "WHATSAPP",
          fulfilment: "COUNTER",
          confirm: true,
          lines: [{ variantId: v, quantity: 1 }],
          ...body,
        });

    const kept = (await create({ salespersonId: a.id })).body.data;
    const dropped = (await create({ salespersonId: a.id })).body.data;
    expect(kept.status).toBe("CONFIRMED");
    expect((await detail(a.id)).totals.sales).toBe(0);

    await api().post(`/api/v1/sales/${dropped.id}/cancel`).set(admin.auth).send({ reason: "Changed mind" });
    expect((await api().put(`/api/v1/sales/${dropped.id}/salesperson`).set(admin.auth).send({ salespersonId: b.id })).status).toBe(409);

    expect((await api().post(`/api/v1/sales/${kept.id}/fulfil`).set(admin.auth)).status).toBe(200);
    expect((await detail(a.id)).totals).toMatchObject({ sales: 1, earned: "5.00" });

    expect((await api().put(`/api/v1/sales/${kept.id}/salesperson`).set(cashier.auth).send({ salespersonId: b.id })).status).toBe(403);
    const moved = await api().put(`/api/v1/sales/${kept.id}/salesperson`).set(admin.auth).send({ salespersonId: b.id });
    expect(moved.status).toBe(200);
    expect(moved.body.data).toMatchObject({ salesperson: { id: b.id }, commissionRate: "4" });
    expect(moved.body.data.events.at(-1)).toMatchObject({ action: "salesperson_changed" });
    expect((await detail(a.id)).totals).toMatchObject({ sales: 0, earned: "0.00" });
    expect((await detail(b.id)).totals).toMatchObject({ sales: 1, earned: "2.00" });

    const cleared = await api().put(`/api/v1/sales/${kept.id}/salesperson`).set(admin.auth).send({ salespersonId: "" });
    expect(cleared.body.data).toMatchObject({ salesperson: null, commissionRate: null });
    expect((await detail(b.id)).totals.sales).toBe(0);
  });
});
