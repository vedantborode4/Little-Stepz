import { randomInt, randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashier: TestSession;
let categoryId: string;
let store: string;
let cash: string;
let phonePe: string;
let personalUpi: string;
let gateway: string;
let bank: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const daysAgo = (n: number) => {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

async function account(name: string, method: string, extra: Record<string, unknown> = {}) {
  const res = await api()
    .post("/api/v1/settings/receiving-accounts")
    .set(admin.auth)
    .send({ name: `${name} ${uid()}`, method, ...extra });
  return res.body.data.id as string;
}

beforeAll(async () => {
  [admin, cashier] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER")]);
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Pay ${uid()}` })
  ).body.data.id;
  store = (
    await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `PY${uid()}`, name: "Pay store", type: "STORE" })
  ).body.data.id;
  [cash, phonePe, personalUpi, gateway, bank] = await Promise.all([
    account("Cash", "CASH"),
    account("PhonePe", "UPI"),
    account("PhonePe personal", "UPI", { isPersonal: true }),
    account("Gateway", "GATEWAY", { feePercent: "2" }),
    account("Bank", "BANK"),
  ]);
});

/** An item at `price` with `stock` units on hand. */
async function item(price: string, stock = 20) {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Item ${uid()}`, categoryId, gstRate: "18", variants: [{ sku: `P-${uid()}`, regularPrice: price }] });
  const variantId = res.body.data.variants[0].id as string;
  await api()
    .post("/api/v1/inventory/opening")
    .set(admin.auth)
    .send({ locationId: store, lines: [{ variantId, quantity: stock, unitCost: "100" }] });
  return variantId;
}

async function customer(extra: Record<string, unknown> = {}) {
  const res = await api()
    .post("/api/v1/customers")
    .set(admin.auth)
    .send({ name: `Payer ${uid()}`, mobile: `8${String(randomInt(0, 1e9)).padStart(9, "0")}`, ...extra });
  return res.body.data.id as string;
}

const pos = (session: TestSession, body: Record<string, unknown>) =>
  api()
    .post("/api/v1/sales/pos")
    .set(session.auth)
    .send({ locationId: store, idempotencyKey: randomUUID(), ...body });

const order = async (customerId: string, variantId: string, quantity = 1, extra: Record<string, unknown> = {}) => {
  const res = await api()
    .post("/api/v1/sales")
    .set(admin.auth)
    .send({ locationId: store, channel: "WHATSAPP", customerId, confirm: true, lines: [{ variantId, quantity }], ...extra });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; code: string };
};

const receive = (session: TestSession, body: Record<string, unknown>) => api().post("/api/v1/payments").set(session.auth).send(body);
const getOrder = async (id: string) => (await api().get(`/api/v1/sales/${id}`).set(admin.auth)).body.data;
const credit = async (customerId: string) => (await api().get(`/api/v1/payments/credit/${customerId}`).set(admin.auth)).body.data;
const collections = async () =>
  (await api().get("/api/v1/payments/collections").query({ from: today(), to: today() }).set(admin.auth)).body.data;
const byAccount = (c: { byAccount: { accountId: string }[] }, id: string) =>
  c.byAccount.find((a) => a.accountId === id) as Record<string, string> | undefined;

describe("Scenario C — ₹5,500 paid ₹500 cash + ₹5,000 PhonePe", () => {
  it("records one sale with two payments, fully paid, and both show in collections", async () => {
    const variantId = await item("5500");
    const res = await pos(cashier, {
      lines: [{ variantId, quantity: 1 }],
      payments: [
        { accountId: cash, amount: "500" },
        { accountId: phonePe, amount: "5000", reference: "UPI-REF-1" },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ paid: "5500.00", due: "0.00", paymentStatus: "PAID" });
    expect(res.body.data.payments).toHaveLength(2);
    expect(await prisma.salesOrder.count({ where: { idempotencyKey: { not: null }, id: res.body.data.id } })).toBe(1);

    const c = await collections();
    expect(byAccount(c, cash)).toMatchObject({ received: "500.00" });
    expect(byAccount(c, phonePe)).toMatchObject({ received: "5000.00" });
  });

  it("refuses an under-paid walk-in sale and an over-payment with no customer", async () => {
    const variantId = await item("1000");
    const short = await pos(cashier, { lines: [{ variantId, quantity: 1 }], payments: [{ accountId: cash, amount: "900" }] });
    expect(short.body.error.code).toBe("PAYMENT_INCOMPLETE");
    const over = await pos(cashier, { lines: [{ variantId, quantity: 1 }], payments: [{ accountId: cash, amount: "1100" }] });
    expect(over.body.error.code).toBe("PAYMENT_EXCEEDS_TOTAL");
    expect(await prisma.stockBalance.findFirst({ where: { variantId, bucket: "SELLABLE" } })).toMatchObject({ quantity: 20 });
  });

  it("keeps a customer's overpayment as credit only when asked to", async () => {
    const variantId = await item("1000");
    const buyer = await customer();
    const refused = await pos(cashier, {
      customerId: buyer,
      lines: [{ variantId, quantity: 1 }],
      payments: [{ accountId: cash, amount: "1200" }],
    });
    expect(refused.body.error.code).toBe("PAYMENT_EXCEEDS_TOTAL");
    const kept = await pos(cashier, {
      customerId: buyer,
      lines: [{ variantId, quantity: 1 }],
      payments: [{ accountId: cash, amount: "1200" }],
      excessToCredit: true,
    });
    expect(kept.body.data.paymentStatus).toBe("PAID");
    expect((await credit(buyer)).balance).toBe("200.00");
  });
});

describe("Scenario D — ₹10,000 order with ₹5,000 paid", () => {
  it("shows partially paid with ₹5,000 outstanding, then paid after the second instalment", async () => {
    const variantId = await item("10000");
    const buyer = await customer({ type: "WHOLESALE", creditDays: 15 });
    const sale = await pos(cashier, {
      customerId: buyer,
      lines: [{ variantId, quantity: 1 }],
      payments: [{ accountId: phonePe, amount: "5000" }],
    });
    expect(sale.body.data).toMatchObject({ grandTotal: "10000.00", paid: "5000.00", due: "5000.00", paymentStatus: "PARTIAL" });

    const outstanding = await api().get("/api/v1/payments/outstanding").query({ customerId: buyer }).set(admin.auth);
    expect(outstanding.body.data.items).toEqual([
      expect.objectContaining({ code: sale.body.data.code, due: "5000.00", bucket: "0-30", fulfilled: true }),
    ]);
    const profile = await api().get(`/api/v1/customers/${buyer}`).set(admin.auth);
    expect(profile.body.data.stats).toMatchObject({ outstanding: "5000.00", creditBalance: "0.00" });

    const second = await receive(cashier, {
      customerId: buyer,
      accountId: bank,
      amount: "5000",
      reference: "NEFT-1",
      allocations: [{ orderId: sale.body.data.id, amount: "5000" }],
    });
    expect(second.status).toBe(201);
    expect(await getOrder(sale.body.data.id)).toMatchObject({ paid: "10000.00", due: "0.00", paymentStatus: "PAID" });
    expect((await api().get("/api/v1/payments/outstanding").query({ customerId: buyer }).set(admin.auth)).body.data.total).toBe(0);
  });
});

describe("allocation rules", () => {
  it("never lets payments exceed what an order owes, even when two arrive together", async () => {
    const variantId = await item("3000");
    const buyer = await customer();
    const o = await order(buyer, variantId);
    const tooMuch = await receive(cashier, {
      customerId: buyer,
      accountId: cash,
      amount: "3500",
      allocations: [{ orderId: o.id, amount: "3500" }],
    });
    expect(tooMuch.body.error.code).toBe("ALLOCATION_EXCEEDS_DUE");

    const both = await Promise.all(
      [1, 2].map(() =>
        receive(cashier, { customerId: buyer, accountId: cash, amount: "3000", allocations: [{ orderId: o.id, amount: "3000" }] }),
      ),
    );
    expect(both.filter((r) => r.status === 201)).toHaveLength(1);
    expect(both.find((r) => r.status !== 201)!.body.error.code).toBe("ALLOCATION_EXCEEDS_DUE");
    expect((await getOrder(o.id)).paid).toBe("3000.00");
  });

  it("requires leftover money to be kept as credit explicitly", async () => {
    const variantId = await item("1000");
    const buyer = await customer();
    const o = await order(buyer, variantId);
    const res = await receive(cashier, {
      customerId: buyer,
      accountId: cash,
      amount: "1500",
      allocations: [{ orderId: o.id, amount: "1000" }],
    });
    expect(res.body.error.code).toBe("UNALLOCATED_EXCESS");
    const ok = await receive(cashier, {
      customerId: buyer,
      accountId: cash,
      amount: "1500",
      allocations: [{ orderId: o.id, amount: "1000" }],
      excessToCredit: true,
    });
    expect(ok.body.data).toMatchObject({ creditAmount: "500.00", orderCodes: [o.code] });
    const walkIn = await receive(cashier, { accountId: cash, amount: "100" });
    expect(walkIn.body.error.code).toBe("UNALLOCATED_EXCESS");
  });

  it("won't take payments on drafts or for another customer's order", async () => {
    const variantId = await item("1000");
    const [a, b] = await Promise.all([customer(), customer()]);
    const draft = await api()
      .post("/api/v1/sales")
      .set(admin.auth)
      .send({ locationId: store, channel: "WHATSAPP", customerId: a, lines: [{ variantId, quantity: 1 }] });
    const onDraft = await receive(cashier, {
      customerId: a,
      accountId: cash,
      amount: "1000",
      allocations: [{ orderId: draft.body.data.id, amount: "1000" }],
    });
    expect(onDraft.body.error.code).toBe("ORDER_NOT_PAYABLE");
    const o = await order(a, variantId);
    const wrong = await receive(cashier, {
      customerId: b,
      accountId: cash,
      amount: "1000",
      allocations: [{ orderId: o.id, amount: "1000" }],
    });
    expect(wrong.body.error.code).toBe("CUSTOMER_MISMATCH");
  });

  it("charges the gateway's fee by default and lets it be overridden", async () => {
    const variantId = await item("2000");
    const buyer = await customer();
    const o = await order(buyer, variantId, 2);
    const auto = await receive(cashier, {
      customerId: buyer,
      accountId: gateway,
      amount: "2000",
      allocations: [{ orderId: o.id, amount: "2000" }],
    });
    expect(auto.body.data.fee).toBe("40.00");
    const manual = await receive(cashier, {
      customerId: buyer,
      accountId: gateway,
      amount: "2000",
      fee: "35.50",
      allocations: [{ orderId: o.id, amount: "2000" }],
    });
    expect(manual.body.data.fee).toBe("35.50");
  });
});

describe("customer credit", () => {
  it("is spent on orders and refunded, never below zero", async () => {
    const variantId = await item("800");
    const buyer = await customer();
    await receive(cashier, { customerId: buyer, accountId: cash, amount: "1000", excessToCredit: true });
    expect((await credit(buyer)).balance).toBe("1000.00");

    const o = await order(buyer, variantId);
    const applied = await api().post(`/api/v1/payments/credit/${buyer}/apply`).set(cashier.auth).send({ orderId: o.id, amount: "800" });
    expect(applied.body.data.balance).toBe("200.00");
    expect(await getOrder(o.id)).toMatchObject({
      paymentStatus: "PAID",
      payments: [expect.objectContaining({ source: "CREDIT", amount: "800.00" })],
    });

    const second = await order(buyer, variantId);
    const tooMuch = await api()
      .post(`/api/v1/payments/credit/${buyer}/apply`)
      .set(cashier.auth)
      .send({ orderId: second.id, amount: "300" });
    expect(tooMuch.body.error.code).toBe("CREDIT_INSUFFICIENT");

    expect(
      (await api().post(`/api/v1/payments/credit/${buyer}/refund`).set(cashier.auth).send({ accountId: cash, amount: "200" })).status,
    ).toBe(403);
    const refunded = await api().post(`/api/v1/payments/credit/${buyer}/refund`).set(admin.auth).send({ accountId: cash, amount: "200" });
    expect(refunded.body.data.balance).toBe("0.00");
    const refund = await prisma.payment.findFirst({ where: { customerId: buyer, direction: "OUT" } });
    expect(refund).toMatchObject({ accountId: cash });
  });
});

describe("voids and cancellations", () => {
  it("voids a payment with a mirror row and refuses a second void", async () => {
    const variantId = await item("1500");
    const buyer = await customer();
    const o = await order(buyer, variantId);
    const p = await receive(cashier, {
      customerId: buyer,
      accountId: phonePe,
      amount: "1500",
      allocations: [{ orderId: o.id, amount: "1500" }],
    });
    expect((await api().post(`/api/v1/payments/${p.body.data.id}/void`).set(cashier.auth).send({ reason: "x" })).status).toBe(403);
    const voided = await api().post(`/api/v1/payments/${p.body.data.id}/void`).set(admin.auth).send({ reason: "Entered twice" });
    expect(voided.body.data.reversedBy).toMatchObject({ code: expect.stringMatching(/^PAY-/) });
    expect(await getOrder(o.id)).toMatchObject({ paid: "0.00", paymentStatus: "REFUNDED" });
    const again = await api().post(`/api/v1/payments/${p.body.data.id}/void`).set(admin.auth).send({ reason: "again" });
    expect(again.body.error.code).toBe("ALREADY_VOIDED");
    await expect(prisma.payment.update({ where: { id: p.body.data.id }, data: { amount: 1 } })).rejects.toThrow(/append-only/);
    await expect(prisma.paymentAllocation.deleteMany({ where: { paymentId: p.body.data.id } })).rejects.toThrow();
  });

  it("won't void an overpayment whose credit has been spent", async () => {
    const variantId = await item("500");
    const buyer = await customer();
    const p = await receive(cashier, { customerId: buyer, accountId: cash, amount: "500", excessToCredit: true });
    const o = await order(buyer, variantId);
    await api().post(`/api/v1/payments/credit/${buyer}/apply`).set(cashier.auth).send({ orderId: o.id, amount: "500" });
    const res = await api().post(`/api/v1/payments/${p.body.data.id}/void`).set(admin.auth).send({ reason: "Mistake" });
    expect(res.body.error.code).toBe("CREDIT_ALREADY_USED");
  });

  it("makes paid money on a cancelled order go back to the customer or into their credit", async () => {
    const variantId = await item("2000");
    const buyer = await customer();
    const [toCredit, toRefund] = [await order(buyer, variantId), await order(buyer, variantId)];
    for (const o of [toCredit, toRefund]) {
      await receive(cashier, { customerId: buyer, accountId: phonePe, amount: "1000", allocations: [{ orderId: o.id, amount: "1000" }] });
    }
    const missing = await api().post(`/api/v1/sales/${toCredit.id}/cancel`).set(admin.auth).send({ reason: "Changed mind" });
    expect(missing.body.error.code).toBe("SETTLEMENT_REQUIRED");

    const credited = await api()
      .post(`/api/v1/sales/${toCredit.id}/cancel`)
      .set(admin.auth)
      .send({ reason: "Changed mind", settlement: { mode: "CREDIT" } });
    expect(credited.body.data).toMatchObject({ status: "CANCELLED", paid: "0.00", paymentStatus: "REFUNDED" });
    expect((await credit(buyer)).balance).toBe("1000.00");

    const refunded = await api()
      .post(`/api/v1/sales/${toRefund.id}/cancel`)
      .set(admin.auth)
      .send({ reason: "Out of stock", settlement: { mode: "REFUND", accountId: phonePe, reference: "UPI-BACK" } });
    expect(refunded.body.data.payments.at(-1)).toMatchObject({ amount: "-1000.00", accountName: expect.stringContaining("PhonePe") });
    expect((await credit(buyer)).balance).toBe("1000.00");
  });
});

describe("transfers, collections and ageing", () => {
  it("moves money between accounts without touching sales, and reverses once", async () => {
    const salesBefore = (await api().get("/api/v1/sales/summary").query({ from: today(), to: today() }).set(admin.auth)).body.data
      .grossSales;
    const before = await collections();
    expect(
      (await api().post("/api/v1/payments/transfers").set(cashier.auth).send({ fromAccountId: cash, toAccountId: bank, amount: "1" }))
        .status,
    ).toBe(403);
    const t = await api()
      .post("/api/v1/payments/transfers")
      .set(admin.auth)
      .send({ fromAccountId: personalUpi, toAccountId: bank, amount: "2500" });
    expect(t.body.data).toMatchObject({ code: expect.stringMatching(/^TRF-/), amount: "2500.00" });

    const after = await collections();
    expect(after.totals.received).toBe(before.totals.received);
    expect(Number(byAccount(after, bank)!.transfersIn) - Number(byAccount(before, bank)?.transfersIn ?? 0)).toBe(2500);
    expect(Number(byAccount(after, personalUpi)!.transfersOut) - Number(byAccount(before, personalUpi)?.transfersOut ?? 0)).toBe(2500);
    const salesAfter = (await api().get("/api/v1/sales/summary").query({ from: today(), to: today() }).set(admin.auth)).body.data
      .grossSales;
    expect(salesAfter).toBe(salesBefore);

    const same = await api()
      .post("/api/v1/payments/transfers")
      .set(admin.auth)
      .send({ fromAccountId: bank, toAccountId: bank, amount: "1" });
    expect(same.status).toBe(400);
    const reversed = await api()
      .post(`/api/v1/payments/transfers/${t.body.data.id}/reverse`)
      .set(admin.auth)
      .send({ reason: "Wrong account" });
    expect(reversed.body.data.reversedBy).toBeTruthy();
    expect(
      (await api().post(`/api/v1/payments/transfers/${t.body.data.id}/reverse`).set(admin.auth).send({ reason: "x" })).body.error.code,
    ).toBe("ALREADY_REVERSED");
  });

  it("nets a voided receipt out of collections and separates personal accounts", async () => {
    const before = await collections();
    const buyer = await customer();
    const p = await receive(cashier, { customerId: buyer, accountId: personalUpi, amount: "700", excessToCredit: true });
    const mid = await collections();
    expect(Number(mid.personal) - Number(before.personal)).toBe(700);
    await api().post(`/api/v1/payments/${p.body.data.id}/void`).set(admin.auth).send({ reason: "Test" });
    const after = await collections();
    expect(after.totals.received).toBe(before.totals.received);
    expect(after.personal).toBe(before.personal);
  });

  it("ages unpaid balances from the order date", async () => {
    const variantId = await item("1000");
    const buyer = await customer();
    await api()
      .post("/api/v1/sales")
      .set(admin.auth)
      .send({
        locationId: store,
        channel: "WHOLESALE",
        customerId: buyer,
        orderDate: daysAgo(45),
        confirm: true,
        lines: [{ variantId, quantity: 1 }],
      });
    const res = await api().get("/api/v1/payments/outstanding").query({ customerId: buyer }).set(admin.auth);
    expect(res.body.data.items[0]).toMatchObject({ bucket: "31-60", ageDays: 45, overdue: true, fulfilled: false });
    const summary = await api().get("/api/v1/payments/outstanding/summary").query({ customerId: buyer }).set(admin.auth);
    expect(summary.body.data).toMatchObject({
      total: "1000.00",
      receivable: "0.00",
      openOrders: "1000.00",
      buckets: { "31-60": "1000.00" },
    });
  });

  it("moves payments and credit when customers merge", async () => {
    const [keep, dup] = await Promise.all([customer(), customer()]);
    await receive(cashier, { customerId: dup, accountId: cash, amount: "300", excessToCredit: true });
    const merged = await api().post(`/api/v1/customers/${dup}/merge`).set(admin.auth).send({ intoId: keep, reason: "Same person" });
    expect(merged.body.data.stats.creditBalance).toBe("300.00");
    expect(await prisma.payment.count({ where: { customerId: dup } })).toBe(0);
  });
});
