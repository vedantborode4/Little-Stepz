import { randomInt, randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { REPORT_KEYS } from "@repo/crm-schema";
import { dec } from "../src/core/money";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashier: TestSession;
let ops: TestSession;
let categoryId: string;
let store: string;
let cash: string;
let gateway: string;
let courierId: string;
let expenseCategory: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

beforeAll(async () => {
  [admin, cashier, ops] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER"), sessionAs("OPS")]);
  const post = (path: string, body: Record<string, unknown>) => api().post(`/api/v1${path}`).set(admin.auth).send(body);
  categoryId = (await post("/categories", { name: `Profit ${uid()}` })).body.data.id;
  store = (await post("/settings/locations", { code: `AN${uid()}`, name: "Analytics store", type: "STORE" })).body.data.id;
  cash = (await post("/settings/receiving-accounts", { name: `Cash ${uid()}`, method: "CASH" })).body.data.id;
  gateway = (await post("/settings/receiving-accounts", { name: `Gateway ${uid()}`, method: "GATEWAY", feePercent: "2" })).body.data.id;
  courierId = (await post("/couriers", { name: `Courier ${uid()}`, trackingUrlTemplate: "https://track.example/{awb}" })).body.data.id;
  const packing = `Packing ${uid()}`;
  const categories = await post("/expenses/categories", { name: packing });
  expenseCategory = categories.body.data.find((c: { name: string }) => c.name === packing).id;
});

async function item(prices: Record<string, string>, stock = 10, unitCost: string | null = "500") {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Profit item ${uid()}`, categoryId, gstRate: "18", variants: [{ sku: `PF-${uid()}`, ...prices }] });
  const variant = { ...(res.body.data.variants[0] as { id: string; sku: string }), productId: res.body.data.id as string };
  if (stock) {
    await api()
      .post("/api/v1/inventory/opening")
      .set(admin.auth)
      .send({ locationId: store, lines: [{ variantId: variant.id, quantity: stock, unitCost: unitCost ?? undefined }] });
  }
  return variant;
}

async function pos(lines: Record<string, unknown>[]) {
  const body: Record<string, unknown> = { locationId: store, channel: "STORE", idempotencyKey: randomUUID(), lines };
  const quote = await api().post("/api/v1/sales/quote").set(admin.auth).send(body);
  body.payments = [{ accountId: cash, amount: quote.body.data.totals.grandTotal }];
  const res = await api().post("/api/v1/sales/pos").set(admin.auth).send(body);
  expect(res.status).toBe(201);
  return res.body.data as { id: string; lines: { id: string; variantId: string; unitPrice: string }[]; grandTotal: string };
}

const profit = async () => (await api().get("/api/v1/analytics/profit").query({ from: today(), to: today() }).set(admin.auth)).body.data;
const breakdown = async (query: Record<string, string>) =>
  (
    await api()
      .get("/api/v1/analytics/breakdown")
      .query({ from: today(), to: today(), categoryId, ...query })
      .set(admin.auth)
  ).body.data;
const valuationOf = async (sku: string) => (await api().get("/api/v1/analytics/valuation").query({ q: sku }).set(admin.auth)).body.data;
const delta = (after: Record<string, string>, before: Record<string, string>, key: string) => dec(after[key]!).sub(before[key]!).toFixed(2);

describe("Profit waterfall", () => {
  let a: { id: string; sku: string };
  let b: { id: string; sku: string };

  it("walks sales down to operating profit, net of returns, courier, fees and expenses", async () => {
    const before = await profit();
    a = await item({ regularPrice: "1180" });
    b = await item({ regularPrice: "1180", offerPrice: "1062" });

    const sale = await pos([{ variantId: a.id, quantity: 2 }]);
    await pos([{ variantId: b.id, quantity: 1, lineDiscount: "62" }]);
    const returned = await api()
      .post(`/api/v1/sales/${sale.id}/returns`)
      .set(admin.auth)
      .send({
        reason: "Changed mind",
        lines: [{ orderLineId: sale.lines[0]!.id, quantity: 1, condition: "RESELLABLE" }],
        refund: { method: "REFUND", accountId: cash },
      });
    expect(returned.status).toBe(201);

    const buyer = await api()
      .post("/api/v1/customers")
      .set(admin.auth)
      .send({ name: `Online ${uid()}`, mobile: `7${String(randomInt(0, 1e9)).padStart(9, "0")}` });
    const online = await api()
      .post("/api/v1/sales")
      .set(admin.auth)
      .send({
        locationId: store,
        channel: "INSTAGRAM",
        fulfilment: "DELIVERY",
        customerId: buyer.body.data.id,
        shippingCharged: "99",
        confirm: true,
        lines: [{ variantId: a.id, quantity: 1 }],
      });
    expect(online.status).toBe(201);
    const paid = await api()
      .post("/api/v1/payments")
      .set(admin.auth)
      .send({
        customerId: buyer.body.data.id,
        accountId: gateway,
        amount: "1279",
        allocations: [{ orderId: online.body.data.id, amount: "1279" }],
      });
    expect(paid.body.data.fee).toBe("25.58");
    const shipment = await api()
      .post("/api/v1/shipments")
      .set(ops.auth)
      .send({ orderId: online.body.data.id, courierId, courierCost: "65", packages: [{ awb: `AN${randomInt(0, 1e9)}${uid()}` }] });
    await api().post(`/api/v1/shipments/${shipment.body.data.id}/status`).set(ops.auth).send({ status: "DISPATCHED" }).expect(200);

    const expense = (amount: string, extra: Record<string, unknown> = {}) =>
      api()
        .post("/api/v1/expenses")
        .set(admin.auth)
        .send({ categoryId: expenseCategory, accountId: cash, amount, vendor: "Packers", ...extra });
    await expense("35", { kind: "ORDER", orderId: online.body.data.id });
    await expense("200");
    const mistake = await expense("50");
    await api().post(`/api/v1/expenses/${mistake.body.data.id}/void`).set(admin.auth).send({ reason: "Entered twice" }).expect(200);

    const after = await profit();
    expect(after.orders - before.orders).toBe(3);
    expect(after.units - before.units).toBe(3);
    expect({
      grossSales: delta(after, before, "grossSales"),
      discounts: delta(after, before, "discounts"),
      returns: delta(after, before, "returns"),
      netSalesInclGst: delta(after, before, "netSalesInclGst"),
      cogs: delta(after, before, "cogs"),
      shippingExpense: delta(after, before, "shippingExpense"),
      paymentFees: delta(after, before, "paymentFees"),
      orderExpenses: delta(after, before, "orderExpenses"),
      operatingExpenses: delta(after, before, "operatingExpenses"),
      priceReductions: delta(after, before, "priceReductions"),
    }).toEqual({
      // 2×1180 + 1062 + 1180 + 99 shipping, before the ₹62 item discount
      grossSales: "4701.00",
      discounts: "62.00",
      returns: "1180.00",
      netSalesInclGst: "3459.00",
      cogs: "1500.00",
      shippingExpense: "65.00",
      paymentFees: "25.58",
      orderExpenses: "35.00",
      operatingExpenses: "200.00",
      // B sold at its offer, ₹118 under the list price
      priceReductions: "118.00",
    });
    const netDelta = dec(delta(after, before, "netSales"));
    expect(delta(after, before, "grossProfit")).toBe(netDelta.sub(1500).toFixed(2));

    expect(dec(after.contributionProfit).toFixed(2)).toBe(
      dec(after.grossProfit).sub(after.shippingExpense).sub(after.paymentFees).sub(after.orderExpenses).sub(after.lateCharges).toFixed(2),
    );
    expect(dec(after.operatingProfit).toFixed(2)).toBe(dec(after.contributionProfit).sub(after.operatingExpenses).toFixed(2));
  });

  it("breaks profit down by variant, category and channel, net of returns", async () => {
    const byVariant = await breakdown({ by: "variant" });
    const rowA = byVariant.find((r: { sublabel: string }) => r.sublabel === a.sku);
    const rowB = byVariant.find((r: { sublabel: string }) => r.sublabel === b.sku);
    // A: two at the counter, one returned, one shipped
    expect(rowA).toMatchObject({ units: 2, netSales: "2000.00", cogs: "1000.00", grossProfit: "1000.00", marginPercent: "50.0" });
    // B: ₹1,000 after the discount is ₹847.46 before GST
    expect(rowB).toMatchObject({ units: 1, netSales: "847.46", cogs: "500.00", grossProfit: "347.46", discounts: "62.00" });

    const [category] = await breakdown({ by: "category" });
    expect(category).toMatchObject({ units: 3, netSales: "2847.46", cogs: "1500.00", grossProfit: "1347.46" });

    const instagram = await breakdown({ by: "channel", channel: "INSTAGRAM" });
    expect(instagram).toEqual([expect.objectContaining({ key: "INSTAGRAM", units: 1, netSales: "1000.00" })]);
  });

  it("rejects a range that ends before it starts", async () => {
    const res = await api().get("/api/v1/analytics/profit").query({ from: today(), to: "2020-01-01" }).set(admin.auth);
    expect(res.body.error.code).toBe("INVALID_RANGE");
  });
});

describe("Scenario I — valuation follows today's prices, past sales stay put", () => {
  it("moves the offer projection as soon as the offer price changes", async () => {
    const c = await item({ regularPrice: "2360" }, 5, "1000");
    const sale = await pos([{ variantId: c.id, quantity: 1 }]);

    const first = await valuationOf(c.sku);
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0]).toMatchObject({
      available: 4,
      avgCost: "1000.00",
      costValue: "4000.00",
      offerPrice: null,
      regular: { revenue: "9440.00", profitBeforeGst: "5440.00", profitNetOfGst: "4000.00", marginPercent: "50.0" },
      offer: { revenue: "9440.00", profitNetOfGst: "4000.00" },
    });

    await api().patch(`/api/v1/variants/${c.id}`).set(admin.auth).send({ offerPrice: "1770", reason: "Clearance" }).expect(200);
    const second = await valuationOf(c.sku);
    expect(second.rows[0]).toMatchObject({
      offerPrice: "1770.00",
      regular: { revenue: "9440.00", profitNetOfGst: "4000.00" },
      offer: { revenue: "7080.00", profitBeforeGst: "3080.00", profitNetOfGst: "2000.00", marginPercent: "33.3" },
    });

    const past = (await api().get(`/api/v1/sales/${sale.id}`).set(admin.auth)).body.data;
    expect(past.grandTotal).toBe("2360.00");
    expect(past.lines[0].unitPrice).toBe("2360.00");
  });

  it("lists stock with an unknown cost but never values it", async () => {
    const v = await item({ regularPrice: "1180" }, 3, null);
    const supplier = await api()
      .post("/api/v1/suppliers")
      .set(admin.auth)
      .send({ name: `Local ${uid()}`, currency: "INR" });
    const draft = await api()
      .post("/api/v1/purchases")
      .set(admin.auth)
      .send({
        supplierId: supplier.body.data.id,
        invoiceNumber: `INV-${uid()}`,
        invoiceDate: today(),
        locationId: store,
        currency: "INR",
        exchangeRate: "1",
        lines: [{ variantId: v.id, quantity: 2, unitPrice: "300" }],
      });
    await api().post(`/api/v1/purchases/${draft.body.data.id}/receive`).set(admin.auth).send({}).expect(200);

    const { rows, unknownCostUnits } = await valuationOf(v.sku);
    expect(unknownCostUnits).toBe(3);
    expect(rows[0]).toMatchObject({
      available: 5,
      avgCost: "300.00",
      costValue: "600.00",
      unknownCostUnits: 3,
      // Revenue covers all five; profit only the two with a known cost
      regular: { revenue: "5900.00", profitBeforeGst: "1760.00", profitNetOfGst: "1400.00" },
    });
  });
});

describe("Dashboard", () => {
  it("shapes the figures to the role", async () => {
    const asAdmin = (await api().get("/api/v1/analytics/dashboard").set(admin.auth)).body.data;
    expect(asAdmin.trend).toHaveLength(30);
    expect(asAdmin.trend.at(-1).date).toBe(today());
    expect(asAdmin.profit).toEqual(expect.objectContaining({ grossProfit: expect.any(String), potentialRevenue: expect.any(String) }));
    expect(asAdmin.inventory.costValue).toEqual(expect.any(String));
    expect(asAdmin.payments).toEqual(expect.objectContaining({ collectedToday: expect.any(String), advances: expect.any(String) }));

    const asCashier = (await api().get("/api/v1/analytics/dashboard").set(cashier.auth)).body.data;
    expect(asCashier.payments).toBeDefined();
    expect(asCashier.profit).toBeUndefined();
    expect(asCashier.inventory.costValue).toBeUndefined();

    const asOps = (await api().get("/api/v1/analytics/dashboard").set(ops.auth)).body.data;
    expect(asOps.payments).toBeUndefined();
    expect(asOps.profit).toBeUndefined();
    expect(asOps.collectionsByMethod).toBeUndefined();
  });

  it("scopes stock and charts to a category", async () => {
    const scoped = (await api().get("/api/v1/analytics/dashboard").query({ categoryId }).set(admin.auth)).body.data;
    expect(scoped.inventory.products).toBe(4);
    expect(scoped.topProducts.length).toBeGreaterThan(0);
  });

  it("scopes sales and profit to one product's own lines, not the whole order", async () => {
    const a = await item({ regularPrice: "1180" });
    const b = await item({ regularPrice: "590" });
    await pos([
      { variantId: a.id, quantity: 2 },
      { variantId: b.id, quantity: 1 },
    ]);

    const scoped = (await api().get("/api/v1/analytics/dashboard").query({ productId: a.productId }).set(admin.auth)).body.data;
    expect(scoped.sales.today).toEqual({ grossSales: "2360.00", netSales: "2000.00", orders: 1 });
    expect(scoped.sales.lifetime).toEqual(scoped.sales.today);
    expect(scoped.sales.offline).toBe("2360.00");
    expect(scoped.topBy).toBe("variant");
    expect(scoped.topProducts).toEqual([{ label: "Default", netSales: "2000.00", units: 2 }]);
    expect(scoped.mixBy).toBe("channel");
    expect(scoped.categoryMix).toEqual([{ label: "STORE", netSales: "2000.00" }]);
    expect(scoped.profit).toMatchObject({
      grossProfit: "1000.00",
      marginPercent: "50.0",
      contributionProfit: null,
      potentialRevenue: "9440.00",
    });
    expect(scoped.inventory.available).toBe(8);

    const whole = (await api().get("/api/v1/analytics/dashboard").set(admin.auth)).body.data;
    expect(whole.mixBy).toBe("category");
    expect(whole.profit.contributionProfit).toEqual(expect.any(String));
  });

  it("keeps the financial views to admins", async () => {
    for (const path of ["profit", "breakdown", "valuation"]) {
      const res = await api().get(`/api/v1/analytics/${path}`).query({ from: today(), to: today() }).set(cashier.auth);
      expect(res.status).toBe(403);
    }
  });
});

describe("Reports", () => {
  it("lists every report to an admin and hides the financial ones from a cashier", async () => {
    const all = (await api().get("/api/v1/reports").set(admin.auth)).body.data as { key: string }[];
    expect(all.map((r) => r.key).sort()).toEqual([...REPORT_KEYS].sort());

    const forCashier = ((await api().get("/api/v1/reports").set(cashier.auth)).body.data as { key: string }[]).map((r) => r.key);
    expect(forCashier).not.toContain("profit-by-product");
    expect(forCashier).not.toContain("inventory-valuation");
    expect(forCashier).not.toContain("purchase-history");
    expect(forCashier).toContain("daily-sales");
    expect((await api().get("/api/v1/reports/profit-by-product").set(cashier.auth)).status).toBe(403);
    expect((await api().get("/api/v1/reports").set(ops.auth)).status).toBe(403);
  });

  it("previews and exports every report", async () => {
    for (const key of REPORT_KEYS) {
      const preview = await api().get(`/api/v1/reports/${key}`).query({ from: today(), to: today() }).set(admin.auth);
      expect(preview.status, key).toBe(200);
      expect(preview.body.data.key).toBe(key);
      const csv = await api().get(`/api/v1/reports/${key}`).query({ from: today(), to: today(), format: "csv" }).set(admin.auth);
      expect(csv.status, key).toBe(200);
      expect(csv.headers["content-type"]).toContain("text/csv");
    }
    const xlsx = await api().get("/api/v1/reports/variant-stock").query({ format: "xlsx" }).set(admin.auth);
    expect(xlsx.headers["content-type"]).toContain("spreadsheetml");
  });

  it("keeps cost columns from a cashier and masks customer phone numbers", async () => {
    const asAdmin = (await api().get("/api/v1/reports/variant-stock").query({ categoryId }).set(admin.auth)).body.data;
    const asCashier = (await api().get("/api/v1/reports/variant-stock").query({ categoryId }).set(cashier.auth)).body.data;
    expect(asAdmin.columns).toContain("Stock value");
    expect(asCashier.columns).not.toContain("Stock value");
    expect(asCashier.rows.length).toBe(asAdmin.rows.length);

    const purchases = (await api().get("/api/v1/reports/customer-purchases").query({ from: today(), to: today() }).set(admin.auth)).body
      .data;
    const mobile = purchases.columns.indexOf("Mobile");
    expect(purchases.rows.length).toBeGreaterThan(0);
    for (const row of purchases.rows) expect(String(row[mobile])).not.toMatch(/\d{6}/);
  });

  it("totals daily sales the same way as the sales summary", async () => {
    const report = (await api().get("/api/v1/reports/daily-sales").query({ from: today(), to: today() }).set(admin.auth)).body.data;
    const summary = (await api().get("/api/v1/sales/summary").query({ from: today(), to: today() }).set(admin.auth)).body.data;
    const net = report.columns.indexOf("Net sales excl. GST");
    expect(report.rows).toHaveLength(1);
    expect(dec(report.rows[0][net]).toFixed(2)).toBe(summary.netSales);
  });
});
