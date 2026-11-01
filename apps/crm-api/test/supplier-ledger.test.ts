import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let ops: TestSession;
let cashier: TestSession;
let bank: string;
let store: string;
let categoryId: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const post = (path: string, body: object, as = admin) => api().post(`/api/v1${path}`).set(as.auth).send(body);
const get = (path: string, as = admin, query: object = {}) => api().get(`/api/v1${path}`).query(query).set(as.auth);

const newSupplier = async () =>
  (await post("/suppliers", { name: `Hot Wheels supplier ${uid()}`, currency: "INR" })).body.data.id as string;
const drawer = async () => (await post("/settings/receiving-accounts", { name: `Drawer ${uid()}`, method: "CASH" })).body.data.id as string;
const entry = (supplierId: string, body: object) => post(`/suppliers/${supplierId}/ledger`, body);
const ledger = async (supplierId: string) => (await get(`/suppliers/${supplierId}/ledger`)).body.data;

async function receivedPurchase(supplierId: string) {
  const variantId = (
    await post("/products", {
      name: `Mainline ${uid()}`,
      categoryId,
      gstRate: "18",
      variants: [{ sku: `ML-${uid()}`, regularPrice: "250" }],
    })
  ).body.data.variants[0].id;
  const draft = await post("/purchases", {
    supplierId,
    invoiceDate: "2026-10-01",
    locationId: store,
    currency: "INR",
    exchangeRate: "1",
    lines: [{ variantId, quantity: 72, unitPrice: "152.78" }],
  });
  return { draft: draft.body.data.id as string, received: () => post(`/purchases/${draft.body.data.id}/receive`, {}) };
}

beforeAll(async () => {
  [admin, ops, cashier] = await Promise.all([sessionAs("ADMIN"), sessionAs("OPS"), sessionAs("CASHIER")]);
  bank = (await post("/settings/receiving-accounts", { name: `Bank ${uid()}`, method: "BANK" })).body.data.id;
  store = (await post("/settings/locations", { code: `SL${uid()}`, name: "Ledger store", type: "STORE" })).body.data.id;
  categoryId = (await post("/categories", { name: `Ledger ${uid()}` })).body.data.id;
});

describe("Supplier ledger", () => {
  it("keeps a running balance of what the supplier holds of ours and what we owe, with voids instead of edits", async () => {
    const supplierId = await newSupplier();
    const cash = await drawer();

    // The owner's figure: ₹1,10,000 paid for 10 cases, 8 received, shipping deducted.
    const opening = await entry(supplierId, {
      type: "OPENING",
      direction: "OURS",
      amount: "20420",
      businessDate: "2026-10-17",
      notes: "2 Mainline cases still owed",
    });
    expect(opening.status).toBe(201);
    expect(opening.body.data).toMatchObject({ code: expect.stringMatching(/^SLE-\d{5}$/), amount: "20420.00", balanceAfter: "20420.00" });

    const second = await entry(supplierId, { type: "OPENING", direction: "THEIRS", amount: "100" });
    expect(second.body.error.code).toBe("OPENING_EXISTS");

    const { draft, received } = await receivedPurchase(supplierId);
    const onDraft = await entry(supplierId, { type: "GOODS_RECEIVED", amount: "11000", purchaseId: draft });
    expect(onDraft.body.error.code).toBe("INVALID_PURCHASE");
    await received();
    const goods = await entry(supplierId, { type: "GOODS_RECEIVED", amount: "11000", purchaseId: draft, businessDate: "2026-10-20" });
    expect(goods.body.data).toMatchObject({ amount: "-11000.00", balanceAfter: "9420.00", purchase: { id: draft }, account: null });
    const otherSupplier = await newSupplier();
    expect((await entry(otherSupplier, { type: "GOODS_RECEIVED", amount: "1", purchaseId: draft })).body.error.code).toBe(
      "INVALID_PURCHASE",
    );

    const noAccount = await entry(supplierId, { type: "PAYMENT", amount: "5000" });
    expect(noAccount.status).toBe(400);
    expect(noAccount.body.error.details.fieldErrors.accountId).toBeDefined();
    await entry(supplierId, { type: "PAYMENT", amount: "5000", accountId: cash, businessDate: "2026-10-21" });
    await entry(supplierId, { type: "REFUND", amount: "2000", accountId: bank, businessDate: "2026-10-22" });
    await entry(supplierId, { type: "CREDIT_NOTE", amount: "480", businessDate: "2026-10-22", notes: "Shipping refunded as credit" });
    const unexplained = await entry(supplierId, { type: "ADJUSTMENT", direction: "THEIRS", amount: "100" });
    expect(unexplained.body.error.details.fieldErrors.notes).toBeDefined();
    await entry(supplierId, { type: "ADJUSTMENT", direction: "THEIRS", amount: "100", businessDate: "2026-10-23", notes: "Rounding" });

    let book = await ledger(supplierId);
    // 20,420 − 11,000 + 5,000 − 2,000 + 480 − 100
    expect(book.summary).toMatchObject({
      balance: "12800.00",
      entryCount: 6,
      lastEntryDate: "2026-10-23",
      totals: {
        OPENING: "20420.00",
        GOODS_RECEIVED: "-11000.00",
        PAYMENT: "5000.00",
        REFUND: "-2000.00",
        CREDIT_NOTE: "480.00",
        ADJUSTMENT: "-100.00",
      },
    });
    // Newest first, each with the balance after it in date order.
    expect(book.items.map((e: { balanceAfter: string }) => e.balanceAfter)).toEqual([
      "12800.00",
      "12900.00",
      "12420.00",
      "14420.00",
      "9420.00",
      "20420.00",
    ]);

    const openingId = opening.body.data.id;
    const voided = await post(`/suppliers/ledger-entries/${openingId}/void`, { reason: "Wrong figure" });
    expect(voided.status).toBe(200);
    expect(voided.body.data.reversedBy.code).toMatch(/^SLE-/);
    expect((await post(`/suppliers/ledger-entries/${openingId}/void`, { reason: "Again" })).body.error.code).toBe("ALREADY_VOIDED");
    const reversal = await prisma.supplierLedgerEntry.findUniqueOrThrow({ where: { reversalOfId: openingId } });
    expect(reversal.amount.toFixed(2)).toBe("-20420.00");
    expect((await post(`/suppliers/ledger-entries/${reversal.id}/void`, { reason: "Undo" })).body.error.code).toBe("CANNOT_VOID_REVERSAL");
    expect((await entry(supplierId, { type: "OPENING", direction: "OURS", amount: "20000", businessDate: "2026-10-17" })).status).toBe(201);

    book = await ledger(supplierId);
    expect(book.summary.balance).toBe("12380.00");
    expect(book.summary.totals.OPENING).toBe("20000.00");

    await expect(prisma.supplierLedgerEntry.update({ where: { id: openingId }, data: { notes: "edited" } })).rejects.toThrow();
    const supplier = (await get(`/suppliers/${supplierId}`)).body.data;
    expect(supplier.balance).toBe("12380.00");
    const listed = (await get("/suppliers", admin, { q: supplier.name })).body.data.items[0];
    expect(listed.balance).toBe("12380.00");
  });

  it("counts cash paid to suppliers in that day's cash closing and refuses a closed day", async () => {
    const supplierId = await newSupplier();
    const cash = await drawer();
    const session = (await post("/cash/sessions", { accountId: cash, openingAmount: "10000" }, cashier)).body.data;
    const paid = await entry(supplierId, { type: "PAYMENT", amount: "3000", accountId: cash });
    await entry(supplierId, { type: "REFUND", amount: "500", accountId: cash });
    let day = (await get("/cash/day", cashier, { accountId: cash, date: today() })).body.data;
    expect(day.breakdown).toMatchObject({ supplierPayments: "2500.00", expected: "7500.00" });

    await post(`/suppliers/ledger-entries/${paid.body.data.id}/void`, { reason: "Paid from the bank instead" });
    day = (await get("/cash/day", cashier, { accountId: cash, date: today() })).body.data;
    expect(day.breakdown).toMatchObject({ supplierPayments: "-500.00", expected: "10500.00" });

    expect((await post(`/cash/sessions/${session.id}/close`, { countedAmount: "10500" }, cashier)).status).toBe(200);
    const late = await entry(supplierId, { type: "PAYMENT", amount: "100", accountId: cash });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe("DAY_CLOSED");
    // Money that doesn't touch an account isn't held back by the closed drawer.
    expect((await entry(supplierId, { type: "CREDIT_NOTE", amount: "100" })).status).toBe(201);
  });

  it("is for the owner: others see suppliers without balances and can't open the ledger", async () => {
    const supplierId = await newSupplier();
    await entry(supplierId, { type: "OPENING", direction: "THEIRS", amount: "8573.70" });

    const forOps = await get(`/suppliers/${supplierId}`, ops);
    expect(forOps.status).toBe(200);
    expect(forOps.body.data).not.toHaveProperty("balance");
    expect((await get("/suppliers", ops)).body.data.items.every((s: object) => !("balance" in s))).toBe(true);
    expect((await get(`/suppliers/${supplierId}/ledger`, ops)).status).toBe(403);
    expect((await post(`/suppliers/${supplierId}/ledger`, { type: "CREDIT_NOTE", amount: "1" }, ops)).status).toBe(403);
    expect((await get(`/suppliers/${supplierId}`, cashier)).status).toBe(403);

    const report = (await get("/reports/supplier-balances")).body.data;
    const name = (await get(`/suppliers/${supplierId}`)).body.data.name;
    const row = report.rows.find((r: unknown[]) => r[0] === name);
    const col = (header: string) => row[report.columns.indexOf(header)];
    expect(col("Position")).toBe("We owe them");
    expect(col("We owe them")).toBe(8573.7);
    expect(col("They hold ours")).toBe(0);
    expect((await get("/reports/supplier-balances", ops)).status).toBe(403);
  });
});
