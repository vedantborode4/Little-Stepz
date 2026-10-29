import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let categoryId: string;
let store: string;
let supplierId: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();

beforeAll(async () => {
  admin = await sessionAs("ADMIN");
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `RC ${uid()}` })
  ).body.data.id;
  store = (
    await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `PS${uid()}`, name: "Store", type: "STORE" })
  ).body.data.id;
  supplierId = (
    await api()
      .post("/api/v1/suppliers")
      .set(admin.auth)
      .send({ name: `Shantou ${uid()}`, currency: "CNY", country: "China" })
  ).body.data.id;
});

async function simpleVariant(regularPrice = "20000") {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `MJX ${uid()}`, categoryId, gstRate: "18", variants: [{ sku: `MJX-${uid()}`, regularPrice }] });
  return res.body.data.variants[0].id as string;
}

/** Scenario A's shape: 10 units at ¥900, rate 12, freight ₹8,000 + duty ₹9,000 + recoverable IGST. */
function scenarioA(variantId: string, overrides: Record<string, unknown> = {}) {
  return {
    supplierId,
    invoiceNumber: `INV-${uid()}`,
    invoiceDate: "2026-10-01",
    locationId: store,
    currency: "CNY",
    exchangeRate: "12",
    allocationMethod: "VALUE",
    lines: [{ variantId, quantity: 10, unitPrice: "900" }],
    charges: [
      { type: "FREIGHT", amount: "8000", currency: "INR" },
      { type: "CUSTOMS_DUTY", amount: "9000", currency: "INR" },
      { type: "IGST", amount: "22860", currency: "INR", isRecoverableTax: true },
    ],
    ...overrides,
  };
}

async function card(variantId: string) {
  return (await api().get(`/api/v1/inventory/variants/${variantId}`).set(admin.auth)).body.data;
}

async function receivedPurchase(variantId: string, overrides: Record<string, unknown> = {}) {
  const draft = await api().post("/api/v1/purchases").set(admin.auth).send(scenarioA(variantId, overrides));
  expect(draft.status).toBe(201);
  const received = await api().post(`/api/v1/purchases/${draft.body.data.id}/receive`).set(admin.auth).send({});
  expect(received.status).toBe(200);
  return received.body.data;
}

describe("Scenario A — purchase 10 MJX RC cars at ₹12,500 landed", () => {
  it("previews the landed cost on the draft, then receiving adds 10 units and ₹1,25,000 of stock value", async () => {
    const variantId = await simpleVariant();
    const draft = await api().post("/api/v1/purchases").set(admin.auth).send(scenarioA(variantId));
    expect(draft.body.data).toMatchObject({ status: "DRAFT", code: expect.stringMatching(/^PUR-\d{4}$/) });
    expect(draft.body.data.totals).toMatchObject({ landedTotal: "125000.00", inputTaxCredit: "22860.00", capitalisedCharges: "17000.00" });
    expect((await card(variantId)).stock.physical).toBe(0);

    const received = await api().post(`/api/v1/purchases/${draft.body.data.id}/receive`).set(admin.auth).send({});
    expect(received.body.data.status).toBe("RECEIVED");
    expect(received.body.data.lines[0].costs).toMatchObject({
      unitPriceInr: "10800.00",
      allocatedCharges: "17000.00",
      landedUnitCost: "12500.00",
    });
    expect(received.body.data.stockDocument.code).toMatch(/^STK-/);

    const c = await card(variantId);
    expect(c.stock).toMatchObject({ physical: 10, available: 10, avgUnitCost: "12500.00", stockValue: "125000.00" });
    expect(c.reconciliation).toMatchObject({ purchases: 10, computedPhysical: 10 });
  });

  it("receives exactly once, even when two requests race", async () => {
    const variantId = await simpleVariant();
    const draft = await api().post("/api/v1/purchases").set(admin.auth).send(scenarioA(variantId));
    const [a, b] = await Promise.all([
      api().post(`/api/v1/purchases/${draft.body.data.id}/receive`).set(admin.auth).send({}),
      api().post(`/api/v1/purchases/${draft.body.data.id}/receive`).set(admin.auth).send({}),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await card(variantId)).stock.physical).toBe(10);
  });

  it("averages the cost across batches bought at different landed costs", async () => {
    const variantId = await simpleVariant();
    await receivedPurchase(variantId);
    await receivedPurchase(variantId, {
      lines: [{ variantId, quantity: 10, unitPrice: "1000" }],
      charges: [{ type: "FREIGHT", amount: "15000", currency: "INR" }],
    });
    expect((await card(variantId)).stock.avgUnitCost).toBe("13000.00");
  });
});

describe("historical purchases can't be rewritten", () => {
  it("locks a received purchase in the API and in the database", async () => {
    const variantId = await simpleVariant();
    const purchase = await receivedPurchase(variantId);

    const edit = await api()
      .put(`/api/v1/purchases/${purchase.id}`)
      .set(admin.auth)
      .send(scenarioA(variantId, { exchangeRate: "1" }));
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe("PURCHASE_LOCKED");

    await expect(prisma.$executeRaw`UPDATE "PurchaseLine" SET "unitPrice" = 1 WHERE "shipmentId" = ${purchase.id}`).rejects.toThrow(
      /locked/,
    );
    await expect(prisma.$executeRaw`UPDATE "PurchaseShipment" SET "exchangeRate" = 1 WHERE id = ${purchase.id}`).rejects.toThrow(
      /can no longer be changed/,
    );

    const reverse = await api()
      .post(`/api/v1/inventory/documents/${purchase.stockDocument.id}/reverse`)
      .set(admin.auth)
      .send({ reason: "nope" });
    expect(reverse.body.error.code).toBe("REVERSE_AT_SOURCE");
  });

  it("lets a draft be edited and cancelled, and never receives a cancelled purchase", async () => {
    const variantId = await simpleVariant();
    const draft = await api().post("/api/v1/purchases").set(admin.auth).send(scenarioA(variantId));
    const edited = await api()
      .put(`/api/v1/purchases/${draft.body.data.id}`)
      .set(admin.auth)
      .send(scenarioA(variantId, { lines: [{ variantId, quantity: 4, unitPrice: "900" }] }));
    expect(edited.body.data.lines[0].quantity).toBe(4);

    await api().post(`/api/v1/purchases/${draft.body.data.id}/cancel`).set(admin.auth).expect(200);
    const receive = await api().post(`/api/v1/purchases/${draft.body.data.id}/receive`).set(admin.auth).send({});
    expect(receive.status).toBe(409);
  });
});

describe("validation", () => {
  it("rejects inconsistent currency, rate and allocation data", async () => {
    const variantId = await simpleVariant();
    const inrRate = await api()
      .post("/api/v1/purchases")
      .set(admin.auth)
      .send(scenarioA(variantId, { currency: "INR", exchangeRate: "12" }));
    expect(inrRate.status).toBe(400);

    const noWeights = await api()
      .post("/api/v1/purchases")
      .set(admin.auth)
      .send(scenarioA(variantId, { allocationMethod: "WEIGHT" }));
    expect(noWeights.status).toBe(400);

    const wrongChargeCurrency = await api()
      .post("/api/v1/purchases")
      .set(admin.auth)
      .send(scenarioA(variantId, { charges: [{ type: "FREIGHT", amount: "10", currency: "USD" }] }));
    expect(wrongChargeCurrency.status).toBe(400);
  });

  it("converts charges paid in the purchase currency at the purchase's own rate", async () => {
    const variantId = await simpleVariant();
    const draft = await api()
      .post("/api/v1/purchases")
      .set(admin.auth)
      .send(scenarioA(variantId, { exchangeRate: "11.85", charges: [{ type: "FREIGHT", amount: "500", currency: "CNY" }] }));
    expect(draft.body.data.charges[0].amountInr).toBe("5925.00");
  });
});

describe("late charges", () => {
  it("splits a late charge between stock still on hand and cost of units already gone", async () => {
    const variantId = await simpleVariant("5000");
    const purchase = await receivedPurchase(variantId, {
      currency: "INR",
      exchangeRate: "1",
      lines: [{ variantId, quantity: 10, unitPrice: "1000" }],
      charges: [],
    });
    await api()
      .post("/api/v1/inventory/write-offs")
      .set(admin.auth)
      .send({
        locationId: store,
        bucket: "SELLABLE",
        reasonCode: "MISSING",
        reason: "Stand-in for 4 sold",
        lines: [{ variantId, quantity: 4 }],
      })
      .expect(201);

    const res = await api()
      .post(`/api/v1/purchases/${purchase.id}/late-charges`)
      .set(admin.auth)
      .send({ type: "FREIGHT", amountInr: "1000" });
    expect(res.status).toBe(201);
    expect(res.body.data.costAdjustments[0].lines[0]).toMatchObject({
      allocated: "1000.00",
      toInventory: "600.00",
      toCostOfSales: "400.00",
    });
    expect((await card(variantId)).stock.stockValue).toBe("6600.00");
  });

  it("records recoverable tax as input credit without changing stock value", async () => {
    const variantId = await simpleVariant("5000");
    const purchase = await receivedPurchase(variantId, {
      currency: "INR",
      exchangeRate: "1",
      lines: [{ variantId, quantity: 2, unitPrice: "1000" }],
      charges: [],
    });
    const res = await api()
      .post(`/api/v1/purchases/${purchase.id}/late-charges`)
      .set(admin.auth)
      .send({ type: "GST", amountInr: "360", isRecoverableTax: true });
    expect(res.body.data.costAdjustments[0]).toMatchObject({ isRecoverableTax: true, lines: [] });
    expect((await card(variantId)).stock.stockValue).toBe("2000.00");
  });
});

describe("returns to supplier", () => {
  it("removes returned units and refuses to return more than was received", async () => {
    const variantId = await simpleVariant();
    const purchase = await receivedPurchase(variantId);
    const lineId = purchase.lines[0].id;

    const ret = await api()
      .post(`/api/v1/purchases/${purchase.id}/returns`)
      .set(admin.auth)
      .send({ locationId: store, reason: "Faulty batch", lines: [{ purchaseLineId: lineId, quantity: 3 }] });
    expect(ret.status).toBe(201);
    expect(ret.body.data.lines[0].returnedQty).toBe(3);

    const tooMany = await api()
      .post(`/api/v1/purchases/${purchase.id}/returns`)
      .set(admin.auth)
      .send({ locationId: store, reason: "Again", lines: [{ purchaseLineId: lineId, quantity: 8 }] });
    expect(tooMany.body.error.code).toBe("RETURN_EXCEEDS_RECEIVED");

    const c = await card(variantId);
    expect(c.stock).toMatchObject({ physical: 7, stockValue: "87500.00" });
    expect(c.reconciliation).toMatchObject({ purchases: 10, purchaseReturns: 3, computedPhysical: 7, actualPhysical: 7 });
  });
});

describe("purchase permissions", () => {
  it("lets Ops receive goods without seeing any money, and keeps purchases from cashiers", async () => {
    const variantId = await simpleVariant();
    const draft = await api().post("/api/v1/purchases").set(admin.auth).send(scenarioA(variantId));
    const ops = await sessionAs("OPS");
    const cashier = await sessionAs("CASHIER");

    const opsView = await api().get(`/api/v1/purchases/${draft.body.data.id}`).set(ops.auth);
    expect(opsView.status).toBe(200);
    expect(opsView.body.data).not.toHaveProperty("charges");
    expect(opsView.body.data).not.toHaveProperty("exchangeRate");
    expect(opsView.body.data.lines[0]).not.toHaveProperty("unitPrice");

    expect((await api().post(`/api/v1/purchases/${draft.body.data.id}/receive`).set(ops.auth).send({})).status).toBe(200);
    expect((await api().post("/api/v1/purchases").set(ops.auth).send(scenarioA(variantId))).status).toBe(403);
    expect((await api().get("/api/v1/purchases").set(cashier.auth)).status).toBe(403);
  });
});
