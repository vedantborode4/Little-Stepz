import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { netCommission } from "../src/modules/commission/commission.service";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashier: TestSession;
let categoryId: string;
let store: string;
let cash: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const post = (path: string, body: object, session = admin) => api().post(`/api/v1${path}`).set(session.auth).send(body);

beforeAll(async () => {
  [admin, cashier] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER")]);
  categoryId = (await post("/categories", { name: `LCE ${uid()}`, gstRate: "18" })).body.data.id;
  store = (await post("/settings/locations", { code: `LC${uid()}`, name: "Landed cost store", type: "STORE" })).body.data.id;
  cash = (await post("/settings/receiving-accounts", { name: `Cash ${uid()}`, method: "CASH" })).body.data.id;
});

/** ₹118 incl. 18% GST: ₹100 of goods value per unit. `unitCost` null = stock uploaded without a cost. */
async function item(stock: number, unitCost: string | null) {
  const res = await post("/products", {
    name: `LCE item ${uid()}`,
    categoryId,
    gstRate: null,
    variants: [{ sku: `LCE-${uid()}`, regularPrice: "118" }],
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const variant = res.body.data.variants[0] as { id: string; sku: string };
  if (stock)
    await post("/inventory/opening", { locationId: store, lines: [{ variantId: variant.id, quantity: stock, unitCost }] }).expect(201);
  return variant;
}

async function sale(variantId: string, quantity: number, salespersonId: string | null = null) {
  const res = await post("/sales/pos", {
    locationId: store,
    idempotencyKey: randomUUID(),
    lines: [{ variantId, quantity }],
    payments: [{ accountId: cash, amount: (118 * quantity).toFixed(2) }],
    salespersonId,
  });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; lines: { id: string }[] };
}

const giveBack = (orderId: string, orderLineId: string, quantity: number, condition = "RESELLABLE") =>
  post(`/sales/${orderId}/returns`, {
    reason: "Customer return",
    lines: [{ orderLineId, quantity, condition }],
    refund: { method: "REFUND", accountId: cash },
  }).expect(201);

const preview = (variantId: string, unitCost: string, session = admin) =>
  post(`/inventory/variants/${variantId}/landed-cost/preview`, { unitCost }, session);
const setCost = (variantId: string, unitCost: string, session = admin) =>
  post(`/inventory/variants/${variantId}/landed-cost`, { unitCost, reason: "Supplier bill found" }, session);

const costOf = (variantId: string) => prisma.variantCost.findUniqueOrThrow({ where: { variantId } });
const lineOf = (id: string) => prisma.salesOrderLine.findUniqueOrThrow({ where: { id }, include: { returnLines: true, landedCost: true } });

describe("setting a landed cost after the stock is in", () => {
  it("values unknown-cost stock and fills the sales, returns and commission that took it", async () => {
    const v = await item(10, null);
    const seller = (await post("/salespeople", { name: `Seller ${uid()}`, commissionRate: "10" })).body.data as { id: string };
    const order = await sale(v.id, 4, seller.id);
    const lineId = order.lines[0]!.id;
    await giveBack(order.id, lineId, 1);
    expect(await lineOf(lineId)).toMatchObject({ unknownCostQty: 4, returnLines: [{ unknownCostQty: 1 }] });
    expect((await netCommission(prisma, [seller.id])).get(seller.id)!.toFixed(2)).toBe("0.00");

    // 4 sold − 1 back = 3 out at ₹40: ₹120 of cost; what's left earns 10% of (₹300 − ₹120).
    const p = await preview(v.id, "40");
    expect(p.status).toBe(200);
    expect(p.body.data).toMatchObject({
      sku: v.sku,
      previousUnitCost: null,
      stockQty: 7,
      unknownStockQty: 7,
      stockValueBefore: "0.00",
      stockValueAfter: "280.00",
      filledSoldQty: 4,
      recostedSoldQty: 0,
      orders: 1,
      cogsChange: "120.00",
      untouchedHistoricalQty: 0,
      commission: [{ salespersonId: seller.id, change: "18.00" }],
    });
    // The preview saved nothing.
    expect(await costOf(v.id)).toMatchObject({ valuedQty: 0, unvaluedQty: 7 });
    expect(await prisma.landedCostEntry.count({ where: { variantId: v.id } })).toBe(0);

    const res = await setCost(v.id, "40");
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      code: expect.stringMatching(/^LCE-\d{5}$/),
      unitCost: "40.00",
      stockQty: 7,
      unknownStockQty: 7,
      stockValueChange: "280.00",
      filledSoldQty: 4,
      cogsChange: "120.00",
      reason: "Supplier bill found",
    });
    const cost = await costOf(v.id);
    expect([cost.valuedQty, cost.totalValue.toFixed(2), cost.unvaluedQty]).toEqual([7, "280.00", 0]);
    const line = await lineOf(lineId);
    expect([line.cogs!.toFixed(2), line.unknownCostQty]).toEqual(["160.00", 0]);
    expect([line.returnLines[0]!.cogs.toFixed(2), line.returnLines[0]!.unknownCostQty]).toEqual(["40.00", 0]);
    expect([line.landedCost!.quantity, line.landedCost!.unitCost.toFixed(2)]).toEqual([4, "40.00"]);
    expect((await netCommission(prisma, [seller.id])).get(seller.id)!.toFixed(2)).toBe("18.00");

    const card = (await api().get(`/api/v1/inventory/variants/${v.id}`).set(admin.auth)).body.data;
    expect(card.stock).toMatchObject({ avgUnitCost: "40.00", stockValue: "280.00", unvaluedQty: 0 });
    expect(card.landedCosts).toHaveLength(1);
  });

  it("re-costs sales an earlier entry costed, but never sales that left at a known cost", async () => {
    const v = await item(10, null);
    const first = await sale(v.id, 4);
    await giveBack(first.id, first.lines[0]!.id, 1, "WRITE_OFF");
    await setCost(v.id, "40").expect(201);

    // Sold after the cost was known: it leaves at the ₹40 average and is not the entry's to change.
    const later = await sale(v.id, 2);
    expect((await lineOf(later.lines[0]!.id)).cogs!.toFixed(2)).toBe("80.00");

    const res = await setCost(v.id, "50");
    // 4 re-costed units add ₹40; the written-off return's cost stays a loss, so nothing comes back out.
    expect(res.body.data).toMatchObject({
      previousUnitCost: "40.00",
      stockQty: 4,
      unknownStockQty: 0,
      stockValueChange: "40.00",
      filledSoldQty: 0,
      recostedSoldQty: 4,
      cogsChange: "40.00",
    });
    const recosted = await lineOf(first.lines[0]!.id);
    expect(recosted.cogs!.toFixed(2)).toBe("200.00");
    expect(recosted.returnLines[0]!.cogs.toFixed(2)).toBe("50.00");
    expect(recosted.landedCost).toMatchObject({ quantity: 4, entryId: res.body.data.id });
    expect((await lineOf(later.lines[0]!.id)).cogs!.toFixed(2)).toBe("80.00");
    expect((await costOf(v.id)).totalValue.toFixed(2)).toBe("200.00");

    const history = (await api().get(`/api/v1/inventory/variants/${v.id}`).set(admin.auth)).body.data.landedCosts;
    expect(history.map((h: { unitCost: string }) => h.unitCost)).toEqual(["50.00", "40.00"]);

    // Outside a landed-cost entry, sold costs stay locked and entries can't be edited.
    await expect(prisma.salesOrderLine.update({ where: { id: later.lines[0]!.id }, data: { cogs: 1 } })).rejects.toThrow(/locked/);
    await expect(prisma.salesReturnLine.update({ where: { id: recosted.returnLines[0]!.id }, data: { cogs: 1 } })).rejects.toThrow(
      /append-only/,
    );
    await expect(prisma.landedCostEntry.update({ where: { id: res.body.data.id }, data: { reason: "x" } })).rejects.toThrow(/append-only/);
  });

  it("revalues stock that came in with a cost, and refuses a cost that changes nothing", async () => {
    const v = await item(10, "50");
    const order = await sale(v.id, 3);
    const res = await setCost(v.id, "60");
    expect(res.body.data).toMatchObject({
      previousUnitCost: "50.00",
      stockQty: 7,
      stockValueChange: "70.00",
      filledSoldQty: 0,
      cogsChange: "0.00",
    });
    expect((await lineOf(order.lines[0]!.id)).cogs!.toFixed(2)).toBe("150.00");
    expect((await costOf(v.id)).totalValue.toFixed(2)).toBe("420.00");

    const again = await setCost(v.id, "60");
    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({
      code: "LANDED_COST_UNCHANGED",
      message: expect.stringMatching(/already at this landed cost/),
    });
    expect((await preview(v.id, "60")).body.error.code).toBe("LANDED_COST_UNCHANGED");

    const empty = await item(0, null);
    expect((await setCost(empty.id, "10")).body.error.message).toMatch(/nothing to cost/);
  });

  it("leaves workbook-imported past sales with their blank cost", async () => {
    const v = await item(5, null);
    const csv = [
      "Sale Date,Transaction ID,Product SKU,Quantity Sold,Actual Selling Price,Cash Amount",
      `2026-10-01,${uid()},${v.sku},2,118,236`,
    ].join("\n");
    const up = await api()
      .post("/api/v1/imports")
      .query({ kind: "HISTORICAL_SALES", fileName: "old.csv" })
      .set(admin.auth)
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from(csv));
    await api()
      .put(`/api/v1/imports/${up.body.data.id}/mapping`)
      .set(admin.auth)
      .send({ mapping: up.body.data.suggestedMapping, locationId: store, options: { payment2Account: cash } })
      .expect(200);
    await api().post(`/api/v1/imports/${up.body.data.id}/approve`).set(admin.auth).expect(200);

    expect((await preview(v.id, "30")).body.data).toMatchObject({ stockQty: 5, filledSoldQty: 0, untouchedHistoricalQty: 2 });
    await setCost(v.id, "30").expect(201);
    const historical = await prisma.salesOrderLine.findFirstOrThrow({
      where: { variantId: v.id, order: { importBatchId: up.body.data.id } },
    });
    expect(historical.unknownCostQty).toBe(2);
  });

  it("is for admins only, and only cost-seeing roles get the history", async () => {
    const v = await item(3, null);
    expect((await setCost(v.id, "10", cashier)).status).toBe(403);
    expect((await preview(v.id, "10", cashier)).status).toBe(403);
    expect((await post(`/inventory/variants/${v.id}/landed-cost`, { unitCost: "0", reason: "x" })).status).toBe(400);
    const card = (await api().get(`/api/v1/inventory/variants/${v.id}`).set(cashier.auth)).body.data;
    expect(card.landedCosts).toBeUndefined();
  });
});

describe("Landed costs import", () => {
  it("costs each SKU as the item action does, flags what it can't use, and can't be rolled back", async () => {
    const unknown = await item(4, null);
    const sameCost = await item(2, "25");
    const csv = [
      "SKU,Landed cost,Reason",
      `${unknown.sku},"₹1,016.6772",Bill from supplier`,
      `${sameCost.sku},25,`,
      `NOPE-${uid()},10,`,
      `${unknown.sku},12,`,
      `${sameCost.sku},0,`,
    ].join("\n");
    const up = await api()
      .post("/api/v1/imports")
      .query({ kind: "LANDED_COSTS", fileName: "costs.csv" })
      .set(admin.auth)
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from(csv));
    expect(up.body.data.suggestedMapping).toMatchObject({ sku: "SKU", unitCost: "Landed cost", reason: "Reason" });
    const checked = await api()
      .put(`/api/v1/imports/${up.body.data.id}/mapping`)
      .set(admin.auth)
      .send({ mapping: up.body.data.suggestedMapping });
    expect(checked.body.data).toMatchObject({ validRows: 1, duplicateRows: 1, errorRows: 3 });
    expect(checked.body.data.summary).toContain("4 unit(s) in stock with no cost get one.");

    const approved = await api().post(`/api/v1/imports/${up.body.data.id}/approve`).set(admin.auth);
    expect(approved.body.data).toMatchObject({ status: "IMPORTED", importedRows: 1 });
    const entry = await prisma.landedCostEntry.findFirstOrThrow({ where: { variantId: unknown.id } });
    expect([entry.unitCost.toFixed(4), entry.reason, entry.importBatchId]).toEqual(["1016.6772", "Bill from supplier", up.body.data.id]);
    expect((await costOf(unknown.id)).unvaluedQty).toBe(0);

    const rollback = await api().post(`/api/v1/imports/${up.body.data.id}/rollback`).set(admin.auth).send({ reason: "Oops" });
    expect(rollback.body.error.code).toBe("IMPORT_IN_USE");
  });
});
