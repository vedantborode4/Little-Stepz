import { randomInt, randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashier: TestSession;
let categoryId: string;
let expenseCategory: string;
let store: string;
let bank: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const shift = (days: number) => {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** A fresh cash drawer per test, so days and sessions never collide between runs. */
async function drawer() {
  const res = await api()
    .post("/api/v1/settings/receiving-accounts")
    .set(admin.auth)
    .send({ name: `Drawer ${uid()}`, method: "CASH" });
  return res.body.data.id as string;
}

beforeAll(async () => {
  [admin, cashier] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER")]);
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Cash ${uid()}` })
  ).body.data.id;
  store = (
    await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `CA${uid()}`, name: "Cash store", type: "STORE" })
  ).body.data.id;
  bank = (
    await api()
      .post("/api/v1/settings/receiving-accounts")
      .set(admin.auth)
      .send({ name: `Bank ${uid()}`, method: "BANK" })
  ).body.data.id;
  const cats = await api()
    .post("/api/v1/expenses/categories")
    .set(admin.auth)
    .send({ name: `Tea ${uid()}` });
  expenseCategory = cats.body.data.find((c: { name: string }) => c.name.startsWith("Tea "))!.id;
});

async function cashSale(account: string, amount: string) {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Cash item ${uid()}`, categoryId, gstRate: "18", variants: [{ sku: `CI-${uid()}`, regularPrice: amount }] });
  const variantId = res.body.data.variants[0].id as string;
  await api()
    .post("/api/v1/inventory/opening")
    .set(admin.auth)
    .send({ locationId: store, lines: [{ variantId, quantity: 5, unitCost: "100" }] });
  return api()
    .post("/api/v1/sales/pos")
    .set(cashier.auth)
    .send({
      locationId: store,
      idempotencyKey: randomUUID(),
      lines: [{ variantId, quantity: 1 }],
      payments: [{ accountId: account, amount }],
    });
}

const expense = (account: string, amount: string, extra: Record<string, unknown> = {}) =>
  api()
    .post("/api/v1/expenses")
    .set(admin.auth)
    .send({ categoryId: expenseCategory, accountId: account, amount, vendor: "Chai stall", ...extra });
const day = async (account: string, date = today()) =>
  (await api().get("/api/v1/cash/day").query({ accountId: account, date }).set(cashier.auth)).body.data;
const open = (account: string, body: Record<string, unknown> = {}) =>
  api()
    .post("/api/v1/cash/sessions")
    .set(cashier.auth)
    .send({ accountId: account, ...body });
const close = (id: string, countedAmount: string) =>
  api().post(`/api/v1/cash/sessions/${id}/close`).set(cashier.auth).send({ countedAmount });

describe("closing the cash drawer", () => {
  it("₹2,000 + ₹5,000 − ₹500 − ₹3,000 = ₹3,500 expected; a short count is recorded and sales don't change", async () => {
    const cash = await drawer();
    const session = (await open(cash, { openingAmount: "2000" })).body.data;
    expect(session).toMatchObject({ status: "OPEN", openingAmount: "2000.00" });

    expect((await cashSale(cash, "5000")).status).toBe(201);
    expect((await expense(cash, "500")).status).toBe(201);
    expect(
      (await api().post("/api/v1/payments/transfers").set(admin.auth).send({ fromAccountId: cash, toAccountId: bank, amount: "3000" }))
        .status,
    ).toBe(201);

    expect((await day(cash)).breakdown).toEqual({
      opening: "2000.00",
      received: "5000.00",
      refunded: "0.00",
      expenses: "500.00",
      transfersIn: "0.00",
      transfersOut: "3000.00",
      supplierPayments: "0.00",
      expected: "3500.00",
    });

    const sales = async () =>
      (await api().get("/api/v1/sales/summary").query({ from: today(), to: today() }).set(admin.auth)).body.data.grossSales;
    const before = await sales();
    const closed = await close(session.id, "3400");
    expect(closed.body.data).toMatchObject({
      status: "CLOSED",
      expectedAmount: "3500.00",
      countedAmount: "3400.00",
      discrepancy: "-100.00",
    });
    expect(await sales()).toBe(before);
  });

  it("locks a closed day against any cash posting until an admin reopens it", async () => {
    const cash = await drawer();
    const session = (await open(cash, { openingAmount: "0" })).body.data;
    await cashSale(cash, "1000");
    await close(session.id, "1000");

    expect((await cashSale(cash, "200")).body.error.code).toBe("DAY_CLOSED");
    expect((await expense(cash, "50")).body.error.code).toBe("DAY_CLOSED");
    const transfer = await api()
      .post("/api/v1/payments/transfers")
      .set(admin.auth)
      .send({ fromAccountId: cash, toAccountId: bank, amount: "100" });
    expect(transfer.body.error.code).toBe("DAY_CLOSED");
    expect((await expense(bank, "50")).status).toBe(201);
    expect((await expense(cash, "50", { businessDate: shift(-1) })).status).toBe(201);

    expect((await api().post(`/api/v1/cash/sessions/${session.id}/reopen`).set(cashier.auth).send({ reason: "x" })).status).toBe(403);
    const reopened = await api().post(`/api/v1/cash/sessions/${session.id}/reopen`).set(admin.auth).send({ reason: "Missed a sale" });
    expect(reopened.body.data).toMatchObject({ status: "OPEN", countedAmount: null, discrepancy: null });
    expect((await cashSale(cash, "200")).status).toBe(201);
    expect((await close(session.id, "1200")).body.data.discrepancy).toBe("0.00");
    const audit = await prisma.auditLog.findFirst({ where: { entityId: session.id, action: "cash.reopened" } });
    expect(audit?.before).toMatchObject({ counted: "1000" });
  });

  it("opens a day with the last count as the opening amount", async () => {
    const cash = await drawer();
    const yesterday = (await open(cash, { businessDate: shift(-1), openingAmount: "500" })).body.data;
    await close(yesterday.id, "750");
    expect((await day(cash)).previousClose).toEqual({ date: shift(-1), counted: "750.00" });
    expect((await open(cash)).body.data.openingAmount).toBe("750.00");
    expect((await open(cash)).body.error.code).toBe("DAY_ALREADY_OPEN");
  });

  it("counts voided receipts and voided expenses out of the expected cash", async () => {
    const cash = await drawer();
    const session = (await open(cash, { openingAmount: "100" })).body.data;
    const buyer = await api()
      .post("/api/v1/customers")
      .set(admin.auth)
      .send({ name: `Cash buyer ${uid()}`, mobile: `9${String(randomInt(0, 1e9)).padStart(9, "0")}` });
    const p = await api()
      .post("/api/v1/payments")
      .set(cashier.auth)
      .send({ customerId: buyer.body.data.id, accountId: cash, amount: "300", excessToCredit: true });
    await api().post(`/api/v1/payments/${p.body.data.id}/void`).set(admin.auth).send({ reason: "Wrong drawer" });
    const e = await expense(cash, "40");
    await api().post(`/api/v1/expenses/${e.body.data.id}/void`).set(admin.auth).send({ reason: "Paid from bank" });
    expect((await day(cash)).breakdown).toMatchObject({ received: "0.00", expenses: "0.00", expected: "100.00" });
    expect((await close(session.id, "100")).body.data.discrepancy).toBe("0.00");
  });

  it("only keeps sessions for cash drawers, never in the future", async () => {
    expect((await open(bank)).body.error.code).toBe("INVALID_ACCOUNT");
    expect((await open(await drawer(), { businessDate: shift(1) })).body.error.code).toBe("FUTURE_DATE");
  });
});

describe("expenses", () => {
  it("records operating and order expenses, voids once, and keeps them out of sales", async () => {
    const cash = await drawer();
    const sales = async () =>
      (await api().get("/api/v1/sales/summary").query({ from: today(), to: today() }).set(admin.auth)).body.data.netSales;
    const before = await sales();

    expect((await expense(cash, "100", { kind: "ORDER" })).status).toBe(400);
    const sale = await cashSale(cash, "1000");
    const forOrder = await expense(cash, "35", { kind: "ORDER", orderId: sale.body.data.id, vendor: "Box supplier" });
    expect(forOrder.body.data).toMatchObject({
      code: expect.stringMatching(/^EXP-\d{5}$/),
      kind: "ORDER",
      order: { code: sale.body.data.code },
    });
    const listed = await api().get("/api/v1/expenses").query({ orderId: sale.body.data.id }).set(admin.auth);
    expect(listed.body.data.total).toBe(1);

    const voided = await api().post(`/api/v1/expenses/${forOrder.body.data.id}/void`).set(admin.auth).send({ reason: "Duplicate" });
    expect(voided.body.data.reversedBy).toMatchObject({ code: expect.stringMatching(/^EXP-/) });
    expect(
      (await api().post(`/api/v1/expenses/${forOrder.body.data.id}/void`).set(admin.auth).send({ reason: "again" })).body.error.code,
    ).toBe("ALREADY_VOIDED");
    await expect(prisma.expense.update({ where: { id: forOrder.body.data.id }, data: { amount: 1 } })).rejects.toThrow();

    expect(Number(await sales()) - Number(before)).toBeCloseTo(847.46, 2);
  });

  it("keeps expenses with admins and cash closing with the till", async () => {
    const cash = await drawer();
    expect(
      (await api().post("/api/v1/expenses").set(cashier.auth).send({ categoryId: expenseCategory, accountId: cash, amount: "10" })).status,
    ).toBe(403);
    expect((await api().get("/api/v1/cash/sessions").set(cashier.auth)).status).toBe(200);
    const dup = await api().post("/api/v1/expenses/categories").set(admin.auth).send({ name: "rent " });
    const again = await api().post("/api/v1/expenses/categories").set(admin.auth).send({ name: "RENT" });
    expect([dup.status, again.status]).toContain(409);
  });
});
